export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* -------------------------------------------------
   Supabase client — SERVER ONLY
-------------------------------------------------- */

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

/* -------------------------------------------------
   Types (locked contract)
-------------------------------------------------- */

export type RadarWeeklyResponse = {
  week_start: string;
  generated_at: string;
  system_health: {
    scan_count: number;
    submit_to_render_rate: number | null;
    fallback_rate: number | null;
    signal_yield_pct: number | null;
    signal_coverage_pct: number | null;
  };
  fraud_landscape: {
    narratives: { value: string; scan_count: number; share_of_week: number }[];
    channels: { value: string; scan_count: number; share_of_week: number }[];
    payment_methods: { value: string; scan_count: number; share_of_week: number }[];
    authority_types: { value: string; scan_count: number; share_of_week: number }[];
  };
  emerging_patterns: {
    dimension: string;
    value: string;
    this_week_count: number;
    this_week_share: number;
    last_week_count: number;
    last_week_share: number;
    count_delta_wow: number;
    share_delta_wow: number;
    emerging_rank: number;
    is_meaningful: boolean;
  }[];
  geography: {
    provinces: {
      province: string;
      scan_count: number;
      wow_scan_delta: number;
      high_risk_count: number;
      high_risk_ratio: number | null;
      is_meaningful: boolean;
    }[];
    top_cities: {
      city: string;
      province: string;
      scan_count: number;
      high_risk_count: number;
    }[];
  };
  recent_signals: {
    created_at: string;
    summary_sentence: string | null;
    risk_tier: string;
    city: string | null;
    province: string | null;
  }[];
  weekly_timeline?: {
    week_start: string;
    scan_count: number;
    scan_delta_wow: number | null;
    signal_coverage_pct: number | null;
    coverage_delta_wow: number | null;
  }[];
  daily_volume_timeline?: { day: string; scan_count: number }[];
};

const CA_PROVINCE_CODES = new Set(
  ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"].map((c) => c.toUpperCase())
);

const emptyResponse = (weekStart: string): RadarWeeklyResponse => ({
  week_start: weekStart,
  generated_at: new Date().toISOString(),
  system_health: {
    scan_count: 0,
    submit_to_render_rate: null,
    fallback_rate: null,
    signal_yield_pct: null,
    signal_coverage_pct: null,
  },
  fraud_landscape: {
    narratives: [],
    channels: [],
    payment_methods: [],
    authority_types: [],
  },
  emerging_patterns: [],
  geography: { provinces: [], top_cities: [] },
  recent_signals: [],
  weekly_timeline: [],
  daily_volume_timeline: [],
});

/* -------------------------------------------------
   Helpers
-------------------------------------------------- */

function parseWeekStart(q: string | null): string | null {
  if (!q || typeof q !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(q.trim());
  if (!m) return null;
  const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  if (isNaN(d.getTime())) return null;
  return q.trim();
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

function decodeCity(value: string | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/* -------------------------------------------------
   GET /api/intel/radar-weekly
-------------------------------------------------- */

export async function GET(req: NextRequest) {
  try {
    const weekStartParam = req.nextUrl.searchParams.get("week_start");
    let weekStart: string;

    if (weekStartParam && parseWeekStart(weekStartParam)) {
      weekStart = parseWeekStart(weekStartParam)!;
    } else {
      const { data: coreRows } = await supabase
        .from("intel_weekly_core" as any)
        .select("week_start")
        .order("week_start", { ascending: false })
        .limit(1);
      const latest = (coreRows as { week_start?: string }[])?.[0]?.week_start;
      if (!latest) {
        return NextResponse.json(emptyResponse(""), { status: 200 });
      }
      weekStart = latest;
    }

    const { start: rangeStart, end: rangeEnd } = weekToDateRange(weekStart);
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekStr = prevWeekStart.toISOString().slice(0, 10);

    const today = new Date();
    const dayEnd = today.toISOString().slice(0, 10);
    const dayStart = new Date(today);
    dayStart.setDate(dayStart.getDate() - 13);
    const dayStartStr = dayStart.toISOString().slice(0, 10);

    const [coreRes, signalYieldRes, behavioralRes, patternRes, geoRes, recentRes, timelineRes, dailyVolumeRes] =
      await Promise.all([
      supabase.from("intel_weekly_core" as any).select("*").eq("week_start", weekStart).maybeSingle(),
      /* intel_signal_yield is daily; column assumed "date"; adjust if view uses "day" */
      supabase
        .from("intel_signal_yield" as any)
        .select("*")
        .gte("day", rangeStart)
        .lte("day", rangeEnd),
      supabase.from("intel_weekly_behavioral" as any).select("*").eq("week_start", weekStart),
      supabase
        .from("intel_weekly_pattern_detector" as any)
        .select("*")
        .eq("week_start", weekStart)
        .gte("this_week_count", 3)
        .gt("share_delta_wow", 0.05)
        .order("share_delta_wow", { ascending: false })
        .order("this_week_count", { ascending: false })
        .limit(10),
      supabase
        .from("intel_weekly_geo" as any)
        .select("*")
        .in("week_start", [weekStart, prevWeekStr])
        .eq("country_code", "CA"),
      supabase
        .from("intel_recent_scams" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("intel_weekly_timeline" as any)
        .select("*")
        .order("week_start", { ascending: true })
        .limit(16),
      supabase
        .from("scans")
        .select("created_at")
        .gte("created_at", dayStartStr + "T00:00:00.000Z")
        .lte("created_at", dayEnd + "T23:59:59.999Z")
        .limit(10000),
    ]);

    const core = (coreRes.data ?? null) as Record<string, any> | null;
    const signalYieldRows = (signalYieldRes.data ?? []) as Record<string, any>[];
    const dailyVolumeRows = (dailyVolumeRes.data ?? []) as Record<string, any>[];
    const behavioralRows = (behavioralRes.data ?? []) as Record<string, any>[];
    const patternRows = (patternRes.data ?? []) as Record<string, any>[];
    const geoRows = (geoRes.data ?? []) as Record<string, any>[];
    let recentRows = (recentRes.data ?? []) as Record<string, any>[];
    const timelineRows = (timelineRes.data ?? []) as Record<string, any>[];

    let scanCount = 0;
    let submitToRenderRate: number | null = null;
    let fallbackRate: number | null = null;
    if (core) {
      scanCount = Number(core.scan_count) ?? 0;
      submitToRenderRate = core.submit_to_render_rate != null ? Number(core.submit_to_render_rate) : null;
      fallbackRate = core.fallback_rate != null ? Number(core.fallback_rate) : null;
    }

    let signalCoveragePct: number | null = null;
    if (behavioralRows.length > 0) {
      let totalScans = 0;
      let classifiedScans = 0;
      for (const r of behavioralRows) {
        const sc = Number(r.scan_count) ?? 0;
        totalScans += sc;
        if (String(r.value ?? "").toLowerCase() !== "unknown") classifiedScans += sc;
      }
      if (totalScans > 0) {
        signalCoveragePct = Math.round((classifiedScans / totalScans) * 1000) / 10;
      }
    }

    let signalYieldPct: number | null = null;
    if (signalYieldRows.length > 0) {
      let totalScanCount = 0;
      let totalHighValueSignalCount = 0;
      for (const row of signalYieldRows) {
        totalScanCount += Number(row.scan_count) ?? 0;
        totalHighValueSignalCount += Number(row.high_value_signal_count) ?? 0;
      }
      if (totalScanCount > 0) {
        signalYieldPct = Math.round((totalHighValueSignalCount / totalScanCount) * 1000) / 10;
      }
    }

    const byDimension = (dim: string) => {
      return behavioralRows
        .filter((r) => String(r.dimension ?? "").toLowerCase() === dim.toLowerCase())
        .map((r) => ({
          value: String(r.value ?? "unknown"),
          scan_count: Number(r.scan_count) ?? 0,
          share_of_week: Number(r.share_of_week) ?? 0,
        }))
        .sort((a, b) => b.scan_count - a.scan_count || b.share_of_week - a.share_of_week)
        .slice(0, 5);
    };

    const fraudLandscape = {
      narratives: byDimension("narrative_category"),
      channels: byDimension("channel_type"),
      payment_methods: byDimension("payment_method"),
      authority_types: byDimension("authority_type"),
    };

    const emergingPatterns = patternRows.map((r, i) => ({
      dimension: String(r.dimension ?? ""),
      value: String(r.value ?? ""),
      this_week_count: Number(r.this_week_count) ?? 0,
      this_week_share: Number(r.this_week_share) ?? 0,
      last_week_count: Number(r.last_week_count) ?? 0,
      last_week_share: Number(r.last_week_share) ?? 0,
      count_delta_wow: Number(r.count_delta_wow) ?? 0,
      share_delta_wow: Number(r.share_delta_wow) ?? 0,
      emerging_rank: Number(r.emerging_rank) ?? i + 1,
      is_meaningful: Boolean(r.is_meaningful),
    }));

    const geoCurr = geoRows.filter((r) => r.week_start === weekStart);
    const geoPrev = geoRows.filter((r) => r.week_start === prevWeekStr);
    const prevByRegion = new Map<string, number>();
    for (const r of geoPrev) {
      const reg = String(r.region_code ?? "").trim() || "unknown";
      prevByRegion.set(reg, (prevByRegion.get(reg) ?? 0) + (Number(r.scan_count) ?? 0));
    }

    const currByRegion = new Map<string, { scan_count: number; high_risk_count: number }>();
    for (const r of geoCurr) {
      const reg = String(r.region_code ?? "").trim() || "unknown";
      const existing = currByRegion.get(reg) ?? { scan_count: 0, high_risk_count: 0 };
      existing.scan_count += Number(r.scan_count) ?? 0;
      existing.high_risk_count += Number(r.high_risk_count) ?? 0;
      currByRegion.set(reg, existing);
    }

    const cityAgg = new Map<string, { province: string; scan_count: number; high_risk_count: number }>();
    for (const r of geoCurr) {
      const city = decodeCity(r.city).trim();
      const prov = String(r.region_code ?? "").trim() || "unknown";
      if (!city || city.toLowerCase() === "unknown") continue;
      const key = `${city}|${prov}`;
      const existing = cityAgg.get(key);
      if (existing) {
        existing.scan_count += Number(r.scan_count) ?? 0;
        existing.high_risk_count += Number(r.high_risk_count) ?? 0;
      } else {
        cityAgg.set(key, {
          province: prov,
          scan_count: Number(r.scan_count) ?? 0,
          high_risk_count: Number(r.high_risk_count) ?? 0,
        });
      }
    }

    const provinces = Array.from(currByRegion.entries())
      .filter(([province]) => CA_PROVINCE_CODES.has(String(province ?? "").trim().toUpperCase()))
      .map(([province, v]) => {
        const prev = prevByRegion.get(province) ?? 0;
        return {
          province,
          scan_count: v.scan_count,
          wow_scan_delta: v.scan_count - prev,
          high_risk_count: v.high_risk_count,
          high_risk_ratio: v.scan_count > 0 ? Math.round((v.high_risk_count / v.scan_count) * 1000) / 1000 : null,
          is_meaningful: v.scan_count >= 5,
        };
      })
      .filter((p) => p.scan_count >= 0)
      .sort((a, b) => b.scan_count - a.scan_count || b.high_risk_count - a.high_risk_count);

    const topCities = Array.from(cityAgg.entries())
      .map(([key, v]) => {
        const [city] = key.split("|");
        return { city, province: v.province, scan_count: v.scan_count, high_risk_count: v.high_risk_count };
      })
      .filter((c) => c.scan_count >= 2)
      .sort((a, b) => b.scan_count - a.scan_count || b.high_risk_count - a.high_risk_count)
      .slice(0, 3);

    const caRecent = recentRows.filter((r) => String(r.country_code ?? "").toUpperCase() === "CA");
    if (caRecent.length >= 20) {
      recentRows = caRecent;
    }
    recentRows = recentRows.slice(0, 20);

    const byDay = new Map<string, number>();
    for (const r of dailyVolumeRows) {
      const raw = r.created_at ?? "";
      const d = typeof raw === "string" ? raw.slice(0, 10) : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
    }
    const dailyVolumeTimeline = Array.from(byDay.entries())
      .map(([day, scan_count]) => ({ day, scan_count }))
      .sort((a, b) => a.day.localeCompare(b.day));

    const weeklyTimeline = timelineRows.map((r) => ({
      week_start: String(r.week_start ?? ""),
      scan_count: Number(r.scan_count) ?? 0,
      scan_delta_wow: r.scan_delta_wow != null ? Number(r.scan_delta_wow) : null,
      signal_coverage_pct: r.signal_coverage_pct != null ? Number(r.signal_coverage_pct) : null,
      coverage_delta_wow:
        r.coverage_delta_wow != null
          ? Number(r.coverage_delta_wow)
          : r.signal_coverage_delta_wow != null
            ? Number(r.signal_coverage_delta_wow)
            : null,
    }));

    const recentSignals = recentRows.map((r) => ({
      created_at: String(r.created_at ?? ""),
      summary_sentence: (() => {
        if (r.summary_sentence == null) return null;
        const s = String(r.summary_sentence);
        return s.trim() === "" ? null : s;
      })(),
      risk_tier: String(r.risk_tier ?? "unknown"),
      city: r.city != null ? decodeCity(r.city) : null,
      province: r.region_code != null ? String(r.region_code) : null,
    }));

    const payload: RadarWeeklyResponse = {
      week_start: weekStart,
      generated_at: new Date().toISOString(),
      system_health: {
        scan_count: scanCount,
        submit_to_render_rate: submitToRenderRate,
        fallback_rate: fallbackRate,
        signal_yield_pct: signalYieldPct,
        signal_coverage_pct: signalCoveragePct,
      },
      fraud_landscape: fraudLandscape,
      emerging_patterns: emergingPatterns,
      geography: { provinces, top_cities: topCities },
      recent_signals: recentSignals,
      weekly_timeline: weeklyTimeline,
      daily_volume_timeline: dailyVolumeTimeline,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error("[radar-weekly] request failed");
    return NextResponse.json(
      emptyResponse(req.nextUrl.searchParams.get("week_start") ?? ""),
      { status: 200 }
    );
  }
}
