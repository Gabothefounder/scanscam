export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Additive v2 system-analysis endpoint for internal radar.
 * Does not replace /api/intel/radar-weekly (fraud-analysis v1 path).
 */

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

type SystemAnalysisV2Response = {
  generated_at_utc: string;
  input_reality: {
    scan_count: number;
    full_message_pct: number | null;
    link_only_pct: number | null;
    fragment_pct: number | null;
    phone_only_pct: number | null;
    valid_input_pct: number | null;
    learning_input_pct: number | null;
    context_sufficient_pct: number | null;
  };
  classification_quality: {
    narrative_known_pct: number | null;
    authority_known_pct: number | null;
    payment_known_pct: number | null;
    avg_core_signal_count: number | null;
    classifiable_scan_count: number;
  };
  link_intelligence: {
    shortened_link_pct: number | null;
    suspicious_tld_pct: number | null;
    link_scan_count: number;
    top_domains: { root_domain: string; scan_count: number }[];
  };
  system_health: {
    medium_high_pct: number | null;
    fallback_rate_pct: number | null;
    avg_core_signal_count: number | null;
    learning_input_pct: number | null;
    context_sufficient_pct: number | null;
  };
  recent_signals: {
    created_at: string;
    risk_tier: string;
    summary_sentence: string | null;
    narrative_category: string;
    narrative_family: string;
    authority_type: string;
    payment_intent: string;
    input_type: string;
    root_domain: string | null;
    city: string | null;
    region_code: string | null;
    core_signal_count: number;
    context_quality: string;
    intel_state: string;
  }[];
  improvement_insights: {
    scan_count: number;
    dominant_gap: string | null;
    dominant_gap_pct: number | null;
    learning_input_pct: number | null;
    context_sufficient_pct: number | null;
    avg_core_signal_count: number | null;
    shortened_link_pct: number | null;
    suspicious_tld_pct: number | null;
  };
};

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "true";
  return false;
}

function normalizeRootDomain(v: unknown): string {
  const raw = v == null ? "" : String(v).trim().toLowerCase();
  if (!raw) return "";
  return raw
    .replace(/^[`"'([{<\s]+/g, "")
    .replace(/[`"')\]}>.,;:!?\\/\s]+$/g, "")
    .trim();
}

export async function GET() {
  try {
    const [
      systemQualityRes,
      improvementRes,
      recentRes,
      domainsRes,
    ] = await Promise.all([
      supabase
        .from("intel_v2_system_quality" as any)
        .select("*")
        .order("window_start", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("intel_v2_improvement_insights" as any)
        .select("*")
        .order("window_start", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("intel_v2_recent_scams" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("intel_v2_clean_scans" as any)
        .select("root_domain, created_at, is_learning_input, is_valid_input, link_present, context_quality, intel_state")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(5000),
    ]);

    const sq = (systemQualityRes.data ?? null) as Record<string, unknown> | null;
    const insight = (improvementRes.data ?? null) as Record<string, unknown> | null;
    const recentRows = (recentRes.data ?? []) as Record<string, unknown>[];
    const scopeRows = (domainsRes.data ?? []) as Record<string, unknown>[];

    let learningInputCount = 0;
    let contextSufficientCount = 0;
    let classifiableScanCount = 0;
    let linkScanCount = 0;
    const domainCounts = new Map<string, number>();
    for (const row of scopeRows) {
      if (toBool(row.is_learning_input)) learningInputCount += 1;
      if (toBool(row.is_valid_input)) classifiableScanCount += 1;
      if (toBool(row.link_present)) linkScanCount += 1;
      const contextQuality = String(row.context_quality ?? "unknown").toLowerCase();
      const intelState = String(row.intel_state ?? "unknown").toLowerCase();
      if ((contextQuality === "partial" || contextQuality === "full") && intelState !== "insufficient_context") {
        contextSufficientCount += 1;
      }

      const root = normalizeRootDomain(row.root_domain);
      if (!root || root === "unknown" || root === "none") continue;
      domainCounts.set(root, (domainCounts.get(root) ?? 0) + 1);
    }
    const topDomains = Array.from(domainCounts.entries())
      .map(([root_domain, scan_count]) => ({ root_domain, scan_count }))
      .sort((a, b) => b.scan_count - a.scan_count)
      .slice(0, 8);
    const learningInputPctFallback =
      scopeRows.length > 0 ? (learningInputCount / scopeRows.length) * 100 : null;
    const contextSufficientPctFallback =
      scopeRows.length > 0 ? (contextSufficientCount / scopeRows.length) * 100 : null;
    const learningInputPct = toNum(sq?.learning_input_pct) ?? learningInputPctFallback;
    const contextSufficientPct = toNum(sq?.context_sufficient_pct) ?? contextSufficientPctFallback;

    const payload: SystemAnalysisV2Response = {
      generated_at_utc: new Date().toISOString(),
      input_reality: {
        scan_count: Number(sq?.scan_count ?? 0),
        full_message_pct: toNum(sq?.full_message_pct),
        link_only_pct: toNum(sq?.link_only_pct),
        fragment_pct: toNum(sq?.fragment_pct),
        phone_only_pct: toNum(sq?.phone_only_pct),
        valid_input_pct: toNum(sq?.valid_input_pct),
        learning_input_pct: learningInputPct,
        context_sufficient_pct: contextSufficientPct,
      },
      classification_quality: {
        narrative_known_pct: toNum(sq?.narrative_known_pct_on_valid_inputs),
        authority_known_pct: toNum(sq?.authority_known_pct_on_valid_inputs),
        payment_known_pct: toNum(sq?.payment_known_pct_on_valid_inputs),
        avg_core_signal_count: toNum(sq?.avg_core_signal_count_on_valid_inputs),
        classifiable_scan_count: classifiableScanCount,
      },
      link_intelligence: {
        shortened_link_pct: toNum(sq?.shortened_link_pct),
        suspicious_tld_pct: toNum(sq?.suspicious_tld_pct),
        link_scan_count: linkScanCount,
        top_domains: topDomains,
      },
      system_health: {
        medium_high_pct: toNum(sq?.medium_high_pct),
        fallback_rate_pct: toNum(sq?.fallback_rate_pct),
        avg_core_signal_count: toNum(sq?.avg_core_signal_count_on_valid_inputs),
        learning_input_pct: learningInputPct,
        context_sufficient_pct: contextSufficientPct,
      },
      recent_signals: recentRows.map((r) => ({
        created_at: String(r.created_at ?? ""),
        risk_tier: String(r.risk_tier ?? "unknown"),
        summary_sentence: r.summary_sentence == null ? null : String(r.summary_sentence),
        narrative_category: String(r.narrative_category ?? "unknown"),
        narrative_family: String(r.narrative_family ?? "unknown"),
        authority_type: String(r.authority_type ?? "unknown"),
        payment_intent: String(r.payment_intent ?? "unknown"),
        input_type: String(r.input_type ?? "unknown"),
        root_domain: r.root_domain == null ? null : String(r.root_domain),
        city: r.city == null ? null : String(r.city),
        region_code: r.region_code == null ? null : String(r.region_code),
        core_signal_count: Number(r.core_signal_count ?? 0),
        context_quality: String(r.context_quality ?? "unknown"),
        intel_state: String(r.intel_state ?? "unknown"),
      })),
      improvement_insights: {
        scan_count: Number(sq?.scan_count ?? scopeRows.length),
        dominant_gap: insight?.dominant_gap == null ? null : String(insight.dominant_gap),
        dominant_gap_pct: toNum(insight?.dominant_gap_pct),
        learning_input_pct: learningInputPct,
        context_sufficient_pct: contextSufficientPct,
        avg_core_signal_count: toNum(sq?.avg_core_signal_count_on_valid_inputs),
        shortened_link_pct: toNum(sq?.shortened_link_pct),
        suspicious_tld_pct: toNum(sq?.suspicious_tld_pct),
      },
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error("[system-analysis-v2]", err);
    return NextResponse.json(
      {
        generated_at_utc: new Date().toISOString(),
        input_reality: {
          scan_count: 0,
          full_message_pct: null,
          link_only_pct: null,
          fragment_pct: null,
          phone_only_pct: null,
          valid_input_pct: null,
          learning_input_pct: null,
          context_sufficient_pct: null,
        },
        classification_quality: {
          narrative_known_pct: null,
          authority_known_pct: null,
          payment_known_pct: null,
          avg_core_signal_count: null,
          classifiable_scan_count: 0,
        },
        link_intelligence: {
          shortened_link_pct: null,
          suspicious_tld_pct: null,
          link_scan_count: 0,
          top_domains: [],
        },
        system_health: {
          medium_high_pct: null,
          fallback_rate_pct: null,
          avg_core_signal_count: null,
          learning_input_pct: null,
          context_sufficient_pct: null,
        },
        recent_signals: [],
        improvement_insights: {
          scan_count: 0,
          dominant_gap: null,
          dominant_gap_pct: null,
          learning_input_pct: null,
          context_sufficient_pct: null,
          avg_core_signal_count: null,
          shortened_link_pct: null,
          suspicious_tld_pct: null,
        },
      } satisfies SystemAnalysisV2Response,
      { status: 200 }
    );
  }
}
