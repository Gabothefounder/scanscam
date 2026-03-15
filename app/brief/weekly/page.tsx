"use client";

import { useEffect, useState } from "react";
import FraudLandscapeCard from "@/app/components/charts/FraudLandscapeCard";
import { formatLandscapeLabel, toDisplayShare } from "@/app/components/charts/utils";

type BriefData = {
  week_start: string;
  generated_at: string;
  scan_count: number;
  top_narrative: string;
  top_channel: string;
  top_authority: string | null;
  top_payment_method: string | null;
  fraud_label: string;
  how_it_works: string;
  protection_tip: string;
  narratives: { value: string; scan_count: number; share_of_week: number }[];
  channels: { value: string; scan_count: number; share_of_week: number }[];
};

function formatWeek(iso: string): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

function formatGeneratedAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

/** Build "signal observed" intro from API fields. */
function getSignalObservedText(data: BriefData): string {
  const n = data.scan_count ?? 0;
  const parts: string[] = [];
  if (n > 0) {
    parts.push(`This week ScanScam processed ${n.toLocaleString()} scans.`);
  } else {
    parts.push("No scan volume data is available for this period.");
  }
  if (data.fraud_label && data.fraud_label !== "No dominant pattern identified") {
    parts.push(`The dominant pattern observed was ${data.fraud_label}.`);
  }
  const narrativeList = (data.narratives ?? []).filter(
    (i) => String(i.value ?? "").toLowerCase() !== "unknown"
  );
  const channelList = (data.channels ?? []).filter(
    (i) => String(i.value ?? "").toLowerCase() !== "unknown"
  );
  if (narrativeList.length > 0) {
    const top = narrativeList.slice(0, 3).map(
      (i) => `${formatLandscapeLabel(i.value)} (${toDisplayShare(i.share_of_week).toFixed(1)}%)`
    );
    parts.push(`Top narratives: ${top.join(", ")}.`);
  }
  if (channelList.length > 0) {
    const top = channelList.slice(0, 3).map(
      (i) => `${formatLandscapeLabel(i.value)} (${toDisplayShare(i.share_of_week).toFixed(1)}%)`
    );
    parts.push(`Top channels: ${top.join(", ")}.`);
  }
  return parts.join(" ") || "No classified signals available for this period.";
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    maxWidth: 720,
    margin: "0 auto",
    padding: "24px 16px",
    fontFamily: "system-ui, sans-serif",
    color: "#1a1a1a",
    backgroundColor: "#fff",
  },
  header: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: "1px solid #e0e0e0",
  },
  title: {
    margin: "0 0 4px",
    fontSize: 22,
    fontWeight: 700,
    color: "#1a1a1a",
  },
  meta: {
    margin: 0,
    fontSize: 13,
    color: "#666",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    margin: "0 0 8px",
    fontSize: 14,
    fontWeight: 600,
    color: "#333",
    textTransform: "uppercase",
    letterSpacing: "0.02em",
  },
  sectionBody: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.5,
    color: "#444",
  },
  landscapeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 20,
    marginTop: 12,
  },
  loading: {
    padding: 48,
    textAlign: "center",
    color: "#666",
    fontSize: 14,
  },
  error: {
    padding: 48,
    textAlign: "center",
    color: "#c00",
    fontSize: 14,
  },
};

export default function BriefWeeklyPage() {
  const [data, setData] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/brief/weekly", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 502 ? "Service temporarily unavailable" : "Failed to load brief");
        return res.json();
      })
      .then((json: BriefData) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? "Failed to load weekly brief");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div style={styles.loading}>Loading weekly brief…</div>;
  }
  if (error) {
    return <div style={styles.error}>{error}</div>;
  }
  if (!data) {
    return <div style={styles.error}>No data available.</div>;
  }

  const weekLabel = data.week_start ? `Week of ${formatWeek(data.week_start)}` : "Weekly brief";
  const generatedLabel = data.generated_at ? `Generated ${formatGeneratedAt(data.generated_at)}` : "";

  return (
    <div style={styles.wrap} className="brief-weekly">
      <header style={styles.header}>
        <h1 style={styles.title}>ScanScam Weekly Brief</h1>
        <p style={styles.meta}>{weekLabel}. {generatedLabel}</p>
      </header>

      {/* 1. Signal observed */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>1. Signal observed</h2>
        <p style={styles.sectionBody}>{getSignalObservedText(data)}</p>
        <div style={styles.landscapeGrid}>
          <FraudLandscapeCard title="Narratives" items={data.narratives ?? []} />
          <FraudLandscapeCard title="Channels" items={data.channels ?? []} />
        </div>
      </section>

      {/* 2. How the fraud works */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>2. How the fraud works</h2>
        <p style={styles.sectionBody}>{data.how_it_works}</p>
        {(data.top_authority || data.top_payment_method) && (
          <p style={styles.sectionBody}>
            {data.top_authority && `This week, impersonation of ${data.top_authority} was among the most common authority types. `}
            {data.top_payment_method && `Requests for payment via ${data.top_payment_method} were frequently observed.`}
          </p>
        )}
      </section>

      {/* 3. Observed signals */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>3. Observed signals</h2>
        <p style={styles.sectionBody}>
          {data.fraud_label && data.fraud_label !== "No dominant pattern identified"
            ? `This week’s dominant pattern was ${data.fraud_label}. Volume and category breakdown are shown in the charts above.`
            : "Volume and category breakdown for this period are shown in the charts above."}
        </p>
      </section>

      {/* 4. How to protect yourself */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>4. How to protect yourself</h2>
        <p style={styles.sectionBody}>{data.protection_tip}</p>
      </section>
    </div>
  );
}
