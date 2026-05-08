import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/proReports/serviceSupabase";
import { createProReportAccess } from "@/lib/proReports/createProReportAccess";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const Q1_SITUATIONS = new Set([
  "quick_check",
  "suspicious_message",
  "suspicious_call",
  "pressure_to_act",
  "already_acted",
  "checking_for_someone_else",
  "report_or_keep_proof",
  "work_or_client",
  "other",
]);

const Q3_HELP_OPTIONS = new Set([
  "risk_check",
  "suspicious_signals",
  "next_step",
  "share_report",
  "report_scam",
  "limit_damage",
  "guided_until_resolved",
  "human_case_support",
  "deeper_check",
  "protect_others",
  "other",
]);

const Q4_PRICE_RANGES = new Set([
  "free_only",
  "price_0_5",
  "price_5_10",
  "price_10_25",
  "around_50",
  "monthly_5_10",
  "monthly_10_20",
  "monthly_50_plus",
  "high_end_150_500",
  "not_sure",
]);

const MAX_PROBLEM_TEXT = 2000;
const MAX_HELP_OTHER = 500;
const MAX_HELP_OPTIONS = 3;
const MAX_USER_AGENT = 512;
const MAX_REFERRER = 1024;
const SOURCE_DEFAULT = "post_scan_full_report_gate";

type ResponseInsert = {
  scan_id: string;
  lang: "en" | "fr" | null;
  source: string;
  q1_situation: string;
  q2_problem_text: string | null;
  q3_help_options: string[];
  q3_help_other: string | null;
  q4_price_range: string;
  user_agent: string | null;
  referrer: string | null;
};

function trimToMax(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const t = value.trim();
  return t.length > max ? "" : t;
}

/**
 * POST /api/user-research/response
 *
 * Stores a single product-market-fit research response per scan in
 * `public.user_research_responses`. No payment, no token, no account.
 * On duplicate scan_id (unique violation 23505) returns { ok: true, already: true }
 * so the client can idempotently retry / re-render.
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
  const lang: "en" | "fr" | null = langRaw === "fr" ? "fr" : langRaw === "en" ? "en" : null;

  const q1 = String(o.q1_situation ?? "").trim();
  if (!Q1_SITUATIONS.has(q1)) {
    return NextResponse.json({ ok: false, error: "invalid q1_situation" }, { status: 400 });
  }

  const q4 = String(o.q4_price_range ?? "").trim();
  if (!Q4_PRICE_RANGES.has(q4)) {
    return NextResponse.json({ ok: false, error: "invalid q4_price_range" }, { status: 400 });
  }

  const q2Raw = typeof o.q2_problem_text === "string" ? o.q2_problem_text.trim() : "";
  if (q2Raw.length > MAX_PROBLEM_TEXT) {
    return NextResponse.json({ ok: false, error: "q2_problem_text too long" }, { status: 400 });
  }
  const q2 = q2Raw.length > 0 ? q2Raw : null;

  const helpOtherRaw = typeof o.q3_help_other === "string" ? o.q3_help_other.trim() : "";
  if (helpOtherRaw.length > MAX_HELP_OTHER) {
    return NextResponse.json({ ok: false, error: "q3_help_other too long" }, { status: 400 });
  }

  const help: string[] = [];
  if (Array.isArray(o.q3_help_options)) {
    for (const x of o.q3_help_options) {
      const id = String(x ?? "").trim();
      if (!id) continue;
      if (!Q3_HELP_OPTIONS.has(id)) {
        return NextResponse.json({ ok: false, error: "invalid q3_help_options entry" }, { status: 400 });
      }
      if (!help.includes(id)) help.push(id);
      if (help.length > MAX_HELP_OPTIONS) {
        return NextResponse.json(
          { ok: false, error: `q3_help_options exceeds max of ${MAX_HELP_OPTIONS}` },
          { status: 400 }
        );
      }
    }
  } else if (o.q3_help_options !== undefined) {
    return NextResponse.json({ ok: false, error: "q3_help_options must be an array" }, { status: 400 });
  }

  const helpOther = help.includes("other") && helpOtherRaw.length > 0 ? helpOtherRaw : null;

  const ua = trimToMax(req.headers.get("user-agent"), MAX_USER_AGENT) || null;
  const ref = trimToMax(req.headers.get("referer"), MAX_REFERRER) || null;

  const supabase = getServiceSupabase();
  const { data: scan, error: scanErr } = await supabase
    .from("scans")
    .select("id")
    .eq("id", scanId)
    .maybeSingle();
  if (scanErr) {
    return NextResponse.json({ ok: false, error: "lookup failed" }, { status: 500 });
  }
  if (!scan) {
    return NextResponse.json({ ok: false, error: "scan not found" }, { status: 404 });
  }

  const row: ResponseInsert = {
    scan_id: scanId,
    lang,
    source: SOURCE_DEFAULT,
    q1_situation: q1,
    q2_problem_text: q2,
    q3_help_options: help,
    q3_help_other: helpOther,
    q4_price_range: q4,
    user_agent: ua,
    referrer: ref,
  };

  const { error: insertErr } = await supabase
    .from("user_research_responses")
    .insert(row);

  let alreadySubmitted = false;
  if (insertErr) {
    const code = (insertErr as { code?: string }).code ?? "";
    if (code === "23505") {
      alreadySubmitted = true;
    } else {
      return NextResponse.json({ ok: false, error: "insert failed" }, { status: 500 });
    }
  }

  /**
   * Reuse an existing non-expired pro_report_access row for this scan if one exists,
   * otherwise mint a new tokenized 21-day report URL via the shared helper.
   */
  let token: string | null = null;
  try {
    const { data: existing, error: existingErr } = await supabase
      .from("pro_report_access")
      .select("access_token, expires_at")
      .eq("scan_id", scanId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!existingErr && existing) {
      const expiresAt = new Date(String((existing as { expires_at: string }).expires_at));
      if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() > Date.now()) {
        token = String((existing as { access_token: string }).access_token);
      }
    }

    if (!token) {
      const created = await createProReportAccess(scanId, {
        reportSnapshot: { source: "user_research_unlock" },
      });
      token = created.token;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "report access failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  if (!token) {
    return NextResponse.json({ ok: false, error: "report access failed" }, { status: 500 });
  }

  /** Root-relative path so the client stays on the current host (local, preview, prod). */
  const reportPath = `/r/${encodeURIComponent(token)}`;
  const reportUrl = lang ? `${reportPath}?lang=${lang}` : reportPath;

  return NextResponse.json({
    ok: true,
    ...(alreadySubmitted ? { already: true } : {}),
    report_url: reportUrl,
  });
}
