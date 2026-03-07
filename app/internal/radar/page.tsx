"use client";

import { useEffect, useState } from "react";

type SystemHealth = {
  scan_count: number;
  submit_to_render_rate: number | null;
  fallback_rate: number | null;
  signal_yield_pct: number | null;
  signal_coverage_pct: number | null;
};

type RadarData = {
  week_start: string;
  generated_at: string;
  system_health: SystemHealth;
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
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "24px 32px",
    maxWidth: "1200px",
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
    backgroundColor: "#161b22",
    borderRadius: "12px",
    border: "1px solid #30363d",
    borderTop: "1px solid #1c2128",
    padding: "24px",
  },
  sectionTitle: {
    margin: "0 0 20px",
    fontSize: "16px",
    fontWeight: 600,
    color: "#e6edf3",
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
