export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export type AnalystBlocksResponse = {
  current_snapshot: unknown;
  weekly_snapshot: unknown;
  system_quality_snapshot: unknown;
};

export async function GET() {
  try {
    const [currentRes, weeklyRes, systemQualityRes] = await Promise.all([
      supabase.from("intel_current_snapshot" as any).select("*").maybeSingle(),
      supabase.from("intel_weekly_snapshot" as any).select("*"),
      supabase.from("intel_system_quality_snapshot" as any).select("*"),
    ]);

    const currentSnap = currentRes.data ?? null;
    const weeklyRaw = (weeklyRes.data ?? null) as unknown[] | null;
    const systemQualityRaw = (systemQualityRes.data ?? null) as unknown[] | null;
    const weeklySnap = Array.isArray(weeklyRaw) ? (weeklyRaw.length === 1 ? weeklyRaw[0] : weeklyRaw) : weeklyRaw;
    const systemQualitySnap = Array.isArray(systemQualityRaw) ? (systemQualityRaw.length === 1 ? systemQualityRaw[0] : systemQualityRaw) : systemQualityRaw;

    const payload: AnalystBlocksResponse = {
      current_snapshot: currentSnap,
      weekly_snapshot: weeklySnap,
      system_quality_snapshot: systemQualitySnap,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error("[analyst-blocks] request failed");
    return NextResponse.json(
      { current_snapshot: null, weekly_snapshot: null, system_quality_snapshot: null },
      { status: 200 }
    );
  }
}
