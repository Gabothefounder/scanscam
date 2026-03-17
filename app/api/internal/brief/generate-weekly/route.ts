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

const BRIEF_TIMEZONE = "America/Toronto";

/**
 * Returns the Monday (YYYY-MM-DD) of the last fully completed Monday–Sunday week.
 * "Today" is interpreted in BRIEF_TIMEZONE so the week is stable for Canadian users
 * and not affected by server UTC (e.g. Sunday evening local is still "previous week").
 * Example: 2026-03-16 (Monday) or 2026-03-18 (Wednesday) in Toronto → 2026-03-09.
 * Note: /brief/weekly reads from weekly_briefs; after deploying this logic, regenerate
 * the brief from the internal radar so the stored row uses the correct week_start.
 */
function getLastCompletedWeekStartISO(now: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRIEF_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const month = parseInt(parts.find((p) => p.type === "month")!.value, 10) - 1;
  const day = parseInt(parts.find((p) => p.type === "day")!.value, 10);
  const noonUtc = new Date(Date.UTC(year, month, day, 12, 0, 0));
  const dayOfWeek = noonUtc.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const mondayOfThisWeek = new Date(Date.UTC(year, month, day, 12, 0, 0));
  mondayOfThisWeek.setUTCDate(mondayOfThisWeek.getUTCDate() - daysSinceMonday);
  const previousMonday = new Date(mondayOfThisWeek);
  previousMonday.setUTCDate(previousMonday.getUTCDate() - 7);
  return previousMonday.toISOString().slice(0, 10);
}

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
    const rawNarrative = r?.intel_features?.narrative_category;
    const value =
      typeof rawNarrative === "string" && rawNarrative.trim().length > 0
        ? rawNarrative.trim()
        : "unknown";
    const tier = String(r?.risk_tier ?? "low").toLowerCase();
    const key = tier === "high" ? "high" : tier === "medium" ? "medium" : "low";
    totals[key]++;
    if (value === "none" || value === "unknown") continue;
    let entry = byNarrative.get(value);
    if (!entry) {
      entry = { low: 0, medium: 0, high: 0 };
      byNarrative.set(value, entry);
    }
    entry[key]++;
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
    const lastCompletedWeekStart = getLastCompletedWeekStartISO(new Date());
    const res = await fetch(`${origin}/api/intel/radar-weekly?week_start=${lastCompletedWeekStart}`, {
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lastCompletedWeekStart)) {
      return NextResponse.json(
        { ok: false, error: "Invalid lastCompletedWeekStart" },
        { status: 500 }
      );
    }
    const { start: rangeStart, end: rangeEnd } = weekToDateRange(lastCompletedWeekStart);
    const [weekRiskData, previousWeekTotals] = await Promise.all([
      getWeekRiskData(rangeStart, rangeEnd),
      (() => {
        const prevStart = new Date(lastCompletedWeekStart + "T12:00:00.000Z");
        prevStart.setUTCDate(prevStart.getUTCDate() - 7);
        const prevEnd = new Date(prevStart);
        prevEnd.setUTCDate(prevEnd.getUTCDate() + 6);
        const pStart = prevStart.toISOString().slice(0, 10);
        const pEnd = prevEnd.toISOString().slice(0, 10);
        return getPreviousWeekRiskTotals(pStart, pEnd);
      })(),
    ]);
    const narratives = Array.isArray(data.fraud_landscape?.narratives) ? data.fraud_landscape.narratives : [];
    data = {
      ...data,
      week_start: lastCompletedWeekStart,
      fraud_landscape: {
        ...data.fraud_landscape,
        narratives: enrichNarrativesWithRiskCounts(narratives, weekRiskData.byNarrative),
      },
      week_risk_counts: weekRiskData.totals,
      previous_week_risk_counts: previousWeekTotals,
    };
    const payload = deriveBriefPayload(data);
    payload.week_start = lastCompletedWeekStart;

    const weekStart = lastCompletedWeekStart;

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
