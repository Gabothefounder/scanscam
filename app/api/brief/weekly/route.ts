import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { BriefWeeklyResponse } from "@/lib/brief";

export type { BriefWeeklyResponse } from "@/lib/brief";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

/**
 * GET /api/brief/weekly
 * Returns the latest generated brief from weekly_briefs (brief_json).
 * Public-safe; no internal-only fields. 404 when no brief has been generated yet.
 */
export async function GET(req: NextRequest) {
  try {
    const { data: row, error } = await supabase
      .from("weekly_briefs")
      .select("brief_json")
      .eq("status", "published")
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[brief/weekly] Supabase query failed");
      return NextResponse.json(
        { error: "Failed to load weekly brief" },
        { status: 500 }
      );
    }

    if (!row?.brief_json) {
      return NextResponse.json(
        { error: "No weekly brief available. A brief has not been generated for this period." },
        { status: 404 }
      );
    }

    const payload = row.brief_json as BriefWeeklyResponse;
    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error("[brief/weekly] request failed");
    return NextResponse.json(
      { error: "Failed to load weekly brief" },
      { status: 500 }
    );
  }
}
