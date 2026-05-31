import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/proReports/serviceSupabase";
import { createProReportAccess } from "@/lib/proReports/createProReportAccess";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;
const SOURCE_DEFAULT = "post_scan_result";

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed.length > MAX_EMAIL_LEN) return null;
  if (!EMAIL_RE.test(trimmed)) return null;
  return trimmed;
}

function normalizeRiskTier(value: unknown): string {
  const r = String(value ?? "low")
    .trim()
    .toLowerCase();
  if (r === "high" || r === "medium") return r;
  return "low";
}

/**
 * POST /api/guide-report-unlock
 *
 * Email opt-in for post-scan Decision Report (/r/{token}).
 * Stores lead in guide_leads, reuses or creates pro_report_access.
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

  const email = normalizeEmail(o.email);
  if (!email) {
    return NextResponse.json({ ok: false, error: "invalid email" }, { status: 400 });
  }

  const langRaw = typeof o.lang === "string" ? o.lang.trim().toLowerCase() : "";
  const lang: "en" | "fr" | null = langRaw === "fr" ? "fr" : langRaw === "en" ? "en" : null;

  const source =
    typeof o.source === "string" && o.source.trim().length > 0
      ? o.source.trim().slice(0, 64)
      : SOURCE_DEFAULT;

  const supabase = getServiceSupabase();
  const { data: scan, error: scanErr } = await supabase
    .from("scans")
    .select("id, risk_tier")
    .eq("id", scanId)
    .maybeSingle();

  if (scanErr) {
    return NextResponse.json({ ok: false, error: "lookup failed" }, { status: 500 });
  }
  if (!scan) {
    return NextResponse.json({ ok: false, error: "scan not found" }, { status: 404 });
  }

  const scanRiskTier = normalizeRiskTier((scan as { risk_tier?: unknown }).risk_tier);
  const riskTier =
    o.risk_tier !== undefined && o.risk_tier !== null
      ? normalizeRiskTier(o.risk_tier)
      : scanRiskTier;

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
        reportSnapshot: { source: "guide_email_optin" },
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

  const { error: leadErr } = await supabase.from("guide_leads").insert({
    email,
    scan_id: scanId,
    access_token: token,
    risk_tier: riskTier,
    lang,
    source,
  });

  if (leadErr) {
    return NextResponse.json({ ok: false, error: "insert failed" }, { status: 500 });
  }

  const reportPath = `/r/${encodeURIComponent(token)}`;
  const reportUrl = lang ? `${reportPath}?lang=${lang}` : reportPath;

  return NextResponse.json({
    ok: true,
    report_url: reportUrl,
  });
}
