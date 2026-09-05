import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/proReports/serviceSupabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const scanId = request.nextUrl.searchParams.get("scan_id") || "";
  if (!UUID_RE.test(scanId)) {
    return NextResponse.json({ ok: false, error: "invalid_scan_id" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getServiceSupabase();
  } catch {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const { data: signal, error: signalError } = await supabase
    .from("atlas_scan_signals")
    .select("cluster_key")
    .eq("scan_id", scanId)
    .maybeSingle();

  if (signalError || !signal?.cluster_key) {
    return NextResponse.json({ ok: false, error: "current_not_found" }, { status: 404 });
  }

  const { data: current, error: currentError } = await supabase
    .from("atlas_current_summary")
    .select("id,cluster_key,scam_family,channel,primary_request,signal_count,high_risk_count,recent_30d_count,first_seen,last_seen,light_count")
    .eq("cluster_key", signal.cluster_key)
    .maybeSingle();

  if (currentError || !current) {
    return NextResponse.json({ ok: false, error: "current_not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, current });
}
