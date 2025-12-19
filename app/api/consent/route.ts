export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";
import { logEvent } from "@/lib/observability";

/* -------------------------------------------------
   Supabase client — SERVER ONLY
-------------------------------------------------- */

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

/* -------------------------------------------------
   POST /api/consent
-------------------------------------------------- */

export async function POST(req: Request) {
  let body: any;

  /* ---------- Safe parse ---------- */
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 204 });
  }

  const { consent, scan_result } = body ?? {};

  /* ---------- Hard consent gate ---------- */
  if (consent !== true || !scan_result) {
    return new Response(null, { status: 204 });
  }

  /* ---------- Canonical risk ---------- */
  const risk_tier =
    scan_result.risk_tier ??
    scan_result.risk ??
    null;

  if (!risk_tier) {
    logEvent("consent_invalid_scan", "warning", "consent_api", {
      reason: "missing_risk",
    });
    return new Response(null, { status: 204 });
  }

  /* ---------- Canonical signals ---------- */
  let signals: any[] = [];

  if (Array.isArray(scan_result.signals)) {
    signals = scan_result.signals;
  } else if (Array.isArray(scan_result.reasons)) {
    signals = scan_result.reasons.map((r: string) => ({
      description: r,
    }));
  }

  /* ---------- Canonical metadata ---------- */
  const language =
    scan_result.language === "fr" ? "fr" : "en";

  const source =
    scan_result.source === "ocr" ? "ocr" : "user_text";

  /* ---------- Data quality ---------- */
  const data_quality = {
    is_message_like: true,
    ...(scan_result.data_quality ?? {}),
  };

  /* ---------- Build row ---------- */
  const row = {
    risk_tier,
    summary_sentence: scan_result.summary_sentence ?? null,
    signals,
    language,
    source,
    data_quality,
    used_fallback: Boolean(scan_result.used_fallback),
  };

  logEvent("consent_accepted", "info", "consent_api", {
    risk_tier,
    language,
    source,
    signals_count: signals.length,
  });

  /* ---------- Insert ---------- */
  const { error } = await supabase
    .from("scans")
    .insert(row);

  if (error) {
    logEvent("consent_write_failed", "critical", "consent_api", {
      message: error.message,
    });
  }

  return new Response(null, { status: 204 });
}
