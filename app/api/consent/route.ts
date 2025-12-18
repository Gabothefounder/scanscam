export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";

/* -------------------------------------------------
   Supabase client — SERVER ONLY
   Uses SERVICE ROLE key (bypasses RLS)
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

  /* ---------- Safe JSON parse ---------- */
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 204 });
  }

  const { consent, scan_result } = body ?? {};

  /* ---------- HARD CONSENT GATE ---------- */
  if (consent !== true) {
    return new Response(null, { status: 204 });
  }

  /* ---------- VALIDATION (D2.3) ---------- */
  if (
    !scan_result ||
    scan_result.risk_tier == null ||
    !Array.isArray(scan_result.signals) ||
    scan_result.data_quality?.is_message_like !== true
  ) {
    return new Response(null, { status: 204 });
  }

  /* ---------- BUILD INSERT PAYLOAD ---------- */
  const row = {
    risk_tier: scan_result.risk_tier,
    summary_sentence: scan_result.summary_sentence ?? null,
    signals: scan_result.signals,
    language: scan_result.language,
    source: scan_result.source,
    data_quality: scan_result.data_quality,
    used_fallback: Boolean(scan_result.used_fallback),
  };

  /* ---------- TEMP DEBUG LOG (REMOVE LATER) ---------- */
  console.log("[CONSENT_DEBUG] About to insert scan:", {
    risk_tier: row.risk_tier,
    language: row.language,
    source: row.source,
    has_summary: !!row.summary_sentence,
    signals_count: Array.isArray(row.signals)
      ? row.signals.length
      : null,
    used_fallback: row.used_fallback,
  });

  /* ---------- INSERT ONCE (NO RETRIES) ---------- */
  const { error } = await supabase
    .from("scans")
    .insert(row);

  if (error) {
    console.error("[CONSENT_WRITE_FAILED]", {
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }

  return new Response(null, { status: 204 });
}
