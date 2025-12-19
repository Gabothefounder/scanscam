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

  /* ---------- Safe JSON parse ---------- */
  try {
    body = await req.json();
  } catch {
    // Silent by design
    return new Response(null, { status: 204 });
  }

  const { consent, scan_result } = body ?? {};

  /* =================================================
     CONSENT = DENIED (explicit user action)
     → Log event ONLY
     → Do NOT write scan
  ================================================= */

  if (consent === false) {
    await logEvent("consent_denied", "info", "consent_api", {
      risk_tier:
        scan_result?.risk_tier ??
        scan_result?.risk ??
        null,
      has_scan_result: Boolean(scan_result),
    });

    return new Response(null, { status: 204 });
  }

  /* =================================================
     CONSENT = MISSING / INVALID
     → Ignore silently
  ================================================= */

  if (consent !== true) {
    return new Response(null, { status: 204 });
  }

  /* =================================================
     CONSENT = GIVEN
     → Validate payload
     → Insert scan
     → Log success event
  ================================================= */

  const risk =
    scan_result?.risk_tier ??
    scan_result?.risk ??
    null;

  const signals =
    Array.isArray(scan_result?.signals)
      ? scan_result.signals
      : Array.isArray(scan_result?.reasons)
      ? scan_result.reasons
      : null;

  if (!risk || !Array.isArray(signals)) {
    await logEvent("consent_invalid_payload", "warning", "consent_api", {
      has_risk: Boolean(risk),
      has_signals_array: Array.isArray(signals),
    });

    return new Response(null, { status: 204 });
  }

  /* ---------- Build canonical scan row ---------- */
  const row = {
    risk_tier: risk,
    summary_sentence: scan_result.summary_sentence ?? null,
    signals,
    language: scan_result.language ?? null,
    source: scan_result.source ?? null,
    data_quality: {
      is_message_like: true,
    },
    used_fallback: Boolean(scan_result.used_fallback),
  };

  /* ---------- Insert scan ---------- */
  const { error } = await supabase
    .from("scans")
    .insert(row);

  if (error) {
    await logEvent("consent_write_failed", "critical", "consent_api", {
      message: error.message,
    });

    return new Response(null, { status: 204 });
  }

  /* ---------- Consent success event ---------- */
  await logEvent("consent_given", "info", "consent_api", {
    risk_tier: row.risk_tier,
    language: row.language,
    source: row.source,
  });

  return new Response(null, { status: 204 });
}
