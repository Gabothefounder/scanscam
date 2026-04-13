import type { RadarMspPartnerRow } from "@/lib/intel/radarMspContext";
import { mspPilotScopeDisplayName } from "@/lib/intel/formatMspPilotReport";

function topPatternPhrase(row: RadarMspPartnerRow): string {
  const t = row.top_narrative.trim().toLowerCase();
  if (!t || t === "unknown") return "no single dominant pattern label";
  return row.top_narrative.replace(/_/g, " ");
}

function highRiskCount(row: RadarMspPartnerRow): number {
  return row.risk_distribution
    .filter((r) => r.risk_tier === "high")
    .reduce((s, r) => s + r.count, 0);
}

/**
 * 2–3 sentences for email intros or Slack — internal / directional, not a legal claim.
 */
export function formatMspShortSummary(row: RadarMspPartnerRow): string {
  const label = mspPilotScopeDisplayName(row.partner_slug);
  const high = highRiskCount(row);
  const pattern = topPatternPhrase(row);

  const s1 = `ScanScam pilot summary for ${label}: ${row.total_scans.toLocaleString()} estimated submissions (v1), ${row.total_escalations.toLocaleString()} escalations, ${high} high-risk escalated case(s), and ~${Math.max(0, row.time_saved_hours)} hours of modeled review time supported this period.`;

  const s2 =
    pattern === "no single dominant pattern label"
      ? "Pattern mix is spread across labels in escalated traffic."
      : `Top pattern in escalated traffic: ${pattern}.`;

  return `${s1} ${s2} Figures are directional — see full report for methodology.`;
}
