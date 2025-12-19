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
    // Silent exit by design
    return new Response(null, { status: 204 });
  }

  const { consent, scan_result } = body ?? {};

  /* ---------- HARD CONSENT GATE ---------- */
  if (consent !== true) {
    return new Response(null, { status: 204 });
  }

  /* ---------- NORMALIZE SCHEMA (FRONTEND + AI) ---------- */
  const risk =
    scan_result?.risk_tier ??
    scan_result?.risk ??
    null;

  const signals =
    scan_result?.signals ??
    scan_result?.reasons ??
    null;

  /* ---------- VALIDATION (STRICT, NON-NEGOTIABLE) ---------- */
  if (
    !scan_result ||
    !risk ||
    !Array.isArray(signals) ||
    scan_result.data_quality?.is_message_like !== true
  ) {
    return new Response(null, { status: 204 });
  }

  /* ---------- BUILD CANONICAL INSERT PAYLOAD ---------- */
  const row = {
    risk_tier: risk, // canonical storage
    summary_sentence: scan_result.summary_sentence ?? null,
    signals,
    language: scan_result.language ?? null,
    source: scan_result.source ?? null,
    data_quality: scan_result.data_quality,
    used_fallback: Boolean(scan_result.used_fallback),
  };

  /* ---------- DEBUG LOG (SAFE TO REMOVE LATER) ---------- */
  console.log("[CONSENT_DEBUG] Insert scan", {
    risk_tier: row.risk_tier,
    language: row.language,
    source: row.source,
    signals_count: row.signals.length,
    has_summary: !!row.summary_sentence,
    used_fallback: row.used_fallback,
  });

  /* ---------- INSERT (SINGLE ATTEMPT, NO RETRIES) ---------- */
  const { error } = await supabase
    .from("scans")
    .insert(row);

  if (error) {
    console.error("[CONSENT_WRITE_FAILED]", {
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }

  // Intentionally return no content
  return new Response(null, { status: 204 });
}
