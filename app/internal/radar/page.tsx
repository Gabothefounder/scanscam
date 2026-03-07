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

type RadarData = {
  week_start: string;
  generated_at: string;
  system_health: SystemHealth;
  fraud_landscape?: FraudLandscape;
  emerging_patterns?: EmergingPattern[];
  geography?: Geography;
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
