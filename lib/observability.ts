import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Severity = "info" | "warning" | "critical";

export async function logEvent(
  event_type: string,
  severity: Severity,
  source: string,
  context: Record<string, any> = {}
) {
  try {
    await supabase.from("observability_events").insert({
      event_type,
      severity,
      source,
      context,
    });
  } catch {
    // Never throw. Observability must NEVER break the app.
  }
}
