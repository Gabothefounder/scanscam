export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildRadarMspContextPayload } from "@/lib/intel/radarMspContext";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function GET() {
  try {
    const payload = await buildRadarMspContextPayload(supabase);
    return NextResponse.json(payload);
  } catch (e) {
    console.error("[radar-msp-context]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "radar_msp_context_failed" },
      { status: 500 }
    );
  }
}
