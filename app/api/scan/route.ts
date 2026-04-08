export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

import { ocrImage } from "@/lib/ocr";
import { analyzeScan } from "@/lib/ai/analyzeScan";
import { buildScanEnrichment } from "@/lib/scan-analysis";
import { harmonizeNarratives } from "@/lib/scan-analysis/harmonizeNarratives";
import { mapIntelFields } from "@/lib/scan-analysis/mapIntelFields";
import { extractLinkArtifacts, type LinkArtifact } from "@/lib/scan-analysis/extractLinkArtifacts";
import { checkRateLimit } from "@/lib/rateLimit";
import { isRepeatedScan } from "@/lib/repeatGuard";
import { isOCRBlocked, recordOCRResult } from "@/lib/ocrGuard";
import { logEvent } from "@/lib/observability";

/* -------------------------------------------------
   Supabase client — SERVER ONLY
-------------------------------------------------- */

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

/* -------------------------------------------------
   Intel features extraction (additive + none vs unknown)
-------------------------------------------------- */

const CORE_INTEL_KEYS = [
  "narrative_category",
  "channel_type",
  "authority_type",
  "payment_method",
  "escalation_pattern",
] as const;

/** Shared phone pattern for channel, callback_number_present, micro_signals.has_phone_number */
const PHONE_CALLBACK_PATTERN = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/;

function countKnownCoreDimensions(intel: Record<string, unknown>): number {
  let n = 0;
  for (const k of CORE_INTEL_KEYS) {
    const v = intel[k];
    if (v === undefined || v === null) continue;
    if (v === "unknown") continue;
    if (typeof v === "string" && v.length > 0) n++;
  }
  return n;
}

function assessContextQuality(
  raw: string,
  iq: { url_only: boolean; very_short: boolean }
): "full" | "partial" | "thin" | "fragment" | "unknown" {
  const trimmed = raw.trim();
  const len = trimmed.length;
  const lines = trimmed.split(/\n/).filter((l) => l.trim().length > 0).length;
  const urlish =
    iq.url_only ||
    /^(https?:\/\/\S+|www\.\S+)/i.test(trimmed) ||
    (trimmed.length > 0 && (trimmed.match(/https?:\/\/|www\./gi) || []).join("").length / trimmed.length > 0.5);

  if (urlish && len < 80) return "fragment";
  if (iq.url_only || (len < 60 && lines <= 1)) return "fragment";
  if (len < 100 || iq.very_short) return "thin";
  if (/^from:\s|^to:\s|^subject:\s/im.test(raw) || lines >= 4 || len > 400) return len > 800 ? "full" : "partial";
  if (lines >= 2 && len >= 150) return "partial";
  return "partial";
}

const NARRATIVE_SIGNALS: { id: string; test: RegExp }[] = [
  { id: "prize_scam", test: /lottery|winner|prize|won|congratulations.*won/ },
  {
    id: "government_impersonation",
    test:
      /\b(cra|arc|irs)\b|tax\s+(return|refund|debt)|revenue\s+canada|arrest|warrant|justice|court\s+order|government\s+fine|parking\s+(violation|ticket|fine|notice)|unpaid\s+parking|plate\s+denial|permit\s+renewal\s+blocked|\bmto\b|\bdmv\b|service\s+ontario|\bserviceontario\b|\bcontraventions?\b|\bstationnement\b|billets?\s+impay(?:é|e)s?|\bamendes?\b|pénalités?|penalites?|refus\s+de\s+(?:la\s+)?plaque|renouvellement\s+du\s+permis|avis\s+officiel/u,
  },
  { id: "financial_phishing", test: /bank|account.*suspend|verify.*account|unusual\s+activity.*account/ },
  { id: "tech_support", test: /tech support|virus|computer.*infected|malware/ },
  { id: "romance_scam", test: /romance|love|dating|met\s+you\s+online/ },
  { id: "investment_fraud", test: /investment|crypto|bitcoin|guaranteed.*return|forex/ },
  { id: "employment_scam", test: /job|work.*from.*home|easy\s+money|interview.*position/ },
  { id: "delivery_scam", test: /package|delivery|courier|usps|fedex|ups|tracking.*number/ },
];

function isInsufficientContextQuality(contextQ: string): boolean {
  return contextQ === "fragment" || contextQ === "thin" || contextQ === "unknown";
}

function detectNarrativeCategory(text: string, contextQ: string): string {
  if (isInsufficientContextQuality(contextQ)) return "unknown";
  const hits = NARRATIVE_SIGNALS.filter(({ test }) => test.test(text)).map((h) => h.id);
  const unique = [...new Set(hits)];
  if (unique.length === 0) return "none";
  if (unique.length === 1) return unique[0];
  return "unknown";
}

const AUTHORITY_SIGNALS: { id: string; test: RegExp }[] = [
  {
    id: "government",
    test:
      /\b(cra|arc|irs|tax\s+agency|revenue\s+canada|government|police|fbi|justice|court|fine|warrant)\b|\bcontraventions?\b|\bstationnement\b|billets?\s+impay(?:é|e)s?|\bamendes?\b|pénalités?|penalites?|refus\s+de\s+(?:la\s+)?plaque|renouvellement\s+du\s+permis|avis\s+officiel|\bserviceontario\b|service\s+ontario|\bmto\b/u,
  },
  {
    id: "financial_institution",
    test: /bank|credit\s+union|account\s+support|banking|visa|mastercard|paypal|financial\s+institution/,
  },
  {
    id: "corporate",
    test:
      /package|delivery|courier|usps|fedex|ups|postal|ceo|manager|hr|boss|compliance|recovery|account\s+verification|verify\s+your\s+identity/,
  },
  { id: "tech_company", test: /microsoft|apple|google|amazon|netflix|meta|facebook/ },
];

function detectAuthorityType(text: string, contextQ: string): string {
  if (isInsufficientContextQuality(contextQ)) return "unknown";
  const ids = AUTHORITY_SIGNALS.filter(({ test }) => test.test(text)).map((a) => a.id);
  const unique = [...new Set(ids)];
  if (unique.length === 0) return "none";
  if (unique.length === 1) return unique[0];
  return "unknown";
}

function detectBrandMentions(text: string): string[] {
  const brands = [
    "amazon", "paypal", "apple", "microsoft", "google", "netflix", "facebook", "meta", "instagram", "whatsapp",
    "bank of america", "chase", "wells fargo", "usps", "fedex", "ups",
  ];
  return brands.filter((b) => text.includes(b));
}

function detectChannelType(
  text: string,
  raw: string,
  iq: { url_only: boolean; message_like: boolean },
  microSignals: Record<string, boolean>
): string {
  const trimmed = raw.trim();
  const lineCount = raw.split(/\n/).filter((l) => l.trim().length > 0).length;
  const urlCharRatio =
    trimmed.length > 0
      ? ((trimmed.match(/https?:\/\/|www\./gi) || []).join("").length / trimmed.length)
      : 0;

  if (iq.url_only || /^(https?:\/\/\S+|www\.\S+)$/i.test(trimmed)) return "web";
  // Near-URL-only: only force web when not clearly communication-like.
  if (urlCharRatio > 0.42 && !isCommunicationLike(text, microSignals)) return "web";
  if (/\/(t\.co|bit\.ly|goo\.gl)\b/i.test(raw) && urlCharRatio > 0.15 && !isCommunicationLike(text, microSignals))
    return "web";

  if (
    /^from:\s|^to:\s|^subject:\s|^sent:\s|^date:\s|^reply-to:\s/mi.test(raw) ||
    /^from:\s*\S+@/im.test(raw)
  )
    return "email";
  if (lineCount >= 2 && /^from:\s*\S+/im.test(raw) && /@/.test(raw)) return "email";

  if (
    /\b(reply|text)\s+stop\b|msg\s*&\s*data|data\s+(?:rates|charges|may\s+apply)|\btext\s+message\b|^sms[\s:]|^txt[\s:]/i.test(raw) ||
    /\btext\s+stop\s+to\s+(?:opt\s*out|unsubscribe)\b/i.test(text) ||
    /\b\d{4,6}\b[^\n]{0,60}\b(stop|help|unsubscribe|end)\b/i.test(text) ||
    /\bshort\s*code\b|\bmsg\s*&\s*data/i.test(text)
  )
    return "sms";

  if (
    /\b(kijiji|craigslist)\b|facebook\s+marketplace|\bmarketplace\s+(listing|post|item|sale)|\bclassifieds?\s+(ad|listing)/i.test(
      text
    ) ||
    (/\b(buyer|seller)\b/.test(text) && /\b(listing|item|ship|pickup|price)\b/.test(text))
  )
    return "marketplace";

  if (
    /whatsapp|wa\.me|telegram\.|(?<![\w.])\btelegram\b|signal\b|imessage|i-message|\bmessenger\b(?!\s+marketplace)|facebook\s+messenger|viber\b|wechat|line\s+app/i.test(
      text
    ) ||
    /\b(chat|message)\s+me\s+(on|via)\s+(whatsapp|telegram|signal)/i.test(text)
  )
    return "messaging_app";

  if (
    /snapchat|instagram|\binsta\b|tiktok|twitter|tweet\b|x\.com\/|linkedin|reddit|\bdm\s+me\b|direct\s+message|slide\s+into\s+(my\s+)?dms/i.test(
      text
    ) ||
    /\b(?:my|view|see|check\s+out)\s+(?:my\s+)?story\b/i.test(text) ||
    (/\bfacebook\b|\bmeta\b/.test(text) && !/marketplace/i.test(text))
  )
    return "social";

  if (/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i.test(raw) && raw.includes("@")) return "email";

  if (
    (/voicemail|missed\s+call|incoming\s+call|call\s+(us|now|today|back|here)|ring\s+us|dial\s+this|reach\s+us\s+at/i.test(text) &&
      PHONE_CALLBACK_PATTERN.test(raw)) ||
    (PHONE_CALLBACK_PATTERN.test(raw) && /\b(call|phone|dial)\b/i.test(text))
  )
    return "phone";

  if (/\bsms\b|\btext\s+to\s+\d/i.test(text)) return "sms";

  if (
    /\bforwarded\s+message\b|you\s+have\s+(a\s+)?new\s+message\s+from|notification:\s*(new\s+)?(message|reply)/i.test(
      text
    )
  )
    return "other";

  if (
    iq.message_like &&
    lineCount <= 2 &&
    trimmed.length < 300 &&
    !/@/.test(raw) &&
    !PHONE_CALLBACK_PATTERN.test(raw) &&
    !/https?:\/\/|www\./i.test(raw)
  )
    return "none";

  if (trimmed.length >= 120 && /\b(reach\s+out|following\s+up|touch\s+base|get\s+in\s+touch)\b/i.test(text))
    return "other";

  return "unknown";
}

function isCommunicationLike(textLower: string, microSignals: Record<string, boolean>): boolean {
  return (
    microSignals.has_action_request ||
    microSignals.urgency_detected ||
    microSignals.threat_detected ||
    microSignals.authority_keyword_detected ||
    microSignals.delivery_keyword_detected ||
    microSignals.financial_keyword_detected ||
    microSignals.credential_request_detected
  );
}

function isLikelyWebArtifact(
  inputQuality: { url_only: boolean; very_short: boolean; message_like: boolean },
  contextQ: string,
  microSignals: Record<string, boolean>,
  raw: string
): boolean {
  if (!microSignals.has_link) return false;
  if (
    !(
      inputQuality.url_only ||
      inputQuality.very_short ||
      contextQ === "fragment" ||
      contextQ === "thin"
    )
  )
    return false;

  // Structural clues that this is more like a message than a bare web artifact.
  if (PHONE_CALLBACK_PATTERN.test(raw)) return false;
  if (/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i.test(raw)) return false;
  if (/^from:\s|^to:\s|^subject:\s|^sent:\s|^date:\s|^reply-to:\s/mi.test(raw)) return false;
  if (
    /\b(reply|text)\s+stop\b|msg\s*&\s*data|data\s+(?:rates|charges|may\s+apply)|\btext\s+message\b|^sms[\s:]|^txt[\s:]/i.test(
      raw
    )
  )
    return false;
  if (
    /voicemail|missed\s+call|incoming\s+call|call\s+(us|now|today|back)|ring\s+us|dial\s+this|reach\s+us\s+at/i.test(raw)
  )
    return false;

  return true;
}

function detectEscalationPattern(text: string, contextQ: string): string {
  if (isInsufficientContextQuality(contextQ)) return "unknown";
  const time = /immediate|urgent|asap|act\s+now|within\s+\d+\s*(hour|minute|day)|expires?\s+(today|soon)/.test(text);
  const legal = /arrest|legal\s+action|lawsuit|warrant|police|jail|prison/.test(text);
  const account = /suspend|close.*account|lose\s+access|terminate.*service|locked\s+out/.test(text);
  const n = (time ? 1 : 0) + (legal ? 1 : 0) + (account ? 1 : 0);
  if (n > 1) return "unknown";
  if (time) return "time_pressure";
  if (legal) return "legal_threat";
  if (account) return "account_threat";
  return "none";
}

function computeUrgencyScore(text: string): number {
  let score = 0;
  if (/urgent|immediately|asap|right now/.test(text)) score += 2;
  if (/today|within.*hour|expires/.test(text)) score += 1;
  if (/don't delay|act fast|limited time/.test(text)) score += 1;
  if (/!{2,}/.test(text)) score += 1;
  return Math.min(score, 5);
}

function computeThreatScore(text: string): number {
  let score = 0;
  if (/arrest|jail|prison|warrant/.test(text)) score += 2;
  if (/suspend|terminate|close/.test(text)) score += 1;
  if (/legal action|lawsuit|court/.test(text)) score += 1;
  if (/police|fbi|irs|cra/.test(text)) score += 1;
  return Math.min(score, 5);
}

function hasPaymentPressure(text: string): boolean {
  return /pay|payment|send\s+money|wire|transfer|gift\s*card|bitcoin|crypto|zelle|venmo|cash\s*app|fee|fine|debt|invoice|refund\s+claim|collect/i.test(
    text
  );
}

function detectPaymentIntent(text: string): string {
  if (/otp|one[-\s]?time|verification\s+code|enter\s+code\s+to|confirm\s+with\s+code|2fa|two[-\s]?factor/i.test(text) && /login|sign\s*in|account/i.test(text))
    return "credential_to_enable_payment";
  if (/claim\s+(your\s+)?(prize|reward|refund)|you('ve|\s+have)\s+won|redeem\s+(your\s+)?(gift|prize)/i.test(text))
    return "claim_reward_or_refund";
  if (/fine|debt|collection|overdue|unpaid|court\s+fee|penalty|owed\s+balance/i.test(text)) return "fee_or_debt_pressure";
  if (/subscription|billing|invoice|payment\s+failed|renew\s+(your|the)\s+account|account\s+on\s+hold/i.test(text))
    return "billing_or_account_resolution";
  if (/send\s+money|wire\s+funds|send\s+bitcoin|buy\s+gift\s+cards|pay\s+with|transfer\s+to\s+this/i.test(text))
    return "direct_payment_request";
  if (!hasPaymentPressure(text)) return "none";
  return "unknown";
}

const PAYMENT_METHOD_SIGNALS: { id: string; test: RegExp }[] = [
  { id: "gift_card", test: /gift\s*card/ },
  { id: "cryptocurrency", test: /bitcoin|crypto|btc|eth/ },
  { id: "wire_transfer", test: /wire.*transfer|western union|moneygram|etransfer|e-transfer/i },
  { id: "p2p_app", test: /zelle|venmo|cash\s*app|paypal|interac/i },
  { id: "card", test: /credit\s*card|debit\s*card|card\s+number/i },
];

function detectPaymentMethod(text: string, contextQ: string): string {
  if (isInsufficientContextQuality(contextQ)) return "unknown";
  if (!hasPaymentPressure(text)) return "none";
  const hits = PAYMENT_METHOD_SIGNALS.filter(({ test }) => test.test(text)).map((m) => m.id);
  const unique = [...new Set(hits)];
  if (unique.length === 0) return "unknown";
  if (unique.length === 1) return unique[0];
  return "unknown";
}

function hasCredentialRequest(text: string): boolean {
  return /password|ssn|sin\b|social\s+security|login|credentials|verify.*identity|confirm.*account|otp|verification\s+code/i.test(text);
}

const DEFAULT_MICRO_SIGNALS: Record<string, boolean> = {
  has_link: false,
  has_phone_number: false,
  has_email_address: false,
  has_action_request: false,
  urgency_detected: false,
  threat_detected: false,
  authority_keyword_detected: false,
  delivery_keyword_detected: false,
  financial_keyword_detected: false,
  credential_request_detected: false,
  reward_keyword_detected: false,
  account_verification_detected: false,
  link_shortened_detected: false,
};

function extractMicroSignals(raw: string, text: string): Record<string, boolean> {
  const has_link = /https?:\/\/|www\./i.test(raw);
  const has_phone_number = PHONE_CALLBACK_PATTERN.test(raw);
  const has_email_address = /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i.test(raw);
  const has_action_request =
    /\b(click|tap|verify|review|confirm|login|log\s*in|update|restore|claim|redeem|schedule|reschedule|call|reply|check|follow|complete|submit|unlock|validate)\b/.test(
      text
    ) ||
    /\bact\s+now\b/.test(text);
  const urgency_detected =
    /\burgent\b|\bimmediately\b|\bright\s+now\b|\bnow\b|\btoday\b|final\s+notice|action\s+required|\bact\s+now\b/.test(text);
  const threat_detected =
    /\b(?:re)?strict(?:ed|ion)?s?\b|\bsuspension\b|\bsuspended\b|\blocked\b|\bdisabled\b|\bpenalt(?:y|ies)\b|\boverdue\b|\benforcement\b|final\s+warning|avoid\s+(?:restriction|penalt)|restore\s+access|account\s+(?:at\s+risk|will\s+be\s+(?:closed|suspended))|will\s+be\s+(?:closed|suspended)/i.test(
      text
    );
  const authority_keyword_detected =
    /\bcra\b|\birs\b|\b(?:arc)\b|tax|government|justice|\bbank\b|account\s+support|official\s+notice/.test(text);
  const delivery_keyword_detected =
    /\bpackage\b|\bcourier\b|\bdelivery\b|\bredelivery\b|\bparcel\b|\btracking\b/.test(text);
  const financial_keyword_detected =
    /\bbank\b|\bcredit\b|\bpayment\b|\bbilling\b|\btransfer\b|\binvoice\b/.test(text);
  const credential_request_detected =
    /\bpassword\b|\bcode\b|\botp\b|\blogin\b|verify\s+account|confirmation\s+code/.test(text);
  const reward_keyword_detected =
    /\bprize\b|\breward\b|\bwon\b|\bwinner\b|\bredeem\b/.test(text);
  const account_verification_detected =
    /verify\s+your\s+account|account\s+verification|confirm\s+your\s+identity/.test(text);

  return {
    has_link,
    has_phone_number,
    has_email_address,
    has_action_request,
    urgency_detected,
    threat_detected,
    authority_keyword_detected,
    delivery_keyword_detected,
    financial_keyword_detected,
    credential_request_detected,
    reward_keyword_detected,
    account_verification_detected,
  };
}

function microSignalsBlockBenign(ms: Record<string, boolean>): boolean {
  return (
    ms.has_action_request ||
    ms.urgency_detected ||
    ms.threat_detected ||
    ms.authority_keyword_detected ||
    ms.delivery_keyword_detected ||
    ms.financial_keyword_detected ||
    ms.credential_request_detected ||
    ms.reward_keyword_detected ||
    ms.account_verification_detected
  );
}

function detectEmotionVectors(text: string): string[] {
  const vectors: string[] = [];
  if (/fear|scared|worried|concern/.test(text)) vectors.push("fear");
  if (/urgent|hurry|immediate/.test(text)) vectors.push("urgency");
  if (/congratulations|winner|lucky/.test(text)) vectors.push("excitement");
  if (/trust|secure|safe|official/.test(text)) vectors.push("false_trust");
  if (/help|assist|support/.test(text)) vectors.push("helpfulness");
  return vectors;
}

function riskTierToNumeric(tier: string): number {
  if (tier === "high") return 85;
  if (tier === "medium") return 50;
  return 15;
}

function deriveIntelState(
  contextQ: string,
  narrative: string,
  paymentIntent: string,
  escalation: string,
  urgency: number,
  threat: number,
  riskTier: string,
  text: string
): "structured_signal" | "weak_signal" | "no_signal" | "insufficient_context" | "unknown" {
  const scamNarratives = new Set([
    "prize_scam",
    "government_impersonation",
    "financial_phishing",
    "tech_support",
    "romance_scam",
    "investment_fraud",
    "employment_scam",
    "delivery_scam",
  ]);
  const strongPayment = new Set([
    "direct_payment_request",
    "fee_or_debt_pressure",
    "claim_reward_or_refund",
    "billing_or_account_resolution",
    "credential_to_enable_payment",
  ]);
  const structured =
    scamNarratives.has(narrative) ||
    strongPayment.has(paymentIntent) ||
    escalation === "legal_threat" ||
    escalation === "account_threat" ||
    (urgency >= 3 && threat >= 2);

  if (isInsufficientContextQuality(contextQ) && !structured) return "insufficient_context";

  if (structured) return "structured_signal";

  if (riskTier === "medium" || riskTier === "high" || urgency >= 2 || threat >= 1) return "weak_signal";
  if (
    paymentIntent === "unknown" &&
    hasPaymentPressure(text) &&
    (narrative === "unknown" || narrative === "none")
  )
    return "weak_signal";
  if (narrative === "unknown" && (urgency >= 1 || hasPaymentPressure(text))) return "weak_signal";

  if (
    narrative === "none" &&
    paymentIntent === "none" &&
    (escalation === "none" || escalation === "unknown") &&
    riskTier === "low"
  )
    return "no_signal";

  return "unknown";
}

/** "none" only when partial/full context, no_signal, and detectors already implied no scam signal for that slot. */
function gateCoreDimensionsNone(
  contextQ: string,
  intelState: string,
  dims: {
    narrative_category: string;
    authority_type: string;
    payment_method: string;
    escalation_pattern: string;
  }
): void {
  const richContext = contextQ === "partial" || contextQ === "full";
  const allowNone = richContext && intelState === "no_signal";
  if (!allowNone) {
    if (dims.narrative_category === "none") dims.narrative_category = "unknown";
    if (dims.authority_type === "none") dims.authority_type = "unknown";
    if (dims.payment_method === "none") dims.payment_method = "unknown";
    if (dims.escalation_pattern === "none") dims.escalation_pattern = "unknown";
  }
}

function isBenignRoutineLowRisk(text: string, micro_signals: Record<string, boolean>): boolean {
  if (microSignalsBlockBenign(micro_signals)) return false;
  const hasNarrativeCue = NARRATIVE_SIGNALS.some(({ test }) => test.test(text));
  const hasAuthorityCue = AUTHORITY_SIGNALS.some(({ test }) => test.test(text));
  const hasPaymentCue = hasPaymentPressure(text);
  const hasCredentialCue = hasCredentialRequest(text);
  const hasEscalationCue =
    /immediate|urgent|asap|act\s+now|within\s+\d+\s*(hour|minute|day)|expires?\s+(today|soon)/.test(text) ||
    /arrest|legal\s+action|lawsuit|warrant|police|jail|prison/.test(text) ||
    /suspend|close.*account|lose\s+access|terminate.*service|locked\s+out/.test(text);

  if (hasNarrativeCue) return false;
  if (hasAuthorityCue) return false;
  if (hasPaymentCue) return false;
  if (hasCredentialCue) return false;
  if (hasEscalationCue) return false;
  return true;
}

/**
 * Risk reconciliation: elevate risk when enrichment detects strong scam patterns.
 * Never elevates insufficient_context/fragment (caller must skip when capped).
 */
function applyRiskReconciliation(
  currentRisk: "low" | "medium" | "high",
  enrichment: {
    narrativeFamily: string;
    impersonationEntity: string;
    requestedAction: string;
    threatStage: string;
  }
): "low" | "medium" | "high" {
  let risk = currentRisk;
  const n = enrichment.narrativeFamily ?? "";
  const e = enrichment.impersonationEntity ?? "";
  const a = enrichment.requestedAction ?? "";
  const th = enrichment.threatStage ?? "";
  const entityKnown = e && e !== "unknown";
  const strongActions = new Set(["submit_credentials", "pay_money", "click_link", "call_number"]);

  if (n === "recovery_scam") {
    risk = "high";
  } else if (
    ["government_impersonation", "account_verification", "law_enforcement"].includes(n) &&
    entityKnown
  ) {
    const hasStrongAction = strongActions.has(a);
    risk = hasStrongAction && ["submit_credentials", "pay_money"].includes(a) ? "high" : "medium";
  } else if (n === "delivery_scam" && a === "pay_money") {
    risk = currentRisk === "low" ? "medium" : "high";
  } else if (th === "credential_capture" && entityKnown) {
    risk = risk === "low" ? "medium" : "high";
  }

  return risk;
}

/** Strip first link from raw text so path/host tokens (e.g. login, secure) are not scored as prose. */
function textForLinkFragmentHeuristics(messageText: string, linkArtifact: LinkArtifact): string {
  let rest = messageText;
  const needle = linkArtifact.url;
  if (needle.length > 0) {
    const idx = rest.toLowerCase().indexOf(needle.toLowerCase());
    if (idx !== -1) {
      rest = rest.slice(0, idx) + " " + rest.slice(idx + needle.length);
    }
  }
  if (rest.trim() === messageText.trim()) {
    rest = rest.replace(/https?:\/\/[^\s<>"'`]+/gi, " ");
  }
  rest = rest.replace(/\bwww\.[^\s<>"'`]+/gi, " ");
  return rest.trim().toLowerCase();
}

function summaryForLinkOnlyFragment(linkArtifact: LinkArtifact, language: "en" | "fr"): string {
  if (language === "fr") {
    if (linkArtifact.is_shortened) {
      return "Cette soumission ne contient qu'un lien raccourci. Vérifiez la destination avant de cliquer.";
    }
    if (linkArtifact.has_suspicious_tld) {
      return "Cette soumission ne contient qu'un lien avec une terminaison de domaine inhabituelle. Vérifiez attentivement la destination avant de cliquer.";
    }
    return "Cette soumission ne contient qu'un lien. Assurez-vous que l'adresse correspond au site officiel avant de cliquer.";
  }
  if (linkArtifact.is_shortened) {
    return "This submission contains only a shortened link. Verify the destination before clicking.";
  }
  if (linkArtifact.has_suspicious_tld) {
    return "This submission contains only a link using an unusual domain ending. Verify the destination carefully before clicking.";
  }
  return "This submission contains only a link. Confirm the address matches the official website before clicking.";
}

const HUMAN_MANIPULATION_SIGNAL_TYPE =
  /urgency|time_?pressure|deadline|immediate|threat|fear|coerc|emotion|panic|pressure|account_?threat|legal_?threat|consequence|suspend|suspension/i;

const BRAND_LIKE_HOST_SUBSTRINGS =
  /paypal|amazon|microsoft|apple|google|netflix|chase|wells\s*fargo|desjardins|interac|bank\s*of\s*america|citibank|scotiabank|tdbank|bmo\b/i;

/** Known-good brand roots: do not flag brand-like hostname when registrable domain is clearly official. */
const OFFICIAL_BRAND_ROOT = /^(paypal|amazon|microsoft|apple|google|netflix|desjardins|chase|wellsfargo)\.(com|ca|co\.uk|net|org)(\.[a-z]{2})?$/i;

function isMostlyLinkOnlySubmission(messageText: string, linkArtifact: LinkArtifact): boolean {
  const prose = textForLinkFragmentHeuristics(messageText, linkArtifact).replace(/[`'".,;:()[\]{}>\s-]/g, "");
  return prose.length < 6;
}

function evidenceContainedInUrl(evidence: string, url: string): boolean {
  const e = evidence.trim().toLowerCase();
  if (e.length < 4) return false;
  return url.toLowerCase().includes(e);
}

function suspiciousBrandLikeHostname(domain: string | null, root: string | null): boolean {
  if (!domain || !root) return false;
  const d = domain.toLowerCase();
  const r = root.toLowerCase().replace(/^www\./, "");
  if (!BRAND_LIKE_HOST_SUBSTRINGS.test(d)) return false;
  if (OFFICIAL_BRAND_ROOT.test(r)) return false;
  return true;
}

type ScanSignal = { type: string; evidence: string; weight?: number };

/** Link-honest signals for insufficient/fragment context; does not change risk tier. */
function buildLinkNativeSignals(linkArtifact: LinkArtifact, lang: "en" | "fr"): ScanSignal[] {
  const cues: string[] = [];
  if (linkArtifact.is_shortened) cues.push(lang === "fr" ? "lien raccourci" : "shortened link");
  if (linkArtifact.has_suspicious_tld && linkArtifact.tld) {
    cues.push(lang === "fr" ? `fin de domaine .${linkArtifact.tld}` : `.${linkArtifact.tld} domain ending`);
  }
  if (suspiciousBrandLikeHostname(linkArtifact.domain, linkArtifact.root_domain)) {
    cues.push(lang === "fr" ? "nom d’hôte évoquant une marque" : "brand-like host name");
  }
  if (cues.length === 0) return [];
  const evidence =
    lang === "fr"
      ? `Le lien seul indique : ${cues.join(", ")}.`
      : `The link alone indicates: ${cues.join(", ")}.`;
  return [{ type: "link_manipulation", evidence, weight: 3 }];
}

function normalizeSignalsForInsufficientLinkContext(
  rawSignals: unknown,
  isInsufficientContext: boolean,
  linkArtifact: LinkArtifact | null,
  messageText: string,
  lang: "en" | "fr"
): ScanSignal[] {
  const signals: ScanSignal[] = Array.isArray(rawSignals)
    ? rawSignals.map((s: any) => ({
        type: String(s?.type ?? "unknown"),
        evidence: String(s?.evidence ?? ""),
        weight: typeof s?.weight === "number" ? s.weight : undefined,
      }))
    : [];

  if (!isInsufficientContext || !linkArtifact) return signals;

  const native = buildLinkNativeSignals(linkArtifact, lang);
  const mostlyLink = isMostlyLinkOnlySubmission(messageText, linkArtifact);

  if (mostlyLink) {
    if (native.length > 0) return native;
    return [
      {
        type: "link_only",
        evidence:
          lang === "fr"
            ? "Soumission sans texte autour du lien ; le contexte est insuffisant pour interpréter le message."
            : "Link-only submission; not enough surrounding text to interpret as a full message.",
        weight: 2,
      },
    ];
  }

  const filtered = signals.filter((s) => {
    if (!HUMAN_MANIPULATION_SIGNAL_TYPE.test(s.type)) return true;
    return !evidenceContainedInUrl(s.evidence, linkArtifact.url);
  });

  const hasLinkNative = filtered.some((s) => /link_manipulation|link_only|link_shortener|suspicious_tld/i.test(s.type));
  if (!hasLinkNative && native.length > 0) return [...filtered, ...native];
  return filtered;
}

function extractIntelFeatures(
  result: any,
  messageText: string,
  platformLang: "en" | "fr",
  inputQuality: { url_only: boolean; very_short: boolean; message_like: boolean },
  riskTier: string,
  aiParseFallback: boolean,
  linkArtifact: LinkArtifact | null
): { intel_features: Record<string, any>; mode: "full" | "extraction_failed" } {
  const mergeCore = (base: Record<string, any>): Record<string, any> => {
    const out = { ...base };
    for (const k of CORE_INTEL_KEYS) {
      if (out[k] === undefined || out[k] === null) out[k] = "unknown";
    }
    out.known_core_dimension_count = countKnownCoreDimensions(out);
    out.ai_parse_fallback = aiParseFallback;
    return out;
  };

  try {
    const text = messageText.toLowerCase();
    const contextQ = assessContextQuality(messageText, inputQuality);
    const signalText =
      contextQ === "fragment" && linkArtifact ? textForLinkFragmentHeuristics(messageText, linkArtifact) : text;

    const micro_signals = extractMicroSignals(messageText, signalText);
    const narrative_category = detectNarrativeCategory(text, contextQ);
    let channel_type = detectChannelType(text, messageText, inputQuality, micro_signals);
    let authority_type = detectAuthorityType(text, contextQ);
    if (authority_type === "none" && micro_signals.authority_keyword_detected) authority_type = "unknown";
    const payment_intent = detectPaymentIntent(signalText);
    const payment_method = detectPaymentMethod(text, contextQ);
    const escalation_pattern = detectEscalationPattern(text, contextQ);
    const urgency = computeUrgencyScore(signalText);
    const threat = computeThreatScore(signalText);

    const gatedDims = {
      narrative_category,
      authority_type,
      payment_method,
      escalation_pattern,
    };

    let intel_state = deriveIntelState(
      contextQ,
      gatedDims.narrative_category,
      payment_intent,
      gatedDims.escalation_pattern,
      urgency,
      threat,
      riskTier,
      signalText
    );

    const richContext = contextQ === "partial" || contextQ === "full";
    const commLike = isCommunicationLike(text, micro_signals);

    // URL-only / fragmentary link artifacts with weak context and no strong message structure → web.
    if (
      (channel_type === "unknown" || channel_type === "none") &&
      isLikelyWebArtifact(inputQuality, contextQ, micro_signals, messageText)
    ) {
      channel_type = "web";
    }

    // Clear communication-like artifacts that still have unknown/none channel become generic "other".
    if (channel_type === "unknown" && richContext && commLike) channel_type = "other";
    if (channel_type === "none" && richContext && commLike) channel_type = "other";

    if (
      riskTier === "low" &&
      richContext &&
      (intel_state === "unknown" || intel_state === "no_signal") &&
      isBenignRoutineLowRisk(text, micro_signals)
    ) {
      intel_state = "no_signal";
      gatedDims.narrative_category = "none";
      gatedDims.authority_type = "none";
      gatedDims.payment_method = "none";
      gatedDims.escalation_pattern = "none";
    }

    if (
      riskTier === "low" &&
      richContext &&
      intel_state === "unknown" &&
      ((micro_signals.has_action_request &&
        (micro_signals.urgency_detected || micro_signals.threat_detected)) ||
        (micro_signals.threat_detected && micro_signals.credential_request_detected))
    ) {
      intel_state = "weak_signal";
    }

    gateCoreDimensionsNone(contextQ, intel_state, gatedDims);
    if (intel_state === "structured_signal" && channel_type === "none") channel_type = "unknown";

    const intel: Record<string, any> = {
      narrative_category: gatedDims.narrative_category,
      channel_type,
      authority_type: gatedDims.authority_type,
      payment_method: gatedDims.payment_method,
      escalation_pattern: gatedDims.escalation_pattern,
      context_quality: contextQ,
      payment_intent,
      intel_state,
      micro_signals: { ...micro_signals },
      brand_mentions: detectBrandMentions(signalText),
      urgency_score: urgency,
      threat_score: threat,
      payment_request: hasPaymentPressure(signalText),
      credential_request: hasCredentialRequest(signalText),
      link_present: Boolean(linkArtifact) || /https?:\/\/|www\./i.test(messageText),
      callback_number_present: PHONE_CALLBACK_PATTERN.test(messageText),
      emotion_vectors: detectEmotionVectors(signalText),
      language_variant: platformLang,
      risk_score_numeric: riskTierToNumeric(result.risk_tier ?? result.risk ?? "low"),
    };

    const missing = CORE_INTEL_KEYS.filter((k) => intel[k] === undefined || intel[k] === null);
    if (missing.length > 0) {
      return {
        intel_features: mergeCore({
          ...intel,
          extraction_failed: true,
          reason: `missing_keys: ${missing.join(",")}`,
        }),
        mode: "extraction_failed",
      };
    }

    return { intel_features: mergeCore(intel), mode: "full" };
  } catch (err: any) {
    return {
      intel_features: mergeCore({
        narrative_category: "unknown",
        channel_type: "unknown",
        authority_type: "unknown",
        payment_method: "unknown",
        escalation_pattern: "unknown",
        context_quality: "unknown",
        payment_intent: "unknown",
        intel_state: "unknown",
        micro_signals: { ...DEFAULT_MICRO_SIGNALS, link_shortened_detected: false },
        extraction_failed: true,
        reason: err?.message ?? "unknown_error",
      }),
      mode: "extraction_failed",
    };
  }
}

const MIN_LENGTH = 20;

/* -------------------------------------------------
   Helpers
-------------------------------------------------- */

function reject(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

const SUBMISSION_IMAGES_BUCKET = "submission-images";

function parseDataUrlToBuffer(dataUrl: string): { buffer: Buffer; contentType: string; ext: string } | null {
  const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(dataUrl.trim());
  if (!match) return null;
  const contentType = match[1];
  const ctLower = contentType.toLowerCase();
  let ext = "bin";
  if (ctLower.includes("jpeg") || ctLower.includes("jpg")) ext = "jpg";
  else if (ctLower.includes("png")) ext = "png";
  else if (ctLower.includes("webp")) ext = "webp";
  else if (ctLower.includes("gif")) ext = "gif";
  try {
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length === 0) return null;
    return { buffer, contentType, ext };
  } catch {
    return null;
  }
}

/** Private bucket; MSP view uses signed URLs. Best-effort — scan still succeeds if upload fails. */
async function persistOcrSubmissionImage(scanId: string, dataUrl: string): Promise<boolean> {
  const parsed = parseDataUrlToBuffer(dataUrl);
  if (!parsed) return false;
  const objectPath = `${scanId}/${crypto.randomUUID()}.${parsed.ext}`;
  const { error: uploadError } = await supabase.storage.from(SUBMISSION_IMAGES_BUCKET).upload(objectPath, parsed.buffer, {
    contentType: parsed.contentType,
    upsert: false,
  });
  if (uploadError) {
    console.error("[scan_persist_image]", uploadError.message);
    return false;
  }
  const { error: updateError } = await supabase
    .from("scans")
    .update({ submission_image_path: objectPath })
    .eq("id", scanId);
  if (updateError) {
    console.error("[scan_persist_image_path]", updateError.message);
    return false;
  }
  return true;
}

function looksLikeConversation(text: string): boolean {
  const markers = [
    "i think",
    "i feel",
    "what should i do",
    "can you help",
  ];
  const lower = text.toLowerCase();
  return markers.some((m) => lower.includes(m));
}

function classifyInputQuality(text: string): {
  url_only: boolean;
  very_short: boolean;
  message_like: boolean;
} {
  const trimmed = text.trim();
  const len = trimmed.length;
  const isSingleUrl = /^(https?:\/\/\S+|www\.\S+)$/i.test(trimmed);
  return {
    url_only: isSingleUrl,
    very_short: len >= MIN_LENGTH && len < 100,
    message_like: !looksLikeConversation(text),
  };
}

function stripUrlsForShape(raw: string): string {
  return raw
    .replace(/https?:\/\/[^\s<>"'`]+/gi, " ")
    .replace(/\bwww\.[^\s<>"'`]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripPhonesForShape(raw: string): string {
  return raw
    .replace(/\+?\d[\d\s().-]{6,}\d/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveInputType(
  rawText: string,
  inputQuality: { url_only: boolean; very_short: boolean; message_like: boolean },
  contextQuality: string,
  hasPhone: boolean,
  hasLinkArtifact: boolean
): "full_message" | "link_only" | "phone_only" | "fragment" {
  const trimmed = rawText.trim();
  const withoutLinks = stripUrlsForShape(trimmed);
  const withoutPhones = stripPhonesForShape(trimmed);
  const hasUrlToken = /https?:\/\/|www\./i.test(trimmed);
  const tokenCount = trimmed.split(/\s+/).filter(Boolean).length;
  const nonLinkChars = withoutLinks.replace(/[\s`'"()[\]{}<>.,;:!?-]/g, "").length;
  const nonPhoneChars = withoutPhones.replace(/[\s`'"()[\]{}<>.,;:!?-]/g, "").length;
  const linkOnlyShape =
    inputQuality.url_only ||
    (hasLinkArtifact && nonLinkChars <= 10) ||
    (hasLinkArtifact && tokenCount <= 4 && nonLinkChars <= 16);
  const phoneOnlyShape =
    hasPhone &&
    !hasUrlToken &&
    (nonPhoneChars <= 12 ||
      (/^(call|text|sms|tel|telephone|phone|callback|ring)\b/i.test(withoutPhones) && tokenCount <= 6));

  if (linkOnlyShape) return "link_only";
  if (phoneOnlyShape) return "phone_only";
  if (contextQuality === "fragment" || contextQuality === "unknown") return "fragment";
  if (contextQuality === "thin" && !inputQuality.message_like && tokenCount <= 5) return "fragment";
  return "full_message";
}

/* -------------------------------------------------
   POST /api/scan
-------------------------------------------------- */

export async function POST(req: Request) {
  let body: any;

  /* ---------- IP extraction (ephemeral) ---------- */
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    crypto.randomUUID();

  /* ---------- Rate limiting ---------- */
  if (!checkRateLimit(ip)) {
    logEvent("rate_limited", "warning", "scan_api");
    return reject("rate_limited", "Too many requests.", 429);
  }

  /* ---------- Vercel geo headers (coarse, no IP/UA stored) ---------- */
  const h = new Headers(req.headers);
  const rawCountry = h.get("x-vercel-ip-country")?.trim() ?? "";
  const rawRegion = h.get("x-vercel-ip-country-region")?.trim() ?? "";
  const rawCity = h.get("x-vercel-ip-city")?.trim() ?? "";
  const vercel_country_code = rawCountry ? rawCountry.toUpperCase() : null;
  const vercel_region_code = rawRegion || null;
  const vercel_city = rawCity || null;

  /* ---------- Parse body (JSON or FormData) ---------- */
  const contentType = req.headers.get("content-type") ?? "";
  console.log("[scan_debug]", { contentType });

  let text: string | undefined;
  let image: string | undefined;
  let lang: string | undefined;
  let raw_opt_in: boolean | string | undefined;
  let country_code: string | undefined;
  let region_code: string | undefined;
  let city: string | undefined;
  let utm_source: string | undefined;
  let utm_medium: string | undefined;
  let utm_campaign: string | undefined;
  let utm_term: string | undefined;
  let utm_content: string | undefined;
  let gclid: string | undefined;
  let referrer: string | undefined;
  let landing_path: string | undefined;

  /* ---------- Strict content-type check ---------- */
  if (!contentType.includes("application/json") && !contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { ok: false, code: "unsupported_media_type", message: "Expected application/json or multipart/form-data" },
      { status: 415 }
    );
  }

  try {
    if (contentType.includes("application/json")) {
      const body = await req.json();
      text = body.text;
      image = body.image;
      lang = body.lang;
      raw_opt_in = body.raw_opt_in;
      country_code = body.country_code;
      region_code = body.region_code;
      city = body.city;
      utm_source = body.utm_source;
      utm_medium = body.utm_medium;
      utm_campaign = body.utm_campaign;
      utm_term = body.utm_term;
      utm_content = body.utm_content;
      gclid = body.gclid;
      referrer = body.referrer;
      landing_path = body.landing_path;
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();

      const textField = formData.get("text");
      if (typeof textField === "string") text = textField;

      const langField = formData.get("lang");
      if (typeof langField === "string") lang = langField;

      const rawOptInField = formData.get("raw_opt_in");
      if (rawOptInField === "true") {
        raw_opt_in = true;
      } else if (rawOptInField === "false") {
        raw_opt_in = false;
      }

      const countryField = formData.get("country_code");
      if (typeof countryField === "string") country_code = countryField;

      const regionField = formData.get("region_code");
      if (typeof regionField === "string") region_code = regionField;

      const cityField = formData.get("city");
      if (typeof cityField === "string") city = cityField;

      const utmSourceField = formData.get("utm_source");
      if (typeof utmSourceField === "string") utm_source = utmSourceField;
      const utmMediumField = formData.get("utm_medium");
      if (typeof utmMediumField === "string") utm_medium = utmMediumField;
      const utmCampaignField = formData.get("utm_campaign");
      if (typeof utmCampaignField === "string") utm_campaign = utmCampaignField;
      const utmTermField = formData.get("utm_term");
      if (typeof utmTermField === "string") utm_term = utmTermField;
      const utmContentField = formData.get("utm_content");
      if (typeof utmContentField === "string") utm_content = utmContentField;
      const gclidField = formData.get("gclid");
      if (typeof gclidField === "string") gclid = gclidField;
      const referrerField = formData.get("referrer");
      if (typeof referrerField === "string") referrer = referrerField;
      const landingPathField = formData.get("landing_path");
      if (typeof landingPathField === "string") landing_path = landingPathField;

      const imageField = formData.get("image");
      if (imageField && typeof imageField === "object" && "arrayBuffer" in imageField) {
        const file = imageField as File;
        const buffer = Buffer.from(await file.arrayBuffer());
        const base64 = buffer.toString("base64");
        const mimeType = file.type || "image/png";
        image = `data:${mimeType};base64,${base64}`;
      } else if (typeof imageField === "string") {
        image = imageField;
      }
    }
  } catch {
    logEvent("invalid_payload", "info", "scan_api");
    return reject("invalid_payload", "Invalid request payload.");
  }

  const language: "en" | "fr" = lang === "fr" ? "fr" : "en";
  const rawOptIn = raw_opt_in === true || raw_opt_in === "true";

  /* ---------- XOR enforcement ---------- */
  if (text && image) {
    logEvent("invalid_input", "info", "scan_api");
    return reject(
      "invalid_input",
      language === "fr"
        ? "Veuillez fournir soit un message, soit une image."
        : "Please provide either text or an image."
    );
  }

  let contentText = "";
  let source: "user_text" | "ocr" = "user_text";

  /* ---------- OCR path ---------- */
  if (image) {
    if (isOCRBlocked(ip)) {
      logEvent("ocr_blocked", "warning", "ocr");
      return reject(
        "ocr_blocked",
        language === "fr"
          ? "OCR temporairement bloqué."
          : "OCR temporarily blocked.",
        429
      );
    }

    try {
      contentText = await ocrImage(image);
      source = "ocr";
    } catch {
      recordOCRResult(ip, "failure");
      logEvent("ocr_failed", "warning", "ocr");
      return reject(
        "ocr_failed",
        language === "fr"
          ? "Impossible de traiter l’image."
          : "Image could not be processed."
      );
    }

    if (!contentText || contentText.length < MIN_LENGTH) {
      recordOCRResult(ip, "low_text");
      logEvent("ocr_low_text", "info", "ocr");
      return reject(
        "ocr_no_text",
        language === "fr"
          ? "Texte lisible insuffisant."
          : "Not enough readable text."
      );
    }

    recordOCRResult(ip, "success");
  }

  /* ---------- Text path ---------- */
  if (!image) {
    if (!text || typeof text !== "string") {
      logEvent("empty_text", "info", "scan_api");
      return reject(
        "empty_text",
        language === "fr"
          ? "Aucun texte fourni."
          : "No text provided."
      );
    }

    contentText = text.trim();

    if (contentText.length < MIN_LENGTH) {
      logEvent("text_too_short", "info", "scan_api");
      return reject(
        "text_too_short",
        language === "fr"
          ? "Message trop court."
          : "Message too short."
      );
    }
  }

  /* ---------- Duplicate suppression ---------- */
  if (isRepeatedScan(ip, contentText)) {
    logEvent("duplicate_scan", "info", "scan_api");
    return reject(
      "duplicate_scan",
      language === "fr"
        ? "Message déjà analysé récemment."
        : "Message already analyzed recently.",
      429
    );
  }

  /* ---------- AI analysis ---------- */
  try {
    const { result, usedFallback, ai_parse_fallback } = await analyzeScan({
      messageText: contentText,
      language,
      source,
    });

    /* ---------- Input quality classification ---------- */
    const inputQuality = classifyInputQuality(contentText);
    const riskTier = result.risk_tier ?? "low";
    const linkArtifact = extractLinkArtifacts(contentText);

    if (ai_parse_fallback) {
      logEvent("ai_parse_fallback", "warning", "scan_api", {
        used_hard_fallback: usedFallback,
      });
    }

    const { intel_features: rawLegacyIntel, mode: intelMode } = extractIntelFeatures(
      result,
      contentText,
      language,
      inputQuality,
      riskTier,
      ai_parse_fallback,
      linkArtifact
    );

    const legacyIntel: Record<string, any> = {
      ...rawLegacyIntel,
      micro_signals: {
        ...rawLegacyIntel.micro_signals,
        link_shortened_detected: Boolean(linkArtifact?.is_shortened),
      },
    };

    const enrichment = buildScanEnrichment({
      messageText: contentText,
      language,
      source,
    });

    const inputType = deriveInputType(
      contentText,
      inputQuality,
      enrichment.contextQuality ?? String(legacyIntel.context_quality ?? "unknown"),
      PHONE_CALLBACK_PATTERN.test(contentText),
      Boolean(linkArtifact)
    );

    const intel_features = mapIntelFields(
      harmonizeNarratives({
        ...legacyIntel,
        ...(linkArtifact ? { link_artifact: linkArtifact, link_present: true } : {}),
        input_type: inputType,
        submission_route: enrichment.submissionRoute,
        narrative_family: enrichment.narrativeFamily,
        impersonation_entity: enrichment.impersonationEntity,
        requested_action: enrichment.requestedAction,
        threat_stage: enrichment.threatStage,
        confidence_level: enrichment.confidenceLevel,
        source_type: enrichment.sourceType,
        context_quality: enrichment.contextQuality ?? legacyIntel.context_quality,
      }),
      contentText
    );

    /* ---------- Trust-floor guardrail: cap risk for insufficient/fragment context ---------- */
    let finalRiskTier = riskTier as "low" | "medium" | "high";
    let finalSummary: string | null = result.summary_sentence ?? null;

    const isInsufficientContext =
      enrichment.submissionRoute === "insufficient_context" ||
      enrichment.contextQuality === "fragment";

    if (isInsufficientContext) {
      finalRiskTier = riskTier === "high" ? "medium" : (riskTier as "low" | "medium");
      if (linkArtifact && enrichment.contextQuality === "fragment") {
        finalSummary = summaryForLinkOnlyFragment(linkArtifact, language);
      } else {
        finalSummary = "Not enough context is available to classify this reliably. Proceed with caution.";
      }
    } else {
      if (!finalSummary || String(finalSummary).trim() === "") {
        finalSummary = enrichment.summary ?? null;
      }
      finalRiskTier = applyRiskReconciliation(finalRiskTier, {
        narrativeFamily: enrichment.narrativeFamily,
        impersonationEntity: enrichment.impersonationEntity,
        requestedAction: enrichment.requestedAction,
        threatStage: enrichment.threatStage,
      });
    }

    const userVerdict =
      finalRiskTier === "high" ? "scam" : finalRiskTier === "medium" ? "suspicious" : "safe";

    const finalSignals = normalizeSignalsForInsufficientLinkContext(
      result.signals,
      isInsufficientContext,
      linkArtifact,
      contentText,
      language
    );

    /* ---------- Insert into scans (ALWAYS) ---------- */
    const scanRow: Record<string, any> = {
      risk_tier: finalRiskTier,
      summary_sentence: finalSummary,
      signals: finalSignals,
      language,
      source,
      data_quality: {
        ...(result.data_quality || {}),
        is_message_like: inputQuality.message_like,
        url_only: inputQuality.url_only,
        very_short: inputQuality.very_short,
      },
      used_fallback: usedFallback,
      intel_features,
      raw_opt_in: rawOptIn,
    };
    if (vercel_country_code) scanRow.country_code = vercel_country_code;
    if (vercel_region_code) scanRow.region_code = vercel_region_code;
    if (vercel_city) scanRow.city = vercel_city;

    const sanitize = (v: string | undefined): string | null =>
      typeof v === "string" && (v = v.trim()).length > 0 ? v.slice(0, 512) : null;
    const u = sanitize(utm_source);
    if (u != null) scanRow.utm_source = u;
    const um = sanitize(utm_medium);
    if (um != null) scanRow.utm_medium = um;
    const uc = sanitize(utm_campaign);
    if (uc != null) scanRow.utm_campaign = uc;
    const ut = sanitize(utm_term);
    if (ut != null) scanRow.utm_term = ut;
    const uco = sanitize(utm_content);
    if (uco != null) scanRow.utm_content = uco;
    const g = sanitize(gclid);
    if (g != null) scanRow.gclid = g;
    const r = sanitize(referrer);
    if (r != null) scanRow.referrer = r;
    const lp = sanitize(landing_path);
    if (lp != null) scanRow.landing_path = lp;

    const { data: scanData, error: scanError } = await supabase
      .from("scans")
      .insert(scanRow)
      .select("id")
      .single();

    const persisted = !scanError;
    let scanId = persisted ? (scanData?.id ?? null) : null;

    /* ---------- Insert raw_messages if opted in (atomic: rollback scan on failure) ---------- */
    let rawMessageError: string | null = null;
    if (rawOptIn && scanId) {
      const { error: rawError } = await supabase.from("raw_messages").insert({
        scan_id: scanId,
        message_text: contentText,
        source,
        delete_after: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
      if (rawError) {
        rawMessageError = rawError.message;
        const { error: delErr } = await supabase.from("scans").delete().eq("id", scanId);
        if (!delErr) {
          scanId = null;
          logEvent("scan_rollback_raw_failed", "warning", "scan_api", { reason: rawError.message });
        }
      } else if (source === "ocr" && image && typeof image === "string" && image.startsWith("data:")) {
        const ok = await persistOcrSubmissionImage(scanId, image);
        if (!ok) {
          logEvent("scan_image_upload_skipped", "info", "scan_api", { scan_id: scanId });
        }
      }
    }

    /* ---------- Structured log ---------- */
    console.log("[scan_persist]", JSON.stringify({
      scan_id: scanId,
      persisted,
      raw_opt_in: rawOptIn,
      intel_features_mode: intelMode,
      supabase_error: scanError?.message ?? rawMessageError ?? null,
    }));

    /**
     * 🔑 CANONICAL RESPONSE
     * - Server owns: language, source, data_quality
     * - AI owns: risk_tier, signals, summary_sentence
     * - vNext: scan_id, user_verdict, intel_features
     */

    const { data_quality: _aiDataQuality, ...restResult } = result;
    return NextResponse.json({
      ok: true,
      result: {
        /* AI output (trust-floor may override risk_tier, summary_sentence, signals) */
        ...restResult,
        risk_tier: finalRiskTier,
        summary_sentence: finalSummary,
        signals: finalSignals,

        /* Server truth */
        language,
        source,
        data_quality: {
          ...(_aiDataQuality || {}),
          is_message_like: inputQuality.message_like,
          url_only: inputQuality.url_only,
          very_short: inputQuality.very_short,
        },

        /* Frontend compatibility (legacy) */
        risk: finalRiskTier,
        reasons: finalSignals.map((s) => s.evidence ?? "").filter((r: string) => r.trim()),

        /* vNext fields */
        scan_id: scanId,
        persisted,
        user_verdict: userVerdict,
        intel_features,
      },
    });
  } catch (err) {
    logEvent("analysis_failed", "critical", "ai");
    console.error("SCAN_ANALYSIS_FAILED", err);
    return reject(
      "analysis_failed",
      language === "fr"
        ? "Erreur lors de l’analyse."
        : "Analysis failed."
    );
  }
}
