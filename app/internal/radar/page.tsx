"use client";

import { useEffect, useState } from "react";
import { CA_PROVINCE_PATHS } from "./canada-paths";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type SystemHealth = {
  scan_count: number;
  submit_to_render_rate: number | null;
  fallback_rate: number | null;
  signal_yield_pct: number | null;
  signal_coverage_pct: number | null;
};

type FraudLandscapeItem = {
  value: string;
  scan_count: number;
  share_of_week: number;
};

type FraudLandscape = {
  narratives: FraudLandscapeItem[];
  channels: FraudLandscapeItem[];
  payment_methods: FraudLandscapeItem[];
  authority_types: FraudLandscapeItem[];
};

type EmergingPattern = {
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
};

type GeoProvince = {
  province: string;
  scan_count: number;
  wow_scan_delta: number;
  high_risk_count: number;
  high_risk_ratio: number | null;
  is_meaningful: boolean;
};

type GeoCity = {
  city: string;
  province: string;
  scan_count: number;
  high_risk_count: number;
};

type Geography = {
  provinces: GeoProvince[];
  top_cities: GeoCity[];
};

type RecentSignal = {
  created_at: string;
  summary_sentence: string | null;
  risk_tier: string;
  city: string | null;
  province: string | null;
};

type RadarData = {
  week_start: string;
  generated_at: string;
  system_health: SystemHealth;
  fraud_landscape?: FraudLandscape;
  emerging_patterns?: EmergingPattern[];
  geography?: Geography;
  recent_signals?: RecentSignal[];
};

/** For values already 0–100 (e.g. signal_yield_pct, signal_coverage_pct) */
function formatPct(val: number | null): string {
  if (val == null) return "—";
  return `${Number(val).toFixed(1)}%`;
}

/** For decimal rates 0–1 (e.g. submit_to_render_rate, fallback_rate) */
function formatRateDecimal(val: number | null): string {
  if (val == null) return "—";
  return `${(Number(val) * 100).toFixed(1)}%`;
}

/** Parse YYYY-MM-DD as local date to avoid timezone shift */
function formatWeek(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function formatGeneratedAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-CA", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

/** Compact human-readable time for signal rows */
function formatSignalTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-CA", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

const SUMMARY_MAX_LEN = 80;

function truncateSummary(s: string | null): string {
  if (!s?.trim()) return "No summary available";
  const t = s.trim();
  return t.length <= SUMMARY_MAX_LEN ? t : t.slice(0, SUMMARY_MAX_LEN) + "…";
}

function RecentSignalsContent({ signals }: { signals: RecentSignal[] }) {
  const [expanded, setExpanded] = useState(false);
  const limit = 5;
  const displayRows = expanded ? signals : signals.slice(0, limit);
  const remaining = signals.length - limit;

  return (
    <>
      <div style={styles.signalsTableWrap}>
        <table style={styles.signalsTable}>
          <thead>
            <tr>
              <th style={styles.signalsTh}>Time</th>
              <th style={styles.signalsTh}>Risk</th>
              <th style={styles.signalsTh}>City</th>
              <th style={styles.signalsTh}>Province</th>
              <th style={styles.signalsTh}>Summary</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr key={i}>
                <td style={styles.signalsTd}>{formatSignalTime(row.created_at)}</td>
                <td
                  style={{
                    ...styles.signalsTd,
                    ...getRiskTierStyle(row.risk_tier),
                  }}
                >
                  {formatRiskTierLabel(row.risk_tier)}
                </td>
                <td
                  style={{
                    ...styles.signalsTd,
                    ...(row.city ? {} : styles.signalsTdMuted),
                  }}
                >
                  {row.city ?? "—"}
                </td>
                <td
                  style={{
                    ...styles.signalsTd,
                    ...(row.province ? {} : styles.signalsTdMuted),
                  }}
                >
                  {row.province ?? "—"}
                </td>
                <td
                  style={{
                    ...styles.signalsTd,
                    ...(row.summary_sentence?.trim()
                      ? {}
                      : styles.signalsTdMuted),
                  }}
                >
                  {truncateSummary(row.summary_sentence)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {signals.length > limit && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={styles.signalsToggle}
        >
          {expanded ? "Show less" : `Show ${remaining} more`}
        </button>
      )}
    </>
  );
}

const CURRENT_SNAPSHOT_PROMPT = `You are analyzing a ScanScam current intelligence snapshot.

Context
Product: ScanScam
Scope: Canada-focused scam signal monitoring
Audience: founder
Purpose: identify meaningful scam patterns, behavioral signals, and geographic concentration.

Important design philosophy:
The system prefers "unknown" classifications over incorrect ones. Do not assume missing labels indicate absence of a signal.

Task
Analyze the dataset and identify:

1. the most important current scam signals
2. any behavioral patterns or scam techniques appearing frequently
3. geographic concentration signals
4. interpretation limits due to sample size
5. a short founder-level interpretation paragraph

Be conservative and avoid overstating conclusions.`;

const WEEKLY_SNAPSHOT_PROMPT = `You are analyzing a ScanScam weekly intelligence snapshot.

Context
Product: ScanScam
Scope: Canada-focused scam signal monitoring
Audience: founder and potential institutional partners
Purpose: identify meaningful weekly scam patterns and shifts.

Important philosophy:
The system prefers "unknown" classifications over incorrect ones. Missing classifications should be interpreted cautiously.

Task
Analyze the dataset and produce:

1. dominant scam patterns this week
2. notable behavioral signals
3. geographic observations
4. possible interpretation limits due to sample size
5. a concise weekly intelligence summary suitable for a founder briefing.

Avoid overclaiming conclusions from small samples.`;

const SYSTEM_QUALITY_SNAPSHOT_PROMPT = `You are analyzing a ScanScam system quality snapshot.

Context
Product: ScanScam
Scope: Canada-focused scam signal monitoring
Audience: founder
Purpose: identify where the detection and extraction system should improve.

Important philosophy:
The system intentionally prefers "unknown" classifications over incorrect ones. High unknown rates indicate caution, not failure, but they still reveal where the system needs better coverage.

Task
Analyze the dataset and identify:

1. which classification areas have the highest unknown rates
2. which signal dimensions are currently strongest
3. where extraction quality appears weakest
4. which improvements would most likely increase signal coverage and high-value signal yield
5. a short prioritized improvement recommendation for the founder

Be conservative and focus on the highest-leverage system improvements.`;

function AnalystBlockCard({
  title,
  sourceView,
  explanation,
  bestFor,
  promptText,
  data,
  onCopyFeedback,
}: {
  title: string;
  sourceView: string;
  explanation: string;
  bestFor: string;
  promptText: string;
  data: unknown;
  onCopyFeedback: (msg: string) => void;
}) {
  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      onCopyFeedback("Prompt helper copied");
    } catch {
      onCopyFeedback("Copy failed");
    }
  };

  const handleCopyData = async () => {
    try {
      const timestamp = new Date().toISOString();
      const header = `ScanScam Analyst Dataset
Block: ${title}
Source View: ${sourceView}
Scope: Canada
Generated: ${timestamp}
Explanation: ${explanation}

`;
      const json = JSON.stringify(data, null, 2);
      await navigator.clipboard.writeText(header + json);
      onCopyFeedback("Dataset copied for LLM analysis");
    } catch {
      onCopyFeedback("Copy failed");
    }
  };

  return (
    <div style={styles.analystBlockCard}>
      <div style={styles.analystBlockHeader}>
        <h3 style={styles.analystBlockTitle}>{title}</h3>
      </div>
      <p style={styles.analystBlockExplanation}>{explanation}</p>
      <p style={styles.analystBlockBestFor}>
        <span style={styles.analystBlockBestForLabel}>Best for: </span>
        {bestFor}
      </p>
      <div style={styles.analystBlockActions}>
        <button type="button" onClick={handleCopyPrompt} style={styles.analystBlockBtn}>
          Copy prompt helper
        </button>
        <button type="button" onClick={handleCopyData} style={styles.analystBlockBtn}>
          Copy data for LLM
        </button>
      </div>
    </div>
  );
}

function AnalystBlocksSection() {
  const [expanded, setExpanded] = useState(false);
  const [blocksData, setBlocksData] = useState<{
    current_snapshot: unknown;
    weekly_snapshot: unknown;
    system_quality_snapshot: unknown;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    if (!expanded) return;
    setLoading(true);
    fetch("/api/intel/analyst-blocks")
      .then((r) => r.json())
      .then(setBlocksData)
      .catch(() => setBlocksData({ current_snapshot: null, weekly_snapshot: null, system_quality_snapshot: null }))
      .finally(() => setLoading(false));
  }, [expanded]);

  return (
    <section style={{ ...styles.section, ...styles.analystBlocksSection, marginTop: "24px" }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={styles.analystBlocksHeader}
        aria-expanded={expanded}
      >
        <span style={styles.analystBlocksChevron}>{expanded ? "▼" : "▶"}</span>
        <h2 style={styles.analystBlocksTitle}>Analyst Blocks</h2>
      </button>
      {expanded && (
        <>
          <p style={styles.analystBlocksSubtitle}>
            Additional internal datasets for deeper analysis, quick export, and external LLM interpretation.
          </p>
          {loading ? (
            <p style={styles.analystBlocksEmpty}>Loading analyst datasets…</p>
          ) : (
            <div style={styles.analystBlocksGrid}>
              <AnalystBlockCard
                title="Current Snapshot"
                sourceView="intel_current_snapshot"
                explanation="Compressed 7-day intelligence summary including activity, risk mix, behavioral signals, geography, and acquisition context."
                bestFor="rapid founder interpretation of the current fraud environment."
                promptText={CURRENT_SNAPSHOT_PROMPT}
                data={blocksData?.current_snapshot ?? {}}
                onCopyFeedback={showToast}
              />
              <AnalystBlockCard
                title="Weekly Snapshot"
                sourceView="intel_weekly_snapshot"
                explanation="Compressed weekly intelligence package combining activity, risk distribution, behavioral patterns, geography, and acquisition signals."
                bestFor="weekly founder review and preparation of intelligence briefs."
                promptText={WEEKLY_SNAPSHOT_PROMPT}
                data={blocksData?.weekly_snapshot ?? {}}
                onCopyFeedback={showToast}
              />
              <AnalystBlockCard
                title="System Quality Snapshot"
                sourceView="intel_system_quality_snapshot"
                explanation="Internal diagnostics for classification coverage, unknown distribution, and signal extraction quality."
                bestFor="identifying where the detection system should improve next."
                promptText={SYSTEM_QUALITY_SNAPSHOT_PROMPT}
                data={blocksData?.system_quality_snapshot ?? {}}
                onCopyFeedback={showToast}
              />
            </div>
          )}
          {toast && <div style={styles.analystBlocksToast}>{toast}</div>}
        </>
      )}
    </section>
  );
}

function formatRiskTierLabel(tier: string): string {
  const s = String(tier ?? "").trim().toLowerCase();
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getRiskTierStyle(tier: string): React.CSSProperties {
  const s = String(tier ?? "").trim().toLowerCase();
  if (s === "high") return { color: "#e6edf3", fontWeight: 500 };
  if (s === "medium") return { color: "#8b949e" };
  return { color: "#6e7681" };
}

const LABEL_MAP: Record<string, string> = {
  delivery_scam: "Delivery Scam",
  government_impersonation: "Government Impersonation",
  financial_phishing: "Financial Phishing",
  p2p_app: "P2P App",
  financial_institution: "Financial Institution",
  tech_company: "Tech Company",
};

function formatLandscapeLabel(raw: string): string {
  const s = String(raw ?? "").trim();
  if (!s) return "—";
  return LABEL_MAP[s] ?? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Deterministic generation of 3 key takeaways from radar payload */
function generateKeyTakeaways(data: RadarData): [string, string, string] {
  const sh = data.system_health;
  const fl = data.fraud_landscape;
  const geo = data.geography;
  const scanCount = sh?.scan_count ?? 0;
  const coverage = sh?.signal_coverage_pct ?? null;
  const yieldPct = sh?.signal_yield_pct ?? null;
  const smallSample = scanCount < 25;

  const coverageNum = coverage != null ? Number(coverage) : null;
  const yieldNum = yieldPct != null ? Number(yieldPct) : null;

  let systemTakeaway: string;
  if (coverageNum == null && yieldNum == null) {
    systemTakeaway = "Signal coverage and yield data are not yet available for this period.";
  } else {
    const coveragePhrase =
      coverageNum != null
        ? coverageNum < 30
          ? `remains low at ${coverageNum.toFixed(1)}%, indicating most scans lack classified core signals`
          : coverageNum < 60
            ? `is moderate at ${coverageNum.toFixed(1)}%`
            : `is strong at ${coverageNum.toFixed(1)}%`
        : "";
    const yieldPhrase =
      yieldNum != null
        ? (yieldNum < 15 ? "low" : yieldNum < 35 ? "moderate" : "strong") +
          ` at ${yieldNum.toFixed(1)}%`
        : "";
    const parts: string[] = [];
    if (coveragePhrase) parts.push(`Signal coverage ${coveragePhrase}.`);
    if (yieldPhrase) parts.push(`Signal yield is ${yieldPhrase}.`);
    systemTakeaway = parts.join(" ") || "System quality metrics are still building.";
    if (smallSample && scanCount > 0) {
      systemTakeaway += ` Sample of ${scanCount} scans—interpret with caution.`;
    }
  }

  const knownItems = (
    [
      ...(fl?.narratives ?? []),
      ...(fl?.channels ?? []),
      ...(fl?.payment_methods ?? []),
      ...(fl?.authority_types ?? []),
    ] as FraudLandscapeItem[]
  )
    .filter((i) => String(i.value ?? "").toLowerCase() !== "unknown")
    .sort((a, b) => (b.scan_count ?? 0) - (a.scan_count ?? 0));

  const topKnown = knownItems.slice(0, 5).map((i) => formatLandscapeLabel(i.value));

  let fraudTakeaway: string;
  if (topKnown.length === 0) {
    fraudTakeaway = "Known classified patterns remain limited this week.";
  } else if (topKnown.length <= 2) {
    fraudTakeaway = `Known patterns this week: ${topKnown.join(" and ")}. Signal coverage remains sparse.`;
  } else {
    fraudTakeaway = `Known patterns this week are led by ${topKnown.slice(0, 3).join(", ")}.`;
  }

  const provinces = geo?.provinces ?? [];
  const topCities = geo?.top_cities ?? [];
  const topProvinceNames = provinces.slice(0, 3).map((p) => p.province);
  const topCity = topCities[0];

  let geoTakeaway: string;
  if (topProvinceNames.length === 0 && !topCity) {
    geoTakeaway = "Geographic activity data are not yet available for this period.";
  } else if (topProvinceNames.length === 0) {
    geoTakeaway = topCity
      ? `${topCity.city}, ${topCity.province} is the most active identified city.`
      : "Geographic concentration data remain limited.";
  } else {
    const provList = topProvinceNames.join(", ");
    const cityPhrase = topCity ? `, with ${topCity.city} the most active identified city` : "";
    if (smallSample && scanCount > 0) {
      geoTakeaway = `Activity distribution is preliminary; ${provList} show highest scan counts${cityPhrase}.`;
    } else {
      geoTakeaway = `${provList} lead scan activity this week${cityPhrase}.`;
    }
  }

  return [systemTakeaway, fraudTakeaway, geoTakeaway];
}

/** share_of_week from API is 0–1; convert to 0–100 for display */
function toDisplayShare(share: number): number {
  return share <= 1 ? share * 100 : share;
}

const DIMENSION_LABELS: Record<string, string> = {
  narrative_category: "Narrative",
  channel_type: "Channel",
  payment_method: "Payment Method",
  authority_type: "Authority Type",
};

function formatDimensionLabel(dim: string): string {
  return DIMENSION_LABELS[dim] ?? dim.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Share 0–1 to X.X% */
function formatSharePct(share: number): string {
  const pct = share <= 1 ? share * 100 : share;
  return `${Number(pct).toFixed(1)}%`;
}

/** share_delta_wow as signed percentage, e.g. +6.0% */
function formatWowChange(delta: number): string {
  const pct = delta <= 1 && delta >= -1 ? delta * 100 : delta;
  const s = Number(pct).toFixed(1);
  if (Number(s) > 0) return `+${s}%`;
  return `${s}%`;
}

/** WoW scan delta as signed, e.g. +12 or -3 */
function formatWowDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

/** Risk ratio 0–1 to X.X% */
function formatRiskRatio(ratio: number | null): string {
  if (ratio == null) return "—";
  const pct = ratio <= 1 ? ratio * 100 : ratio;
  return `${Number(pct).toFixed(1)}%`;
}

function getChoroplethFill(scanCount: number, maxCount: number): string {
  if (scanCount <= 0) return "#21262d";
  if (maxCount <= 0) return "#21262d";
  const t = Math.min(1, scanCount / Math.max(maxCount, 1));
  const opacity = 0.25 + t * 0.6;
  return `rgba(56, 139, 253, ${opacity.toFixed(2)})`;
}

function CanadaChoropleth({ provinces }: { provinces: GeoProvince[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const byCode = Object.fromEntries(
    provinces.map((p) => [String(p.province).toUpperCase(), p]),
  );
  const maxScan = Math.max(0, ...provinces.map((p) => p.scan_count));
  const tooltipProv = hovered ? byCode[hovered] : null;

  return (
    <div style={styles.choroWrap}>
      <svg
        viewBox="0 0 900 520"
        style={styles.choroSvg}
        preserveAspectRatio="xMidYMid meet"
      >
        {Object.entries(CA_PROVINCE_PATHS).map(([code, d]) => {
          const p = byCode[code] ?? {
            province: code,
            scan_count: 0,
            wow_scan_delta: 0,
            high_risk_count: 0,
            high_risk_ratio: null,
            is_meaningful: false,
          };
          const fill = getChoroplethFill(p.scan_count, maxScan);
          return (
            <path
              key={code}
              d={d}
              fill={fill}
              stroke="#30363d"
              strokeWidth={0.8}
              opacity={hovered && hovered !== code ? 0.6 : 1}
              onMouseEnter={() => setHovered(code)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "default" }}
            />
          );
        })}
        {Object.entries(CA_PROVINCE_PATHS).map(([code]) => (
          <text
            key={`${code}-label`}
            x={getProvinceLabelX(code)}
            y={getProvinceLabelY(code)}
            fill="#6e7681"
            fontSize={10}
            textAnchor="middle"
            style={{ pointerEvents: "none" }}
          >
            {code}
          </text>
        ))}
      </svg>
      {tooltipProv && (
        <div style={styles.choroTooltip}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{tooltipProv.province}</div>
          <div style={styles.choroTooltipRow}>Scans: {tooltipProv.scan_count.toLocaleString()}</div>
          <div style={styles.choroTooltipRow}>High-risk: {tooltipProv.high_risk_count}</div>
          <div style={styles.choroTooltipRow}>Risk ratio: {formatRiskRatio(tooltipProv.high_risk_ratio)}</div>
          <div style={styles.choroTooltipRow}>WoW Δ: {formatWowDelta(tooltipProv.wow_scan_delta)}</div>
        </div>
      )}
    </div>
  );
}

function getProvinceLabelX(code: string): number {
  const x: Record<string, number> = {
    YT: 100, NT: 325, NU: 675,
    BC: 70, AB: 205, SK: 330, MB: 450, ON: 615, QC: 810,
    NB: 757, NS: 757, PE: 825, NL: 877,
  };
  return x[code] ?? 450;
}
function getProvinceLabelY(code: string): number {
  const y: Record<string, number> = {
    YT: 35, NT: 35, NU: 35,
    BC: 210, AB: 190, SK: 180, MB: 190, ON: 200, QC: 210,
    NB: 382, NS: 467, PE: 457, NL: 435,
  };
  return y[code] ?? 260;
}

function FraudLandscapeCard({
  title,
  items,
}: {
  title: string;
  items: FraudLandscapeItem[];
}) {
  const rows = items
    .filter((item) => String(item.value ?? "").toLowerCase() !== "unknown")
    .slice(0, 5)
    .map((item) => ({
      label: formatLandscapeLabel(item.value),
      share: toDisplayShare(item.share_of_week),
      count: item.scan_count,
    }));

  return (
    <div style={styles.landscapeCard}>
      <h3 style={styles.landscapeCardTitle}>{title}</h3>
      {rows.length === 0 ? (
        <p style={styles.landscapeEmpty}>No classified signals available for this period.</p>
      ) : (
        <div style={styles.landscapeChart}>
          <ResponsiveContainer width="100%" height={Math.max(120, rows.length * 28)}>
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
            >
              <XAxis
                type="number"
                domain={[0, "auto"]}
                tick={{ fill: "#6e7681", fontSize: 10 }}
                axisLine={{ stroke: "#30363d" }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={110}
                tick={{ fill: "#8b949e", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#21262d",
                  border: "1px solid #30363d",
                  borderRadius: "6px",
                  fontSize: "11px",
                }}
                labelStyle={{ color: "#e6edf3" }}
                formatter={(value: number, _n, props: { payload: (typeof rows)[0] }) => [
                  `${Number(value).toFixed(1)}% (${props.payload.count} scans)`,
                  "",
                ]}
              />
              <Bar dataKey="share" fill="#388bfd" radius={[0, 2, 2, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function RadarPage() {
  const [data, setData] = useState<RadarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/intel/radar-weekly")
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setError(e?.message ?? "Failed to fetch"))
      .finally(() => setLoading(false));
  }, []);

  const sh = data?.system_health;

  return (
    <div style={styles.container}>
      {/* Briefing header */}
      <header style={styles.header}>
        <p style={styles.kicker}>INTERNAL INTELLIGENCE SURFACE</p>
        <div style={styles.headerTop}>
          <div>
            <h1 style={styles.title}>ScanScam Intelligence Radar</h1>
            <p style={styles.subLabel}>Founder Internal / Weekly Intelligence Surface</p>
          </div>
          <div style={styles.badges}>
            <span style={styles.badge}>
              {data ? `Week of ${formatWeek(data.week_start)}` : loading ? "…" : "—"}
            </span>
            <span style={styles.badge}>CA</span>
          </div>
        </div>
        {data?.generated_at && (
          <p style={styles.generatedAt}>Generated {formatGeneratedAt(data.generated_at)}</p>
        )}
      </header>

      <div style={styles.content}>
        {error && (
          <div style={styles.error}>
            <p>{error}</p>
          </div>
        )}

        {loading && !data && (
          <div style={styles.section}>
            <p style={{ color: "#8b949e" }}>Loading system health…</p>
          </div>
        )}

        {!loading && data && (
          <>
            <section style={styles.takeawaysSection}>
              <h2 style={styles.takeawaysTitle}>Key Takeaways</h2>
              <ul style={styles.takeawaysList}>
                {generateKeyTakeaways(data).map((line, i) => (
                  <li key={i} style={styles.takeawaysItem}>
                    {line}
                  </li>
                ))}
              </ul>
            </section>

            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>System Health</h2>
              <div style={styles.metrics}>
                <div style={styles.metric}>
                  <span style={styles.metricLabel}>Scans This Week</span>
                  <span style={styles.metricValue}>
                    {sh?.scan_count != null
                      ? sh.scan_count.toLocaleString()
                      : "—"}
                  </span>
                </div>
                <div style={styles.metric}>
                  <span style={styles.metricLabel}>Scan Completion</span>
                  <span style={styles.metricValue}>
                    {formatRateDecimal(sh?.submit_to_render_rate ?? null)}
                  </span>
                </div>
                <div style={styles.metric}>
                  <span style={styles.metricLabel}>Fallback Rate</span>
                  <span style={styles.metricValue}>
                    {formatRateDecimal(sh?.fallback_rate ?? null)}
                  </span>
                </div>
                <div style={styles.metric}>
                  <span style={styles.metricLabel}>High-Value Signal Yield</span>
                  <span style={styles.metricValue}>
                    {formatPct(sh?.signal_yield_pct ?? null)}
                  </span>
                </div>
                <div style={styles.metric}>
                  <span style={styles.metricLabel}>Signal Coverage</span>
                  <span style={styles.metricValue}>
                    {formatPct(sh?.signal_coverage_pct ?? null)}
                  </span>
                </div>
              </div>
            </section>

            <section style={{ ...styles.section, marginTop: "24px" }}>
              <h2 style={{ ...styles.sectionTitle, marginBottom: "4px" }}>Fraud Landscape</h2>
              <p style={styles.sectionSubtitle}>
                The most common scam patterns detected in current weekly activity.
              </p>
              <div style={styles.landscapeGrid}>
                <FraudLandscapeCard
                  title="Top Narratives"
                  items={data.fraud_landscape?.narratives ?? []}
                />
                <FraudLandscapeCard
                  title="Top Channels"
                  items={data.fraud_landscape?.channels ?? []}
                />
                <FraudLandscapeCard
                  title="Top Payment Methods"
                  items={data.fraud_landscape?.payment_methods ?? []}
                />
                <FraudLandscapeCard
                  title="Top Authority Types"
                  items={data.fraud_landscape?.authority_types ?? []}
                />
              </div>
            </section>

            <section style={{ ...styles.section, marginTop: "24px" }}>
              <h2 style={{ ...styles.sectionTitle, marginBottom: "4px" }}>Emerging Techniques</h2>
              <p style={styles.sectionSubtitle}>
                Signals gaining share versus last week.
              </p>
              {(!data.emerging_patterns || data.emerging_patterns.length === 0) ? (
                <div style={styles.emergingEmpty}>
                  <p style={styles.emergingEmptyMain}>
                    No emerging techniques met the current threshold this week.
                  </p>
                  <p style={styles.emergingEmptySub}>
                    Threshold: at least 3 scans and +5% share change week over week.
                  </p>
                </div>
              ) : (
                <div style={styles.emergingTableWrap}>
                  <table style={styles.emergingTable}>
                    <thead>
                      <tr>
                        <th style={styles.emergingTh}>Dimension</th>
                        <th style={styles.emergingTh}>Value</th>
                        <th style={styles.emergingTh}>This Week</th>
                        <th style={styles.emergingTh}>Share</th>
                        <th style={styles.emergingTh}>WoW Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.emerging_patterns.map((row, i) => (
                        <tr key={i}>
                          <td style={styles.emergingTd}>{formatDimensionLabel(row.dimension)}</td>
                          <td style={styles.emergingTd}>{formatLandscapeLabel(row.value)}</td>
                          <td style={styles.emergingTd}>{row.this_week_count.toLocaleString()}</td>
                          <td style={styles.emergingTd}>{formatSharePct(row.this_week_share)}</td>
                          <td
                            style={{
                              ...styles.emergingTd,
                              ...(row.share_delta_wow > 0 ? styles.emergingTdPositive : {}),
                            }}
                          >
                            {formatWowChange(row.share_delta_wow)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section style={{ ...styles.section, marginTop: "24px" }}>
              <h2 style={{ ...styles.sectionTitle, marginBottom: "4px" }}>Canada Concentration</h2>
              <p style={styles.sectionSubtitle}>
                Where activity is concentrating and shifting across Canada.
              </p>
              {!data.geography?.provinces?.length && !data.geography?.top_cities?.length ? (
                <p style={styles.geoEmpty}>No geographic concentration data available for this period.</p>
              ) : (
                <div style={styles.geoLayout}>
                  <div style={styles.geoLeft}>
                    <CanadaChoropleth provinces={data.geography?.provinces ?? []} />
                  </div>
                  <div style={styles.geoRight}>
                    <div style={styles.geoLeaderboard}>
                      <h3 style={styles.geoCardTitle}>Province Leaderboard</h3>
                      {(!data.geography?.provinces || data.geography.provinces.length === 0) ? (
                        <p style={styles.geoLeaderEmpty}>No province data</p>
                      ) : (
                        <table style={styles.geoLeaderTable}>
                          <thead>
                            <tr>
                              <th style={styles.geoLeaderTh}>Province</th>
                              <th style={styles.geoLeaderTh}>Scans</th>
                              <th style={styles.geoLeaderTh}>WoW Δ</th>
                              <th style={styles.geoLeaderTh}>High-Risk</th>
                              <th style={styles.geoLeaderTh}>Risk Ratio</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.geography!.provinces.map((p, i) => (
                              <tr key={i}>
                                <td style={{ ...styles.geoLeaderTd, ...(p.is_meaningful ? {} : styles.geoLeaderTdMuted) }}>
                                  {p.province}
                                </td>
                                <td style={{ ...styles.geoLeaderTd, ...(p.is_meaningful ? {} : styles.geoLeaderTdMuted) }}>
                                  {p.scan_count.toLocaleString()}
                                </td>
                                <td style={{ ...styles.geoLeaderTd, ...(p.is_meaningful ? {} : styles.geoLeaderTdMuted) }}>
                                  {formatWowDelta(p.wow_scan_delta)}
                                </td>
                                <td style={{ ...styles.geoLeaderTd, ...(p.is_meaningful ? {} : styles.geoLeaderTdMuted) }}>
                                  {p.high_risk_count}
                                </td>
                                <td style={{ ...styles.geoLeaderTd, ...(p.is_meaningful ? {} : styles.geoLeaderTdMuted) }}>
                                  {formatRiskRatio(p.high_risk_ratio)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                    <div style={styles.geoCities}>
                      <h3 style={styles.geoCardTitle}>Top 3 Cities</h3>
                      {(!data.geography?.top_cities || data.geography.top_cities.length === 0) ? (
                        <p style={styles.geoLeaderEmpty}>No city data</p>
                      ) : (
                        data.geography.top_cities.map((c, i) => (
                          <div key={i} style={styles.geoCityRow}>
                            <span style={styles.geoCityName}>{c.city}</span>
                            <span style={styles.geoCityProv}>{c.province}</span>
                            <span style={styles.geoCityMeta}>
                              {c.scan_count} scans · {c.high_risk_count} high-risk
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section style={{ ...styles.section, marginTop: "24px" }}>
              <h2 style={{ ...styles.sectionTitle, marginBottom: "4px" }}>Recent Signals</h2>
              <p style={styles.sectionSubtitle}>
                Latest scan examples feeding the current intelligence picture.
              </p>
              {!data.recent_signals?.length ? (
                <p style={styles.signalsEmpty}>No recent scan signals available for this period.</p>
              ) : (
                <RecentSignalsContent signals={data.recent_signals} />
              )}
            </section>

            <AnalystBlocksSection />
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "24px 56px",
    maxWidth: "1800px",
    margin: "0 auto",
  },
  header: {
    marginBottom: "32px",
  },
  kicker: {
    margin: "0 0 6px",
    fontSize: "10px",
    fontWeight: 500,
    letterSpacing: "1.2px",
    color: "#6e7681",
  },
  headerTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
  },
  title: {
    margin: 0,
    fontSize: "24px",
    fontWeight: 600,
    letterSpacing: "-0.3px",
    color: "#e6edf3",
  },
  subLabel: {
    margin: "4px 0 0",
    fontSize: "13px",
    color: "#8b949e",
    fontWeight: 400,
  },
  badges: {
    display: "flex",
    gap: "6px",
    flexShrink: 0,
  },
  badge: {
    fontSize: "10px",
    fontWeight: 500,
    letterSpacing: "0.4px",
    color: "#6e7681",
    backgroundColor: "transparent",
    border: "1px solid #30363d",
    borderRadius: "3px",
    padding: "3px 6px",
  },
  generatedAt: {
    margin: "10px 0 0",
    fontSize: "10px",
    color: "#484f58",
  },
  content: {},
  section: {
    backgroundColor: "#171d24",
    borderRadius: "12px",
    border: "1px solid #30363d",
    borderTop: "1px solid #21262d",
    padding: "24px",
  },
  sectionTitle: {
    margin: "0 0 20px",
    fontSize: "16px",
    fontWeight: 600,
    color: "#e6edf3",
  },
  takeawaysSection: {
    marginBottom: "24px",
    padding: "20px 24px",
    backgroundColor: "#171d24",
    border: "1px solid #30363d",
    borderLeft: "3px solid #388bfd",
    borderRadius: "8px",
  },
  takeawaysTitle: {
    margin: "0 0 12px",
    fontSize: "14px",
    fontWeight: 600,
    color: "#e6edf3",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  takeawaysList: {
    margin: 0,
    paddingLeft: "18px",
    fontSize: "13px",
    color: "#8b949e",
    lineHeight: 1.6,
  },
  takeawaysItem: {
    marginBottom: "6px",
  },
  sectionSubtitle: {
    margin: "4px 0 20px",
    fontSize: "13px",
    color: "#8b949e",
    lineHeight: 1.4,
  },
  landscapeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "20px",
  },
  landscapeCard: {
    backgroundColor: "#1e252d",
    borderRadius: "8px",
    border: "1px solid #30363d",
    padding: "16px",
  },
  landscapeCardTitle: {
    margin: "0 0 12px",
    fontSize: "13px",
    fontWeight: 600,
    color: "#e6edf3",
  },
  landscapeChart: {
    minHeight: 120,
  },
  landscapeEmpty: {
    margin: 0,
    fontSize: "12px",
    color: "#6e7681",
  },
  emergingEmpty: {
    padding: "24px 0",
  },
  emergingEmptyMain: {
    margin: 0,
    fontSize: "13px",
    color: "#8b949e",
  },
  emergingEmptySub: {
    margin: "6px 0 0",
    fontSize: "12px",
    color: "#6e7681",
  },
  emergingTableWrap: {
    overflowX: "auto",
  },
  emergingTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
  },
  emergingTh: {
    textAlign: "left",
    padding: "10px 16px 10px 0",
    fontWeight: 600,
    color: "#8b949e",
    borderBottom: "1px solid #30363d",
  },
  emergingTd: {
    padding: "10px 16px 10px 0",
    color: "#e6edf3",
    borderBottom: "1px solid #21262d",
  },
  emergingTdPositive: {
    color: "#7ee787",
  },
  geoEmpty: {
    margin: 0,
    fontSize: "13px",
    color: "#6e7681",
  },
  geoLayout: {
    display: "flex",
    flexWrap: "wrap",
    gap: "24px",
    alignItems: "flex-start",
  },
  geoLeft: {
    flex: "1 1 380px",
    minWidth: 0,
  },
  geoRight: {
    flex: "1 1 300px",
    minWidth: "280px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  choroWrap: {
    position: "relative",
    backgroundColor: "#1c2128",
    borderRadius: "8px",
    border: "1px solid #30363d",
    padding: "12px",
    maxWidth: "100%",
  },
  choroSvg: {
    width: "100%",
    maxHeight: "280px",
    display: "block",
  },
  choroTooltip: {
    position: "absolute",
    top: "12px",
    right: "12px",
    backgroundColor: "#21262d",
    border: "1px solid #30363d",
    borderRadius: "6px",
    padding: "10px 12px",
    fontSize: "11px",
    color: "#e6edf3",
    minWidth: "140px",
  },
  choroTooltipRow: {
    marginTop: 2,
  },
  geoLeaderboard: {
    backgroundColor: "#1e252d",
    borderRadius: "8px",
    border: "1px solid #30363d",
    padding: "16px",
  },
  geoCardTitle: {
    margin: "0 0 12px",
    fontSize: "13px",
    fontWeight: 600,
    color: "#e6edf3",
  },
  geoLeaderEmpty: {
    margin: 0,
    fontSize: "12px",
    color: "#6e7681",
  },
  geoLeaderTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "12px",
  },
  geoLeaderTh: {
    textAlign: "left",
    padding: "6px 10px 6px 0",
    fontWeight: 600,
    color: "#8b949e",
    borderBottom: "1px solid #30363d",
  },
  geoLeaderTd: {
    padding: "6px 10px 6px 0",
    color: "#e6edf3",
    borderBottom: "1px solid #21262d",
  },
  geoLeaderTdMuted: {
    color: "#6e7681",
  },
  geoCities: {
    backgroundColor: "#1e252d",
    borderRadius: "8px",
    border: "1px solid #30363d",
    padding: "16px",
  },
  geoCityRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: "8px",
    padding: "6px 0",
    borderBottom: "1px solid #21262d",
    fontSize: "12px",
  },
  geoCityName: {
    fontWeight: 600,
    color: "#e6edf3",
  },
  geoCityProv: {
    color: "#8b949e",
    fontSize: "11px",
  },
  geoCityMeta: {
    color: "#6e7681",
    marginLeft: "auto",
  },
  signalsEmpty: {
    margin: 0,
    fontSize: "13px",
    color: "#6e7681",
  },
  signalsTableWrap: {
    overflowX: "auto",
  },
  signalsTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "12px",
  },
  signalsTh: {
    textAlign: "left",
    padding: "8px 14px 8px 0",
    fontWeight: 600,
    color: "#6e7681",
    borderBottom: "1px solid #30363d",
  },
  signalsTd: {
    padding: "8px 14px 8px 0",
    color: "#8b949e",
    borderBottom: "1px solid #21262d",
  },
  signalsTdMuted: {
    color: "#6e7681",
  },
  signalsToggle: {
    marginTop: "8px",
    padding: "4px 0",
    border: "none",
    background: "none",
    color: "#6e7681",
    fontSize: "12px",
    cursor: "pointer",
  },
  analystBlocksSection: {
    opacity: 0.9,
  },
  analystBlocksHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    width: "100%",
    padding: 0,
    margin: "0 0 4px",
    border: "none",
    background: "none",
    cursor: "pointer",
    textAlign: "left",
  },
  analystBlocksChevron: {
    fontSize: "10px",
    color: "#6e7681",
  },
  analystBlocksTitle: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 600,
    color: "#e6edf3",
  },
  analystBlocksSubtitle: {
    margin: "4px 0 20px",
    fontSize: "13px",
    color: "#8b949e",
    lineHeight: 1.4,
  },
  analystBlocksGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: "16px",
  },
  analystBlockCard: {
    backgroundColor: "#1e252d",
    borderRadius: "8px",
    border: "1px solid #30363d",
    padding: "14px 16px",
  },
  analystBlockHeader: {
    marginBottom: "6px",
  },
  analystBlockTitle: {
    margin: 0,
    fontSize: "14px",
    fontWeight: 600,
    color: "#e6edf3",
  },
  analystBlockExplanation: {
    margin: "0 0 8px",
    fontSize: "12px",
    color: "#8b949e",
    lineHeight: 1.4,
  },
  analystBlockBestFor: {
    margin: "0 0 12px",
    fontSize: "11px",
    color: "#6e7681",
    lineHeight: 1.4,
  },
  analystBlockBestForLabel: {
    fontStyle: "italic",
  },
  analystBlockActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  analystBlockBtn: {
    padding: "6px 10px",
    fontSize: "11px",
    color: "#8b949e",
    backgroundColor: "transparent",
    border: "1px solid #30363d",
    borderRadius: "4px",
    cursor: "pointer",
  },
  analystBlocksEmpty: {
    margin: 0,
    fontSize: "13px",
    color: "#6e7681",
  },
  analystBlocksToast: {
    position: "fixed",
    bottom: "24px",
    left: "50%",
    transform: "translateX(-50%)",
    padding: "8px 16px",
    fontSize: "12px",
    color: "#e6edf3",
    backgroundColor: "#21262d",
    border: "1px solid #30363d",
    borderRadius: "6px",
    zIndex: 1000,
  },
  metrics: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: "20px",
  },
  metric: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  metricLabel: {
    fontSize: "12px",
    color: "#8b949e",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  metricValue: {
    fontSize: "20px",
    fontWeight: 600,
    color: "#e6edf3",
  },
  error: {
    padding: "16px",
    backgroundColor: "rgba(248,81,73,0.15)",
    border: "1px solid #f85149",
    borderRadius: "8px",
    color: "#f85149",
    marginBottom: "24px",
  },
};
