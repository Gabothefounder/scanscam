"use client";

import {
  Bar,
  BarChart,
  Cell,
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
  /** Optional display label; when set (e.g. for French), used instead of formatLandscapeLabel(value). */
  label?: string;
};

const darkStyles: Record<string, React.CSSProperties> = {
  landscapeCard: {
    backgroundColor: "#1e252d",
    borderRadius: "8px",
    border: "1px solid #30363d",
    padding: "16px",
  },
  landscapeCardTitle: { margin: "0 0 12px", fontSize: "13px", fontWeight: 600, color: "#e6edf3" },
  landscapeChart: { minHeight: 120 },
  landscapeEmpty: { margin: 0, fontSize: "12px", color: "#6e7681" },
};

const lightStyles: Record<string, React.CSSProperties> = {
  landscapeCard: {
    backgroundColor: "#f6f8fa",
    borderRadius: "6px",
    border: "1px solid #d0d7de",
    padding: "12px",
  },
  landscapeCardTitle: { margin: "0 0 8px", fontSize: "12px", fontWeight: 600, color: "#1a1a1a" },
  landscapeChart: { minHeight: 100 },
  landscapeEmpty: { margin: 0, fontSize: "12px", color: "#57606a" },
};

const DEFAULT_ROW_HEIGHT = 28;
const DEFAULT_LABEL_WIDTH = 110;
const STATIC_MODE_ROW_HEIGHT = 40;
const STATIC_MODE_LABEL_WIDTH = 200;

export default function FraudLandscapeCard({
  title,
  items,
  theme = "dark",
  hideNumericScale = false,
  selectedValue,
  staticMode = false,
}: {
  title: string;
  items: FraudLandscapeItem[];
  theme?: "dark" | "light";
  /** When true, hide x-axis numbers and scale (e.g. for public brief). */
  hideNumericScale?: boolean;
  /** Raw narrative value (e.g. prize_scam) to highlight as the weekly fraud signal. */
  selectedValue?: string | null;
  /** When true, no tooltip/hover values and more space for labels (e.g. public weekly brief). */
  staticMode?: boolean;
}) {
  const styles = theme === "light" ? lightStyles : darkStyles;
  const isLight = theme === "light";
  const defaultFill = isLight ? "#0969da" : "#388bfd";
  const selectedFill = "#d1242f";
  const rowHeight = staticMode ? STATIC_MODE_ROW_HEIGHT : DEFAULT_ROW_HEIGHT;
  const labelWidth = staticMode ? STATIC_MODE_LABEL_WIDTH : DEFAULT_LABEL_WIDTH;
  const minChartHeight = staticMode ? 160 : 120;

  const cleanItems = items.filter((item) => {
    const v = String(item.value ?? "").toLowerCase();
    return v !== "none" && v !== "unknown";
  });
  let rows = cleanItems
    .slice(0, 5)
    .map((item) => ({
      label: item.label ?? formatLandscapeLabel(item.value),
      share: toDisplayShare(item.share_of_week),
      count: item.scan_count,
      value: item.value,
    }));
  if (selectedValue != null && rows.length > 1) {
    const selectedIdx = rows.findIndex((r) => String(r.value) === String(selectedValue));
    if (selectedIdx > 0) {
      const selectedRow = rows[selectedIdx];
      rows = [selectedRow, ...rows.slice(0, selectedIdx), ...rows.slice(selectedIdx + 1)];
    }
  }

  return (
    <div style={styles.landscapeCard}>
      <h3 style={styles.landscapeCardTitle}>{title}</h3>
      {rows.length === 0 ? (
        <p style={styles.landscapeEmpty}>No classified signals available for this period.</p>
      ) : (
        <div style={styles.landscapeChart}>
          <ResponsiveContainer width="100%" height={Math.max(minChartHeight, rows.length * rowHeight)}>
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 0, right: hideNumericScale ? 0 : 8, bottom: 0, left: 0 }}
            >
              <XAxis
                type="number"
                domain={[0, "auto"]}
                tick={hideNumericScale ? false : { fill: isLight ? "#57606a" : "#6e7681", fontSize: 10 }}
                axisLine={hideNumericScale ? false : { stroke: isLight ? "#d0d7de" : "#30363d" }}
                tickLine={false}
                width={hideNumericScale ? 0 : undefined}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={labelWidth}
                tick={{ fill: isLight ? "#24292f" : "#8b949e", fontSize: staticMode ? 12 : 11 }}
                axisLine={false}
                tickLine={false}
              />
              {!staticMode && (
                <Tooltip
                  contentStyle={{
                    backgroundColor: isLight ? "#fff" : "#21262d",
                    border: `1px solid ${isLight ? "#d0d7de" : "#30363d"}`,
                    borderRadius: "6px",
                    fontSize: "11px",
                    color: isLight ? "#1a1a1a" : "#e6edf3",
                  }}
                  labelStyle={{ color: isLight ? "#1a1a1a" : "#e6edf3" }}
                  formatter={(value, _name, item) => {
                    const numericValue = Number(value ?? 0);
                    const count = Number(item?.payload?.count ?? 0);
                    return [`${numericValue.toFixed(1)}% (${count} scans)`, ""];
                  }}
                />
              )}
              <Bar dataKey="share" radius={[0, 2, 2, 0]} maxBarSize={staticMode ? 20 : 16}>
                {rows.map((entry, index) => (
                  <Cell
                    key={entry.value ?? index}
                    fill={selectedValue != null && String(entry.value) === String(selectedValue) ? selectedFill : defaultFill}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
