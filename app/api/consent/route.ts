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

  /* ---------- NORMALIZE SCHEMA (AI + FRONTEND) ---------- */
  const risk =
    scan_result?.risk_tier ??
    scan_result?.risk ??
    null;

  const signals =
    scan_result?.signals ??
    scan_result?.reasons ??
    null;

  /* ---------- STRICT VALIDATION ---------- */
  if (
    !scan_result ||
    !risk ||
    !Array.isArray(signals) ||
    scan_result.data_quality?.is_message_like !== true
  ) {
    console.warn("[CONSENT_VALIDATION_FAILED]", {
      has_scan_result: !!scan_result,
      risk,
      has_signals_array: Array.isArray(signals),
      is_message_like: scan_result?.data_quality?.is_message_like,
    });

    return new Response(null, { status: 204 });
  }

  /* ---------- BUILD CANONICAL ROW ---------- */
  const row = {
    risk_tier: risk,
    summary_sentence: scan_result.summary_sentence ?? null,
    signals,
    language: scan_result.language ?? null,
    source: scan_result.source ?? null,
    data_quality: scan_result.data_quality,
    used_fallback: Boolean(scan_result.used_fallback),
  };

  console.log("[CONSENT_DEBUG] Attempting insert", {
    risk_tier: row.risk_tier,
    language: row.language,
    source: row.source,
    signals_count: row.signals.length,
    has_summary: !!row.summary_sentence,
    used_fallback: row.used_fallback,
  });

  /* ---------- INSERT + FORCE RETURN ---------- */
  const { data, error } = await supabase
    .from("scans")
    .insert(row)
    .select();

  console.log("[CONSENT_INSERT_RESULT]", {
    data,
    error,
  });

  if (error) {
    console.error("[CONSENT_WRITE_FAILED]", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      timestamp: new Date().toISOString(),
    });
  }

  return new Response(null, { status: 204 });
}
