/**
 * Client-side telemetry logging for scan events.
 * Fire-and-forget: never blocks UI, never throws.
 */
export function logScanEvent(
  eventName: "scan_attempt" | "scan_shown" | "scan_consent",
  data?: Record<string, any>
): void {
  if (typeof window === "undefined") return;

  // Fire and forget - never await
  fetch("/api/telemetry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: eventName,
      ...data,
    }),
  }).catch(() => {
    // Silent failure - telemetry must never break the app
  });
}
