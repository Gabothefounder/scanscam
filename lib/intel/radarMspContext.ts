import type { SupabaseClient } from "@supabase/supabase-js";

/** API contract for /api/intel/radar-msp-context */
export type RadarMspGlobal = {
  total_escalations: number;
  active_partners: number;
  risk_distribution: { risk_tier: string; count: number }[];
  top_narratives: { value: string; count: number }[];
  top_actions: { value: string; count: number }[];
  time_saved_minutes: number;
  time_saved_hours: number;
};

/** Per submitted_by_company (escalation rows only; not full client scan volume). */
export type ClientAccountEscalationRow = {
  company_display: string;
  escalation_count: number;
  high_risk_escalation_count: number;
  /** Modeled minutes for this company’s escalation rows only (4 min/escalation +3 min/refined escalation). */
  time_saved_minutes_escalation_slice: number;
};

export type RadarMspPartnerRow = {
  partner_slug: string;
  total_scans: number;
  total_escalations: number;
  escalation_rate: number | null;
  risk_distribution: { risk_tier: string; count: number }[];
  top_narrative: string;
  top_action: string;
  refined_escalations: number;
  time_saved_minutes: number;
  time_saved_hours: number;
  /** Top client labels from escalation submissions only; empty when no rows. */
  client_accounts_escalation?: ClientAccountEscalationRow[];
  /** True when more client buckets exist than included in `client_accounts_escalation`. */
  client_accounts_escalation_truncated?: boolean;
};

export type RadarMspContextResponse = {
  generated_at_utc: string;
  /** Reporting window copy for the UI / exports (full history until a real period filter exists). */
  period_label?: string;
  global: RadarMspGlobal;
  per_partner: RadarMspPartnerRow[];
  /** Roll-up of `client_accounts_escalation` across all partners (same methodology as per-partner). */
  client_accounts_escalation_all_partners?: ClientAccountEscalationRow[];
  client_accounts_escalation_all_partners_truncated?: boolean;
  /** Funnel counts from `events` only (no extra tables). */
  context_layer: {
    context_refinement_shown: number;
    context_refinement_submitted: number;
    context_refinement_completed_analysis: number;
  };
};

/** Display when `submitted_by_company` is missing or blank (stable bucket). */
export const ESCALATION_COMPANY_NOT_PROVIDED = "(company not provided)";

/** Max client-account rows in API payloads, clean report, and internal UIs (sorted, capped). */
export const MSP_CLIENT_ACCOUNTS_TOP_SHOWN = 5;

const PAGE = 1000;
const SCAN_BATCH = 200;

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Canonical grouping key (escalation table may be null → placeholder). */
function normalizeSlugKey(raw: string | null | undefined): string {
  const s = raw?.trim().toLowerCase();
  return s ? s : "(no slug)";
}

function normalizeTaxon(raw: unknown): string {
  const s = raw == null ? "" : String(raw).trim().toLowerCase();
  if (!s || s === "unknown" || s === "none") return "unknown";
  return s;
}

function bump(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function topFromMap(map: Map<string, number>, limit: number): { value: string; count: number }[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function riskListFromMap(riskMap: Map<string, number>, limit = 20): { risk_tier: string; count: number }[] {
  return [...riskMap.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([risk_tier, count]) => ({ risk_tier, count }));
}

/** Partner slug from scan landing_path `/partner/{slug}…` */
export function slugFromLandingPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const m = /^\/partner\/([^/?#]+)/i.exec(String(path).trim());
  return m ? decodeURIComponent(m[1]).trim().toLowerCase() : null;
}

export function computeTimeSavedMinutes(
  nonEscalatedScans: number,
  escalatedScans: number,
  refinedEscalatedScans: number
): { time_saved_minutes: number; time_saved_hours: number } {
  const ne = Math.max(0, nonEscalatedScans);
  const es = Math.max(0, escalatedScans);
  const re = Math.max(0, Math.min(refinedEscalatedScans, es));
  const rawMinutes = ne * 5 + es * 4 + re * 3;
  const time_saved_minutes = Math.max(0, rawMinutes);
  const time_saved_hours = Math.max(0, Math.round((time_saved_minutes / 60) * 10) / 10);
  return { time_saved_minutes, time_saved_hours };
}

function topSingleLabel(rows: { value: string; count: number }[]): string {
  const first = rows.find((r) => r.value && r.value !== "unknown");
  if (!first) return "unknown";
  return first.value.replace(/_/g, " ");
}

type PartnerEscalationRow = {
  scan_id: string;
  partner_slug: string | null;
  submitted_by_company: string | null;
};

async function fetchAllEscalations(supabase: SupabaseClient): Promise<PartnerEscalationRow[]> {
  const out: PartnerEscalationRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("partner_escalation_access")
      .select("scan_id, partner_slug, submitted_by_company")
      .order("scan_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...(data as PartnerEscalationRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

export function normalizeEscalationCompanyDisplay(raw: string | null | undefined): string {
  const s = raw == null ? "" : String(raw).trim();
  return s ? s : ESCALATION_COMPANY_NOT_PROVIDED;
}

function isHighRiskEscalationTier(riskTier: string | null | undefined): boolean {
  const t = (riskTier ?? "").trim().toLowerCase();
  return t === "high";
}

/**
 * Aggregate escalation rows by `submitted_by_company` for one partner (or all partners when `partnerSlugKey` is null).
 * Counts are **row-based** (multiple rows for the same scan_id each count).
 */
function aggregateClientAccountsFromEscalations(
  rows: PartnerEscalationRow[],
  partnerSlugKey: string | null,
  scanById: Map<string, { id: string; risk_tier: string | null; intel_features: Record<string, unknown> | null }>,
  refinedScanIds: Set<string>,
  limit: number
): { items: ClientAccountEscalationRow[]; truncated: boolean } {
  type Acc = { escalation_count: number; high_risk_escalation_count: number; refined_escalations: number };
  const map = new Map<string, Acc>();

  for (const r of rows) {
    const sid = r.scan_id;
    if (!sid) continue;
    const slug = normalizeSlugKey(r.partner_slug);
    if (partnerSlugKey !== null && slug !== partnerSlugKey) continue;

    const company = normalizeEscalationCompanyDisplay(r.submitted_by_company);
    if (!map.has(company)) {
      map.set(company, { escalation_count: 0, high_risk_escalation_count: 0, refined_escalations: 0 });
    }
    const acc = map.get(company)!;
    acc.escalation_count += 1;
    const scan = scanById.get(sid);
    if (isHighRiskEscalationTier(scan?.risk_tier)) acc.high_risk_escalation_count += 1;
    if (refinedScanIds.has(sid)) acc.refined_escalations += 1;
  }

  const full = [...map.entries()]
    .map(([company_display, a]) => {
      const t = computeTimeSavedMinutes(0, a.escalation_count, a.refined_escalations);
      return {
        company_display,
        escalation_count: a.escalation_count,
        high_risk_escalation_count: a.high_risk_escalation_count,
        time_saved_minutes_escalation_slice: t.time_saved_minutes,
      };
    })
    .sort(
      (x, y) =>
        y.escalation_count - x.escalation_count ||
        y.high_risk_escalation_count - x.high_risk_escalation_count ||
        x.company_display.localeCompare(y.company_display, undefined, { sensitivity: "base" })
    );

  const truncated = full.length > limit;
  return { items: full.slice(0, limit), truncated };
}

/** scan_id → partner slug key for escalations */
function escalationBuckets(rows: PartnerEscalationRow[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const r of rows) {
    const slug = normalizeSlugKey(r.partner_slug);
    const sid = r.scan_id;
    if (!sid) continue;
    if (!m.has(slug)) m.set(slug, new Set());
    m.get(slug)!.add(sid);
  }
  return m;
}

async function fetchPartnerLandingScanMap(supabase: SupabaseClient): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("scans")
      .select("id, landing_path")
      .not("landing_path", "is", null)
      .ilike("landing_path", "/partner/%")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data as { id: string; landing_path: string | null }[]) {
      const slug = slugFromLandingPath(row.landing_path);
      if (!slug) continue;
      const key = normalizeSlugKey(slug);
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(row.id);
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return map;
}

async function fetchScansByIds(
  supabase: SupabaseClient,
  scanIds: string[]
): Promise<{ id: string; risk_tier: string | null; intel_features: Record<string, unknown> | null }[]> {
  const rows: { id: string; risk_tier: string | null; intel_features: Record<string, unknown> | null }[] = [];
  for (const batch of chunks(scanIds, SCAN_BATCH)) {
    const { data, error } = await supabase
      .from("scans")
      .select("id, risk_tier, intel_features")
      .in("id", batch);
    if (error) throw error;
    for (const r of data ?? []) {
      rows.push(r as { id: string; risk_tier: string | null; intel_features: Record<string, unknown> | null });
    }
  }
  return rows;
}

async function countEventType(supabase: SupabaseClient, eventType: string): Promise<number> {
  const { count, error } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", eventType);
  if (error) throw error;
  return count ?? 0;
}

/** All scan_ids that have a refinement-completed event (events.scan_id set). */
async function fetchRefinementCompletedScanIds(supabase: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("events")
      .select("scan_id")
           .eq("event_type", "context_refinement_completed_analysis")
      .not("scan_id", "is", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      const id = (row as { scan_id?: string }).scan_id;
      if (id) ids.add(id);
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return ids;
}

function accumulateIntelForScanIds(
  scanIds: string[],
  scanById: Map<
    string,
    { id: string; risk_tier: string | null; intel_features: Record<string, unknown> | null }
  >
): {
  riskMap: Map<string, number>;
  narrativeMap: Map<string, number>;
  actionMap: Map<string, number>;
} {
  const riskMap = new Map<string, number>();
  const narrativeMap = new Map<string, number>();
  const actionMap = new Map<string, number>();
  for (const sid of scanIds) {
    const s = scanById.get(sid);
    if (!s) continue;
    const tier = (s.risk_tier ?? "unknown").trim().toLowerCase() || "unknown";
    bump(riskMap, tier);
    const intel = s.intel_features ?? {};
    bump(narrativeMap, normalizeTaxon(intel.narrative_category));
    bump(actionMap, normalizeTaxon(intel.requested_action));
  }
  return { riskMap, narrativeMap, actionMap };
}

export async function buildRadarMspContextPayload(supabase: SupabaseClient): Promise<RadarMspContextResponse> {
  const escalations = await fetchAllEscalations(supabase);
  const total_escalations = escalations.length;
  const escBuckets = escalationBuckets(escalations);
  const landingBuckets = await fetchPartnerLandingScanMap(supabase);

  const allPartnerKeys = new Set<string>([...escBuckets.keys(), ...landingBuckets.keys()]);
  const refinedScanIds = await fetchRefinementCompletedScanIds(supabase);

  const allEscalatedScanIds = [...new Set(escalations.map((e) => e.scan_id).filter(Boolean))];
  const scanRowsForGlobal = await fetchScansByIds(supabase, allEscalatedScanIds);
  const scanByIdGlobal = new Map(scanRowsForGlobal.map((s) => [s.id, s]));
  const globalIntel = accumulateIntelForScanIds(allEscalatedScanIds, scanByIdGlobal);

  const globalRefined = allEscalatedScanIds.filter((id) => refinedScanIds.has(id)).length;

  const allLandingIds = new Set<string>();
  for (const set of landingBuckets.values()) for (const id of set) allLandingIds.add(id);

  const partnerFlowUnion = new Set<string>([...allLandingIds, ...allEscalatedScanIds]);
  const total_partner_flow_scans = partnerFlowUnion.size;
  const non_escalated_global = Math.max(0, total_partner_flow_scans - total_escalations);
  const globalTime = computeTimeSavedMinutes(non_escalated_global, total_escalations, globalRefined);

  const active_partners = [...escBuckets.entries()].filter(([, set]) => set.size > 0).length;

  const per_partner: RadarMspPartnerRow[] = [];

  const sortedPartnerKeys = [...allPartnerKeys].sort((a, b) => a.localeCompare(b));

  for (const slugKey of sortedPartnerKeys) {
    const escSet = escBuckets.get(slugKey) ?? new Set<string>();
    const landSet = landingBuckets.get(slugKey) ?? new Set<string>();
    const union = new Set<string>([...escSet, ...landSet]);
    const total_scans = union.size;
    const total_escalations_p = escSet.size;
    const escalation_rate =
      total_scans > 0 ? Math.round((total_escalations_p / total_scans) * 1000) / 1000 : null;

    const escIds = [...escSet];
    const { riskMap, narrativeMap, actionMap } = accumulateIntelForScanIds(escIds, scanByIdGlobal);
    const topNarrRows = topFromMap(narrativeMap, 8);
    const topActRows = topFromMap(actionMap, 8);

    let refined_escalations = 0;
    for (const id of escSet) {
      if (refinedScanIds.has(id)) refined_escalations += 1;
    }

    const non_esc = Math.max(0, total_scans - total_escalations_p);
    const t = computeTimeSavedMinutes(non_esc, total_escalations_p, refined_escalations);

    const clientAgg = aggregateClientAccountsFromEscalations(
      escalations,
      slugKey,
      scanByIdGlobal,
      refinedScanIds,
      MSP_CLIENT_ACCOUNTS_TOP_SHOWN
    );

    per_partner.push({
      partner_slug: slugKey,
      total_scans,
      total_escalations: total_escalations_p,
      escalation_rate,
      risk_distribution: riskListFromMap(riskMap, 20),
      top_narrative: topSingleLabel(topNarrRows),
      top_action: topSingleLabel(topActRows),
      refined_escalations,
      time_saved_minutes: t.time_saved_minutes,
      time_saved_hours: t.time_saved_hours,
      client_accounts_escalation: clientAgg.items,
      client_accounts_escalation_truncated: clientAgg.truncated,
    });
  }

  per_partner.sort((a, b) => b.total_escalations - a.total_escalations || a.partner_slug.localeCompare(b.partner_slug));

  const allPartnersClientAgg = aggregateClientAccountsFromEscalations(
    escalations,
    null,
    scanByIdGlobal,
    refinedScanIds,
    MSP_CLIENT_ACCOUNTS_TOP_SHOWN
  );

  const [shown, submitted, completed] = await Promise.all([
    countEventType(supabase, "context_refinement_shown"),
    countEventType(supabase, "context_refinement_submitted"),
    countEventType(supabase, "context_refinement_completed_analysis"),
  ]);

  return {
    generated_at_utc: new Date().toISOString(),
    period_label: "All available pilot data",
    global: {
      total_escalations,
      active_partners,
      risk_distribution: riskListFromMap(globalIntel.riskMap, 20),
      top_narratives: topFromMap(globalIntel.narrativeMap, 8),
      top_actions: topFromMap(globalIntel.actionMap, 8),
      time_saved_minutes: globalTime.time_saved_minutes,
      time_saved_hours: globalTime.time_saved_hours,
    },
    per_partner,
    client_accounts_escalation_all_partners: allPartnersClientAgg.items,
    client_accounts_escalation_all_partners_truncated: allPartnersClientAgg.truncated,
    context_layer: {
      context_refinement_shown: shown,
      context_refinement_submitted: submitted,
      context_refinement_completed_analysis: completed,
    },
  };
}

/** Roll-up row for “all partners” report / UI (sums per-partner tallies; OK when partner buckets are disjoint). */
export function buildAllPartnersReportRow(data: RadarMspContextResponse): RadarMspPartnerRow {
  const total_scans = data.per_partner.reduce((acc, p) => acc + p.total_scans, 0);
  const refined_escalations = data.per_partner.reduce((acc, p) => acc + p.refined_escalations, 0);
  return {
    partner_slug: "(all partners)",
    total_scans,
    total_escalations: data.global.total_escalations,
    escalation_rate:
      total_scans > 0 ? Math.round((data.global.total_escalations / total_scans) * 1000) / 1000 : null,
    risk_distribution: data.global.risk_distribution,
    top_narrative: data.global.top_narratives[0]?.value.replace(/_/g, " ") ?? "unknown",
    top_action: data.global.top_actions[0]?.value.replace(/_/g, " ") ?? "unknown",
    refined_escalations,
    time_saved_minutes: data.global.time_saved_minutes,
    time_saved_hours: data.global.time_saved_hours,
    client_accounts_escalation: data.client_accounts_escalation_all_partners ?? [],
    client_accounts_escalation_truncated: data.client_accounts_escalation_all_partners_truncated,
  };
}
