export const runtime = "nodejs";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { readCompleteArchive, type SignalRow } from "@/lib/atlasArchiveMetrics";
export async function GET() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ ok: false }, { status: 503 });
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  try {
    const metrics = await readCompleteArchive(async (from, to) => {
      const { data, count, error } = await supabase.from("atlas_scan_signals")
        .select("scan_id,scam_family,authority_type,primary_request,tactic_tags,emotion_vectors", { count: "exact" })
        .order("scan_id", { ascending: true }).range(from, to);
      return { data: data as SignalRow[] | null, count, error };
    });
    return NextResponse.json({ ok: true, ...metrics, generatedAt: new Date().toISOString() }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
