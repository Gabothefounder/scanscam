"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatLandscapeLabel, toDisplayShare } from "./utils";

export type FraudLandscapeItem = {
  value: string;
  scan_count: number;
  share_of_week: number;
};

const styles: Record<string, React.CSSProperties> = {
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
};

export default function FraudLandscapeCard({
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
                formatter={(value, _name, item) => {
                  const numericValue = Number(value ?? 0);
                  const count = Number(item?.payload?.count ?? 0);
                  return [`${numericValue.toFixed(1)}% (${count} scans)`, ""];
                }}
              />
              <Bar dataKey="share" fill="#388bfd" radius={[0, 2, 2, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
