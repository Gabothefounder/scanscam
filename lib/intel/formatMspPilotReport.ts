import type { ClientAccountEscalationRow, RadarMspPartnerRow } from "@/lib/intel/radarMspContext";

/** Human-readable pilot scope title (no internal slugs exposed raw). */
export function mspPilotScopeDisplayName(partnerSlug: string): string {
  const s = partnerSlug.trim();
  if (s === "(all partners)") return "All pilot partners (aggregated view)";
  if (s === "(no slug)") return "Pilot program";
  return s
    .split(/[-_]/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function formatNarrativeForPartner(text: string): string {
  const t = text.trim();
  if (!t || t === "unknown") return "—";
  return t.replace(/_/g, " ");
}

/** Share of estimated volume that did not generate an MSP escalation row (v1 methodology). */
function resolvedWithoutEscalationPct(row: RadarMspPartnerRow): number | null {
  if (row.total_scans <= 0) return null;
  const resolved = Math.max(0, row.total_scans - row.total_escalations);
  return Math.round((resolved / row.total_scans) * 1000) / 10;
}

function highRiskCount(row: RadarMspPartnerRow): number {
  return row.risk_distribution
    .filter((r) => r.risk_tier === "high")
    .reduce((s, r) => s + r.count, 0);
}

/** Example: `2026-04-13 09:15 ET` — for report framing (America/New_York). */
export function formatReportTimestampEt(isoUtc: string): string {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return "—";
  const raw = d.toLocaleString("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${raw.replace(/,\s*/, " ")} ET`;
}

function topHighRiskClientConcentrationLine(clients: ClientAccountEscalationRow[]): string | null {
  const nonzero = clients.filter((c) => c.high_risk_escalation_count > 0);
  if (!nonzero.length) return null;
  const max = Math.max(...nonzero.map((c) => c.high_risk_escalation_count));
  const tied = nonzero.filter((c) => c.high_risk_escalation_count === max);
  tied.sort((a, b) =>
    a.company_display.localeCompare(b.company_display, undefined, { sensitivity: "base" })
  );
  const top = tied[0]!;
  return `Highest concentration of escalated high-risk cases came from: **${top.company_display}** (${top.high_risk_escalation_count}).`;
}

/**
 * Clean, partner-facing pilot summary (markdown-friendly plain text).
 * Uses only fields suitable for external sharing; no internal/debug identifiers.
 */
export type MspPilotReportVariant = "executive" | "operational";

export type FormatMspPilotReportOptions = {
  variant?: MspPilotReportVariant;
  /** ISO UTC; shown as Eastern time in the report framing. */
  generatedAtUtc?: string;
  /** Human-readable window, e.g. “All available pilot data”. */
  periodLabel?: string;
};

/**
 * @param variant — `operational` adds internal-only triage detail (still no raw TSV/debug).
 */
export function formatMspPilotReport(
  partnerData: RadarMspPartnerRow,
  options?: FormatMspPilotReportOptions
): string {
  const variant = options?.variant ?? "executive";
  const scope = mspPilotScopeDisplayName(partnerData.partner_slug);
  const resolvedPct = resolvedWithoutEscalationPct(partnerData);
  const high = highRiskCount(partnerData);
  const narrative = formatNarrativeForPartner(partnerData.top_narrative);
  const action = formatNarrativeForPartner(partnerData.top_action);
  const generatedLine =
    options?.generatedAtUtc != null
      ? formatReportTimestampEt(options.generatedAtUtc)
      : formatReportTimestampEt(new Date().toISOString());
  const periodLine = options?.periodLabel?.trim() || "All available pilot data";

  const lines: string[] = [];

  lines.push("# ScanScam pilot summary");
  lines.push("");
  lines.push("## Overview");
  lines.push(
    `This report summarizes recent ScanScam activity for **${scope}**: how many messages users checked, how many reached your team, and what patterns appeared in escalated cases. Figures are directional and based on our current pilot methodology—not a legal or financial statement.`
  );
  lines.push("");
  lines.push("## Report framing");
  lines.push(`- **Generated:** ${generatedLine}`);
  lines.push(`- **Period:** ${periodLine}`);
  lines.push(`- **Partner:** ${scope}`);
  lines.push("");

  lines.push("## Key metrics");
  lines.push(
    `- **Estimated submissions (methodology v1):** ${partnerData.total_scans.toLocaleString()}`
  );
  lines.push(`- **Escalated to your team:** ${partnerData.total_escalations.toLocaleString()}`);
  lines.push(
    "_Escalation counts reflect submission events and may differ from unique scan totals._"
  );
  if (resolvedPct != null) {
    lines.push(
      `- **Resolved without escalation (estimated):** ${resolvedPct}% of submissions did not create an MSP ticket in this period.`
    );
  }
  lines.push(
    `- **High-risk escalations:** ${high.toLocaleString()} (messages escalated to you that ScanScam rated **high** risk)`
  );
  lines.push(
    `- **Estimated review time supported (modeled):** ~${Math.max(0, partnerData.time_saved_hours)} hours — illustrative only; not measured clock time.`
  );
  lines.push("");

  lines.push("## What this means");
  if (partnerData.total_escalations === 0 && partnerData.total_scans > 0) {
    lines.push(
      "Users submitted messages for analysis, but none were escalated to your queue in this window—either self-serve triage met their needs or escalation was not triggered."
    );
  } else if (resolvedPct != null && resolvedPct >= 60) {
    lines.push(
      "A majority of submissions did not become MSP tickets, which suggests ScanScam is absorbing routine triage before your technicians engage. Use escalations to focus on higher-touch cases."
    );
  } else if (resolvedPct != null && resolvedPct < 40 && partnerData.total_escalations > 0) {
    lines.push(
      "A larger share of submissions reached your team. That may reflect pilot traffic, user behavior, or patterns worth reviewing with your ScanScam contact to tune guidance and thresholds."
    );
  } else {
    lines.push(
      "Volume is split between self-serve analysis and MSP-visible escalations. The pattern summary below highlights what users are seeing when they do escalate."
    );
  }
  lines.push("");

  lines.push("## Top patterns");
  lines.push(
    narrative === "—"
      ? "No dominant narrative label in escalated cases for this period."
      : `Among escalated messages, the leading pattern label was **${narrative}**.`
  );
  lines.push("");

  lines.push("## Most common actions");
  lines.push(
    action === "—"
      ? "No dominant requested-action label in escalated cases for this period."
      : `Among escalated messages, the most common requested action was **${action}**.`
  );
  lines.push("");

  const clients = partnerData.client_accounts_escalation ?? [];
  if (clients.length > 0) {
    lines.push("## Client accounts (escalation-based)");
    lines.push(
      "_Based on `submitted_by_company` on escalation rows only—not full per-client scan volume unless broader attribution exists._"
    );
    lines.push("");
    for (const c of clients) {
      lines.push(
        `- **${c.company_display}** — ${c.escalation_count.toLocaleString()} escalations (${c.high_risk_escalation_count.toLocaleString()} high-risk)`
      );
    }
    lines.push("");
    const hiLine = topHighRiskClientConcentrationLine(clients);
    if (hiLine) {
      lines.push(hiLine);
      lines.push("");
    }
  }

  if (variant === "operational") {
    lines.push("## Operational detail");
    lines.push(
      "_Internal pilot review only — supplemental triage fields; not intended as a partner-facing export._"
    );
    lines.push("");
    if (partnerData.escalation_rate != null) {
      lines.push(
        `- **Escalation rate:** ${(partnerData.escalation_rate * 100).toFixed(1)}% (escalations / estimated submissions, v1)`
      );
    } else {
      lines.push("- **Escalation rate:** — (insufficient denominator for this scope)");
    }
    lines.push(
      `- **Refined analyses:** ${partnerData.refined_escalations.toLocaleString()} escalated scan(s) where users completed optional context and received a follow-up analysis.`
    );
    lines.push("- **Risk mix (escalated scans):**");
    if (partnerData.risk_distribution.length === 0) {
      lines.push("  - No risk breakdown in this scope.");
    } else {
      for (const r of partnerData.risk_distribution) {
        lines.push(`  - ${r.risk_tier}: ${r.count.toLocaleString()}`);
      }
    }
    lines.push("");
  }

  lines.push("## Methodology (short)");
  lines.push(
    "- **Submissions** are estimated from partner-branded usage and escalation records (v1); not a guaranteed census of every end-user touchpoint."
  );
  lines.push(
    "- **Escalations** are messages your users sent to your team via the pilot workflow."
  );
  lines.push(
    "- **Escalation / submission counts** may be row- or scan-based depending on the metric; submission events can differ from unique scan totals."
  );
  lines.push(
    "- **Client-account views** (when shown) count only identities captured on escalation submissions (`submitted_by_company`); they do not represent all partner scan activity until broader attribution exists."
  );
  lines.push(
    "- **Resolved without escalation** is the complement of the escalation rate against the same submission estimate—useful directionally, not as a contractual SLA."
  );
  lines.push(
    "- **Time saved** uses a simple internal model for discussion purposes only; it is not an audited productivity claim."
  );
  lines.push(
    "- **Pilot-stage totals** remain directional; use them for operational triage and narrative, not as audited operational or financial baselines."
  );
  lines.push("");

  lines.push("---");
  lines.push(
    "ScanScam helps your clients check suspicious messages earlier and gives your team a clearer picture when a case does need human review. Questions about this report: contact your ScanScam pilot lead."
  );

  return lines.join("\n");
}
