/**
 * Server-only helpers for GET /api/internal/radar-decision-report-beta.
 * Parses pro_report_access + scans into a privacy-safe radar payload (no free text, no raw JSON blobs).
 */

export const DECISION_REPORT_BETA_RADAR_ROW_LIMIT = 250;

export type DecisionReportBetaRadarResponse = {
  ok: true;
  generated_at_utc: string;
  window: {
    row_limit: number;
    ordered_by: "pro_report_access.created_at_desc";
  };
  aggregates: {
    row_count: number;
    with_beta_survey: number;
    with_report_feedback: number;
    feedback_rating: {
      yes: number;
      somewhat: number;
      no: number;
      unknown: number;
    };
    feedback_useful_true: number;
    feedback_useful_false: number;
    risk_tier: {
      high: number;
      medium: number;
      low: number;
      unknown: number;
    };
    beta_survey: {
      user_situation: Record<string, number>;
      /** Derived from first-line `usefulness:` slug in price_reason_text; never exposes raw text. */
      use_context: Record<string, number>;
      desired_help_ids: Record<string, number>;
    };
  };
  recent: Array<{
    access_id: string;
    scan_id: string;
    created_at: string;
    expires_at: string | null;
    report_kind: string | null;
    has_beta_survey: boolean;
    beta_survey_meta?: {
      user_situation: string | null;
      /** `self_only` | … | `legacy` | `unknown` — from usefulness slug or legacy willingness mapping. */
      use_context: string;
      desired_help_count: number;
      has_worry_text: boolean;
      has_price_reason_text: boolean;
      has_desired_help_other: boolean;
    };
    feedback_meta?: {
      rating: "yes" | "somewhat" | "no" | null;
      useful: boolean | null;
      has_feedback_text: boolean;
      worth_five?: string | null;
      submitted_at?: string | null;
    };
    scan?: {
      risk_tier: string | null;
      language: string | null;
      created_at: string | null;
      input_type?: string | null;
      context_quality?: string | null;
      intel_state?: string | null;
    } | null;
  }>;
};

export type ProReportAccessRadarRow = {
  id: string;
  scan_id: string;
  created_at: string;
  expires_at: string | null;
  report_kind: string | null;
  report_snapshot: unknown | null;
};

export type ScanRadarJoinRow = {
  id: string;
  risk_tier: string | null;
  language: string | null;
  created_at: string | null;
  intel_features: Record<string, unknown> | null;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function bump(map: Record<string, number>, key: string, by = 1) {
  if (!key) return;
  map[key] = (map[key] ?? 0) + by;
}

const USEFULNESS_PREFIX = "usefulness:";
const USE_CONTEXT_SLUGS = new Set([
  "self_only",
  "family_friend",
  "workplace_it",
  "bank_support_provider",
  "personal_records",
  "other",
]);

/**
 * Q4 use context from first line of `price_reason_text` only (`usefulness:<slug>`).
 * Ignores any newline-separated free text. Never returns raw `price_reason_text`.
 */
function deriveUseContext(raw: Record<string, unknown>): string {
  const prtFull = typeof raw.price_reason_text === "string" ? raw.price_reason_text : "";
  const firstLine = prtFull.split(/\r?\n/)[0]?.trim() ?? "";
  if (firstLine.startsWith(USEFULNESS_PREFIX)) {
    const slug = firstLine.slice(USEFULNESS_PREFIX.length).trim();
    if (USE_CONTEXT_SLUGS.has(slug)) return slug;
    return "unknown";
  }
  const wtp = String(raw.willingness_to_pay ?? "").trim();
  if (wtp) return "legacy";
  return "unknown";
}

function normTier(t: string | null | undefined): "high" | "medium" | "low" | "unknown" {
  const s = String(t ?? "").trim().toLowerCase();
  if (s === "high") return "high";
  if (s === "medium") return "medium";
  if (s === "low") return "low";
  return "unknown";
}

function extractIntelScalars(intel: Record<string, unknown> | null): {
  input_type: string | null;
  context_quality: string | null;
  intel_state: string | null;
} {
  if (!intel) {
    return { input_type: null, context_quality: null, intel_state: null };
  }
  const clip = (v: unknown, max = 80): string | null => {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s) return null;
    return s.length > max ? s.slice(0, max) : s;
  };
  return {
    input_type: clip(intel.input_type),
    context_quality: clip(intel.context_quality),
    intel_state: clip(intel.intel_state),
  };
}

function parseReportFeedback(raw: unknown): {
  rating: "yes" | "somewhat" | "no" | null;
  useful: boolean | null;
  has_feedback_text: boolean;
  worth_five: string | null;
  submitted_at: string | null;
} | null {
  if (!isRecord(raw)) return null;
  const ratingRaw = String(raw.rating ?? "").trim().toLowerCase();
  let rating: "yes" | "somewhat" | "no" | null = null;
  if (ratingRaw === "yes" || ratingRaw === "somewhat" || ratingRaw === "no") {
    rating = ratingRaw;
  }
  const useful =
    typeof raw.useful === "boolean" ? raw.useful : raw.useful == null ? null : typeof raw.useful === "string"
      ? raw.useful.toLowerCase() === "true"
      : null;
  const ft = raw.feedback_text;
  const has_feedback_text = typeof ft === "string" && ft.trim().length > 0;
  const wf = raw.worth_five;
  const worth_five =
    wf == null || wf === ""
      ? null
      : typeof wf === "string"
        ? wf.trim().slice(0, 64) || null
        : String(wf).trim().slice(0, 64) || null;
  const sa = raw.submitted_at;
  const submitted_at = typeof sa === "string" && sa.trim() ? sa.trim() : null;
  if (rating == null && useful == null && !has_feedback_text && worth_five == null && submitted_at == null) {
    return null;
  }
  return { rating, useful, has_feedback_text, worth_five, submitted_at };
}

function parseBetaSurvey(raw: unknown): {
  user_situation: string | null;
  use_context: string;
  desired_help: string[];
  has_worry_text: boolean;
  has_price_reason_text: boolean;
  has_desired_help_other: boolean;
} | null {
  if (!isRecord(raw)) return null;
  const user_situation = String(raw.user_situation ?? "").trim() || null;
  const willingness_to_pay = String(raw.willingness_to_pay ?? "").trim() || null;
  const desired_help: string[] = [];
  if (Array.isArray(raw.desired_help)) {
    for (const x of raw.desired_help) {
      const id = String(x ?? "").trim();
      if (id && !desired_help.includes(id)) desired_help.push(id);
    }
  }
  const worry_text = typeof raw.worry_text === "string" ? raw.worry_text.trim() : "";
  const price_reason_text = typeof raw.price_reason_text === "string" ? raw.price_reason_text.trim() : "";
  const desired_help_other = typeof raw.desired_help_other === "string" ? raw.desired_help_other.trim() : "";
  if (!user_situation && !willingness_to_pay && desired_help.length === 0) return null;
  const use_context = deriveUseContext(raw);
  return {
    user_situation,
    use_context,
    desired_help,
    has_worry_text: worry_text.length > 0,
    has_price_reason_text: price_reason_text.length > 0,
    has_desired_help_other: desired_help_other.length > 0,
  };
}

function isBetaUnlockSnapshot(snapshot: unknown): boolean {
  if (!isRecord(snapshot)) return false;
  return String(snapshot.source ?? "").trim() === "beta_unlock";
}

export function filterBetaUnlockRows(rows: ProReportAccessRadarRow[]): ProReportAccessRadarRow[] {
  return rows.filter((r) => isBetaUnlockSnapshot(r.report_snapshot));
}

export function buildDecisionReportBetaRadarPayload(
  rows: ProReportAccessRadarRow[],
  scansById: Map<string, ScanRadarJoinRow>
): DecisionReportBetaRadarResponse {
  const betaRows = filterBetaUnlockRows(rows).slice(0, DECISION_REPORT_BETA_RADAR_ROW_LIMIT);

  const user_situation: Record<string, number> = {};
  const use_context: Record<string, number> = {};
  const desired_help_ids: Record<string, number> = {};

  const feedback_rating = { yes: 0, somewhat: 0, no: 0, unknown: 0 };
  let feedback_useful_true = 0;
  let feedback_useful_false = 0;
  const risk_tier = { high: 0, medium: 0, low: 0, unknown: 0 };

  let with_beta_survey = 0;
  let with_report_feedback = 0;

  const recent: DecisionReportBetaRadarResponse["recent"] = [];

  for (const row of betaRows) {
    const snap = row.report_snapshot;
    const survey = isRecord(snap) ? parseBetaSurvey(snap.beta_survey) : null;
    if (survey) {
      with_beta_survey += 1;
      if (survey.user_situation) bump(user_situation, survey.user_situation);
      bump(use_context, survey.use_context);
      for (const id of survey.desired_help) {
        bump(desired_help_ids, id);
      }
    }

    const fb = isRecord(snap) ? parseReportFeedback(snap.report_feedback) : null;
    if (fb) {
      with_report_feedback += 1;
      if (fb.rating === "yes") feedback_rating.yes += 1;
      else if (fb.rating === "somewhat") feedback_rating.somewhat += 1;
      else if (fb.rating === "no") feedback_rating.no += 1;
      else feedback_rating.unknown += 1;
      if (fb.useful === true) feedback_useful_true += 1;
      else if (fb.useful === false) feedback_useful_false += 1;
    }

    const scan = scansById.get(row.scan_id) ?? null;
    const tier = normTier(scan?.risk_tier ?? null);
    risk_tier[tier] += 1;

    const intelRec =
      scan?.intel_features && isRecord(scan.intel_features) ? (scan.intel_features as Record<string, unknown>) : null;
    const intelScalars = extractIntelScalars(intelRec);

    const entry: DecisionReportBetaRadarResponse["recent"][0] = {
      access_id: row.id,
      scan_id: row.scan_id,
      created_at: row.created_at,
      expires_at: row.expires_at,
      report_kind: row.report_kind,
      has_beta_survey: Boolean(survey),
    };

    if (survey) {
      entry.beta_survey_meta = {
        user_situation: survey.user_situation,
        use_context: survey.use_context,
        desired_help_count: survey.desired_help.length,
        has_worry_text: survey.has_worry_text,
        has_price_reason_text: survey.has_price_reason_text,
        has_desired_help_other: survey.has_desired_help_other,
      };
    }

    if (fb) {
      entry.feedback_meta = {
        rating: fb.rating,
        useful: fb.useful,
        has_feedback_text: fb.has_feedback_text,
        worth_five: fb.worth_five ?? undefined,
        submitted_at: fb.submitted_at ?? undefined,
      };
    }

    if (scan) {
      entry.scan = {
        risk_tier: scan.risk_tier,
        language: scan.language,
        created_at: scan.created_at,
        input_type: intelScalars.input_type ?? undefined,
        context_quality: intelScalars.context_quality ?? undefined,
        intel_state: intelScalars.intel_state ?? undefined,
      };
    } else {
      entry.scan = null;
    }

    recent.push(entry);
  }

  return {
    ok: true,
    generated_at_utc: new Date().toISOString(),
    window: {
      row_limit: DECISION_REPORT_BETA_RADAR_ROW_LIMIT,
      ordered_by: "pro_report_access.created_at_desc",
    },
    aggregates: {
      row_count: betaRows.length,
      with_beta_survey,
      with_report_feedback,
      feedback_rating,
      feedback_useful_true,
      feedback_useful_false,
      risk_tier,
      beta_survey: {
        user_situation,
        use_context,
        desired_help_ids,
      },
    },
    recent,
  };
}
