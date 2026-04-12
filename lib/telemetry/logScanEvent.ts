/**
 * Client-side telemetry logging for scan events.
 * Fire-and-forget: never blocks UI, never throws.
 * Strict payload: event, session_id, scan_id?, props?
 */
import { getSessionId } from "@/lib/telemetry/session";

export function logScanEvent(
  eventName:
    | "scan_attempt"
    | "scan_processing"
    | "scan_shown"
    | "scan_consent"
    | "scan_error"
    | "scan_created"
    | "context_refinement_shown"
    | "context_refinement_submitted"
    | "context_refinement_completed_analysis",
  data?: { scan_id?: string; props?: Record<string, unknown> }
): void {
  if (typeof window === "undefined") return;

  const payload: Record<string, unknown> = {
    event: eventName,
    session_id: getSessionId(),
  };
  if (data?.scan_id && typeof data.scan_id === "string") {
    payload.scan_id = data.scan_id;
  }
  if (data?.props && typeof data.props === "object" && Object.keys(data.props).length > 0) {
    payload.props = data.props;
  }

  fetch("/api/telemetry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Silent failure - telemetry must never break the app
  });
}
