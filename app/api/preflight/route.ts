import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  const { data, error } = await supabase
    .from("reports")
    .insert({
      source: "preflight_test",
      report_version: "mvp2-preflight",
      impersonation_type: "test",
      contact_channel: "test",
      scam_request: "test",
      engagement_outcome: "test",
      identity_impact: "no",
      financial_loss_range: "none",
      event_country: "TEST",
      event_region_level_1: "TEST",
      event_city_or_area: "TEST",
      event_location_source: "preflight",
      location_confidence: "high",
      narrative_text: "Preflight write test — this row must appear exactly once.",
      reflection_text: "If this row is missing or partial, STOP."
    })
    .select()
    .single();

  if (error) {
    console.error("PRE-FLIGHT INSERT FAILED", error);
    return new Response(
      JSON.stringify({
        status: "error",
        error: error.message
      }),
      { status: 500 }
    );
  }

  return new Response(
    JSON.stringify({
      status: "ok",
      environment: process.env.NODE_ENV,
      build_id: process.env.VERCEL_GIT_COMMIT_SHA || "local",
      data
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }
  );
}
