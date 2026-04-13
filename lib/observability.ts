import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Severity = "info" | "warning" | "critical" | "error";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Central event logger
 * NEVER throws
 * NEVER blocks product flow
 */
export async function logEvent(
  event_type: string,
  severity: Severity,
  source: string,
  context: Record<string, any> = {}
) {
  try {
    const scanIdCandidate =
      typeof context?.scan_id === "string" ? context.scan_id.trim() : null;
    const scan_id = scanIdCandidate && UUID_RE.test(scanIdCandidate) ? scanIdCandidate : null;

    const { error } = await supabase.from("events").insert({
      event_type,
      severity,
      source,
      context,
      ...(scan_id ? { scan_id } : {}),
    });
    if (error) {
      console.error("[observability] events insert failed:", error);
    }
  } catch {
    // Observability must never break the app
  }
}

