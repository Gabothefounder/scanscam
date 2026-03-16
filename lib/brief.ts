/**
 * Shared weekly brief derivation from radar payload.
 * Used by GET /api/brief/weekly (live or fallback) and POST /api/internal/brief/generate-weekly.
 * Server-only; preserves public-safe data exposure.
 */

import { formatLandscapeLabel } from "@/app/components/charts/utils";

export type RiskCounts = {
  low: number;
  medium: number;
  high: number;
  total: number;
};

export type BriefWeeklyResponse = {
  week_start: string;
  generated_at: string;
  scan_count: number;
  top_narrative: string;
  /** Raw narrative key (e.g. prize_scam) for chart highlighting. */
  top_narrative_raw?: string;
  top_channel: string;
  top_authority: string | null;
  top_payment_method: string | null;
  fraud_label: string;
  how_it_works: string;
  protection_tip: string;
  /** French copy for how_it_works when locale is fr. */
  how_it_works_fr?: string;
  /** French copy for protection_tip when locale is fr. */
  protection_tip_fr?: string;
  narratives: { value: string; scan_count: number; share_of_week: number }[];
  channels: { value: string; scan_count: number; share_of_week: number }[];
  /** Short factual headline for social / sharing. */
  social_headline: string;
  /** 2–4 line summary, awareness tone, with CTA idea. No URLs. */
  social_summary: string;
  /** Risk Index 0–100 from low(1)/medium(2)/high(3) weighted distribution. */
  risk_index: number;
  /** Previous week's risk_index; null if no prior week or prior total = 0. */
  previous_risk_index: number | null;
  /** Week-over-week change in risk_index; null if no prior week. */
  risk_index_delta: number | null;
  /** "up" | "down" | "flat"; null if no prior week. */
  risk_index_trend: "up" | "down" | "flat" | null;
  risk_counts: RiskCounts;
  /** True when the selected dominant narrative had fewer than 3 signals (use softer explanatory copy). */
  signals_limited?: boolean;
};

/** Narrative item; optional risk counts enable risk-weighted selection. */
export type NarrativeForBrief = {
  value: string;
  scan_count: number;
  share_of_week: number;
  low_count?: number;
  medium_count?: number;
  high_count?: number;
};

/** Current week aggregate risk tier counts (for Risk Index). */
export type WeekRiskCounts = { low: number; medium: number; high: number };

export type RadarPayloadForBrief = {
  week_start?: string;
  generated_at?: string;
  system_health?: { scan_count?: number };
  fraud_landscape?: {
    narratives?: NarrativeForBrief[];
    channels?: { value: string; scan_count: number; share_of_week: number }[];
    authority_types?: { value: string; scan_count: number; share_of_week: number }[];
    payment_methods?: { value: string; scan_count: number; share_of_week: number }[];
  };
  /** Current week low/medium/high counts for Risk Index. */
  week_risk_counts?: WeekRiskCounts;
  /** Previous week low/medium/high counts for WoW trend; optional. */
  previous_week_risk_counts?: WeekRiskCounts;
};

/**
 * How the fraud works: short, social-engineering–oriented copy per dominant narrative.
 * Structure: who they pretend to be → what action they want → what tactic (urgency, authority, fear, reward).
 * Used only when a single dominant narrative is selected; otherwise FALLBACK_HOW_IT_WORKS is used.
 */
const HOW_IT_WORKS: Record<string, string> = {
  delivery_scam:
    "The scammer pretends to be a courier, postal service, or retailer. They want you to pay a \"redelivery\" fee, confirm your address, or click a link to \"reschedule.\" They use urgency (package held, deadline) and fake authority (official-looking branding) so you act before checking.",
  government_impersonation:
    "The scammer pretends to be a government agency—tax, immigration, or benefits. They demand you pay a \"debt\" or \"fee\" or share personal details to \"resolve\" an issue. They use authority and fear (fines, arrest, account suspension) and often insist on payment by gift cards, crypto, or wire.",
  financial_phishing:
    "The scammer pretends to be your bank or a financial service. They want you to confirm your identity, update your account, or click a link to \"fix\" an urgent problem. They use urgency and fear (account locked, suspicious activity) so you log in on a fake page and hand over your credentials.",
  p2p_app:
    "The scammer pretends to be a buyer, seller, or the payment app itself. They want you to send money, pay a \"verification\" fee, or complete a \"prize\" claim outside the app. They use reward (great deal, payout) and urgency (offer expires) to get you to act before you verify.",
  financial_institution:
    "The scammer pretends to be a known bank or financial institution. They want you to log in, verify your details, or move money to \"secure\" your account. They use urgency and authority (fraud alert, policy update) so you use their link instead of the real app or website.",
  tech_company:
    "The scammer pretends to be tech support or a security team for a well-known company. They want you to call a number, click a link, or install software so they can \"fix\" your device or account. They use fear (virus, breach) and fake authority to get remote access or your credentials.",
  prize_scam:
    "The scammer offers a prize, refund, or reward and asks you to pay a fee, share details, or click a link to claim it. They use reward and urgency so you act before checking. Legitimate giveaways do not require upfront payment or sensitive information.",
};

/** French: how the fraud works (same keys as HOW_IT_WORKS). */
const HOW_IT_WORKS_FR: Record<string, string> = {
  prize_scam:
    "Dans ce type de fraude, l'arnaqueur annonce un prix, un remboursement ou une récompense et demande ensuite de payer des frais, de fournir des informations ou de cliquer sur un lien pour le réclamer. Les fraudeurs utilisent l'urgence et l'attrait d'un gain pour pousser à agir rapidement. Les organisations légitimes n'exigent généralement aucun paiement ni information sensible pour recevoir un prix.",
};

/** French: protection advice (same keys as PROTECTION_TIP). */
const PROTECTION_TIP_FR: Record<string, string> = {
  prize_scam:
    "Les vrais concours ou remboursements ne demandent jamais de paiement ni d'informations personnelles pour réclamer un prix. Si vous n'avez participé à aucun concours ou demandé de remboursement, considérez ce message comme suspect.",
};

const PROTECTION_TIP: Record<string, string> = {
  delivery_scam:
    "Verify any delivery or refund message by logging into the carrier or retailer's official website yourself—never use links in the message.",
  government_impersonation:
    "Government and tax agencies do not demand payment by gift cards or cryptocurrency. Contact the agency through their official website or phone number from a trusted source.",
  financial_phishing:
    "Never log in to your bank or financial accounts from a link in an email or message. Open your app or type the official URL yourself.",
  p2p_app:
    "Use only in-app messaging and official verification. Be wary of anyone asking for payment or verification outside the app.",
  financial_institution:
    "Treat unexpected messages about your account as suspicious. Log in only via the official app or website you already use.",
  tech_company:
    "Legitimate tech companies do not ask you to install remote-access software or pay via gift cards. Hang up and contact support through the company's official site.",
  prize_scam:
    "Legitimate prizes and refunds do not require upfront payment or personal details to claim. If you did not enter a contest or request a refund, treat the message as a scam.",
};

/** Used when no single dominant narrative (e.g. Mixed fraud signals) or narrative key is unknown. */
const FALLBACK_HOW_IT_WORKS =
  "Scammers impersonate trusted entities and push for an action—payment, a click, or sharing details—using urgency, fear, or the appearance of authority. Without one dominant pattern this week, stay cautious with any unsolicited message and verify through official channels.";
const FALLBACK_PROTECTION_TIP =
  "Stay cautious with unsolicited messages and verify identities or requests through official websites or apps, not links in messages.";

/** French fallbacks when no single dominant narrative or narrative key has no French copy. */
const FALLBACK_HOW_IT_WORKS_FR =
  "Les fraudeurs se font passer pour des entités de confiance et poussent à une action—paiement, clic ou partage d'informations—en utilisant l'urgence, la peur ou l'apparence d'autorité. En l'absence d'un schéma dominant cette semaine, restez prudent avec tout message non sollicité et vérifiez par les canaux officiels.";
const FALLBACK_PROTECTION_TIP_FR =
  "Restez prudent avec les messages non sollicités et vérifiez les identités ou les demandes via les sites ou applications officiels, et non via les liens contenus dans les messages.";

function getTopDisplay(
  arr: { value: string }[] | undefined,
  formatter: (v: string) => string
): string {
  const first = Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
  if (!first || String(first.value ?? "").toLowerCase() === "unknown") return "—";
  return formatter(first.value);
}

function getTopDisplayOrNull(
  arr: { value: string }[] | undefined,
  formatter: (v: string) => string
): string | null {
  const first = Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
  if (!first || String(first.value ?? "").toLowerCase() === "unknown") return null;
  return formatter(first.value);
}

const MIXED_FRAUD_LABEL = "Mixed fraud signals";

/** French display labels for fraud types; used when locale is fr. Keys match API fraud_label values. */
export const FRAUD_LABEL_FR: Record<string, string> = {
  "Prize Scam": "Arnaque au faux gain",
  "Government Impersonation": "Usurpation d'identité gouvernementale",
  "Delivery Scam": "Fraude de livraison",
  "Investment Fraud": "Fraude d'investissement",
  "Mixed fraud signals": "Signaux de fraude mixtes",
};

/**
 * Risk Index formula (deterministic):
 * risk_index = ((low×1 + medium×2 + high×3) / (total×3)) × 100, rounded to nearest integer.
 * If total_count = 0, risk_index = 0.
 */
function computeRiskIndex(low: number, medium: number, high: number): {
  risk_index: number;
  risk_counts: RiskCounts;
} {
  const total = low + medium + high;
  const risk_counts: RiskCounts = { low, medium, high, total };
  if (total === 0) {
    return { risk_index: 0, risk_counts };
  }
  const weightedSum = low * 1 + medium * 2 + high * 3;
  const risk_index = Math.round((weightedSum / (total * 3)) * 100);
  return { risk_index, risk_counts };
}

function computeRiskIndexTrend(
  currentIndex: number,
  previousIndex: number | null
): { risk_index_delta: number | null; risk_index_trend: "up" | "down" | "flat" | null } {
  if (previousIndex === null) {
    return { risk_index_delta: null, risk_index_trend: null };
  }
  const risk_index_delta = currentIndex - previousIndex;
  const risk_index_trend: "up" | "down" | "flat" = risk_index_delta > 0 ? "up" : risk_index_delta < 0 ? "down" : "flat";
  return { risk_index_delta, risk_index_trend };
}

/**
 * Select the dominant narrative using risk-weighted scoring.
 * score = (low × 1) + (medium × 2) + (high × 3).
 * Always selects the top-scoring non-unknown narrative when any exist; no minimum signal threshold.
 * Tie-break: highest high_count, then highest total.
 * Returns null only when there is no usable narrative data (use MIXED_FRAUD_LABEL).
 */
function selectDominantNarrative(
  narratives: NarrativeForBrief[]
): { value: string; total: number; score: number; highCount: number } | null {
  type Candidate = { value: string; total: number; score: number; highCount: number };
  const candidates: Candidate[] = [];

  for (const n of narratives) {
    const value = String(n.value ?? "").trim();
    if (value.toLowerCase() === "unknown") continue;

    const low = Number(n.low_count ?? 0);
    const medium = Number(n.medium_count ?? 0);
    const high = Number(n.high_count ?? 0);
    const hasRiskBreakdown = (n.low_count != null) || (n.medium_count != null) || (n.high_count != null);

    const total = hasRiskBreakdown ? low + medium + high : Number(n.scan_count ?? 0);
    const score = hasRiskBreakdown ? low * 1 + medium * 2 + high * 3 : total;
    const highCount = hasRiskBreakdown ? high : 0;

    candidates.push({ value, total, score, highCount });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.highCount !== a.highCount) return b.highCount - a.highCount;
    return b.total - a.total;
  });

  return candidates[0];
}

/**
 * Derive the public-safe weekly brief payload from a radar-weekly response.
 */
export function deriveBriefPayload(data: RadarPayloadForBrief): BriefWeeklyResponse {
  const narratives = Array.isArray(data.fraud_landscape?.narratives)
    ? data.fraud_landscape.narratives
    : [];
  const channels = Array.isArray(data.fraud_landscape?.channels)
    ? data.fraud_landscape.channels
    : [];
  const authorityTypes = Array.isArray(data.fraud_landscape?.authority_types)
    ? data.fraud_landscape.authority_types
    : [];
  const paymentMethods = Array.isArray(data.fraud_landscape?.payment_methods)
    ? data.fraud_landscape.payment_methods
    : [];

  const scanCount = data.system_health?.scan_count ?? 0;
  const dominant = selectDominantNarrative(narratives);

  const topNarrativeRaw = dominant ? dominant.value : "";
  const topNarrative =
    topNarrativeRaw && formatLandscapeLabel(topNarrativeRaw) !== "—"
      ? formatLandscapeLabel(topNarrativeRaw)
      : getTopDisplay(narratives, formatLandscapeLabel);
  const topChannel = getTopDisplay(channels, formatLandscapeLabel);
  const topAuthority = getTopDisplayOrNull(authorityTypes, formatLandscapeLabel);
  const topPaymentMethod = getTopDisplayOrNull(paymentMethods, formatLandscapeLabel);

  const fraudLabel = dominant
    ? topChannel !== "—"
      ? `${formatLandscapeLabel(dominant.value)} via ${topChannel}`
      : formatLandscapeLabel(dominant.value)
    : MIXED_FRAUD_LABEL;

  const howItWorks =
    topNarrativeRaw && HOW_IT_WORKS[topNarrativeRaw] ? HOW_IT_WORKS[topNarrativeRaw] : FALLBACK_HOW_IT_WORKS;
  const protectionTip =
    topNarrativeRaw && PROTECTION_TIP[topNarrativeRaw] ? PROTECTION_TIP[topNarrativeRaw] : FALLBACK_PROTECTION_TIP;
  const howItWorksFr =
    topNarrativeRaw && HOW_IT_WORKS_FR[topNarrativeRaw]
      ? HOW_IT_WORKS_FR[topNarrativeRaw]
      : FALLBACK_HOW_IT_WORKS_FR;
  const protectionTipFr =
    topNarrativeRaw && PROTECTION_TIP_FR[topNarrativeRaw]
      ? PROTECTION_TIP_FR[topNarrativeRaw]
      : FALLBACK_PROTECTION_TIP_FR;

  const { social_headline, social_summary } = deriveSocialCopy({
    fraud_label: fraudLabel,
    top_narrative: topNarrative,
    top_channel: topChannel,
    scan_count: scanCount,
    how_it_works: howItWorks,
    protection_tip: protectionTip,
  });

  const narrativesPublic = narratives.map((n) => ({
    value: n.value,
    scan_count: n.scan_count,
    share_of_week: n.share_of_week,
  }));

  const w = data.week_risk_counts;
  const low = w ? Number(w.low) : 0;
  const medium = w ? Number(w.medium) : 0;
  const high = w ? Number(w.high) : 0;
  const { risk_index, risk_counts } = computeRiskIndex(low, medium, high);

  let previous_risk_index: number | null = null;
  let risk_index_delta: number | null = null;
  let risk_index_trend: "up" | "down" | "flat" | null = null;
  if (risk_counts.total > 0 && data.previous_week_risk_counts) {
    const prev = data.previous_week_risk_counts;
    const prevLow = Number(prev.low);
    const prevMedium = Number(prev.medium);
    const prevHigh = Number(prev.high);
    const prevTotal = prevLow + prevMedium + prevHigh;
    previous_risk_index = prevTotal === 0 ? 0 : Math.round(((prevLow * 1 + prevMedium * 2 + prevHigh * 3) / (prevTotal * 3)) * 100);
    const trendResult = computeRiskIndexTrend(risk_index, previous_risk_index);
    risk_index_delta = trendResult.risk_index_delta;
    risk_index_trend = trendResult.risk_index_trend;
  }

  const signals_limited = dominant != null && dominant.total < 3;

  return {
    week_start: data.week_start ?? "",
    generated_at: data.generated_at ?? new Date().toISOString(),
    scan_count: scanCount,
    top_narrative: topNarrative,
    top_narrative_raw: topNarrativeRaw || undefined,
    top_channel: topChannel,
    top_authority: topAuthority,
    top_payment_method: topPaymentMethod,
    fraud_label: fraudLabel,
    how_it_works: howItWorks,
    protection_tip: protectionTip,
    how_it_works_fr: howItWorksFr,
    protection_tip_fr: protectionTipFr,
    narratives: narrativesPublic,
    channels,
    social_headline,
    social_summary,
    risk_index,
    previous_risk_index,
    risk_index_delta,
    risk_index_trend,
    risk_counts,
    signals_limited: dominant != null ? signals_limited : undefined,
  };
}

/** Deterministic social-ready headline and summary from brief fields. Public-awareness tone; CTA idea without URLs. */
function deriveSocialCopy(params: {
  fraud_label: string;
  top_narrative: string;
  top_channel: string;
  scan_count: number;
  how_it_works: string;
  protection_tip: string;
}): { social_headline: string; social_summary: string } {
  const { fraud_label, top_narrative, top_channel, scan_count, how_it_works, protection_tip } = params;
  const hasPattern = fraud_label && fraud_label !== "No dominant pattern identified";

  const social_headline = hasPattern
    ? `ScanScam Weekly: ${fraud_label} led reported scans`
    : scan_count > 0
      ? "ScanScam Weekly Brief: scan trends this week"
      : "ScanScam Weekly Brief";

  const firstLine = hasPattern
    ? `This week, ${fraud_label} was the most common pattern in messages people scanned.`
    : scan_count > 0
      ? "Here’s what ScanScam users were scanning this week."
      : "Weekly fraud awareness from ScanScam.";
  const secondLine = how_it_works.trim().slice(0, 180);
  const secondLineTrimmed = secondLine.length < how_it_works.trim().length ? `${secondLine}…` : secondLine;
  const thirdLine = protection_tip.trim().slice(0, 160);
  const thirdLineTrimmed = thirdLine.length < protection_tip.trim().length ? `${thirdLine}…` : thirdLine;
  const ctaLine = "Scan suspicious messages with ScanScam before you click or reply.";
  const social_summary = [firstLine, secondLineTrimmed, thirdLineTrimmed, ctaLine].filter(Boolean).join("\n\n");

  return { social_headline, social_summary };
}
