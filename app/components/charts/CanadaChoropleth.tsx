"use client";

import { useState } from "react";
import { CA_PROVINCE_PATHS } from "./canada-paths";
import { formatGeoValue, formatRiskRatio, formatWowDelta } from "./utils";

export type GeoProvince = {
  province: string;
  scan_count: number;
  wow_scan_delta: number;
  high_risk_count: number;
  high_risk_ratio: number | null;
  is_meaningful: boolean;
};

const styles: Record<string, React.CSSProperties> = {
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
};

function getChoroplethFill(scanCount: number, maxCount: number): string {
  if (scanCount <= 0) return "#21262d";
  if (maxCount <= 0) return "#21262d";
  const t = Math.min(1, scanCount / Math.max(maxCount, 1));
  const opacity = 0.25 + t * 0.6;
  return `rgba(56, 139, 253, ${opacity.toFixed(2)})`;
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

export default function CanadaChoropleth({
  provinces,
  isMobile,
}: {
  provinces: GeoProvince[];
  isMobile?: boolean;
}) {
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
        style={{ ...styles.choroSvg, ...(isMobile ? { maxHeight: "200px" } : {}) }}
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
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{formatGeoValue(tooltipProv.province)}</div>
          <div style={styles.choroTooltipRow}>Scans: {tooltipProv.scan_count.toLocaleString()}</div>
          <div style={styles.choroTooltipRow}>High-risk: {tooltipProv.high_risk_count}</div>
          <div style={styles.choroTooltipRow}>Risk ratio: {formatRiskRatio(tooltipProv.high_risk_ratio)}</div>
          <div style={styles.choroTooltipRow}>WoW Δ: {formatWowDelta(tooltipProv.wow_scan_delta)}</div>
        </div>
      )}
    </div>
  );
}
