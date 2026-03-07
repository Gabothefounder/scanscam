"use client";

import { useEffect, useState } from "react";
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

type RadarData = {
  week_start: string;
  generated_at: string;
  system_health: SystemHealth;
  fraud_landscape?: FraudLandscape;
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
