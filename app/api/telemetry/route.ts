export const runtime = "nodejs";

import { logEvent } from "@/lib/observability";

/**
 * POST /api/telemetry
 * Client-side telemetry endpoint with strict validation.
 * Persists events before responding (await) for reliable delivery on serverless.
 */

const ALLOWED_EVENTS = [
  "scan_attempt",
  "scan_shown",
  "scan_consent",
  "scan_viewed",
  "scan_submit_clicked",
  "scan_request_sent",
  "scan_result_received",
  "scan_result_rendered",
  "scan_abandon_before_result",
  "scan_consent_clicked_allow",
  "scan_consent_clicked_deny",
  "scan_error",
  "report_cta_viewed",
  "report_cta_clicked",
  "report_mission_viewed",
  "report_mission_continue",
  "report_step_viewed",
  "report_step_back",
  "report_exit",
  "report_submit_clicked",
  "report_submit_success",
  "report_submit_failed",
  "telemetry_rejected_payload",
] as const;

const ALLOWED_PROPS = [
  "flow",
  "step",
  "risk_tier",
  "ui_action",
  "latency_ms",
  "error_code",
  "build_id",
] as const;

const BANNED_KEYS = [
  "text",
  "message",
  "content",
  "body",
  "prompt",
  "input",
  "email",
  "phone",
  "url",
  "link",
] as const;

/** Legacy event names → canonical names logged in event_type. original_event stored in context when mapped. */
const LEGACY_EVENT_MAP: Record<string, string> = {
  scan_attempt: "scan_submit_clicked",
  scan_shown: "scan_result_rendered",
};

function hasBannedKeys(obj: any, bannedKeys: readonly string[]): boolean {
  if (obj === null || obj === undefined) return false;
  if (typeof obj !== "object") return false;

  if (Array.isArray(obj)) {
    return obj.some((item) => hasBannedKeys(item, bannedKeys));
  }

  for (const key in obj) {
    if (bannedKeys.includes(key)) return true;
    if (hasBannedKeys(obj[key], bannedKeys)) return true;
  }
  return false;
}

function extractSafePayload(body: any): {
  event_type: string;
  session_id?: string;
  route?: string;
  props?: Record<string, any>;
} | null {
  // Backward compatibility: accept event_type or event
  const event_type = body.event_type ?? body.event;
  if (!event_type || typeof event_type !== "string") return null;

  if (!ALLOWED_EVENTS.includes(event_type as any)) return null;

  const safePayload: any = { event_type };

  if (typeof body.session_id === "string") safePayload.session_id = body.session_id;
  if (typeof body.route === "string") safePayload.route = body.route;

  if (body.props && typeof body.props === "object") {
    const safeProps: Record<string, any> = {};
    for (const key of ALLOWED_PROPS) {
      if (key in body.props) safeProps[key] = body.props[key];
    }
    if (Object.keys(safeProps).length > 0) safePayload.props = safeProps;
  }

  return safePayload;
}

export async function POST(req: Request) {
  let supabaseHost = "missing";
  try {
    if (process.env.SUPABASE_URL) {
      supabaseHost = new URL(process.env.SUPABASE_URL).hostname;
    }
  } catch {
    // leave as "missing"
  }
  console.log("[telemetry] env", {
    supabaseHost,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  let body: any;

  // 400 only on JSON parse failure
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  // Hard reject on banned keys (but never break UX)
  if (hasBannedKeys(body, BANNED_KEYS)) {
    const session_id = typeof body.session_id === "string" ? body.session_id : null;
    const route = typeof body.route === "string" ? body.route : null;

    await logEvent("telemetry_rejected_payload", "warning", "telemetry_api", {
      reason: "banned_key",
      session_id,
      route,
    });

    return new Response(null, { status: 204 });
  }

  const safePayload = extractSafePayload(body);
  if (!safePayload) {
    const received = body.event_type ?? body.event;
    await logEvent("telemetry_rejected_payload", "warning", "telemetry_api", {
      reason: "invalid_event",
      ...(typeof received === "string" && { received_event: received }),
      ...(typeof body.session_id === "string" && { session_id: body.session_id }),
      ...(typeof body.route === "string" && { route: body.route }),
    });
    return new Response(null, { status: 204 });
  }

  // Enforce payload size cap
  const payloadString = JSON.stringify(safePayload);
  if (payloadString.length > 2000) {
    await logEvent("telemetry_rejected_payload", "warning", "telemetry_api", {
      reason: "too_large",
      session_id: safePayload.session_id ?? null,
      route: safePayload.route ?? null,
      size: payloadString.length,
    });

    return new Response(null, { status: 204 });
  }

  const canonicalEvent =
    LEGACY_EVENT_MAP[safePayload.event_type] ?? safePayload.event_type;
  const context: Record<string, any> = {
    session_id: safePayload.session_id,
    route: safePayload.route,
    ...(safePayload.props ?? {}),
  };
  if (canonicalEvent !== safePayload.event_type) {
    context.original_event = safePayload.event_type;
  }

  await logEvent(canonicalEvent, "info", "telemetry_api", context);

  return new Response(null, { status: 204 });
}
