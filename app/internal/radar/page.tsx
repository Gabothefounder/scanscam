"use client";

import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import CanadaChoropleth, { type GeoProvince } from "@/app/components/charts/CanadaChoropleth";
import FraudLandscapeCard, { type FraudLandscapeItem } from "@/app/components/charts/FraudLandscapeCard";
import { formatGeoValue, formatLandscapeLabel, formatRiskRatio, formatWowDelta } from "@/app/components/charts/utils";
import {
  Area,
  AreaChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BriefWeeklyResponse, SocialSignalFormats } from "@/lib/brief";
import { formatSocialSignalText, formatWeekStartForSocial, fraudLabelFr, FRAUD_LABEL_FR } from "@/lib/brief";

type SystemHealth = {
  scan_count: number;
  submit_to_render_rate: number | null;
  fallback_rate: number | null;
  signal_yield_pct: number | null;
  signal_coverage_pct: number | null;
};

type FraudLandscape = {
  narratives: FraudLandscapeItem[];
  channels: FraudLandscapeItem[];
  payment_methods: FraudLandscapeItem[];
  authority_types: FraudLandscapeItem[];
};

type EmergingPattern = {
  dimension: string;
  value: string;
  this_week_count: number;
  this_week_share: number;
  last_week_count: number;
  last_week_share: number;
  count_delta_wow: number;
  share_delta_wow: number;
  emerging_rank: number;
  is_meaningful: boolean;
};

type GeoCity = {
  city: string;
  province: string;
  scan_count: number;
  high_risk_count: number;
};

type Geography = {
  provinces: GeoProvince[];
  top_cities: GeoCity[];
};

type RecentSignal = {
  created_at: string;
  summary_sentence: string | null;
  risk_tier: string;
  city: string | null;
  province: string | null;
};

type WeeklyTimelineRow = {
  week_start: string;
  scan_count: number;
  scan_delta_wow: number | null;
  signal_coverage_pct: number | null;
  coverage_delta_wow: number | null;
};

type DailyVolumeRow = {
  day: string;
  scan_count: number;
};

type RadarData = {
  week_start: string;
  generated_at: string;
  system_health: SystemHealth;
  fraud_landscape?: FraudLandscape;
  emerging_patterns?: EmergingPattern[];
  geography?: Geography;
  recent_signals?: RecentSignal[];
  weekly_timeline?: WeeklyTimelineRow[];
  daily_volume_timeline?: DailyVolumeRow[];
};

type SystemAnalysisV2Data = {
  generated_at_utc: string;
  input_reality: {
    scan_count: number;
    full_message_pct: number | null;
    link_only_pct: number | null;
    fragment_pct: number | null;
    phone_only_pct: number | null;
    valid_input_pct: number | null;
    learning_input_pct: number | null;
    context_sufficient_pct: number | null;
  };
  classification_quality: {
    narrative_known_pct: number | null;
    authority_known_pct: number | null;
    payment_known_pct: number | null;
    avg_core_signal_count: number | null;
    classifiable_scan_count: number;
  };
  link_intelligence: {
    shortened_link_pct: number | null;
    suspicious_tld_pct: number | null;
    link_scan_count: number;
    top_domains: { root_domain: string; scan_count: number }[];
  };
  system_health: {
    medium_high_pct: number | null;
    fallback_rate_pct: number | null;
    avg_core_signal_count: number | null;
    learning_input_pct: number | null;
    context_sufficient_pct: number | null;
  };
  recent_signals: {
    created_at: string;
    risk_tier: string;
    summary_sentence: string | null;
    narrative_category: string;
    narrative_family: string;
    authority_type: string;
    payment_intent: string;
    input_type: string;
    root_domain: string | null;
    city: string | null;
    region_code: string | null;
    core_signal_count: number;
  }[];
  improvement_insights: {
    scan_count: number;
    dominant_gap: string | null;
    dominant_gap_pct: number | null;
    learning_input_pct: number | null;
    context_sufficient_pct: number | null;
    avg_core_signal_count: number | null;
    shortened_link_pct: number | null;
    suspicious_tld_pct: number | null;
  };
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

/** Compact human-readable time for signal rows */
function formatSignalTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-CA", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

const SUMMARY_MAX_LEN = 80;

function truncateSummary(s: string | null): string {
  if (!s?.trim()) return "No summary available";
  const t = s.trim();
  return t.length <= SUMMARY_MAX_LEN ? t : t.slice(0, SUMMARY_MAX_LEN) + "…";
}

function RecentSignalsContent({ signals }: { signals: SystemAnalysisV2Data["recent_signals"] }) {
  const initialLimit = 5;
  const pageSize = 15;
  const [visibleCount, setVisibleCount] = useState(initialLimit);
  const displayRows = signals.slice(0, visibleCount);
  const remaining = Math.max(0, signals.length - visibleCount);

  return (
    <>
      <div style={styles.signalsTableWrap}>
        <table style={styles.signalsTable}>
          <thead>
            <tr>
              <th style={styles.signalsTh}>Time</th>
              <th style={styles.signalsTh}>Risk</th>
              <th style={styles.signalsTh}>Narrative</th>
              <th style={styles.signalsTh}>Input Type</th>
              <th style={styles.signalsTh}>Source / Domain</th>
              <th style={styles.signalsTh}>Location</th>
              <th style={styles.signalsTh}>Summary</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr key={i}>
                <td style={styles.signalsTd}>{formatSignalTime(row.created_at)}</td>
                <td
                  style={{
                    ...styles.signalsTd,
                    ...getRiskTierStyle(row.risk_tier),
                  }}
                >
                  {formatRiskTierLabel(row.risk_tier)}
                </td>
                <td style={styles.signalsTd}>{formatLandscapeLabel(row.narrative_category)}</td>
                <td style={styles.signalsTd}>{formatLandscapeLabel(row.input_type)}</td>
                <td style={{ ...styles.signalsTd, ...(row.root_domain ? {} : styles.signalsTdMuted) }}>
                  {row.root_domain ?? "—"}
                </td>
                <td style={styles.signalsTd}>
                  {row.city ?? "—"}{row.region_code ? ` / ${formatGeoValue(row.region_code)}` : ""}
                </td>
                <td
                  style={{
                    ...styles.signalsTd,
                    ...(row.summary_sentence?.trim()
                      ? {}
                      : styles.signalsTdMuted),
                  }}
                >
                  {truncateSummary(row.summary_sentence)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setVisibleCount((prev) => prev + pageSize)}
          style={styles.signalsToggle}
        >
          {`Show ${Math.min(15, remaining)} more`}
        </button>
      )}
      {visibleCount > initialLimit && (
        <button
          type="button"
          onClick={() => setVisibleCount(initialLimit)}
          style={styles.signalsToggle}
        >
          Show less
        </button>
      )}
    </>
  );
}

const CURRENT_SNAPSHOT_PROMPT = `You are analyzing a ScanScam current intelligence snapshot.

Context
Product: ScanScam
Scope: Canada-focused scam signal monitoring
Audience: founder
Purpose: identify meaningful scam patterns, behavioral signals, and geographic concentration.

Important design philosophy:
The system prefers "unknown" classifications over incorrect ones. Do not assume missing labels indicate absence of a signal.

Task
Analyze the dataset and identify:

1. the most important current scam signals
2. any behavioral patterns or scam techniques appearing frequently
3. geographic concentration signals
4. interpretation limits due to sample size
5. a short founder-level interpretation paragraph

Be conservative and avoid overstating conclusions.`;

const WEEKLY_SNAPSHOT_PROMPT = `You are analyzing a ScanScam weekly intelligence snapshot.

Context
Product: ScanScam
Scope: Canada-focused scam signal monitoring
Audience: founder and potential institutional partners
Purpose: identify meaningful weekly scam patterns and shifts.

Important philosophy:
The system prefers "unknown" classifications over incorrect ones. Missing classifications should be interpreted cautiously.

Task
Analyze the dataset and produce:

1. dominant scam patterns this week
2. notable behavioral signals
3. geographic observations
4. possible interpretation limits due to sample size
5. a concise weekly intelligence summary suitable for a founder briefing.

Avoid overclaiming conclusions from small samples.`;

const SYSTEM_QUALITY_SNAPSHOT_PROMPT = `You are analyzing a ScanScam system quality snapshot.

Context
Product: ScanScam
Scope: Canada-focused scam signal monitoring
Audience: founder
Purpose: identify where the detection and extraction system should improve.

Important philosophy:
The system intentionally prefers "unknown" classifications over incorrect ones. High unknown rates indicate caution, not failure, but they still reveal where the system needs better coverage.

Task
Analyze the dataset and identify:

1. which classification areas have the highest unknown rates
2. which signal dimensions are currently strongest
3. where extraction quality appears weakest
4. which improvements would most likely increase signal coverage and high-value signal yield
5. a short prioritized improvement recommendation for the founder

Be conservative and focus on the highest-leverage system improvements.`;

const SYSTEM_V2_OUTPUT_SUFFIX = `

Output:
1. Diagnosis (1–2 sentences)
2. Root cause (choose one: input problem, classification problem, link-intelligence problem, calibration problem)
3. Exact fix (implementation-level: what to change and where)
4. Why this fix should move the metric`;

const SYSTEM_V2_PROMPTS = {
  systemOverview: `Analyze the overall state of the ScanScam system using the combined system-analysis metrics.

Focus on:
- whether the main constraint is input quality, classification quality, link-heavy usage, or calibration
- how user behavior and scanner design interact
- whether the current system is learning from the right kinds of inputs
- which single weakness is most limiting the product right now
- the difference between what is limiting user-facing classification and what is limiting system learning

Then:
- identify the single highest-leverage next system improvement
- explain why it should come before other possible upgrades
- state whether the next move should be a UX/input-shaping fix, a mapping/detector fix, or a link-intelligence fix

Output:
1. Overall diagnosis (2–3 sentences)
2. Primary bottleneck (choose one: input problem, classification problem, link-intelligence problem, calibration problem)
3. Exact next fix (implementation-level: what to change and where)
4. Why this should move the system fastest`,
  inputReality: `Analyze how users are submitting scans and what this implies for system performance and product design.

Focus on:
- the proportion of valid vs non-actionable inputs
- the balance between full messages and artifacts (links, fragments, phone-only checks)
- whether user behavior is helping or limiting detection quality

Then:
- identify the main bottleneck in input quality
- state whether the bottleneck is primarily a user-behavior problem or an intake/UX design problem
- recommend exactly one concrete product or UX improvement to increase valid inputs, with a short justification${SYSTEM_V2_OUTPUT_SUFFIX}`,
  classificationQuality: `Analyze classifier performance on valid inputs and identify where extraction quality is weakest.

Focus on:
- narrative coverage
- authority coverage
- payment-intent coverage
- whether core signal extraction is dense enough to support reliable interpretation

Then:
- identify the highest-leverage classification weakness
- prefer the smallest change that would increase structured coverage fastest
- recommend exactly one specific detector, mapping, or schema improvement, with a short justification${SYSTEM_V2_OUTPUT_SUFFIX}`,
  linkIntelligence: `Analyze the link-heavy scan population and identify what link patterns are most common and most important.

Focus on:
- how much of usage is link-only
- shortened link prevalence
- suspicious domain ending prevalence
- top repeated domains or root domains
- whether current link guidance is sufficient

Then:
- identify the most important link-related product or detection improvement
- state whether the next fix should be UX guidance, link normalization, or detection logic
- explain why it matters for user safety and MSP value${SYSTEM_V2_OUTPUT_SUFFIX}`,
  systemHealth: `Analyze overall scanner health and whether the system is producing enough meaningful output to support product decisions.

Focus on:
- medium/high risk share
- fallback rate
- signal density on valid inputs
- whether the system appears too weak, too noisy, or reasonably calibrated

Then:
- identify the biggest system-level health concern
- recommend exactly one concrete operational or modeling improvement, with a short justification${SYSTEM_V2_OUTPUT_SUFFIX}`,
  improvementInsights: `Identify the single highest-leverage system improvement based on current input mix, classification quality, link intelligence, and overall system health.

Focus on:
- the dominant weakness
- whether it is an input problem, classification problem, link-intelligence problem, or calibration problem
- what change would most improve the system this week

Then:
- recommend exactly one next improvement
- explain why it should come before other possible upgrades${SYSTEM_V2_OUTPUT_SUFFIX}`,
} as const;

function AnalystBlockCard({
  title,
  sourceView,
  explanation,
  bestFor,
  promptText,
  data,
  onCopyFeedback,
}: {
  title: string;
  sourceView: string;
  explanation: string;
  bestFor: string;
  promptText: string;
  data: unknown;
  onCopyFeedback: (msg: string) => void;
}) {
  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      onCopyFeedback("Prompt helper copied");
    } catch {
      onCopyFeedback("Copy failed");
    }
  };

  const handleCopyData = async () => {
    try {
      const timestamp = new Date().toISOString();
      const header = `ScanScam Analyst Dataset
Block: ${title}
Source View: ${sourceView}
Scope: Canada
Generated: ${timestamp}
Explanation: ${explanation}

`;
      const json = JSON.stringify(data, null, 2);
      await navigator.clipboard.writeText(header + json);
      onCopyFeedback("Dataset copied for LLM analysis");
    } catch {
      onCopyFeedback("Copy failed");
    }
  };

  return (
    <div style={styles.analystBlockCard}>
      <div style={styles.analystBlockHeader}>
        <h3 style={styles.analystBlockTitle}>{title}</h3>
      </div>
      <p style={styles.analystBlockExplanation}>{explanation}</p>
      <p style={styles.analystBlockBestFor}>
        <span style={styles.analystBlockBestForLabel}>Best for: </span>
        {bestFor}
      </p>
      <div style={styles.analystBlockActions}>
        <button type="button" onClick={handleCopyPrompt} style={styles.analystBlockBtn}>
          Copy prompt helper
        </button>
        <button type="button" onClick={handleCopyData} style={styles.analystBlockBtn}>
          Copy data for LLM
        </button>
      </div>
    </div>
  );
}

function AnalystBlocksSection({
  isMobile,
  mobileStyles,
}: {
  isMobile?: boolean;
  mobileStyles?: Record<string, React.CSSProperties>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [blocksData, setBlocksData] = useState<{
    current_snapshot: unknown;
    weekly_snapshot: unknown;
    system_quality_snapshot: unknown;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    if (!expanded) return;
    setLoading(true);
    fetch("/api/intel/analyst-blocks")
      .then((r) => r.json())
      .then(setBlocksData)
      .catch(() => setBlocksData({ current_snapshot: null, weekly_snapshot: null, system_quality_snapshot: null }))
      .finally(() => setLoading(false));
  }, [expanded]);

  return (
    <section style={{ ...styles.section, ...(mobileStyles?.section ?? {}), ...styles.analystBlocksSection, marginTop: "24px" }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{ ...styles.analystBlocksHeader, ...(isMobile ? (mobileStyles?.analystBlocksHeader ?? {}) : {}) }}
        aria-expanded={expanded}
      >
        <span style={styles.analystBlocksChevron}>{expanded ? "▼" : "▶"}</span>
        <h2 style={styles.analystBlocksTitle}>Analyst Blocks</h2>
      </button>
      {expanded && (
        <>
          <p style={styles.analystBlocksSubtitle}>
            Additional internal datasets for deeper analysis, quick export, and external LLM interpretation.
          </p>
          {loading ? (
            <p style={styles.analystBlocksEmpty}>Loading analyst datasets…</p>
          ) : (
            <div style={{ ...styles.analystBlocksGrid, ...(mobileStyles?.analystBlocksGrid ?? {}) }}>
              <AnalystBlockCard
                title="Current Snapshot"
                sourceView="intel_current_snapshot"
                explanation="Compressed 7-day intelligence summary including activity, risk mix, behavioral signals, geography, and acquisition context."
                bestFor="rapid founder interpretation of the current fraud environment."
                promptText={CURRENT_SNAPSHOT_PROMPT}
                data={blocksData?.current_snapshot ?? {}}
                onCopyFeedback={showToast}
              />
              <AnalystBlockCard
                title="Weekly Snapshot"
                sourceView="intel_weekly_snapshot"
                explanation="Compressed weekly intelligence package combining activity, risk distribution, behavioral patterns, geography, and acquisition signals."
                bestFor="weekly founder review and preparation of intelligence briefs."
                promptText={WEEKLY_SNAPSHOT_PROMPT}
                data={blocksData?.weekly_snapshot ?? {}}
                onCopyFeedback={showToast}
              />
              <AnalystBlockCard
                title="System Quality Snapshot"
                sourceView="intel_system_quality_snapshot"
                explanation="Internal diagnostics for classification coverage, unknown distribution, and signal extraction quality."
                bestFor="identifying where the detection system should improve next."
                promptText={SYSTEM_QUALITY_SNAPSHOT_PROMPT}
                data={blocksData?.system_quality_snapshot ?? {}}
                onCopyFeedback={showToast}
              />
            </div>
          )}
          {toast && <div style={styles.analystBlocksToast}>{toast}</div>}
        </>
      )}
    </section>
  );
}

function numOrZero(v: number | null | undefined): number {
  return v == null || Number.isNaN(Number(v)) ? 0 : Number(v);
}

function numOrNull(v: number | null | undefined): number | null {
  return v == null || Number.isNaN(Number(v)) ? null : Number(v);
}

function stringOrEmpty(v: string | null | undefined): string {
  return v == null ? "" : String(v);
}

function SystemV2AnalystBlock({
  title,
  description,
  kpiLabel,
  kpiValue,
  promptText,
  dataPayload,
}: {
  title: string;
  description: string;
  kpiLabel: string;
  kpiValue: string;
  promptText: string;
  dataPayload: Record<string, unknown>;
}) {
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      showToast("Prompt helper copied");
    } catch {
      showToast("Copy failed");
    }
  };

  const handleCopyData = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(dataPayload, null, 2));
      showToast("Dataset copied for LLM");
    } catch {
      showToast("Copy failed");
    }
  };

  return (
    <div style={styles.analystBlockCard}>
      <div style={styles.analystBlockHeader}>
        <h3 style={styles.analystBlockTitle}>{title}</h3>
      </div>
      <p style={styles.analystBlockExplanation}>{description}</p>
      <p style={styles.analystBlockBestFor}>
        <span style={styles.analystBlockBestForLabel}>{kpiLabel}: </span>
        {kpiValue}
      </p>
      <div style={styles.analystBlockActions}>
        <button type="button" onClick={handleCopyPrompt} style={styles.analystBlockBtn}>
          Copy prompt helper
        </button>
        <button type="button" onClick={handleCopyData} style={styles.analystBlockBtn}>
          Copy data for LLM
        </button>
      </div>
      {toast && <div style={styles.analystBlocksToast}>{toast}</div>}
    </div>
  );
}

function SystemAnalysisV2Section({
  data,
  error,
  isMobile,
  mobileStyles,
}: {
  data: SystemAnalysisV2Data | null;
  error: string | null;
  isMobile?: boolean;
  mobileStyles?: Record<string, React.CSSProperties>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section style={{ ...styles.section, ...(mobileStyles?.section ?? {}), ...styles.analystBlocksSection, marginTop: "24px" }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{ ...styles.analystBlocksHeader, ...(isMobile ? (mobileStyles?.analystBlocksHeader ?? {}) : {}) }}
        aria-expanded={expanded}
      >
        <span style={styles.analystBlocksChevron}>{expanded ? "▼" : "▶"}</span>
        <h2 style={styles.analystBlocksTitle}>System Analysis (v2)</h2>
      </button>
      {expanded && (
        <>
          <p style={styles.analystBlocksSubtitle}>
            Derived system-analysis view for improving detection quality and prioritizing upgrades.
          </p>
          <p style={{ ...styles.analystBlocksSubtitle, marginTop: "-10px" }}>
            This section uses derived analysis data rather than raw message content.
          </p>
          <p style={{ ...styles.analystBlocksSubtitle, marginTop: "-10px" }}>
            Use these blocks to identify one concrete system improvement at a time.
          </p>
          <p style={{ ...styles.analystBlocksSubtitle, marginTop: "-10px" }}>
            Valid input = stronger/classifiable input; learning input = broader input useful for system improvement.
          </p>
          {error && (
            <p style={{ ...styles.signalsEmpty, color: "#f0883e" }}>{error}</p>
          )}
          {!data ? (
            <p style={styles.signalsEmpty}>No v2 system-analysis data available yet.</p>
          ) : (
            <>
              <div style={{ ...styles.analystBlocksGrid, ...(isMobile ? (mobileStyles?.analystBlocksGrid ?? {}) : {}) }}>
            <SystemV2AnalystBlock
              title="System Overview"
              description="Cross-block synthesis of input quality, classification coverage, link-heavy usage, and overall system health."
              kpiLabel="Context-Sufficient Rate"
              kpiValue={formatPct(data.input_reality.context_sufficient_pct)}
              promptText={SYSTEM_V2_PROMPTS.systemOverview}
              dataPayload={{
                scan_count: numOrZero(data.input_reality.scan_count),
                valid_input_pct: numOrZero(data.input_reality.valid_input_pct),
                learning_input_pct: numOrZero(data.input_reality.learning_input_pct),
                context_sufficient_pct: numOrZero(data.input_reality.context_sufficient_pct),
                link_only_pct: numOrZero(data.input_reality.link_only_pct),
                narrative_known_pct: numOrZero(data.classification_quality.narrative_known_pct),
                authority_known_pct: numOrZero(data.classification_quality.authority_known_pct),
                payment_known_pct: numOrZero(data.classification_quality.payment_known_pct),
                avg_core_signal_count: numOrZero(data.classification_quality.avg_core_signal_count),
                medium_high_pct: numOrZero(data.system_health.medium_high_pct),
                fallback_rate_pct: numOrZero(data.system_health.fallback_rate_pct),
                shortened_link_pct: numOrZero(data.link_intelligence.shortened_link_pct),
                suspicious_tld_pct: numOrZero(data.link_intelligence.suspicious_tld_pct),
                dominant_gap: stringOrEmpty(data.improvement_insights.dominant_gap),
                dominant_gap_pct: numOrZero(data.improvement_insights.dominant_gap_pct),
              }}
            />
            <SystemV2AnalystBlock
              title="Input Reality"
              description="Understand what users are submitting and how much of it is usable."
              kpiLabel="Valid Input Rate"
              kpiValue={formatPct(data.input_reality.valid_input_pct)}
              promptText={SYSTEM_V2_PROMPTS.inputReality}
              dataPayload={{
                scan_count: numOrZero(data.input_reality.scan_count),
                valid_input_pct: numOrNull(data.input_reality.valid_input_pct),
                learning_input_pct: numOrNull(data.input_reality.learning_input_pct),
                context_sufficient_pct: numOrNull(data.input_reality.context_sufficient_pct),
                full_message_pct: numOrNull(data.input_reality.full_message_pct),
                link_only_pct: numOrNull(data.input_reality.link_only_pct),
                fragment_pct: numOrNull(data.input_reality.fragment_pct),
                phone_only_pct: numOrNull(data.input_reality.phone_only_pct),
              }}
            />
            <SystemV2AnalystBlock
              title="Classification Quality"
              description="Measure how well the system extracts meaning from valid inputs."
              kpiLabel="Narrative Known %"
              kpiValue={formatPct(data.classification_quality.narrative_known_pct)}
              promptText={SYSTEM_V2_PROMPTS.classificationQuality}
              dataPayload={{
                narrative_known_pct: numOrZero(data.classification_quality.narrative_known_pct),
                authority_known_pct: numOrZero(data.classification_quality.authority_known_pct),
                payment_known_pct: numOrZero(data.classification_quality.payment_known_pct),
                avg_core_signal_count: numOrZero(data.classification_quality.avg_core_signal_count),
                classifiable_scan_count: numOrZero(data.classification_quality.classifiable_scan_count),
              }}
            />
            <SystemV2AnalystBlock
              title="Link Intelligence"
              description="Analyze link-heavy scans and detect risky patterns."
              kpiLabel="Link-Only Rate"
              kpiValue={formatPct(data.input_reality.link_only_pct)}
              promptText={SYSTEM_V2_PROMPTS.linkIntelligence}
              dataPayload={{
                link_only_pct: numOrZero(data.input_reality.link_only_pct),
                shortened_link_pct: numOrZero(data.link_intelligence.shortened_link_pct),
                suspicious_tld_pct: numOrZero(data.link_intelligence.suspicious_tld_pct),
                link_scan_count: numOrZero(data.link_intelligence.link_scan_count),
                top_domains: data.link_intelligence.top_domains ?? [],
              }}
            />
            <SystemV2AnalystBlock
              title="System Health"
              description="Evaluate overall signal strength and scanner calibration."
              kpiLabel="Medium/High Risk Share"
              kpiValue={formatPct(data.system_health.medium_high_pct)}
              promptText={SYSTEM_V2_PROMPTS.systemHealth}
              dataPayload={{
                medium_high_pct: numOrZero(data.system_health.medium_high_pct),
                fallback_rate_pct: numOrZero(data.system_health.fallback_rate_pct),
                avg_core_signal_count: numOrZero(data.system_health.avg_core_signal_count),
                learning_input_pct: numOrNull(data.system_health.learning_input_pct),
                context_sufficient_pct: numOrNull(data.system_health.context_sufficient_pct),
              }}
            />
            <SystemV2AnalystBlock
              title="Improvement Insights"
              description="Identify the single most impactful next system upgrade."
              kpiLabel="Dominant Gap %"
              kpiValue={formatPct(data.improvement_insights.dominant_gap_pct)}
              promptText={SYSTEM_V2_PROMPTS.improvementInsights}
              dataPayload={{
                scan_count: numOrZero(data.improvement_insights.scan_count),
                dominant_gap: stringOrEmpty(data.improvement_insights.dominant_gap),
                dominant_gap_pct: numOrZero(data.improvement_insights.dominant_gap_pct),
                valid_input_pct: numOrZero(data.input_reality.valid_input_pct),
                learning_input_pct: numOrNull(data.improvement_insights.learning_input_pct),
                context_sufficient_pct: numOrNull(data.improvement_insights.context_sufficient_pct),
                link_only_pct: numOrZero(data.input_reality.link_only_pct),
                avg_core_signal_count: numOrZero(data.improvement_insights.avg_core_signal_count),
                shortened_link_pct: numOrZero(data.improvement_insights.shortened_link_pct),
                suspicious_tld_pct: numOrZero(data.improvement_insights.suspicious_tld_pct),
                narrative_known_pct: numOrZero(data.classification_quality.narrative_known_pct),
                authority_known_pct: numOrZero(data.classification_quality.authority_known_pct),
                payment_known_pct: numOrZero(data.classification_quality.payment_known_pct),
              }}
            />
              </div>

            </>
          )}
        </>
      )}
    </section>
  );
}

function formatRiskTierLabel(tier: string): string {
  const s = String(tier ?? "").trim().toLowerCase();
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getRiskTierStyle(tier: string): React.CSSProperties {
  const s = String(tier ?? "").trim().toLowerCase();
  if (s === "high") return { color: "#e6edf3", fontWeight: 500 };
  if (s === "medium") return { color: "#8b949e" };
  return { color: "#6e7681" };
}

/** Deterministic generation of 3 key takeaways from radar payload */
function generateKeyTakeaways(data: RadarData): [string, string, string] {
  const sh = data.system_health;
  const fl = data.fraud_landscape;
  const geo = data.geography;
  const scanCount = sh?.scan_count ?? 0;
  const coverage = sh?.signal_coverage_pct ?? null;
  const yieldPct = sh?.signal_yield_pct ?? null;
  const smallSample = scanCount < 25;

  const coverageNum = coverage != null ? Number(coverage) : null;
  const yieldNum = yieldPct != null ? Number(yieldPct) : null;

  let systemTakeaway: string;
  if (coverageNum == null && yieldNum == null) {
    systemTakeaway = "Signal coverage and yield data are not yet available for this period.";
  } else {
    const coveragePhrase =
      coverageNum != null
        ? coverageNum < 30
          ? `remains low at ${coverageNum.toFixed(1)}%, indicating most scans lack classified core signals`
          : coverageNum < 60
            ? `is moderate at ${coverageNum.toFixed(1)}%`
            : `is strong at ${coverageNum.toFixed(1)}%`
        : "";
    const yieldPhrase =
      yieldNum != null
        ? (yieldNum < 15 ? "low" : yieldNum < 35 ? "moderate" : "strong") +
          ` at ${yieldNum.toFixed(1)}%`
        : "";
    const parts: string[] = [];
    if (coveragePhrase) parts.push(`Signal coverage ${coveragePhrase}.`);
    if (yieldPhrase) parts.push(`Signal yield is ${yieldPhrase}.`);
    systemTakeaway = parts.join(" ") || "System quality metrics are still building.";
    if (smallSample && scanCount > 0) {
      systemTakeaway += ` Sample of ${scanCount} scans—interpret with caution.`;
    }
  }

  const knownItems = (
    [
      ...(fl?.narratives ?? []),
      ...(fl?.channels ?? []),
      ...(fl?.payment_methods ?? []),
      ...(fl?.authority_types ?? []),
    ] as FraudLandscapeItem[]
  )
    .filter((i) => String(i.value ?? "").toLowerCase() !== "unknown")
    .sort((a, b) => (b.scan_count ?? 0) - (a.scan_count ?? 0));

  const topKnown = knownItems.slice(0, 5).map((i) => formatLandscapeLabel(i.value));

  let fraudTakeaway: string;
  if (topKnown.length === 0) {
    fraudTakeaway = "Known classified patterns remain limited this week.";
  } else if (topKnown.length <= 2) {
    fraudTakeaway = `Known patterns this week: ${topKnown.join(" and ")}. Signal coverage remains sparse.`;
  } else {
    fraudTakeaway = `Known patterns this week are led by ${topKnown.slice(0, 3).join(", ")}.`;
  }

  const provinces = geo?.provinces ?? [];
  const topCities = geo?.top_cities ?? [];
  const topProvinceNames = provinces.slice(0, 3).map((p) => formatGeoValue(p.province));
  const topCity = topCities[0];

  let geoTakeaway: string;
  if (topProvinceNames.length === 0 && !topCity) {
    geoTakeaway = "Geographic activity data are not yet available for this period.";
  } else if (topProvinceNames.length === 0) {
    geoTakeaway = topCity
      ? `${formatGeoValue(topCity.city)}, ${formatGeoValue(topCity.province)} is the most active identified city.`
      : "Geographic concentration data remain limited.";
  } else {
    const provList = topProvinceNames.join(", ");
    const cityPhrase = topCity ? `, with ${formatGeoValue(topCity.city)} the most active identified city` : "";
    if (smallSample && scanCount > 0) {
      geoTakeaway = `Activity distribution is preliminary; ${provList} show highest scan counts${cityPhrase}.`;
    } else {
      geoTakeaway = `${provList} lead scan activity this week${cityPhrase}.`;
    }
  }

  return [systemTakeaway, fraudTakeaway, geoTakeaway];
}

const DIMENSION_LABELS: Record<string, string> = {
  narrative_category: "Narrative",
  channel_type: "Channel",
  payment_method: "Payment Method",
  authority_type: "Authority Type",
};

function formatDimensionLabel(dim: string): string {
  return DIMENSION_LABELS[dim] ?? dim.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Share 0–1 to X.X% */
function formatSharePct(share: number): string {
  const pct = share <= 1 ? share * 100 : share;
  return `${Number(pct).toFixed(1)}%`;
}

/** share_delta_wow as signed percentage, e.g. +6.0% */
function formatWowChange(delta: number): string {
  const pct = delta <= 1 && delta >= -1 ? delta * 100 : delta;
  const s = Number(pct).toFixed(1);
  if (Number(s) > 0) return `+${s}%`;
  return `${s}%`;
}

/** Build display rows for Signals to Watch: filter emerging, fallback to top known from fraud_landscape */
function getSignalsToWatchRows(data: RadarData): {
  displayRows: Array<{ dimension: string; value: string; this_week_count: number; this_week_share: number; share_delta_wow: number | null }>;
  usedFallback: boolean;
} {
  const raw = data.emerging_patterns ?? [];
  const filtered = raw.filter(
    (r) =>
      String(r.value ?? "").toLowerCase() !== "unknown" &&
      (r.this_week_count ?? 0) >= 2 &&
      (r.share_delta_wow ?? 0) > 0
  );
  if (filtered.length > 0) return { displayRows: filtered, usedFallback: false };
  const fl = data.fraud_landscape ?? { narratives: [], channels: [], payment_methods: [], authority_types: [] };
  const dimKeys = ["narrative_category", "channel_type", "payment_method", "authority_type"] as const;
  const fallbackRows: Array<{ dimension: string; value: string; this_week_count: number; this_week_share: number; share_delta_wow: number | null }> = [];
  for (const dim of dimKeys) {
    const arr = fl[dim === "narrative_category" ? "narratives" : dim === "channel_type" ? "channels" : dim === "payment_method" ? "payment_methods" : "authority_types"] ?? [];
    for (const item of arr) {
      if (String(item.value ?? "").toLowerCase() === "unknown") continue;
      fallbackRows.push({
        dimension: dim,
        value: item.value,
        this_week_count: item.scan_count,
        this_week_share: item.share_of_week,
        share_delta_wow: null,
      });
    }
  }
  fallbackRows.sort((a, b) => b.this_week_share - a.this_week_share);
  return { displayRows: fallbackRows.slice(0, 10), usedFallback: true };
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

/** Get current week row from weekly_timeline for WoW deltas */
function getCurrentWeekRow(data: RadarData): WeeklyTimelineRow | null {
  if (!data?.week_start || !data?.weekly_timeline?.length) return null;
  return data.weekly_timeline.find((r) => r.week_start === data.week_start) ?? null;
}

/** Render WoW movement indicator: arrow + formatted delta. Returns null if delta missing. */
function MetricWoWIndicator({
  delta,
  format,
  invertColors,
}: {
  delta: number | null | undefined;
  format: "count" | "pct";
  invertColors?: boolean;
}) {
  if (delta == null) return null;
  const arrow = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
  const text = format === "count" ? formatWowDelta(delta) : formatWowChange(delta);
  const color =
    delta > 0 ? (invertColors ? "#f0883e" : "#3fb950") : delta < 0 ? (invertColors ? "#3fb950" : "#f0883e") : "#6e7681";
  return (
    <span style={{ ...styles.metricWoW, color }}>
      {" "}
      {arrow} {text}
    </span>
  );
}

export default function RadarPage() {
  const [data, setData] = useState<RadarData | null>(null);
  const [systemV2Data, setSystemV2Data] = useState<SystemAnalysisV2Data | null>(null);
  const [systemV2Error, setSystemV2Error] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [briefGenerating, setBriefGenerating] = useState(false);
  const [briefMessage, setBriefMessage] = useState<string | null>(null);
  const [briefSuccess, setBriefSuccess] = useState(false);
  const [briefPreview, setBriefPreview] = useState<{
    social_headline: string;
    social_summary: string;
    brief_url: string;
  } | null>(null);
  const [socialSignalLoading, setSocialSignalLoading] = useState(false);
  const [socialSignalMessage, setSocialSignalMessage] = useState<string | null>(null);
  const [socialSignalText, setSocialSignalText] = useState<SocialSignalFormats | null>(null);
  const [marketingSectionExpanded, setMarketingSectionExpanded] = useState(false);
  const [graphicPreview, setGraphicPreview] = useState<BriefWeeklyResponse | null>(null);
  const [graphicLoading, setGraphicLoading] = useState(false);
  const [graphicMessage, setGraphicMessage] = useState<string | null>(null);
  const [graphicCleanViewLang, setGraphicCleanViewLang] = useState<"en" | "fr" | null>(null);
  const graphicCardEnRef = useRef<HTMLDivElement>(null);
  const graphicCardFrRef = useRef<HTMLDivElement>(null);
  const [narrativePreview, setNarrativePreview] = useState<BriefWeeklyResponse | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeMessage, setNarrativeMessage] = useState<string | null>(null);
  const [narrativeCleanViewLang, setNarrativeCleanViewLang] = useState<"en" | "fr" | null>(null);
  const narrativeCardEnRef = useRef<HTMLDivElement>(null);
  const narrativeCardFrRef = useRef<HTMLDivElement>(null);

  const handleGenerateBrief = () => {
    setBriefMessage(null);
    setBriefSuccess(false);
    setBriefPreview(null);
    setBriefGenerating(true);
    fetch("/api/internal/brief/generate-weekly", { method: "POST", credentials: "include" })
      .then((res) => res.json().catch(() => ({})))
      .then((body) => {
        if (body?.ok) {
          setBriefMessage(`Brief generated for week ${body.week_start ?? ""}.`);
          setBriefSuccess(true);
          if (body.social_headline != null && body.social_summary != null && body.brief_url) {
            setBriefPreview({
              social_headline: body.social_headline,
              social_summary: body.social_summary,
              brief_url: body.brief_url,
            });
          }
        } else {
          setBriefMessage(body?.error ?? "Failed to generate brief.");
        }
      })
      .catch(() => setBriefMessage("Failed to generate brief."))
      .finally(() => setBriefGenerating(false));
  };

  const handleGenerateSocialSignalText = () => {
    setSocialSignalMessage(null);
    setSocialSignalText(null);
    setSocialSignalLoading(true);
    fetch("/api/brief/weekly", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (res.status === 404) {
          throw new Error("No weekly brief yet. Generate one first.");
        }
        if (!res.ok) {
          throw new Error(
            typeof (json as any)?.error === "string"
              ? (json as any).error
              : "Failed to load weekly brief."
          );
        }
        return json as BriefWeeklyResponse;
      })
      .then((brief) => {
        setSocialSignalText(formatSocialSignalText(brief));
        setSocialSignalMessage("Social signal generated.");
      })
      .catch((e) => {
        setSocialSignalMessage(e?.message ?? "Failed to generate social signal.");
      })
      .finally(() => setSocialSignalLoading(false));
  };

  type SocialSignalVariant = "en" | "fr" | "enShort" | "frShort";
  const handleCopySocialSignal = async (variant: SocialSignalVariant) => {
    if (!socialSignalText) return;
    const text =
      variant === "en"
        ? socialSignalText.en
        : variant === "fr"
          ? socialSignalText.fr
          : variant === "enShort"
            ? socialSignalText.enShort
            : socialSignalText.frShort;
    const labels: Record<SocialSignalVariant, string> = {
      en: "Social signal (EN, long) copied.",
      fr: "Social signal (FR, long) copied.",
      enShort: "Social signal (EN, short) copied.",
      frShort: "Social signal (FR, short) copied.",
    };
    try {
      await navigator.clipboard.writeText(text);
      setSocialSignalMessage(labels[variant]);
      setTimeout(() => setSocialSignalMessage(null), 2500);
    } catch {
      setSocialSignalMessage("Copy failed.");
      setTimeout(() => setSocialSignalMessage(null), 2500);
    }
  };

  const handleLoadGraphicPreview = () => {
    setGraphicMessage(null);
    setGraphicPreview(null);
    setGraphicLoading(true);
    fetch("/api/brief/weekly", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (res.status === 404) {
          throw new Error("No weekly brief yet. Generate one first.");
        }
        if (!res.ok) {
          throw new Error(
            typeof (json as { error?: string })?.error === "string"
              ? (json as { error: string }).error
              : "Failed to load weekly brief."
          );
        }
        return json as BriefWeeklyResponse;
      })
      .then((brief) => {
        setGraphicPreview(brief);
        setGraphicMessage("Graphic preview loaded.");
      })
      .catch((e) => {
        setGraphicMessage(e?.message ?? "Failed to load graphic preview.");
      })
      .finally(() => setGraphicLoading(false));
  };

  const getGraphicCaptionEn = (brief: BriefWeeklyResponse) =>
    [
      "⚠️ Fraud signal in Canada — week of " + formatWeekStartForSocial(brief.week_start ?? "", "en-CA"),
      "",
      "Predominant fraud: " + (brief.fraud_label || "—"),
      "Risk Index: " + brief.risk_index,
      "",
      "Full brief:",
      "https://scanscam.ca/brief/weekly",
      "",
      "Analyze a suspicious message:",
      "https://scanscam.ca",
      "",
      "Your scan could help stop the next scam.",
    ].join("\n");

  const getGraphicCaptionFr = (brief: BriefWeeklyResponse) =>
    [
      "⚠️ Signal de fraude au Canada — semaine du " + formatWeekStartForSocial(brief.week_start ?? "", "fr-CA"),
      "",
      "Fraude prédominante : " + (fraudLabelFr(brief.fraud_label) || "—"),
      "Indice de risque : " + brief.risk_index,
      "",
      "Analyse complète :",
      "https://scanscam.ca/brief/weekly",
      "",
      "Analysez un message suspect :",
      "https://scanscam.ca",
      "",
      "Votre analyse pourrait empêcher la prochaine fraude.",
    ].join("\n");

  const handleCopyCaptionEn = async () => {
    if (!graphicPreview) return;
    try {
      await navigator.clipboard.writeText(getGraphicCaptionEn(graphicPreview));
      setGraphicMessage("EN caption copied.");
      setTimeout(() => setGraphicMessage(null), 2500);
    } catch {
      setGraphicMessage("Copy failed.");
      setTimeout(() => setGraphicMessage(null), 2500);
    }
  };

  const handleCopyCaptionFr = async () => {
    if (!graphicPreview) return;
    try {
      await navigator.clipboard.writeText(getGraphicCaptionFr(graphicPreview));
      setGraphicMessage("FR caption copied.");
      setTimeout(() => setGraphicMessage(null), 2500);
    } catch {
      setGraphicMessage("Copy failed.");
      setTimeout(() => setGraphicMessage(null), 2500);
    }
  };

  const handleDownloadEnPng = async () => {
    if (!graphicCardEnRef.current) return;
    try {
      const dataUrl = await toPng(graphicCardEnRef.current, {
        pixelRatio: 2,
        backgroundColor: "#0d1117",
        cacheBust: true,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `scanscam-fraud-signal-en-${graphicPreview?.week_start ?? "weekly"}.png`;
      a.click();
      setGraphicMessage("EN PNG downloaded.");
      setTimeout(() => setGraphicMessage(null), 2500);
    } catch {
      setGraphicMessage("PNG export failed.");
      setTimeout(() => setGraphicMessage(null), 2500);
    }
  };

  const handleDownloadFrPng = async () => {
    if (!graphicCardFrRef.current) return;
    try {
      const dataUrl = await toPng(graphicCardFrRef.current, {
        pixelRatio: 2,
        backgroundColor: "#0d1117",
        cacheBust: true,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `scanscam-fraud-signal-fr-${graphicPreview?.week_start ?? "weekly"}.png`;
      a.click();
      setGraphicMessage("FR PNG downloaded.");
      setTimeout(() => setGraphicMessage(null), 2500);
    } catch {
      setGraphicMessage("PNG export failed.");
      setTimeout(() => setGraphicMessage(null), 2500);
    }
  };

  const handleLoadNarrativePreview = () => {
    setNarrativeMessage(null);
    setNarrativePreview(null);
    setNarrativeLoading(true);
    fetch("/api/brief/weekly", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (res.status === 404) {
          throw new Error("No weekly brief yet. Generate one first.");
        }
        if (!res.ok) {
          throw new Error(
            typeof (json as { error?: string })?.error === "string"
              ? (json as { error: string }).error
              : "Failed to load weekly brief."
          );
        }
        return json as BriefWeeklyResponse;
      })
      .then((brief) => {
        setNarrativePreview(brief);
        setNarrativeMessage("Narrative signal loaded.");
      })
      .catch((e) => {
        setNarrativeMessage(e?.message ?? "Failed to load narrative preview.");
      })
      .finally(() => setNarrativeLoading(false));
  };

  const getNarrativeShareOfWeek = (brief: BriefWeeklyResponse): number => {
    const top = brief?.narratives?.[0];
    return top?.share_of_week ?? 0;
  };

  const formatNarrativeSharePercent = (share: number): string => {
    const pct = share * 100;
    return pct % 1 === 0 ? `${Math.round(pct)}%` : `${pct.toFixed(1)}%`;
  };

  /**
   * Display-ready narrative rows for the Narrative Signal card only.
   * Does NOT use raw brief.narratives for rendering. Follows the same filtered display
   * logic as the Weekly Brief narrative graph (FraudLandscapeCard):
   *
   * 1. Exclude "none" and "unknown" completely — never displayed, never in totals, never affects bar sizes.
   * 2. Build graph only from known narratives.
   * 3. Normalize bar sizes using only the known narrative subset (totalKnown = sum of their scan_count).
   * 4. Take top 5 by scan_count order, then reorder so dominant (top_narrative_raw) is first.
   *
   * This guarantees Unknown can never appear in the card, even when the brief source
   * (e.g. stored brief_json) contains raw narratives.
   */
  const getNarrativeDisplayList = (
    brief: BriefWeeklyResponse,
    lang: "en" | "fr"
  ): { value: string; label: string; share_of_week: number }[] => {
    const raw = brief.narratives ?? [];
    const isExcluded = (v: string) => {
      const l = String(v ?? "").toLowerCase();
      return l === "none" || l === "unknown";
    };
    const knownOnly = raw.filter((n) => !isExcluded(n.value ?? ""));
    const top5 = knownOnly.slice(0, 5);
    const totalKnown = top5.reduce((sum, n) => sum + (Number(n.scan_count) ?? 0), 0);
    let rows = top5.map((n) => ({
      value: n.value,
      label:
        lang === "fr"
          ? (FRAUD_LABEL_FR[formatLandscapeLabel(n.value)] ?? formatLandscapeLabel(n.value))
          : formatLandscapeLabel(n.value),
      share_of_week: totalKnown > 0 ? (Number(n.scan_count) ?? 0) / totalKnown : 0,
    }));
    const selectedValue = brief.top_narrative_raw ?? null;
    if (selectedValue != null && rows.length > 1 && !isExcluded(selectedValue)) {
      const selectedIdx = rows.findIndex((r) => String(r.value) === String(selectedValue));
      if (selectedIdx > 0) {
        const selectedRow = rows[selectedIdx];
        rows = [selectedRow, ...rows.slice(0, selectedIdx), ...rows.slice(selectedIdx + 1)];
      }
    }
    return rows;
  };

  const getNarrativeCaptionEn = (brief: BriefWeeklyResponse) =>
    [
      "⚠️ Fraud narrative in Canada — week of " + formatWeekStartForSocial(brief.week_start ?? "", "en-CA"),
      "",
      "Dominant scam narrative: " + (brief.top_narrative || "—"),
      "Share of reports: " + formatNarrativeSharePercent(getNarrativeShareOfWeek(brief)),
      "",
      "Full brief:",
      "https://scanscam.ca/brief/weekly",
      "",
      "Analyze a suspicious message:",
      "https://scanscam.ca",
      "",
      "Your scan could help stop the next scam.",
    ].join("\n");

  const getNarrativeCaptionFr = (brief: BriefWeeklyResponse) =>
    [
      "⚠️ Narratif de fraude au Canada — semaine du " + formatWeekStartForSocial(brief.week_start ?? "", "fr-CA"),
      "",
      "Fraude dominante : " + (brief.top_narrative || "—"),
      "Part des signalements : " + formatNarrativeSharePercent(getNarrativeShareOfWeek(brief)) + " %",
      "",
      "Analyse complète :",
      "https://scanscam.ca/brief/weekly",
      "",
      "Analysez un message suspect :",
      "https://scanscam.ca",
      "",
      "Votre analyse pourrait empêcher la prochaine fraude.",
    ].join("\n");

  const handleCopyNarrativeCaptionEn = async () => {
    if (!narrativePreview) return;
    try {
      await navigator.clipboard.writeText(getNarrativeCaptionEn(narrativePreview));
      setNarrativeMessage("EN caption copied.");
      setTimeout(() => setNarrativeMessage(null), 2500);
    } catch {
      setNarrativeMessage("Copy failed.");
      setTimeout(() => setNarrativeMessage(null), 2500);
    }
  };

  const handleCopyNarrativeCaptionFr = async () => {
    if (!narrativePreview) return;
    try {
      await navigator.clipboard.writeText(getNarrativeCaptionFr(narrativePreview));
      setNarrativeMessage("FR caption copied.");
      setTimeout(() => setNarrativeMessage(null), 2500);
    } catch {
      setNarrativeMessage("Copy failed.");
      setTimeout(() => setNarrativeMessage(null), 2500);
    }
  };

  const handleDownloadNarrativeEnPng = async () => {
    if (!narrativeCardEnRef.current) return;
    try {
      const dataUrl = await toPng(narrativeCardEnRef.current, {
        pixelRatio: 2,
        backgroundColor: "#0d1117",
        cacheBust: true,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `scanscam-narrative-signal-en-${narrativePreview?.week_start ?? "weekly"}.png`;
      a.click();
      setNarrativeMessage("EN PNG downloaded.");
      setTimeout(() => setNarrativeMessage(null), 2500);
    } catch {
      setNarrativeMessage("PNG export failed.");
      setTimeout(() => setNarrativeMessage(null), 2500);
    }
  };

  const handleDownloadNarrativeFrPng = async () => {
    if (!narrativeCardFrRef.current) return;
    try {
      const dataUrl = await toPng(narrativeCardFrRef.current, {
        pixelRatio: 2,
        backgroundColor: "#0d1117",
        cacheBust: true,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `scanscam-narrative-signal-fr-${narrativePreview?.week_start ?? "weekly"}.png`;
      a.click();
      setNarrativeMessage("FR PNG downloaded.");
      setTimeout(() => setNarrativeMessage(null), 2500);
    } catch {
      setNarrativeMessage("PNG export failed.");
      setTimeout(() => setNarrativeMessage(null), 2500);
    }
  };

  useEffect(() => {
    fetch("/api/intel/radar-weekly")
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setError(e?.message ?? "Failed to fetch"))
      .finally(() => setLoading(false));

    fetch("/api/intel/system-analysis-v2")
      .then((r) => r.json())
      .then(setSystemV2Data)
      .catch((e) => setSystemV2Error(e?.message ?? "Failed to fetch system-analysis-v2"));
  }, []);

  const sh = data?.system_health;
  const isMobile = useIsMobile();

  const mobile = isMobile
    ? {
        container: { padding: "16px 12px" },
        headerTop: { flexDirection: "column" as const, gap: "12px" },
        takeawaysSection: { padding: "16px 12px" },
        section: { padding: "16px 12px" },
        metrics: { gridTemplateColumns: "1fr" },
        trendChartsGrid: { gridTemplateColumns: "1fr" },
        landscapeGrid: { gridTemplateColumns: "1fr" },
        geoLayout: { flexDirection: "column" as const },
        geoLeft: { minWidth: "100%" },
        geoRight: { minWidth: "100%" },
        analystBlocksGrid: { gridTemplateColumns: "1fr" },
        analystBlocksHeader: { padding: "12px 0", minHeight: 44 },
      }
    : ({} as Record<string, React.CSSProperties>);

  return (
    <div style={{ ...styles.container, ...mobile.container }}>
      {/* Briefing header */}
      <header style={styles.header}>
        <p style={styles.kicker}>INTERNAL INTELLIGENCE SURFACE</p>
        <div style={{ ...styles.headerTop, ...mobile.headerTop }}>
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
          <div style={{ ...styles.section, ...mobile.section }}>
            <p style={{ color: "#8b949e" }}>Loading system health…</p>
          </div>
        )}

        {!loading && data && (
          <>
            <section style={{ ...styles.takeawaysSection, ...mobile.takeawaysSection }}>
              <h2 style={styles.takeawaysTitle}>Key Takeaways</h2>
              <ul style={styles.takeawaysList}>
                {generateKeyTakeaways(data).map((line, i) => (
                  <li key={i} style={styles.takeawaysItem}>
                    {line}
                  </li>
                ))}
              </ul>
            </section>

            <section style={{ ...styles.section, ...mobile.section }}>
              <h2 style={styles.sectionTitle}>System Health</h2>
              <div style={{ ...styles.metrics, ...mobile.metrics }}>
                <div style={styles.metric} title="Total number of scans analyzed during the current weekly window.">
                  <span style={styles.metricLabel}>Scans This Week</span>
                  <span style={styles.metricValue}>
                    {sh?.scan_count != null ? sh.scan_count.toLocaleString() : "—"}
                    <MetricWoWIndicator delta={getCurrentWeekRow(data)?.scan_delta_wow ?? null} format="count" />
                  </span>
                </div>
                <div style={styles.metric} title="Percentage of scan attempts that reached a rendered result page.">
                  <span style={styles.metricLabel}>Scan Completion</span>
                  <span style={styles.metricValue}>
                    {formatRateDecimal(sh?.submit_to_render_rate ?? null)}
                  </span>
                </div>
                <div style={styles.metric} title="Percentage of scans that relied on fallback analysis rather than the primary extraction path.">
                  <span style={styles.metricLabel}>Fallback Rate</span>
                  <span style={styles.metricValue}>
                    {formatRateDecimal(sh?.fallback_rate ?? null)}
                  </span>
                </div>
                <div style={styles.metric} title="Percentage of scans that produced at least two classified core signals and landed in medium or high risk.">
                  <span style={styles.metricLabel}>High-Value Signal Yield</span>
                  <span style={styles.metricValue}>
                    {formatPct(sh?.signal_yield_pct ?? null)}
                  </span>
                </div>
                <div style={styles.metric}>
                  <span style={styles.metricLabel}>Signal Coverage</span>
                  <span style={styles.metricValue}>
                    {formatPct(sh?.signal_coverage_pct ?? null)}
                    <MetricWoWIndicator delta={getCurrentWeekRow(data)?.coverage_delta_wow ?? null} format="pct" />
                  </span>
                  <span style={styles.metricHelper}>At least one core signal was classified.</span>
                </div>
              </div>
            </section>

            <section style={{ ...styles.section, ...mobile.section, marginTop: "24px" }}>
              <h2 style={{ ...styles.sectionTitle, marginBottom: "4px" }}>Activity & Signal Trend</h2>
              <p style={styles.sectionSubtitle}>
                Weekly movement in scan volume and signal quality.
              </p>
              {(!data.weekly_timeline || data.weekly_timeline.length === 0) ? (
                <p style={styles.signalsEmpty}>No weekly trend data available yet.</p>
              ) : (
                <div style={{ ...styles.trendChartsGrid, ...mobile.trendChartsGrid }}>
                  <div style={styles.trendChartCard}>
                    <h3 style={styles.trendChartTitle}>Weekly Scan Volume</h3>
                    <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
                      <LineChart
                        data={data.weekly_timeline}
                        margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                      >
                        <XAxis
                          dataKey="week_start"
                          tick={{ fill: "#6e7681", fontSize: 10 }}
                          tickFormatter={(v) => {
                            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
                            if (!m) return v;
                            const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
                            return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
                          }}
                          axisLine={{ stroke: "#30363d" }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: "#6e7681", fontSize: 10 }}
                          axisLine={{ stroke: "#30363d" }}
                          tickLine={false}
                          tickFormatter={(v) => String(v)}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#21262d",
                            border: "1px solid #30363d",
                            borderRadius: "6px",
                            fontSize: "11px",
                          }}
                          labelFormatter={(v) => `Week of ${formatWeek(v)}`}
                          formatter={(value, _name, item) => {
                            const numericValue = Number(value ?? 0);
                            const delta = item?.payload?.scan_delta_wow;
                            return [
                              `${numericValue.toLocaleString()} scans${delta != null ? ` (WoW ${formatWowDelta(delta)})` : ""}`,
                              "Scans",
                            ];
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="scan_count"
                          stroke="#388bfd"
                          strokeWidth={2}
                          dot={{ fill: "#388bfd", r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={styles.trendChartCard}>
                    <h3 style={styles.trendChartTitle}>Signal Coverage Trend</h3>
                    <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
                      <LineChart
                        data={data.weekly_timeline}
                        margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                      >
                        <XAxis
                          dataKey="week_start"
                          tick={{ fill: "#6e7681", fontSize: 10 }}
                          tickFormatter={(v) => {
                            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
                            if (!m) return v;
                            const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
                            return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
                          }}
                          axisLine={{ stroke: "#30363d" }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: "#6e7681", fontSize: 10 }}
                          axisLine={{ stroke: "#30363d" }}
                          tickLine={false}
                          domain={[0, 100]}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#21262d",
                            border: "1px solid #30363d",
                            borderRadius: "6px",
                            fontSize: "11px",
                          }}
                          labelFormatter={(v) => `Week of ${formatWeek(v)}`}
                          formatter={(_value, _name, item) => {
                            const cov = item?.payload?.signal_coverage_pct;
                            const delta = item?.payload?.coverage_delta_wow;
                            const pct = cov != null ? `${Number(cov).toFixed(1)}%` : "—";
                            const deltaStr = delta != null ? ` (WoW ${formatWowChange(delta)})` : "";
                            return [`${pct}${deltaStr}`, "Coverage"];
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="signal_coverage_pct"
                          stroke="#58a6ff"
                          strokeWidth={2}
                          dot={{ fill: "#58a6ff", r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {!data.daily_volume_timeline || data.daily_volume_timeline.length === 0 ? (
                <p style={{ ...styles.signalsEmpty, marginTop: "16px" }}>
                  No daily scan volume data available yet.
                </p>
              ) : (
                <div style={styles.dailyVolumeCard}>
                  <h3 style={styles.trendChartTitle}>Daily Scan Volume</h3>
                  <ResponsiveContainer width="100%" height={isMobile ? 120 : 140}>
                    <AreaChart
                      data={data.daily_volume_timeline}
                      margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    >
                      <defs>
                        <linearGradient id="dailyVolumeFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#388bfd" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#388bfd" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="day"
                        tick={{ fill: "#6e7681", fontSize: 10 }}
                        tickFormatter={(v) => {
                          const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
                          if (!m) return v;
                          const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
                          return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
                        }}
                        axisLine={{ stroke: "#30363d" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#6e7681", fontSize: 10 }}
                        axisLine={{ stroke: "#30363d" }}
                        tickLine={false}
                        tickFormatter={(v) => String(v)}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#21262d",
                          border: "1px solid #30363d",
                          borderRadius: "6px",
                          fontSize: "11px",
                        }}
                        labelFormatter={(v) => {
                          const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
                          if (!m) return v;
                          const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
                          return d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
                        }}
                        formatter={(value, _name, item) => {
                          const numericValue = Number(value ?? 0);
                          return [`${numericValue} scans`, "Scan count"];
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="scan_count"
                        stroke="#388bfd"
                        strokeWidth={1.5}
                        fill="url(#dailyVolumeFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section style={{ ...styles.section, ...mobile.section, marginTop: "24px" }}>
              <h2 style={{ ...styles.sectionTitle, marginBottom: "4px" }}>Fraud Landscape</h2>
              <p style={styles.sectionSubtitle}>
                The most common scam patterns detected in current weekly activity.
              </p>
              <div style={{ ...styles.landscapeGrid, ...mobile.landscapeGrid }}>
                <FraudLandscapeCard
                  title="Top Narratives"
                  items={data.fraud_landscape?.narratives ?? []}
                />
                <FraudLandscapeCard
                  title="Top Channels"
                  items={data.fraud_landscape?.channels ?? []}
                />
                <FraudLandscapeCard
                  title="Top Payment Methods"
                  items={data.fraud_landscape?.payment_methods ?? []}
                />
                <FraudLandscapeCard
                  title="Top Authority Types"
                  items={data.fraud_landscape?.authority_types ?? []}
                />
              </div>
            </section>

            {(() => {
              const { displayRows, usedFallback } = getSignalsToWatchRows(data);
              const subtitle =
                displayRows.length > 0
                  ? (usedFallback
                      ? "Top known classified signals this week (no movers met threshold)."
                      : "Signals gaining share versus last week, based on week-over-week movement.")
                  : "No classified signals available for this period.";
              return (
            <section style={{ ...styles.section, ...mobile.section, marginTop: "24px" }}>
              <h2 style={{ ...styles.sectionTitle, marginBottom: "4px" }}>Signals to Watch</h2>
              <p style={styles.sectionSubtitle}>{subtitle}</p>
              {displayRows.length === 0 ? (
                <div style={styles.emergingEmpty}>
                  <p style={styles.emergingEmptyMain}>No classified signals available for this period.</p>
                </div>
              ) : (
                <div style={styles.emergingTableWrap}>
                  <table style={styles.emergingTable}>
                    <thead>
                      <tr>
                        <th style={styles.emergingTh}>Dimension</th>
                        <th style={styles.emergingTh}>Value</th>
                        <th style={styles.emergingTh}>This Week</th>
                        <th style={styles.emergingTh}>Share</th>
                        <th style={styles.emergingTh}>WoW Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayRows.map((row, i) => (
                        <tr key={i}>
                          <td style={styles.emergingTd}>{formatDimensionLabel(row.dimension)}</td>
                          <td style={styles.emergingTd}>{formatLandscapeLabel(row.value)}</td>
                          <td style={styles.emergingTd}>{row.this_week_count.toLocaleString()}</td>
                          <td style={styles.emergingTd}>{formatSharePct(row.this_week_share)}</td>
                          <td
                            style={{
                              ...styles.emergingTd,
                              ...(row.share_delta_wow != null && row.share_delta_wow > 0 ? styles.emergingTdPositive : {}),
                            }}
                          >
                            {row.share_delta_wow != null ? formatWowChange(row.share_delta_wow) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
              );
            })()}

            <section style={{ ...styles.section, ...mobile.section, marginTop: "24px" }}>
              <h2 style={{ ...styles.sectionTitle, marginBottom: "4px" }}>Canada Concentration</h2>
              <p style={styles.sectionSubtitle}>
                Where scan activity is concentrating and shifting across Canada this week.
              </p>
              {!data.geography?.provinces?.length && !data.geography?.top_cities?.length ? (
                <p style={styles.geoEmpty}>No geographic concentration data available for this period.</p>
              ) : (
                <div style={{ ...styles.geoLayout, ...mobile.geoLayout }}>
                  <div style={{ ...styles.geoLeft, ...mobile.geoLeft }}>
                    <CanadaChoropleth provinces={data.geography?.provinces ?? []} isMobile={isMobile} />
                  </div>
                  <div style={{ ...styles.geoRight, ...mobile.geoRight }}>
                    <div style={styles.geoLeaderboard}>
                      <h3 style={styles.geoCardTitle}>Province Leaderboard</h3>
                      {(!data.geography?.provinces || data.geography.provinces.length === 0) ? (
                        <p style={styles.geoLeaderEmpty}>No province data</p>
                      ) : (
                        <table style={styles.geoLeaderTable}>
                          <thead>
                            <tr>
                              <th style={styles.geoLeaderTh}>Province</th>
                              <th style={styles.geoLeaderTh}>Scans</th>
                              <th style={styles.geoLeaderTh}>WoW Δ</th>
                              <th style={styles.geoLeaderTh}>High-Risk</th>
                              <th style={styles.geoLeaderTh}>Risk Ratio</th>
                            </tr>
                          </thead>
                            <tbody>
                            {data.geography!.provinces.map((p, i) => (
                              <tr key={i}>
                                <td style={{ ...styles.geoLeaderTd, ...(p.is_meaningful ? {} : styles.geoLeaderTdMuted) }}>
                                  {formatGeoValue(p.province)}
                                </td>
                                <td style={{ ...styles.geoLeaderTd, ...(p.is_meaningful ? {} : styles.geoLeaderTdMuted) }}>
                                  {p.scan_count.toLocaleString()}
                                </td>
                                <td style={{ ...styles.geoLeaderTd, ...(p.is_meaningful ? {} : styles.geoLeaderTdMuted) }}>
                                  {formatWowDelta(p.wow_scan_delta)}
                                </td>
                                <td style={{ ...styles.geoLeaderTd, ...(p.is_meaningful ? {} : styles.geoLeaderTdMuted) }}>
                                  {p.high_risk_count}
                                </td>
                                <td style={{ ...styles.geoLeaderTd, ...(p.is_meaningful ? {} : styles.geoLeaderTdMuted) }}>
                                  {formatRiskRatio(p.high_risk_ratio)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                    <div style={styles.geoCities}>
                      <h3 style={styles.geoCardTitle}>Top 3 Cities</h3>
                      {(!data.geography?.top_cities || data.geography.top_cities.length === 0) ? (
                        <p style={styles.geoLeaderEmpty}>No city data</p>
                      ) : (
                        data.geography.top_cities.map((c, i) => (
                          <div key={i} style={styles.geoCityRow}>
                            <span style={styles.geoCityName}>{formatGeoValue(c.city)}</span>
                            <span style={styles.geoCityProv}>{formatGeoValue(c.province)}</span>
                            <span style={styles.geoCityMeta}>
                              {c.scan_count} scans · {c.high_risk_count} high-risk
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section style={{ ...styles.section, ...mobile.section, marginTop: "24px" }}>
              <h2 style={{ ...styles.sectionTitle, marginBottom: "4px" }}>Recent Signals</h2>
              <p style={styles.sectionSubtitle}>
                Recent scan activity using the upgraded v2 system-analysis feed.
              </p>
              {!systemV2Data?.recent_signals?.length ? (
                <p style={styles.signalsEmpty}>No recent signals available.</p>
              ) : (
                <RecentSignalsContent signals={systemV2Data.recent_signals} />
              )}
            </section>

            <AnalystBlocksSection isMobile={isMobile} mobileStyles={mobile} />

            <SystemAnalysisV2Section
              data={systemV2Data}
              error={systemV2Error}
              isMobile={isMobile}
              mobileStyles={mobile}
            />

            <section style={{ ...styles.section, ...mobile.section, ...styles.analystBlocksSection, marginTop: "24px" }}>
              <button
                type="button"
                onClick={() => setMarketingSectionExpanded(!marketingSectionExpanded)}
                style={{ ...styles.analystBlocksHeader, ...(isMobile ? (mobile?.analystBlocksHeader ?? {}) : {}) }}
                aria-expanded={marketingSectionExpanded}
              >
                <span style={styles.analystBlocksChevron}>{marketingSectionExpanded ? "▼" : "▶"}</span>
                <h2 style={styles.analystBlocksTitle}>Marketing & Distribution</h2>
              </button>
              {marketingSectionExpanded && (
                <>
                  <p style={styles.analystBlocksSubtitle}>
                    Weekly brief and social signal exports for sharing.
                  </p>
                  <div style={styles.briefAdminRow}>
                    <button
                      type="button"
                      onClick={handleGenerateBrief}
                      disabled={briefGenerating}
                      style={styles.briefAdminBtn}
                    >
                      {briefGenerating ? "Generating…" : "Generate Weekly Brief"}
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateSocialSignalText}
                      disabled={socialSignalLoading}
                      style={styles.briefAdminBtn}
                    >
                      {socialSignalLoading ? "Generating…" : "Social Signal (Text)"}
                    </button>
                    <a
                      href="https://scanscam.ca/brief/weekly"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ ...styles.briefAdminLink, fontSize: "12px" }}
                    >
                      Open Weekly Brief →
                    </a>
                    <button
                      type="button"
                      onClick={handleLoadGraphicPreview}
                      disabled={graphicLoading}
                      style={styles.briefAdminBtn}
                    >
                      {graphicLoading ? "Loading…" : "Social Signal (Graphic)"}
                    </button>
                    <button
                      type="button"
                      onClick={handleLoadNarrativePreview}
                      disabled={narrativeLoading}
                      style={styles.briefAdminBtn}
                    >
                      {narrativeLoading ? "Loading…" : "Narrative Signal (Graphic)"}
                    </button>
                  </div>
                  {(briefMessage || socialSignalMessage || graphicMessage || narrativeMessage) && (
                    <div style={styles.briefAdminRow}>
                      {briefMessage && (
                        <span style={briefSuccess ? styles.briefAdminSuccess : styles.briefAdminError}>
                          {briefMessage}
                          {briefSuccess && briefPreview && (
                            <>
                              {" "}
                              <a href={briefPreview.brief_url} target="_blank" rel="noopener noreferrer" style={styles.briefAdminLink}>
                                Open brief →
                              </a>
                            </>
                          )}
                        </span>
                      )}
                      {socialSignalMessage && (
                        <span style={socialSignalText ? styles.briefAdminSuccess : styles.briefAdminError}>
                          {socialSignalMessage}
                        </span>
                      )}
                      {graphicMessage && (
                        <span style={graphicPreview ? styles.briefAdminSuccess : styles.briefAdminError}>
                          {graphicMessage}
                        </span>
                      )}
                      {narrativeMessage && (
                        <span style={narrativePreview ? styles.briefAdminSuccess : styles.briefAdminError}>
                          {narrativeMessage}
                        </span>
                      )}
                    </div>
                  )}
                  {briefSuccess && briefPreview && (
                    <div style={styles.briefAdminPreview}>
                      <div style={styles.briefAdminPreviewLabel}>Social preview</div>
                      <div style={styles.briefAdminPreviewHeadline}>{briefPreview.social_headline}</div>
                      <pre style={styles.briefAdminPreviewSummary}>{briefPreview.social_summary}</pre>
                    </div>
                  )}
                  {socialSignalText && (
                    <div style={styles.marketingSignalOutput}>
                      <details style={styles.marketingDetails}>
                        <summary style={styles.marketingSummary}>
                          <span>English social signal (long)</span>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); handleCopySocialSignal("en"); }}
                            style={styles.briefAdminBtn}
                          >
                            Copy
                          </button>
                        </summary>
                        <pre style={{ ...styles.briefAdminPreviewSummary, padding: "8px 12px" }}>{socialSignalText.en}</pre>
                      </details>
                      <details style={styles.marketingDetails}>
                        <summary style={styles.marketingSummary}>
                          <span>English social signal (short)</span>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); handleCopySocialSignal("enShort"); }}
                            style={styles.briefAdminBtn}
                          >
                            Copy
                          </button>
                        </summary>
                        <pre style={{ ...styles.briefAdminPreviewSummary, padding: "8px 12px" }}>{socialSignalText.enShort}</pre>
                      </details>
                      <details style={styles.marketingDetails}>
                        <summary style={styles.marketingSummary}>
                          <span>French social signal (long)</span>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); handleCopySocialSignal("fr"); }}
                            style={styles.briefAdminBtn}
                          >
                            Copy
                          </button>
                        </summary>
                        <pre style={{ ...styles.briefAdminPreviewSummary, padding: "8px 12px" }}>{socialSignalText.fr}</pre>
                      </details>
                      <details style={styles.marketingDetails}>
                        <summary style={styles.marketingSummary}>
                          <span>French social signal (short)</span>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); handleCopySocialSignal("frShort"); }}
                            style={styles.briefAdminBtn}
                          >
                            Copy
                          </button>
                        </summary>
                        <pre style={{ ...styles.briefAdminPreviewSummary, padding: "8px 12px" }}>{socialSignalText.frShort}</pre>
                      </details>
                    </div>
                  )}
                  {graphicPreview && (
                    <>
                      <div style={styles.graphicCardRow}>
                        <button
                          type="button"
                          onClick={() => setGraphicCleanViewLang("en")}
                          style={styles.briefAdminBtn}
                        >
                          Open EN card
                        </button>
                        <button
                          type="button"
                          onClick={() => setGraphicCleanViewLang("fr")}
                          style={styles.briefAdminBtn}
                        >
                          Open FR card
                        </button>
                        <button type="button" onClick={handleDownloadEnPng} style={styles.briefAdminBtn}>
                          Download EN PNG
                        </button>
                        <button type="button" onClick={handleDownloadFrPng} style={styles.briefAdminBtn}>
                          Download FR PNG
                        </button>
                      </div>
                      <div style={styles.graphicCardsWrap}>
                        <div>
                          <div style={styles.graphicCardLabel}>Graphic Preview (EN)</div>
                          <div ref={graphicCardEnRef} style={styles.graphicCard}>
                            <div style={styles.graphicCardHeader}>
                              <div style={styles.graphicCardTitle}>ScanScam Fraud Signal</div>
                              <img src="/Logo/scanscam-sun-mark.png" alt="" style={styles.graphicCardLogo} />
                            </div>
                            <div style={styles.graphicCardScopeLabel}>Canada</div>
                            <div style={styles.graphicCardSubline}>
                              Week of {formatWeekStartForSocial(graphicPreview.week_start ?? "", "en-CA")}
                            </div>
                            <div style={styles.graphicCardMetric}>
                              <span style={styles.graphicCardMetricLabel}>Risk Index</span>
                              <span style={styles.graphicCardMetricValue}>
                                {graphicPreview.risk_index}
                                {graphicPreview.risk_index_trend === "up" && " ↑"}
                                {graphicPreview.risk_index_trend === "down" && " ↓"}
                                {graphicPreview.risk_index_trend === "flat" && " →"}
                              </span>
                            </div>
                            <div style={styles.graphicCardSection}>
                              <span style={styles.graphicCardSectionLabel}>Predominant fraud</span>
                              <span style={styles.graphicCardSectionValue}>
                                {graphicPreview.fraud_label || "—"}
                              </span>
                            </div>
                            <div style={styles.graphicCardUrlBlocks}>
                              <div style={styles.graphicCardUrlBlock}>
                                <div style={styles.graphicCardUrlLabel}>Full brief</div>
                                <div style={styles.graphicCardUrlValue}>scanscam.ca/brief/weekly</div>
                              </div>
                              <div style={styles.graphicCardUrlBlock}>
                                <div style={styles.graphicCardUrlLabel}>Analyze a suspicious message:</div>
                                <div style={styles.graphicCardUrlValue}>scanscam.ca</div>
                              </div>
                            </div>
                            <div style={styles.graphicCardFooter}>
                              Your scan could help stop the next scam.
                            </div>
                          </div>
                        </div>
                        <div>
                          <div style={styles.graphicCardLabel}>Graphic Preview (FR)</div>
                          <div ref={graphicCardFrRef} style={styles.graphicCard}>
                            <div style={styles.graphicCardHeader}>
                              <div style={styles.graphicCardTitle}>Signal de fraude ScanScam</div>
                              <img src="/Logo/scanscam-sun-mark.png" alt="" style={styles.graphicCardLogo} />
                            </div>
                            <div style={styles.graphicCardScopeLabel}>Canada</div>
                            <div style={styles.graphicCardSubline}>
                              Semaine du {formatWeekStartForSocial(graphicPreview.week_start ?? "", "fr-CA")}
                            </div>
                            <div style={styles.graphicCardMetric}>
                              <span style={styles.graphicCardMetricLabel}>Indice de risque</span>
                              <span style={styles.graphicCardMetricValue}>
                                {graphicPreview.risk_index}
                                {graphicPreview.risk_index_trend === "up" && " ↑"}
                                {graphicPreview.risk_index_trend === "down" && " ↓"}
                                {graphicPreview.risk_index_trend === "flat" && " →"}
                              </span>
                            </div>
                            <div style={styles.graphicCardSection}>
                              <span style={styles.graphicCardSectionLabel}>Fraude prédominante</span>
                              <span style={styles.graphicCardSectionValue}>
                                {fraudLabelFr(graphicPreview.fraud_label) || "—"}
                              </span>
                            </div>
                            <div style={styles.graphicCardUrlBlocks}>
                              <div style={styles.graphicCardUrlBlock}>
                                <div style={styles.graphicCardUrlLabel}>Analyse complète</div>
                                <div style={styles.graphicCardUrlValue}>scanscam.ca/brief/weekly</div>
                              </div>
                              <div style={styles.graphicCardUrlBlock}>
                                <div style={styles.graphicCardUrlLabel}>Analysez un message suspect :</div>
                                <div style={styles.graphicCardUrlValue}>scanscam.ca</div>
                              </div>
                            </div>
                            <div style={styles.graphicCardFooter}>
                              Votre analyse pourrait empêcher la prochaine fraude.
                            </div>
                          </div>
                        </div>
                      </div>
                      <div style={styles.graphicCaptionsWrap}>
                        <div style={styles.graphicCaptionBlock}>
                          <div style={styles.graphicCaptionHeader}>
                            <span style={styles.graphicCaptionLabel}>Caption (EN)</span>
                            <button type="button" onClick={handleCopyCaptionEn} style={styles.briefAdminBtn}>
                              Copy EN caption
                            </button>
                          </div>
                          <pre style={styles.graphicCaptionPre}>{getGraphicCaptionEn(graphicPreview)}</pre>
                          <div style={styles.graphicCaptionLinks}>
                            <a href="https://scanscam.ca/brief/weekly" target="_blank" rel="noopener noreferrer" style={styles.briefAdminLink}>
                              scanscam.ca/brief/weekly
                            </a>
                            {" · "}
                            <a href="https://scanscam.ca" target="_blank" rel="noopener noreferrer" style={styles.briefAdminLink}>
                              scanscam.ca
                            </a>
                          </div>
                        </div>
                        <div style={styles.graphicCaptionBlock}>
                          <div style={styles.graphicCaptionHeader}>
                            <span style={styles.graphicCaptionLabel}>Caption (FR)</span>
                            <button type="button" onClick={handleCopyCaptionFr} style={styles.briefAdminBtn}>
                              Copy FR caption
                            </button>
                          </div>
                          <pre style={styles.graphicCaptionPre}>{getGraphicCaptionFr(graphicPreview)}</pre>
                          <div style={styles.graphicCaptionLinks}>
                            <a href="https://scanscam.ca/brief/weekly" target="_blank" rel="noopener noreferrer" style={styles.briefAdminLink}>
                              scanscam.ca/brief/weekly
                            </a>
                            {" · "}
                            <a href="https://scanscam.ca" target="_blank" rel="noopener noreferrer" style={styles.briefAdminLink}>
                              scanscam.ca
                            </a>
                          </div>
                        </div>
                      </div>
                      {graphicCleanViewLang !== null && (
                        <div
                          style={styles.graphicCleanViewOverlay}
                          onClick={() => setGraphicCleanViewLang(null)}
                          role="dialog"
                          aria-modal="true"
                          aria-label={graphicCleanViewLang === "en" ? "Clean view EN card" : "Clean view FR card"}
                        >
                          <div style={styles.graphicCleanViewContent} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setGraphicCleanViewLang(null)}
                              style={styles.graphicCleanViewClose}
                            >
                              Close
                            </button>
                            <div style={styles.graphicCleanViewCards}>
                              {graphicCleanViewLang === "en" && (
                                <div style={styles.graphicCleanViewCardWrap}>
                                <div style={styles.graphicCard}>
                                  <div style={styles.graphicCardHeader}>
                                    <div style={styles.graphicCardTitle}>ScanScam Fraud Signal</div>
                                    <img src="/Logo/scanscam-sun-mark.png" alt="" style={styles.graphicCardLogo} />
                                  </div>
                                  <div style={styles.graphicCardScopeLabel}>Canada</div>
                                  <div style={styles.graphicCardSubline}>
                                    Week of {formatWeekStartForSocial(graphicPreview.week_start ?? "", "en-CA")}
                                  </div>
                                  <div style={styles.graphicCardMetric}>
                                    <span style={styles.graphicCardMetricLabel}>Risk Index</span>
                                    <span style={styles.graphicCardMetricValue}>
                                      {graphicPreview.risk_index}
                                      {graphicPreview.risk_index_trend === "up" && " ↑"}
                                      {graphicPreview.risk_index_trend === "down" && " ↓"}
                                      {graphicPreview.risk_index_trend === "flat" && " →"}
                                    </span>
                                  </div>
                                  <div style={styles.graphicCardSection}>
                                    <span style={styles.graphicCardSectionLabel}>Predominant fraud</span>
                                    <span style={styles.graphicCardSectionValue}>
                                      {graphicPreview.fraud_label || "—"}
                                    </span>
                                  </div>
                                  <div style={styles.graphicCardUrlBlocks}>
                                    <div style={styles.graphicCardUrlBlock}>
                                      <div style={styles.graphicCardUrlLabel}>Full brief</div>
                                      <div style={styles.graphicCardUrlValue}>scanscam.ca/brief/weekly</div>
                                    </div>
                                    <div style={styles.graphicCardUrlBlock}>
                                      <div style={styles.graphicCardUrlLabel}>Analyze a suspicious message:</div>
                                      <div style={styles.graphicCardUrlValue}>scanscam.ca</div>
                                    </div>
                                  </div>
                                  <div style={styles.graphicCardFooter}>
                                    Your scan could help stop the next scam.
                                  </div>
                                </div>
                                </div>
                              )}
                              {graphicCleanViewLang === "fr" && (
                                <div style={styles.graphicCleanViewCardWrap}>
                                <div style={styles.graphicCard}>
                                  <div style={styles.graphicCardHeader}>
                                    <div style={styles.graphicCardTitle}>Signal de fraude ScanScam</div>
                                    <img src="/Logo/scanscam-sun-mark.png" alt="" style={styles.graphicCardLogo} />
                                  </div>
                                  <div style={styles.graphicCardScopeLabel}>Canada</div>
                                  <div style={styles.graphicCardSubline}>
                                    Semaine du {formatWeekStartForSocial(graphicPreview.week_start ?? "", "fr-CA")}
                                  </div>
                                  <div style={styles.graphicCardMetric}>
                                    <span style={styles.graphicCardMetricLabel}>Indice de risque</span>
                                    <span style={styles.graphicCardMetricValue}>
                                      {graphicPreview.risk_index}
                                      {graphicPreview.risk_index_trend === "up" && " ↑"}
                                      {graphicPreview.risk_index_trend === "down" && " ↓"}
                                      {graphicPreview.risk_index_trend === "flat" && " →"}
                                    </span>
                                  </div>
                                  <div style={styles.graphicCardSection}>
                                    <span style={styles.graphicCardSectionLabel}>Fraude prédominante</span>
                                    <span style={styles.graphicCardSectionValue}>
                                      {fraudLabelFr(graphicPreview.fraud_label) || "—"}
                                    </span>
                                  </div>
                                  <div style={styles.graphicCardUrlBlocks}>
                                    <div style={styles.graphicCardUrlBlock}>
                                      <div style={styles.graphicCardUrlLabel}>Analyse complète</div>
                                      <div style={styles.graphicCardUrlValue}>scanscam.ca/brief/weekly</div>
                                    </div>
                                    <div style={styles.graphicCardUrlBlock}>
                                      <div style={styles.graphicCardUrlLabel}>Analysez un message suspect :</div>
                                      <div style={styles.graphicCardUrlValue}>scanscam.ca</div>
                                    </div>
                                  </div>
                                  <div style={styles.graphicCardFooter}>
                                    Votre analyse pourrait empêcher la prochaine fraude.
                                  </div>
                                </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {narrativePreview && (
                    <>
                      <div style={styles.graphicCardRow}>
                        <button type="button" onClick={() => setNarrativeCleanViewLang("en")} style={styles.briefAdminBtn}>
                          Open EN card
                        </button>
                        <button type="button" onClick={() => setNarrativeCleanViewLang("fr")} style={styles.briefAdminBtn}>
                          Open FR card
                        </button>
                        <button type="button" onClick={handleDownloadNarrativeEnPng} style={styles.briefAdminBtn}>
                          Download EN PNG
                        </button>
                        <button type="button" onClick={handleDownloadNarrativeFrPng} style={styles.briefAdminBtn}>
                          Download FR PNG
                        </button>
                      </div>
                      <div style={styles.graphicCardsWrap}>
                        <div>
                          <div style={styles.graphicCardLabel}>Narrative Preview (EN)</div>
                          <div ref={narrativeCardEnRef} style={styles.graphicCard}>
                            <div style={styles.graphicCardHeader}>
                              <div style={styles.graphicCardTitle}>ScanScam Fraud Narrative</div>
                              <img src="/Logo/scanscam-sun-mark.png" alt="" style={styles.graphicCardLogo} />
                            </div>
                            <div style={styles.graphicCardScopeLabel}>Canada</div>
                            <div style={styles.graphicCardSubline}>
                              Week of {formatWeekStartForSocial(narrativePreview.week_start ?? "", "en-CA")}
                            </div>
                            <div style={styles.narrativeDominantSection}>
                              <div style={styles.narrativeDominantLabel}>Dominant scam this week</div>
                              <div style={styles.narrativeDominantValue}>{narrativePreview.fraud_label || "—"}</div>
                            </div>
                            <div style={styles.narrativeBarSection}>
                              <div style={styles.narrativeBarSectionLabel}>Top scam narratives</div>
                              {getNarrativeDisplayList(narrativePreview, "en").map((n) => (
                                <div key={n.value} style={styles.narrativeBarRow}>
                                  <span style={styles.narrativeBarLabel}>{n.label}</span>
                                  <div style={styles.narrativeBarTrack}>
                                    <div
                                      style={{
                                        ...styles.narrativeBarFill,
                                        width: `${(n.share_of_week * 100).toFixed(1)}%`,
                                        backgroundColor:
                                          narrativePreview.top_narrative_raw != null &&
                                          String(n.value) === String(narrativePreview.top_narrative_raw)
                                            ? "#d1242f"
                                            : "#58a6ff",
                                      }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div style={styles.narrativeGraphNote}>
                              Distribution based on reported scam messages this week.
                            </div>
                            <div style={styles.graphicCardUrlBlocks}>
                              <div style={styles.graphicCardUrlBlock}>
                                <div style={styles.graphicCardUrlLabel}>Full brief</div>
                                <div style={styles.graphicCardUrlValue}>scanscam.ca/brief/weekly</div>
                              </div>
                              <div style={styles.graphicCardUrlBlock}>
                                <div style={styles.graphicCardUrlLabel}>Analyze a suspicious message:</div>
                                <div style={styles.graphicCardUrlValue}>scanscam.ca</div>
                              </div>
                            </div>
                            <div style={styles.graphicCardFooter}>
                              Your scan could help stop the next scam.
                            </div>
                          </div>
                        </div>
                        <div>
                          <div style={styles.graphicCardLabel}>Narrative Preview (FR)</div>
                          <div ref={narrativeCardFrRef} style={styles.graphicCard}>
                            <div style={styles.graphicCardHeader}>
                              <div style={styles.graphicCardTitle}>Narratif de fraude ScanScam</div>
                              <img src="/Logo/scanscam-sun-mark.png" alt="" style={styles.graphicCardLogo} />
                            </div>
                            <div style={styles.graphicCardScopeLabel}>Canada</div>
                            <div style={styles.graphicCardSubline}>
                              Semaine du {formatWeekStartForSocial(narrativePreview.week_start ?? "", "fr-CA")}
                            </div>
                            <div style={styles.narrativeDominantSection}>
                              <div style={styles.narrativeDominantLabel}>Fraude principale cette semaine</div>
                              <div style={styles.narrativeDominantValue}>{fraudLabelFr(narrativePreview.fraud_label) || "—"}</div>
                            </div>
                            <div style={styles.narrativeBarSection}>
                              <div style={styles.narrativeBarSectionLabel}>Principaux narratifs de fraude</div>
                              {getNarrativeDisplayList(narrativePreview, "fr").map((n) => (
                                <div key={n.value} style={styles.narrativeBarRow}>
                                  <span style={styles.narrativeBarLabel}>{n.label}</span>
                                  <div style={styles.narrativeBarTrack}>
                                    <div
                                      style={{
                                        ...styles.narrativeBarFill,
                                        width: `${(n.share_of_week * 100).toFixed(1)}%`,
                                        backgroundColor:
                                          narrativePreview.top_narrative_raw != null &&
                                          String(n.value) === String(narrativePreview.top_narrative_raw)
                                            ? "#d1242f"
                                            : "#58a6ff",
                                      }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div style={styles.narrativeGraphNote}>
                              Distribution basée sur les messages frauduleux signalés cette semaine.
                            </div>
                            <div style={styles.graphicCardUrlBlocks}>
                              <div style={styles.graphicCardUrlBlock}>
                                <div style={styles.graphicCardUrlLabel}>Analyse complète</div>
                                <div style={styles.graphicCardUrlValue}>scanscam.ca/brief/weekly</div>
                              </div>
                              <div style={styles.graphicCardUrlBlock}>
                                <div style={styles.graphicCardUrlLabel}>Analysez un message suspect :</div>
                                <div style={styles.graphicCardUrlValue}>scanscam.ca</div>
                              </div>
                            </div>
                            <div style={styles.graphicCardFooter}>
                              Votre analyse pourrait empêcher la prochaine fraude.
                            </div>
                          </div>
                        </div>
                      </div>
                      <div style={styles.graphicCaptionsWrap}>
                        <div style={styles.graphicCaptionBlock}>
                          <div style={styles.graphicCaptionHeader}>
                            <span style={styles.graphicCaptionLabel}>Caption (EN)</span>
                            <button type="button" onClick={handleCopyNarrativeCaptionEn} style={styles.briefAdminBtn}>
                              Copy EN caption
                            </button>
                          </div>
                          <pre style={styles.graphicCaptionPre}>{getNarrativeCaptionEn(narrativePreview)}</pre>
                          <div style={styles.graphicCaptionLinks}>
                            <a href="https://scanscam.ca/brief/weekly" target="_blank" rel="noopener noreferrer" style={styles.briefAdminLink}>
                              scanscam.ca/brief/weekly
                            </a>
                            {" · "}
                            <a href="https://scanscam.ca" target="_blank" rel="noopener noreferrer" style={styles.briefAdminLink}>
                              scanscam.ca
                            </a>
                          </div>
                        </div>
                        <div style={styles.graphicCaptionBlock}>
                          <div style={styles.graphicCaptionHeader}>
                            <span style={styles.graphicCaptionLabel}>Caption (FR)</span>
                            <button type="button" onClick={handleCopyNarrativeCaptionFr} style={styles.briefAdminBtn}>
                              Copy FR caption
                            </button>
                          </div>
                          <pre style={styles.graphicCaptionPre}>{getNarrativeCaptionFr(narrativePreview)}</pre>
                          <div style={styles.graphicCaptionLinks}>
                            <a href="https://scanscam.ca/brief/weekly" target="_blank" rel="noopener noreferrer" style={styles.briefAdminLink}>
                              scanscam.ca/brief/weekly
                            </a>
                            {" · "}
                            <a href="https://scanscam.ca" target="_blank" rel="noopener noreferrer" style={styles.briefAdminLink}>
                              scanscam.ca
                            </a>
                          </div>
                        </div>
                      </div>
                      {narrativeCleanViewLang !== null && (
                        <div
                          style={styles.graphicCleanViewOverlay}
                          onClick={() => setNarrativeCleanViewLang(null)}
                          role="dialog"
                          aria-modal="true"
                          aria-label={narrativeCleanViewLang === "en" ? "Clean view narrative EN" : "Clean view narrative FR"}
                        >
                          <div style={styles.graphicCleanViewContent} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setNarrativeCleanViewLang(null)}
                              style={styles.graphicCleanViewClose}
                            >
                              Close
                            </button>
                            <div style={styles.graphicCleanViewCards}>
                              {narrativeCleanViewLang === "en" && (
                                <div style={styles.graphicCleanViewCardWrap}>
                                  <div style={styles.graphicCard}>
                                    <div style={styles.graphicCardHeader}>
                                      <div style={styles.graphicCardTitle}>ScanScam Fraud Narrative</div>
                                      <img src="/Logo/scanscam-sun-mark.png" alt="" style={styles.graphicCardLogo} />
                                    </div>
                                    <div style={styles.graphicCardScopeLabel}>Canada</div>
                                    <div style={styles.graphicCardSubline}>
                                      Week of {formatWeekStartForSocial(narrativePreview.week_start ?? "", "en-CA")}
                                    </div>
                                    <div style={styles.narrativeDominantSection}>
                                      <div style={styles.narrativeDominantLabel}>Dominant scam this week</div>
                                      <div style={styles.narrativeDominantValue}>{narrativePreview.fraud_label || "—"}</div>
                                    </div>
                                    <div style={styles.narrativeBarSection}>
                                      <div style={styles.narrativeBarSectionLabel}>Top scam narratives</div>
                                      {getNarrativeDisplayList(narrativePreview, "en").map((n) => (
                                        <div key={n.value} style={styles.narrativeBarRow}>
                                          <span style={styles.narrativeBarLabel}>{n.label}</span>
                                          <div style={styles.narrativeBarTrack}>
                                            <div
                                              style={{
                                                ...styles.narrativeBarFill,
                                                width: `${(n.share_of_week * 100).toFixed(1)}%`,
                                                backgroundColor:
                                                  narrativePreview.top_narrative_raw != null &&
                                                  String(n.value) === String(narrativePreview.top_narrative_raw)
                                                    ? "#d1242f"
                                                    : "#58a6ff",
                                              }}
                                            />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    <div style={styles.narrativeGraphNote}>
                                      Distribution based on reported scam messages this week.
                                    </div>
                                    <div style={styles.graphicCardUrlBlocks}>
                                      <div style={styles.graphicCardUrlBlock}>
                                        <div style={styles.graphicCardUrlLabel}>Full brief</div>
                                        <div style={styles.graphicCardUrlValue}>scanscam.ca/brief/weekly</div>
                                      </div>
                                      <div style={styles.graphicCardUrlBlock}>
                                        <div style={styles.graphicCardUrlLabel}>Analyze a suspicious message:</div>
                                        <div style={styles.graphicCardUrlValue}>scanscam.ca</div>
                                      </div>
                                    </div>
                                    <div style={styles.graphicCardFooter}>
                                      Your scan could help stop the next scam.
                                    </div>
                                  </div>
                                </div>
                              )}
                              {narrativeCleanViewLang === "fr" && (
                                <div style={styles.graphicCleanViewCardWrap}>
                                  <div style={styles.graphicCard}>
                                    <div style={styles.graphicCardHeader}>
                                      <div style={styles.graphicCardTitle}>Narratif de fraude ScanScam</div>
                                      <img src="/Logo/scanscam-sun-mark.png" alt="" style={styles.graphicCardLogo} />
                                    </div>
                                    <div style={styles.graphicCardScopeLabel}>Canada</div>
                                    <div style={styles.graphicCardSubline}>
                                      Semaine du {formatWeekStartForSocial(narrativePreview.week_start ?? "", "fr-CA")}
                                    </div>
                                    <div style={styles.narrativeDominantSection}>
                                      <div style={styles.narrativeDominantLabel}>Fraude principale cette semaine</div>
                                      <div style={styles.narrativeDominantValue}>{fraudLabelFr(narrativePreview.fraud_label) || "—"}</div>
                                    </div>
                                    <div style={styles.narrativeBarSection}>
                                      <div style={styles.narrativeBarSectionLabel}>Principaux narratifs de fraude</div>
                                      {getNarrativeDisplayList(narrativePreview, "fr").map((n) => (
                                        <div key={n.value} style={styles.narrativeBarRow}>
                                          <span style={styles.narrativeBarLabel}>{n.label}</span>
                                          <div style={styles.narrativeBarTrack}>
                                            <div
                                              style={{
                                                ...styles.narrativeBarFill,
                                                width: `${(n.share_of_week * 100).toFixed(1)}%`,
                                                backgroundColor:
                                                  narrativePreview.top_narrative_raw != null &&
                                                  String(n.value) === String(narrativePreview.top_narrative_raw)
                                                    ? "#d1242f"
                                                    : "#58a6ff",
                                              }}
                                            />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    <div style={styles.narrativeGraphNote}>
                                      Distribution basée sur les messages frauduleux signalés cette semaine.
                                    </div>
                                    <div style={styles.graphicCardUrlBlocks}>
                                      <div style={styles.graphicCardUrlBlock}>
                                        <div style={styles.graphicCardUrlLabel}>Analyse complète</div>
                                        <div style={styles.graphicCardUrlValue}>scanscam.ca/brief/weekly</div>
                                      </div>
                                      <div style={styles.graphicCardUrlBlock}>
                                        <div style={styles.graphicCardUrlLabel}>Analysez un message suspect :</div>
                                        <div style={styles.graphicCardUrlValue}>scanscam.ca</div>
                                      </div>
                                    </div>
                                    <div style={styles.graphicCardFooter}>
                                      Votre analyse pourrait empêcher la prochaine fraude.
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "24px 56px",
    maxWidth: "1800px",
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
    backgroundColor: "#171d24",
    borderRadius: "12px",
    border: "1px solid #30363d",
    borderTop: "1px solid #21262d",
    padding: "24px",
  },
  sectionTitle: {
    margin: "0 0 20px",
    fontSize: "16px",
    fontWeight: 600,
    color: "#e6edf3",
  },
  takeawaysSection: {
    marginBottom: "24px",
    padding: "20px 24px",
    backgroundColor: "#171d24",
    border: "1px solid #30363d",
    borderLeft: "3px solid #388bfd",
    borderRadius: "8px",
  },
  takeawaysTitle: {
    margin: "0 0 12px",
    fontSize: "14px",
    fontWeight: 600,
    color: "#e6edf3",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  takeawaysList: {
    margin: 0,
    paddingLeft: "18px",
    fontSize: "13px",
    color: "#8b949e",
    lineHeight: 1.6,
  },
  takeawaysItem: {
    marginBottom: "6px",
  },
  sectionSubtitle: {
    margin: "4px 0 20px",
    fontSize: "13px",
    color: "#8b949e",
    lineHeight: 1.4,
  },
  trendChartsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
    gap: "20px",
  },
  trendChartCard: {
    backgroundColor: "#1e252d",
    borderRadius: "8px",
    border: "1px solid #30363d",
    padding: "16px",
  },
  trendChartTitle: {
    margin: "0 0 12px",
    fontSize: "13px",
    fontWeight: 600,
    color: "#e6edf3",
  },
  dailyVolumeCard: {
    marginTop: "16px",
    backgroundColor: "#1e252d",
    borderRadius: "8px",
    border: "1px solid #30363d",
    padding: "16px",
  },
  landscapeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "20px",
  },
  emergingEmpty: {
    padding: "24px 0",
  },
  emergingEmptyMain: {
    margin: 0,
    fontSize: "13px",
    color: "#8b949e",
  },
  emergingEmptySub: {
    margin: "6px 0 0",
    fontSize: "12px",
    color: "#6e7681",
  },
  emergingTableWrap: {
    overflowX: "auto",
  },
  emergingTable: {
    width: "100%",
    minWidth: "360px",
    borderCollapse: "collapse",
    fontSize: "13px",
  },
  emergingTh: {
    textAlign: "left",
    padding: "10px 16px 10px 0",
    fontWeight: 600,
    color: "#8b949e",
    borderBottom: "1px solid #30363d",
  },
  emergingTd: {
    padding: "10px 16px 10px 0",
    color: "#e6edf3",
    borderBottom: "1px solid #21262d",
  },
  emergingTdPositive: {
    color: "#7ee787",
  },
  geoEmpty: {
    margin: 0,
    fontSize: "13px",
    color: "#6e7681",
  },
  geoLayout: {
    display: "flex",
    flexWrap: "wrap",
    gap: "24px",
    alignItems: "flex-start",
  },
  geoLeft: {
    flex: "1 1 380px",
    minWidth: 0,
  },
  geoRight: {
    flex: "1 1 300px",
    minWidth: "280px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  geoLeaderboard: {
    backgroundColor: "#1e252d",
    borderRadius: "8px",
    border: "1px solid #30363d",
    padding: "16px",
    overflowX: "auto",
  },
  geoCardTitle: {
    margin: "0 0 12px",
    fontSize: "13px",
    fontWeight: 600,
    color: "#e6edf3",
  },
  geoLeaderEmpty: {
    margin: 0,
    fontSize: "12px",
    color: "#6e7681",
  },
  geoLeaderTable: {
    width: "100%",
    minWidth: "280px",
    borderCollapse: "collapse",
    fontSize: "12px",
  },
  geoLeaderTh: {
    textAlign: "left",
    padding: "6px 10px 6px 0",
    fontWeight: 600,
    color: "#8b949e",
    borderBottom: "1px solid #30363d",
  },
  geoLeaderTd: {
    padding: "6px 10px 6px 0",
    color: "#e6edf3",
    borderBottom: "1px solid #21262d",
  },
  geoLeaderTdMuted: {
    color: "#6e7681",
  },
  geoCities: {
    backgroundColor: "#1e252d",
    borderRadius: "8px",
    border: "1px solid #30363d",
    padding: "16px",
  },
  geoCityRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: "8px",
    padding: "6px 0",
    borderBottom: "1px solid #21262d",
    fontSize: "12px",
  },
  geoCityName: {
    fontWeight: 600,
    color: "#e6edf3",
  },
  geoCityProv: {
    color: "#8b949e",
    fontSize: "11px",
  },
  geoCityMeta: {
    color: "#6e7681",
    marginLeft: "auto",
  },
  signalsEmpty: {
    margin: 0,
    fontSize: "13px",
    color: "#6e7681",
  },
  signalsTableWrap: {
    overflowX: "auto",
  },
  signalsTable: {
    width: "100%",
    minWidth: "320px",
    borderCollapse: "collapse",
    fontSize: "12px",
  },
  signalsTh: {
    textAlign: "left",
    padding: "8px 14px 8px 0",
    fontWeight: 600,
    color: "#6e7681",
    borderBottom: "1px solid #30363d",
  },
  signalsTd: {
    padding: "8px 14px 8px 0",
    color: "#8b949e",
    borderBottom: "1px solid #21262d",
  },
  signalsTdMuted: {
    color: "#6e7681",
  },
  signalsToggle: {
    marginTop: "8px",
    padding: "4px 0",
    border: "none",
    background: "none",
    color: "#6e7681",
    fontSize: "12px",
    cursor: "pointer",
  },
  analystBlocksSection: {
    opacity: 0.9,
  },
  analystBlocksHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    width: "100%",
    padding: 0,
    margin: "0 0 4px",
    border: "none",
    background: "none",
    cursor: "pointer",
    textAlign: "left",
  },
  analystBlocksChevron: {
    fontSize: "10px",
    color: "#6e7681",
  },
  analystBlocksTitle: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 600,
    color: "#e6edf3",
  },
  analystBlocksSubtitle: {
    margin: "4px 0 20px",
    fontSize: "13px",
    color: "#8b949e",
    lineHeight: 1.4,
  },
  analystBlocksGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: "16px",
  },
  analystBlockCard: {
    backgroundColor: "#1e252d",
    borderRadius: "8px",
    border: "1px solid #30363d",
    padding: "14px 16px",
  },
  analystBlockHeader: {
    marginBottom: "6px",
  },
  analystBlockTitle: {
    margin: 0,
    fontSize: "14px",
    fontWeight: 600,
    color: "#e6edf3",
  },
  analystBlockExplanation: {
    margin: "0 0 8px",
    fontSize: "12px",
    color: "#8b949e",
    lineHeight: 1.4,
  },
  analystBlockBestFor: {
    margin: "0 0 12px",
    fontSize: "11px",
    color: "#6e7681",
    lineHeight: 1.4,
  },
  analystBlockBestForLabel: {
    fontStyle: "italic",
  },
  analystBlockActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  briefAdmin: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginBottom: "16px",
    paddingBottom: "12px",
    borderBottom: "1px solid #21262d",
  },
  briefAdminRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  briefAdminPreview: {
    marginTop: 4,
    padding: "10px 12px",
    backgroundColor: "#161b22",
    border: "1px solid #30363d",
    borderRadius: "6px",
    fontSize: "12px",
  },
  briefAdminPreviewLabel: {
    color: "#8b949e",
    marginBottom: "6px",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  briefAdminPreviewHeadline: {
    color: "#e6edf3",
    fontWeight: 600,
    marginBottom: "6px",
  },
  briefAdminPreviewSummary: {
    margin: 0,
    color: "#8b949e",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontSize: "11px",
    lineHeight: 1.4,
    fontFamily: "inherit",
  },
  briefAdminBtn: {
    padding: "6px 12px",
    fontSize: "12px",
    color: "#e6edf3",
    backgroundColor: "#21262d",
    border: "1px solid #30363d",
    borderRadius: "6px",
    cursor: "pointer",
  },
  briefAdminSuccess: {
    fontSize: "12px",
    color: "#7ee787",
  },
  briefAdminError: {
    fontSize: "12px",
    color: "#f85149",
  },
  briefAdminLink: {
    color: "#58a6ff",
    textDecoration: "none",
  },
  briefAdminBtnDisabled: {
    padding: "6px 10px",
    fontSize: "11px",
    color: "#6e7681",
    backgroundColor: "#21262d",
    border: "1px solid #30363d",
    borderRadius: "6px",
    cursor: "not-allowed",
  },
  marketingSignalOutput: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "8px",
  },
  marketingDetails: {
    border: "1px solid #30363d",
    borderRadius: "6px",
    backgroundColor: "#161b22",
    overflow: "hidden",
  },
  marketingSummary: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    padding: "8px 12px",
    cursor: "pointer",
    listStyle: "none",
    fontSize: "12px",
    color: "#c9d1d9",
  },
  graphicCardRow: {
    marginTop: "12px",
    marginBottom: "8px",
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  graphicCardsWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "20px",
    marginBottom: "16px",
  },
  graphicCardLabel: {
    marginBottom: "6px",
    fontSize: "11px",
    fontWeight: 600,
    color: "#8b949e",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  graphicCard: {
    width: "100%",
    maxWidth: "360px",
    aspectRatio: "1",
    padding: "20px 24px",
    backgroundColor: "#0d1117",
    border: "1px solid #21262d",
    borderRadius: "12px",
    fontFamily: "inherit",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
  },
  graphicCardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "12px",
  },
  graphicCardLogo: {
    width: "32px",
    height: "32px",
    objectFit: "contain",
    flexShrink: 0,
  },
  graphicCardTitle: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 700,
    color: "#f0f6fc",
    letterSpacing: "-0.02em",
    lineHeight: 1.25,
  },
  graphicCardScopeLabel: {
    margin: "2px 0 6px",
    fontSize: "12px",
    color: "#8b949e",
    lineHeight: 1.3,
  },
  graphicCardSubline: {
    margin: "0 0 20px",
    fontSize: "14px",
    color: "#9ca3af",
    lineHeight: 1.35,
  },
  graphicCardMetric: {
    marginBottom: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  graphicCardMetricLabel: {
    fontSize: "10px",
    color: "#6e7681",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 600,
  },
  graphicCardMetricValue: {
    fontSize: "26px",
    fontWeight: 700,
    color: "#f0f6fc",
    letterSpacing: "-0.02em",
  },
  graphicCardSection: {
    marginBottom: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  graphicCardSectionLabel: {
    fontSize: "10px",
    color: "#6e7681",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 600,
  },
  graphicCardSectionValue: {
    fontSize: "14px",
    color: "#c9d1d9",
    lineHeight: 1.4,
  },
  graphicCardUrlBlocks: {
    paddingTop: "16px",
    borderTop: "1px solid #21262d",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    flex: "1 1 auto",
    minHeight: 0,
  },
  graphicCardUrlBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  graphicCardUrlLabel: {
    fontSize: "11px",
    color: "#6e7681",
    lineHeight: 1.3,
  },
  graphicCardUrlValue: {
    fontSize: "11px",
    color: "#8b949e",
    lineHeight: 1.3,
  },
  graphicCardFooter: {
    paddingTop: "10px",
    marginTop: "auto",
    borderTop: "1px solid #21262d",
    fontSize: "12px",
    color: "#8b949e",
    lineHeight: 1.5,
    fontStyle: "italic",
  },
  narrativeDominantSection: {
    marginBottom: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  narrativeDominantLabel: {
    fontSize: "10px",
    color: "#6e7681",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 600,
  },
  narrativeDominantValue: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#e6edf3",
    lineHeight: 1.4,
  },
  narrativeBarSection: {
    marginBottom: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  narrativeGraphNote: {
    marginBottom: "14px",
    fontSize: "10px",
    color: "#6e7681",
    lineHeight: 1.4,
    fontStyle: "italic",
  },
  narrativeBarSectionLabel: {
    fontSize: "10px",
    color: "#6e7681",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 600,
    marginBottom: "2px",
  },
  narrativeBarRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minHeight: "28px",
  },
  narrativeBarLabel: {
    flex: "0 0 130px",
    fontSize: "12px",
    color: "#c9d1d9",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  narrativeBarTrack: {
    flex: "1 1 auto",
    minWidth: 0,
    height: "16px",
    backgroundColor: "#21262d",
    borderRadius: "6px",
    overflow: "hidden",
  },
  narrativeBarFill: {
    height: "100%",
    backgroundColor: "#58a6ff",
    borderRadius: "6px",
    minWidth: "2px",
  },
  graphicCaptionsWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "16px",
    marginTop: "8px",
  },
  graphicCaptionBlock: {
    flex: "1 1 300px",
    maxWidth: "480px",
    padding: "12px 16px",
    backgroundColor: "#161b22",
    border: "1px solid #30363d",
    borderRadius: "8px",
  },
  graphicCaptionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    marginBottom: "8px",
    flexWrap: "wrap",
  },
  graphicCaptionLabel: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#8b949e",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  graphicCaptionPre: {
    margin: "0 0 8px",
    fontSize: "12px",
    color: "#c9d1d9",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    lineHeight: 1.5,
    fontFamily: "inherit",
  },
  graphicCaptionLinks: {
    fontSize: "12px",
  },
  graphicCleanViewOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 2000,
    backgroundColor: "rgba(0,0,0,0.85)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
  },
  graphicCleanViewContent: {
    position: "relative",
    maxWidth: "800px",
    width: "100%",
    maxHeight: "90vh",
    overflow: "auto",
  },
  graphicCleanViewClose: {
    position: "absolute",
    top: "12px",
    right: "12px",
    zIndex: 1,
    padding: "8px 14px",
    fontSize: "12px",
    color: "#c9d1d9",
    backgroundColor: "#21262d",
    border: "1px solid #30363d",
    borderRadius: "6px",
    cursor: "pointer",
  },
  graphicCleanViewCards: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "24px",
    padding: "40px 24px 24px",
  },
  graphicCleanViewCardWrap: {
    maxWidth: "420px",
    width: "100%",
  },
  analystBlockBtn: {
    padding: "6px 10px",
    fontSize: "11px",
    color: "#8b949e",
    backgroundColor: "transparent",
    border: "1px solid #30363d",
    borderRadius: "4px",
    cursor: "pointer",
  },
  analystBlocksEmpty: {
    margin: 0,
    fontSize: "13px",
    color: "#6e7681",
  },
  analystBlocksToast: {
    position: "fixed",
    bottom: "24px",
    left: "50%",
    transform: "translateX(-50%)",
    padding: "8px 16px",
    fontSize: "12px",
    color: "#e6edf3",
    backgroundColor: "#21262d",
    border: "1px solid #30363d",
    borderRadius: "6px",
    zIndex: 1000,
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
  metricWoW: {
    fontSize: "12px",
    fontWeight: 500,
    marginLeft: "6px",
  },
  metricHelper: {
    fontSize: "11px",
    color: "#6e7681",
    lineHeight: 1.3,
    marginTop: "2px",
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
