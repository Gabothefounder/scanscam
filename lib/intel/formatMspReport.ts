import type { RadarMspPartnerRow } from "@/lib/intel/radarMspContext";

/** Plain-text block for operators (notes / pilot follow-up). Directional, not a financial claim. */
export function formatMspReport(partnerData: RadarMspPartnerRow): string {
  const high = partnerData.risk_distribution
    .filter((r) => r.risk_tier === "high")
    .reduce((s, r) => s + r.count, 0);

  const lines: string[] = [];
  lines.push("Pilot snapshot (internal, partner-attributed):");
  lines.push(`- ${partnerData.total_scans} scans (v1 estimate from landing path + escalations)`);
  lines.push(`- ${partnerData.total_escalations} escalated to the partner team`);
  if (partnerData.total_scans > 0) {
    const resolved = Math.max(0, partnerData.total_scans - partnerData.total_escalations);
    const filteredPct = Math.round((resolved / partnerData.total_scans) * 1000) / 10;
    lines.push(
      `- ${filteredPct}% estimated volume filtered before escalation (directional; complement of escalation rate)`
    );
  }
  lines.push(`- ${high} escalated scans rated high risk`);
  lines.push("");
  lines.push(
    `Estimated review time saved (modeled, directional): ~${Math.max(0, partnerData.time_saved_hours)} hours — not measured clock time.`
  );
  lines.push("");
  lines.push("Top patterns seen in escalated scans:");
  lines.push(`- ${partnerData.top_narrative}`);
  lines.push("");
  lines.push("Most common requested action (escalated scans):");
  lines.push(`- ${partnerData.top_action}`);
  return lines.join("\n");
}
