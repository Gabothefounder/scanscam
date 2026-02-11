import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Severity = "info" | "warning" | "critical" | "error";

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
    const { error } = await supabase.from("events").insert({
      event_type,
      severity,
      source,
      context,
    });
    if (error) {
      console.error("[observability] events insert failed:", error);
    }
  } catch {
    // Observability must never break the app
  }
}

