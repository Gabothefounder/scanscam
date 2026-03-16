import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { deriveBriefPayload, type NarrativeForBrief } from "@/lib/brief";

const COOKIE_NAME = "internal_radar_auth";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

/** Radar payload shape (subset). */
type RadarPayload = Parameters<typeof deriveBriefPayload>[0];

function weekToDateRange(weekStart: string): { start: string; end: string } {
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

type RiskTotals = { low: number; medium: number; high: number };

/** Aggregate narrative_category × risk_tier counts and week totals from scans for the given week. */
async function getWeekRiskData(
  rangeStart: string,
  rangeEnd: string
): Promise<{ byNarrative: Map<string, RiskTotals>; totals: RiskTotals }> {
  const byNarrative = new Map<string, RiskTotals>();
  const totals: RiskTotals = { low: 0, medium: 0, high: 0 };
  const { data: rows } = await supabase
    .from("scans")
    .select("intel_features, risk_tier")
    .gte("created_at", `${rangeStart}T00:00:00.000Z`)
    .lte("created_at", `${rangeEnd}T23:59:59.999Z`)
    .limit(50000);

  if (!rows?.length) return { byNarrative, totals };

  for (const r of rows as { intel_features?: { narrative_category?: string }; risk_tier?: string }[]) {
    const value = String(r?.intel_features?.narrative_category ?? "unknown").trim() || "unknown";
    const tier = String(r?.risk_tier ?? "low").toLowerCase();
    const key = tier === "high" ? "high" : tier === "medium" ? "medium" : "low";
    let entry = byNarrative.get(value);
    if (!entry) {
      entry = { low: 0, medium: 0, high: 0 };
      byNarrative.set(value, entry);
    }
    entry[key]++;
    totals[key]++;
  }
  return { byNarrative, totals };
}

/** Aggregate low/medium/high totals only for a week (e.g. previous week for WoW). */
async function getPreviousWeekRiskTotals(
  rangeStart: string,
  rangeEnd: string
): Promise<RiskTotals> {
  const { totals } = await getWeekRiskData(rangeStart, rangeEnd);
  return totals;
}

/** Enrich fraud_landscape.narratives with low_count, medium_count, high_count for risk-weighted selection. */
function enrichNarrativesWithRiskCounts(
  narratives: { value: string; scan_count: number; share_of_week: number }[],
  riskCounts: Map<string, RiskTotals>
): NarrativeForBrief[] {
  return narratives.map((n) => {
    const counts = riskCounts.get(n.value);
    if (!counts) return { ...n };
    return {
      ...n,
      low_count: counts.low,
      medium_count: counts.medium,
      high_count: counts.high,
    };
  });
}

async function requireInternalAuth(): Promise<NextResponse | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (cookie?.value !== "1") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const authErr = await requireInternalAuth();
  if (authErr) return authErr;

  try {
    const origin = req.nextUrl.origin;
    const res = await fetch(`${origin}/api/intel/radar-weekly`, {
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: "Failed to load radar weekly data" },
        { status: 502 }
      );
    }
    let data = (await res.json()) as RadarPayload;
    const weekStartFromRadar = data?.week_start;
    if (weekStartFromRadar && /^\d{4}-\d{2}-\d{2}$/.test(weekStartFromRadar)) {
      const { start: rangeStart, end: rangeEnd } = weekToDateRange(weekStartFromRadar);
      const [weekRiskData, previousWeekTotals] = await Promise.all([
        getWeekRiskData(rangeStart, rangeEnd),
        (() => {
          const prevStart = new Date(weekStartFromRadar);
          prevStart.setDate(prevStart.getDate() - 7);
          const prevEnd = new Date(prevStart);
          prevEnd.setDate(prevEnd.getDate() + 6);
          const pStart = prevStart.toISOString().slice(0, 10);
          const pEnd = prevEnd.toISOString().slice(0, 10);
          return getPreviousWeekRiskTotals(pStart, pEnd);
        })(),
      ]);
      const narratives = Array.isArray(data.fraud_landscape?.narratives) ? data.fraud_landscape.narratives : [];
      data = {
        ...data,
        fraud_landscape: {
          ...data.fraud_landscape,
          narratives: enrichNarrativesWithRiskCounts(narratives, weekRiskData.byNarrative),
        },
        week_risk_counts: weekRiskData.totals,
        previous_week_risk_counts: previousWeekTotals,
      };
    }
    const payload = deriveBriefPayload(data);

    const weekStart = payload.week_start;
    if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return NextResponse.json(
        { ok: false, error: "Invalid week_start from radar" },
        { status: 502 }
      );
    }

    const generatedAt = new Date().toISOString();
    const briefJson = { ...payload, generated_at: generatedAt };
    const row = {
      week_start: weekStart,
      generated_at: generatedAt,
      status: "published",
      scan_count: payload.scan_count,
      top_narrative: payload.top_narrative,
      top_channel: payload.top_channel,
      top_authority: payload.top_authority,
      top_payment_method: payload.top_payment_method,
      fraud_label: payload.fraud_label,
      how_it_works: payload.how_it_works,
      protection_tip: payload.protection_tip,
      brief_json: briefJson as unknown as Record<string, unknown>,
      social_headline: payload.social_headline,
      social_summary: payload.social_summary,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("weekly_briefs").upsert(row, {
      onConflict: "week_start",
    });

    if (error) {
      console.error("[generate-weekly] Supabase upsert:", error);
      return NextResponse.json(
        { ok: false, error: "Failed to save weekly brief" },
        { status: 500 }
      );
    }

    const briefUrl = `${origin}/brief/weekly`;
    return NextResponse.json({
      ok: true,
      week_start: weekStart,
      generated_at: generatedAt,
      social_headline: payload.social_headline,
      social_summary: payload.social_summary,
      brief_url: briefUrl,
    });
  } catch (err) {
    console.error("[generate-weekly]", err);
    return NextResponse.json(
      { ok: false, error: "Failed to generate weekly brief" },
      { status: 500 }
    );
  }
}
