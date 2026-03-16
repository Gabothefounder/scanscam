/**
 * Shared formatters for chart components (FraudLandscapeCard, CanadaChoropleth).
 * Used by internal radar dashboard and any consumer of the extracted charts.
 */

const LABEL_MAP: Record<string, string> = {
  delivery_scam: "Delivery Scam",
  government_impersonation: "Government Impersonation",
  financial_phishing: "Financial Phishing",
  p2p_app: "P2P App",
  financial_institution: "Financial Institution",
  tech_company: "Tech Company",
  prize_scam: "Prize Scam",
};

export function formatLandscapeLabel(raw: string): string {
  const s = String(raw ?? "").trim();
  if (!s) return "—";
  return LABEL_MAP[s] ?? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** share_of_week from API is 0–1; convert to 0–100 for display */
export function toDisplayShare(share: number): number {
  return share <= 1 ? share * 100 : share;
}

/** Decode URL-encoded geography labels (e.g. Maple%20Ridge → Maple Ridge) */
export function formatGeoValue(value: string | null | undefined): string {
  if (value == null) return "";
  const s = String(value).trim();
  if (!s) return "";
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Risk ratio 0–1 to X.X% */
export function formatRiskRatio(ratio: number | null): string {
  if (ratio == null) return "—";
  const pct = ratio <= 1 ? ratio * 100 : ratio;
  return `${Number(pct).toFixed(1)}%`;
}

/** WoW scan delta as signed, e.g. +12 or -3 */
export function formatWowDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}
