import { createClient } from "@supabase/supabase-js";

/* -------------------------------------------------
   Supabase client — SERVER ONLY
   Uses SERVICE ROLE key
-------------------------------------------------- */

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

/* -------------------------------------------------
   Types
-------------------------------------------------- */

export type Severity = "info" | "warning" | "error" | "critical";

/* -------------------------------------------------
   logEvent
   - NEVER throws
   - NEVER blocks app logic
   - Best-effort observability only
-------------------------------------------------- */

export async function logEvent(
  event_type: string,
  severity: Severity,
  source: string,
  context: Record<string, any> = {}
) {
  try {
    await supabase.from("events").insert({
      event_type,
      severity,
      source,
      context,
    });
  } catch {
    // 🔕 Silent by design
    // Observability must never affect runtime behavior
  }
}
