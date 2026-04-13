"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  buildAllPartnersReportRow,
  MSP_CLIENT_ACCOUNTS_TOP_SHOWN,
  type RadarMspContextResponse,
  type RadarMspPartnerRow,
} from "@/lib/intel/radarMspContext";
import {
  formatMspPilotReport,
  formatReportTimestampEt,
  mspPilotScopeDisplayName,
  type MspPilotReportVariant,
} from "@/lib/intel/formatMspPilotReport";
import { formatMspShortSummary } from "@/lib/intel/formatMspShortSummary";

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f6f8fa",
    padding: "28px 22px 48px",
    boxSizing: "border-box" as const,
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  },
  inner: { maxWidth: "820px", margin: "0 auto" },
  title: {
    fontSize: "22px",
    fontWeight: 650,
    margin: "0 0 8px",
    color: "#1f2328",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    fontSize: "14px",
    color: "#57606a",
    lineHeight: 1.55,
    margin: "0 0 24px",
    maxWidth: "640px",
  },
  controlBar: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "12px 16px",
    alignItems: "flex-end",
    marginBottom: "20px",
    padding: "14px 16px",
    backgroundColor: "#ffffff",
    border: "1px solid #d0d7de",
    borderRadius: "10px",
    boxShadow: "0 1px 2px rgba(31,35,40,0.04)",
  },
  field: { display: "flex", flexDirection: "column" as const, gap: "4px" },
  fieldLabel: { fontSize: "11px", fontWeight: 600, color: "#57606a", textTransform: "uppercase" as const },
  select: {
    padding: "8px 10px",
    fontSize: "13px",
    borderRadius: "6px",
    border: "1px solid #d0d7de",
    backgroundColor: "#fff",
    color: "#1f2328",
    minWidth: "160px",
  },
  selectDisabled: {
    opacity: 0.65,
    cursor: "not-allowed" as const,
  },
  periodHint: { fontSize: "11px", color: "#6e7781", marginTop: "2px", maxWidth: "200px" },
  meta: { fontSize: "12px", color: "#6e7781", marginBottom: "16px" },
  strip: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: "10px",
    marginBottom: "20px",
  },
  stripTile: {
    backgroundColor: "#fff",
    border: "1px solid #d0d7de",
    borderRadius: "8px",
    padding: "12px 14px",
  },
  stripLabel: { fontSize: "10px", fontWeight: 600, color: "#6e7781", textTransform: "uppercase" as const },
  stripValue: { fontSize: "18px", fontWeight: 650, color: "#1f2328", marginTop: "4px" },
  stripHint: { fontSize: "10px", color: "#8c959f", marginTop: "4px", lineHeight: 1.35 },
  reportShell: {
    backgroundColor: "#fff",
    border: "1px solid #d0d7de",
    borderRadius: "10px",
    padding: "22px 24px 28px",
    boxShadow: "0 1px 3px rgba(31,35,40,0.06)",
    marginBottom: "16px",
  },
  reportHeading: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#57606a",
    textTransform: "uppercase" as const,
    margin: "0 0 14px",
    letterSpacing: "0.04em",
  },
  reportBody: {
    margin: 0,
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
    fontSize: "14px",
    lineHeight: 1.65,
    color: "#24292f",
    fontFamily: "inherit",
  },
  actions: { display: "flex", flexWrap: "wrap" as const, gap: "10px", marginBottom: "20px" },
  btnPrimary: {
    padding: "9px 16px",
    fontSize: "13px",
    fontWeight: 600,
    color: "#fff",
    backgroundColor: "#0969da",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer" as const,
  },
  btnSecondary: {
    padding: "9px 16px",
    fontSize: "13px",
    fontWeight: 600,
    color: "#0969da",
    backgroundColor: "#fff",
    border: "1px solid #0969da",
    borderRadius: "6px",
    cursor: "pointer" as const,
  },
  toast: { fontSize: "12px", color: "#1a7f37", alignSelf: "center" as const },
  details: {
    marginTop: "8px",
    border: "1px solid #d0d7de",
    borderRadius: "8px",
    backgroundColor: "#fff",
    padding: "0 14px 12px",
  },
  summary: {
    cursor: "pointer" as const,
    fontSize: "13px",
    fontWeight: 600,
    color: "#0969da",
    padding: "12px 0",
    listStyle: "none" as const,
  },
  methodology: {
    margin: 0,
    paddingLeft: "18px",
    fontSize: "12px",
    color: "#57606a",
    lineHeight: 1.65,
  },
  err: { color: "#cf222e", fontSize: "14px" },
  clientSectionTitle: {
    fontSize: "15px",
    fontWeight: 650,
    color: "#1f2328",
    margin: "0 0 8px",
  },
  clientSectionNote: {
    fontSize: "12px",
    color: "#57606a",
    lineHeight: 1.55,
    margin: "0 0 14px",
    maxWidth: "720px",
  },
  clientTable: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "13px",
  },
  clientTh: {
    textAlign: "left" as const,
    fontSize: "10px",
    fontWeight: 600,
    color: "#6e7781",
    textTransform: "uppercase" as const,
    padding: "8px 10px 8px 0",
    borderBottom: "1px solid #d0d7de",
  },
  clientTd: {
    padding: "8px 10px 8px 0",
    borderBottom: "1px solid #eaeef2",
    color: "#24292f",
    verticalAlign: "top" as const,
  },
};

function resolvedPct(row: RadarMspPartnerRow): number | null {
  if (row.total_scans <= 0) return null;
  const resolved = Math.max(0, row.total_scans - row.total_escalations);
  return Math.round((resolved / row.total_scans) * 1000) / 10;
}

function highRisk(row: RadarMspPartnerRow): number {
  return row.risk_distribution
    .filter((r) => r.risk_tier === "high")
    .reduce((s, r) => s + r.count, 0);
}

function topHighRiskClientDetail(row: RadarMspPartnerRow): {
  company_display: string;
  high_risk_escalation_count: number;
} | null {
  const clients = row.client_accounts_escalation ?? [];
  const nonzero = clients.filter((c) => c.high_risk_escalation_count > 0);
  if (!nonzero.length) return null;
  const max = Math.max(...nonzero.map((c) => c.high_risk_escalation_count));
  const tied = nonzero.filter((c) => c.high_risk_escalation_count === max);
  tied.sort((a, b) =>
    a.company_display.localeCompare(b.company_display, undefined, { sensitivity: "base" })
  );
  const top = tied[0]!;
  return { company_display: top.company_display, high_risk_escalation_count: top.high_risk_escalation_count };
}

function MspReportWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [payload, setPayload] = useState<RadarMspContextResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [partnerKey, setPartnerKey] = useState<string>("all");
  const [reportVariant, setReportVariant] = useState<MspPilotReportVariant>("executive");
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const urlPartner = searchParams.get("partner") ?? searchParams.get("partner_slug") ?? "";
  const urlMode = searchParams.get("mode") as MspPilotReportVariant | null;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/intel/radar-msp-context")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error ?? "Failed to load report data");
        return body as RadarMspContextResponse;
      })
      .then((d) => {
        if (!cancelled) setPayload(d);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!payload) return;
    const p = urlPartner.trim();
    if (p && (p === "all" || payload.per_partner.some((x) => x.partner_slug === p))) {
      setPartnerKey(p === "all" ? "all" : p);
    }
    if (urlMode === "executive" || urlMode === "operational") setReportVariant(urlMode);
  }, [payload, urlPartner, urlMode]);

  const row: RadarMspPartnerRow | null = useMemo(() => {
    if (!payload) return null;
    if (partnerKey === "all") return buildAllPartnersReportRow(payload);
    return payload.per_partner.find((p) => p.partner_slug === partnerKey) ?? null;
  }, [payload, partnerKey]);

  const reportText = useMemo(() => {
    if (!row || !payload) return "";
    return formatMspPilotReport(row, {
      variant: reportVariant,
      generatedAtUtc: payload.generated_at_utc,
      periodLabel: payload.period_label ?? "All available pilot data",
    });
  }, [row, reportVariant, payload]);

  const shortSummary = useMemo(() => (row ? formatMspShortSummary(row) : ""), [row]);

  const highRiskClientTop = useMemo(() => (row ? topHighRiskClientDetail(row) : null), [row]);

  const syncUrl = useCallback(
    (nextPartner: string, nextMode: MspPilotReportVariant) => {
      const q = new URLSearchParams();
      q.set("partner", nextPartner === "all" ? "all" : nextPartner);
      q.set("mode", nextMode);
      router.replace(`/internal/msp-report?${q.toString()}`, { scroll: false });
    },
    [router]
  );

  const onPartnerChange = (v: string) => {
    setPartnerKey(v);
    syncUrl(v, reportVariant);
  };

  const onModeChange = (v: MspPilotReportVariant) => {
    setReportVariant(v);
    syncUrl(partnerKey, v);
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg(`${label} copied.`);
    } catch {
      setCopyMsg("Copy failed.");
    }
    setTimeout(() => setCopyMsg(null), 2200);
  };

  if (loadError) {
    return (
      <div style={styles.page}>
        <div style={styles.inner}>
          <p style={styles.err}>{loadError}</p>
        </div>
      </div>
    );
  }

  if (!payload) {
    return (
      <div style={styles.page}>
        <div style={styles.inner}>
          <h1 style={styles.title}>MSP report workspace</h1>
          <p style={styles.subtitle}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.inner}>
        <h1 style={styles.title}>MSP report workspace</h1>
        <p style={styles.subtitle}>
          Internal MSP report workspace. Use this to review value, copy summaries, and prepare pilot updates. Not a client
          portal — share exports deliberately.
        </p>

        <div style={styles.controlBar}>
          <div style={styles.field}>
            <span style={styles.fieldLabel}>Partner</span>
            <select
              style={styles.select}
              value={partnerKey}
              onChange={(e) => onPartnerChange(e.target.value)}
            >
              <option value="all">All partners</option>
              {payload.per_partner.map((p) => (
                <option key={p.partner_slug} value={p.partner_slug}>
                  {p.partner_slug}
                </option>
              ))}
            </select>
          </div>
          <div style={styles.field}>
            <span style={styles.fieldLabel}>Report mode</span>
            <select
              style={styles.select}
              value={reportVariant}
              onChange={(e) => onModeChange(e.target.value as MspPilotReportVariant)}
            >
              <option value="executive">Executive summary</option>
              <option value="operational">Operational summary</option>
            </select>
          </div>
          <div style={styles.field}>
            <span style={styles.fieldLabel}>Period</span>
            <select style={{ ...styles.select, ...styles.selectDisabled }} value="all" disabled>
              <option value="all">All data (current)</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
            <span style={styles.periodHint}>
              Period filter is scaffolded. Report output uses <strong>{payload.period_label ?? "All available pilot data"}</strong>{" "}
              until the API supports date windows (no 7d/30d filtering yet).
            </span>
          </div>
        </div>

        {row ? (
          <>
            <p style={styles.meta}>
              <strong>Generated:</strong> {formatReportTimestampEt(payload.generated_at_utc)} ·{" "}
              <strong>Period:</strong> {payload.period_label ?? "All available pilot data"} ·{" "}
              <strong>Partner:</strong>{" "}
              {partnerKey === "all" ? mspPilotScopeDisplayName("(all partners)") : mspPilotScopeDisplayName(partnerKey)}{" "}
              ·{" "}
              {reportVariant === "executive" ? "Executive" : "Operational"} view
            </p>

            <div style={styles.strip}>
              <div style={styles.stripTile}>
                <div style={styles.stripLabel}>Estimated submissions (v1)</div>
                <div style={styles.stripValue}>{row.total_scans.toLocaleString()}</div>
                <div style={styles.stripHint}>Union of landing path + escalations</div>
              </div>
              <div style={styles.stripTile}>
                <div style={styles.stripLabel}>Escalations</div>
                <div style={styles.stripValue}>{row.total_escalations.toLocaleString()}</div>
                <div style={styles.stripHint}>Distinct escalated scans (this scope)</div>
              </div>
              <div style={styles.stripTile}>
                <div style={styles.stripLabel}>Resolved without escalation</div>
                <div style={styles.stripValue}>
                  {resolvedPct(row) != null ? `${resolvedPct(row)}%` : "—"}
                </div>
                <div style={styles.stripHint}>
                  {resolvedPct(row) != null
                    ? "Directional share of v1-estimated scans with no MSP row"
                    : "Unavailable without estimated submissions (v1)"}
                </div>
              </div>
              <div style={styles.stripTile}>
                <div style={styles.stripLabel}>High-risk escalations</div>
                <div style={styles.stripValue}>{highRisk(row).toLocaleString()}</div>
                <div style={styles.stripHint}>Rated high among escalated</div>
              </div>
              <div style={styles.stripTile}>
                <div style={styles.stripLabel}>Modeled time supported</div>
                <div style={styles.stripValue}>~{Math.max(0, row.time_saved_hours)} h</div>
                <div style={styles.stripHint}>Not measured clock time</div>
              </div>
            </div>

            <p style={{ ...styles.clientSectionNote, marginTop: "0", marginBottom: "16px" }}>
              Escalation counts reflect submission events and may differ from unique scan totals.
            </p>

            <div style={styles.actions}>
              <button type="button" style={styles.btnPrimary} onClick={() => copy(reportText, "Report")}>
                Copy clean report
              </button>
              <button type="button" style={styles.btnSecondary} onClick={() => copy(shortSummary, "Summary")}>
                Copy short summary
              </button>
              {copyMsg && <span style={styles.toast}>{copyMsg}</span>}
            </div>

            {(row.client_accounts_escalation?.length ?? 0) > 0 ? (
              <div style={{ ...styles.reportShell, marginBottom: "16px" }}>
                <div style={styles.reportHeading}>Client accounts (escalation-based)</div>
                <h2 style={styles.clientSectionTitle}>Where escalations are coming from</h2>
                <p style={styles.clientSectionNote}>
                  These names come from <code>submitted_by_company</code> on <code>partner_escalation_access</code> rows
                  only—not total scan volume per client. Escalation counts here are{" "}
                  <strong>per submission row</strong> and may differ from unique scan totals. Blank or missing company
                  values are grouped as <strong>(company not provided)</strong>.
                </p>
                {row.client_accounts_escalation_truncated ? (
                  <p style={{ ...styles.clientSectionNote, marginTop: "-8px" }}>
                    Showing top {MSP_CLIENT_ACCOUNTS_TOP_SHOWN} client accounts by escalated activity.
                  </p>
                ) : null}
                <table style={styles.clientTable}>
                  <thead>
                    <tr>
                      <th style={styles.clientTh}>Client (as submitted)</th>
                      <th style={styles.clientTh}>Activity</th>
                      <th style={styles.clientTh}>Modeled time (esc. slice)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(row.client_accounts_escalation ?? []).map((c) => (
                      <tr key={c.company_display}>
                        <td style={styles.clientTd}>{c.company_display}</td>
                        <td style={styles.clientTd}>
                          {c.escalation_count.toLocaleString()} escalations (
                          {c.high_risk_escalation_count.toLocaleString()} high-risk)
                        </td>
                        <td style={styles.clientTd}>
                          ~
                          {Math.max(
                            0,
                            Math.round((c.time_saved_minutes_escalation_slice / 60) * 10) / 10
                          )}{" "}
                          h
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {highRiskClientTop ? (
                  <p style={{ ...styles.clientSectionNote, marginTop: "14px", marginBottom: 0 }}>
                    Highest concentration of escalated high-risk cases:{" "}
                    <strong>
                      {highRiskClientTop.company_display} ({highRiskClientTop.high_risk_escalation_count})
                    </strong>
                    .
                  </p>
                ) : null}
              </div>
            ) : null}

            <div style={styles.reportShell}>
              <div style={styles.reportHeading}>Report preview</div>
              <pre style={styles.reportBody}>{reportText}</pre>
            </div>

            <details style={styles.details}>
              <summary style={styles.summary}>How these numbers are calculated</summary>
              <ul style={styles.methodology}>
                <li>
                  <strong>Estimated submissions (v1)</strong> — distinct scans tied to the partner scope (landing_path
                  pattern plus escalation keys); a coverage estimate, not a full census.
                </li>
                <li>
                  <strong>Escalations</strong> — rows in <code>partner_escalation_access</code> for the selected scope.
                </li>
                <li>
                  <strong>Escalation counts</strong> — submission events and unique-scan views can differ; see the short
                  note above the summary strip.
                </li>
                <li>
                  <strong>Resolved without escalation</strong> — complement of escalation rate vs. the same submission
                  estimate; directional, not an SLA.
                </li>
                <li>
                  <strong>High-risk escalations</strong> — count of escalated scans rated <code>high</code>; pattern
                  pressure, not legal certainty.
                </li>
                <li>
                  <strong>Time supported</strong> — modeled from internal triage assumptions; not audited productivity.
                </li>
                <li>
                  <strong>Operational mode</strong> — adds escalation rate, refinement count, and risk mix for internal
                  review only.
                </li>
                <li>
                  <strong>Client accounts (escalation-based)</strong> — grouped by <code>submitted_by_company</code> on
                  escalation rows; high-risk counts join <code>scans.risk_tier</code> via <code>scan_id</code>. This is not
                  full partner scan attribution—only identities captured when users escalate.
                </li>
                <li>
                  <strong>Modeled time (escalation slice)</strong> — same v1 coefficients as the main estimate, applied only
                  to each client’s escalation rows (4 min per escalation + 3 min when that scan has refinement completed).
                </li>
                <li>
                  <strong>Pilot-stage framing</strong> — period is full pilot history until a window filter exists; totals
                  are directional, not audited baselines.
                </li>
              </ul>
            </details>
          </>
        ) : (
          <p style={{ color: "#57606a" }}>
            No row for this partner. Choose another scope or confirm data in the radar MSP block.
          </p>
        )}
      </div>
    </div>
  );
}

export default function InternalMspReportPage() {
  return (
    <Suspense
      fallback={
        <div style={styles.page}>
          <div style={styles.inner}>
            <p style={{ color: "#57606a" }}>Loading…</p>
          </div>
        </div>
      }
    >
      <MspReportWorkspace />
    </Suspense>
  );
}
