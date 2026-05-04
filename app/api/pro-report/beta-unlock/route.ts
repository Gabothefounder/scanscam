import { NextRequest, NextResponse } from "next/server";
import { createProReportAccess } from "@/lib/proReports/createProReportAccess";
import { getServiceSupabase } from "@/lib/proReports/serviceSupabase";
import { buildReportAbsoluteUrl } from "@/lib/proReports/resolveReportSiteOrigin";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const USER_SITUATIONS = new Set([
  "pre_action",
  "clicked_no_info",
  "entered_info",
  "paid_or_financial",
  "checking_for_someone_else",
]);

const WILLINGNESS = new Set([
  "free_only",
  "five_report",
  "ten_twenty_fuller",
  "fifty_plus_evidence",
  "hundred_plus_serious_help",
]);

const DESIRED_HELP_IDS = new Set([
  "shareable_report",
  "video",
  "step_by_step",
  "bank_workplace",
  "family_protection",
  "checklist_24_48",
  "other",
]);

const MAX_WORRY = 2000;
const MAX_PRICE_REASON = 2000;
const MAX_OTHER = 500;
const MAX_DESIRED_HELP = 8;

type BetaSurveyInput = {
  user_situation: string;
  worry_text?: string;
  desired_help?: string[];
  desired_help_other?: string;
  willingness_to_pay: string;
  price_reason_text?: string;
};

function validateSurvey(raw: unknown): { ok: true; survey: BetaSurveyInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "beta_survey must be an object" };
  }
  const b = raw as Record<string, unknown>;
  const user_situation = String(b.user_situation ?? "").trim();
  if (!USER_SITUATIONS.has(user_situation)) {
    return { ok: false, error: "invalid user_situation" };
  }
  const willingness_to_pay = String(b.willingness_to_pay ?? "").trim();
  if (!WILLINGNESS.has(willingness_to_pay)) {
    return { ok: false, error: "invalid willingness_to_pay" };
  }

  let worry_text = typeof b.worry_text === "string" ? b.worry_text.trim() : "";
  if (worry_text.length > MAX_WORRY) return { ok: false, error: "worry_text too long" };

  let desired_help_other = typeof b.desired_help_other === "string" ? b.desired_help_other.trim() : "";
  if (desired_help_other.length > MAX_OTHER) return { ok: false, error: "desired_help_other too long" };

  let price_reason_text = typeof b.price_reason_text === "string" ? b.price_reason_text.trim() : "";
  if (price_reason_text.length > MAX_PRICE_REASON) return { ok: false, error: "price_reason_text too long" };

  const desired_help: string[] = [];
  if (Array.isArray(b.desired_help)) {
    for (const x of b.desired_help) {
      const id = String(x ?? "").trim();
      if (!id) continue;
      if (!DESIRED_HELP_IDS.has(id)) return { ok: false, error: "invalid desired_help entry" };
      if (!desired_help.includes(id)) desired_help.push(id);
      if (desired_help.length > MAX_DESIRED_HELP) return { ok: false, error: "too many desired_help selections" };
    }
  }

  return {
    ok: true,
    survey: {
      user_situation,
      worry_text: worry_text || undefined,
      desired_help: desired_help.length ? desired_help : undefined,
      desired_help_other: desired_help_other || undefined,
      willingness_to_pay,
      price_reason_text: price_reason_text || undefined,
    },
  };
}

/**
 * Public beta: create pro_report_access with survey stored in report_snapshot.beta_survey.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const scanId = String(o.scan_id ?? "").trim();
  if (!scanId || !UUID_RE.test(scanId)) {
    return NextResponse.json({ ok: false, error: "scan_id must be a UUID" }, { status: 400 });
  }

  const langRaw = typeof o.lang === "string" ? o.lang.trim().toLowerCase() : "";
  const lang: "en" | "fr" | undefined = langRaw === "fr" ? "fr" : langRaw === "en" ? "en" : undefined;

  const validated = validateSurvey(o.beta_survey);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data: scan, error: scanErr } = await supabase.from("scans").select("id").eq("id", scanId).maybeSingle();
  if (scanErr) {
    return NextResponse.json({ ok: false, error: "lookup failed" }, { status: 500 });
  }
  if (!scan) {
    return NextResponse.json({ ok: false, error: "scan not found" }, { status: 404 });
  }

  const submitted_at = new Date().toISOString();
  const beta_survey = {
    ...validated.survey,
    submitted_at,
  };

  const report_snapshot = {
    source: "beta_unlock",
    beta_survey,
  };

  try {
    const { token, expiresAt } = await createProReportAccess(scanId, { reportSnapshot: report_snapshot });
    /** Root-relative path so the client stays on the current host (local, preview, prod). */
    const url = buildReportAbsoluteUrl(null, token, lang);
    return NextResponse.json({
      ok: true,
      token,
      url,
      expires_at: expiresAt.toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "create failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
