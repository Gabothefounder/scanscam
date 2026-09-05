/**
 * Client-side product telemetry.
 * Fire-and-forget, privacy-bounded, and navigation-safe.
 */
import { getSessionId } from "@/lib/telemetry/session";
import type { TelemetryEvent, TelemetryProps } from "@/lib/telemetry/events";

export function logScanEvent(
  eventName: TelemetryEvent,
  data?: { scan_id?: string; props?: TelemetryProps }
): void {
  if (typeof window === "undefined") return;

  const payload: Record<string, unknown> = {
    event: eventName,
    session_id: getSessionId(),
    route: window.location.pathname,
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
    keepalive: true,
  }).catch(() => {
    // Telemetry must never break product UX.
  });
}
