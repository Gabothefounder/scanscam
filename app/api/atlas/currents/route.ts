import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/proReports/serviceSupabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public, aggregate-only Atlas feed.
 *
 * This endpoint never returns raw messages, free text, contact details,
 * domains, evidence, private ledgers, or per-person journey content.
 */
export async function GET() {
  let supabase;
  try {
    supabase = getServiceSupabase();
  } catch {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const [currentsResult, familiesResult, tacticsResult] = await Promise.all([
    supabase
      .from("atlas_current_summary")
      .select("id,cluster_key,scam_family,channel,primary_request,signal_count,high_risk_count,recent_30d_count,first_seen,last_seen,light_count")
      .order("signal_count", { ascending: false }),
    supabase
      .from("atlas_family_summary")
      .select("scam_family,signal_count,exact_count,inferred_count,high_risk_count,last_seen")
      .order("signal_count", { ascending: false }),
    supabase
      .from("atlas_tactic_summary")
      .select("tactic,signal_count,high_risk_count,last_seen")
      .order("signal_count", { ascending: false }),
  ]);

  if (currentsResult.error || familiesResult.error || tacticsResult.error) {
    return NextResponse.json({ ok: false, error: "atlas_query_failed" }, { status: 500 });
  }

  const currents = currentsResult.data ?? [];
  const totalSignals = currents.reduce((sum, row) => sum + Number(row.signal_count || 0), 0);
  const totalLights = currents.reduce((sum, row) => sum + Number(row.light_count || 0), 0);

  return NextResponse.json({
    ok: true,
    generated_at: new Date().toISOString(),
    totals: {
      signals: totalSignals,
      currents: currents.length,
      lights: totalLights,
    },
    currents,
    families: familiesResult.data ?? [],
    tactics: tacticsResult.data ?? [],
  });
}
