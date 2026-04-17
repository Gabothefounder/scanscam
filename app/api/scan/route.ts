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
import { expandUrl } from "@/lib/scan-analysis/expandUrl";
import { lookupWebRisk } from "@/lib/scan-analysis/webRiskLookup";
import { linkArtifactFromLinkIntel, linkIntelFromArtifact } from "@/lib/scan-analysis/linkIntel";
import { buildAbuseInterpretation } from "@/lib/scan-analysis/abuseInterpretation";
import { passesScanTextAdmission } from "@/lib/scan/scanTextAdmission";
import { getInsufficientContextSummary } from "@/lib/scan/insufficientContextSummary";
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
  {
    id: "prize_scam",
    test:
      /lottery|winner|prize|won|congratulations.*won|loterie|\bgagné\b|félicitations.*gagn|vous\s+avez\s+gagné|\bréclamer\b.*\b(prix|lot)\b/i,
  },
  {
    id: "government_impersonation",
    test:
      /\b(cra|arc|irs)\b|tax\s+(return|refund|debt)|revenue\s+canada|arrest|warrant|justice|court\s+order|government\s+fine|parking\s+(violation|ticket|fine|notice)|unpaid\s+parking|plate\s+denial|permit\s+renewal\s+blocked|\bmto\b|\bdmv\b|service\s+ontario|\bserviceontario\b|\bcontraventions?\b|\bstationnement\b|billets?\s+impay(?:é|e)s?|\bamendes?\b|pénalités?|penalites?|refus\s+de\s+(?:la\s+)?plaque|renouvellement\s+du\s+permis|avis\s+officiel|agence\s+du\s+revenu|impôt\s+fédéral|arrestation|mandat\b/u,
  },
  {
    id: "financial_phishing",
    test:
      /bank|account.*suspend|verify.*account|unusual\s+activity.*account|banque|compte.*suspend|vérifier.*compte|activité\s+inhabituelle|confirmer.*identité|connexion\s+requise/i,
  },
  {
    id: "tech_support",
    test: /tech support|virus|computer.*infected|malware|support\s+technique|ordinateur.*infecté|logiciel\s+malveillant/i,
  },
  { id: "romance_scam", test: /romance|love|dating|met\s+you\s+online|rencontre\s+en\s+ligne|tomber\s+amoureux/i },
  {
    id: "investment_fraud",
    test: /investment|crypto|bitcoin|guaranteed.*return|forex|placement|rendement\s+garanti|crypto(?:monnaie)?/i,
  },
  {
    id: "employment_scam",
    test: /job|work.*from.*home|easy\s+money|interview.*position|emploi|travail\s+à\s+domicile|argent\s+facile|entretien\s+d'?embauche/i,
  },
  {
    id: "delivery_scam",
    test:
      /package|delivery|courier|usps|fedex|ups|tracking.*number|\bcolis\b|livraison|postes\s+canada|numéro.*suivi|suivi.*colis|purolator/i,
  },
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
    test:
      /bank|banque|credit\s+union|account\s+support|banking|visa|mastercard|carte\s+de\s+crédit|paypal|financial\s+institution|institution\s+financière/,
  },
  {
    id: "corporate",
    test:
      /package|delivery|courier|usps|fedex|ups|postal|colis|livraison|postes\s+canada|ceo|manager|hr|boss|compliance|recovery|account\s+verification|verify\s+your\s+identity|vérifier\s+votre\s+compte|vérification\s+du\s+compte/,
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
  const time =
    /immediate|urgent|asap|act\s+now|within\s+\d+\s*(hour|minute|day)|expires?\s+(today|soon)|immédiat|immédiatement|agissez|dans\s+\d+\s*(heures?|minutes?|jours?)|expire\s+(bientôt|aujourd'hui)|dernier\s+délai|action\s+requise/i.test(
      text
    );
  const legal =
    /arrest|legal\s+action|lawsuit|warrant|police|jail|prison|arrestation|mandat|poursuite|tribunal|prison/i.test(text);
  const account =
    /suspend|close.*account|lose\s+access|terminate.*service|locked\s+out|suspendre|fermer.*compte|perdre\s+l'accès|verrouill|compte\s+sera\s+fermé|accès\s+refusé/i.test(text);
  const n = (time ? 1 : 0) + (legal ? 1 : 0) + (account ? 1 : 0);
  if (n > 1) return "unknown";
  if (time) return "time_pressure";
  if (legal) return "legal_threat";
  if (account) return "account_threat";
  return "none";
}

function computeUrgencyScore(text: string): number {
  let score = 0;
  if (/urgent|immediately|asap|right now|immédiat|immédiatement|tout de suite|maintenant/.test(text)) score += 2;
  if (/today|within.*hour|expires|aujourd'hui|dans\s+\d+\s*heures?|expire|expiration/.test(text)) score += 1;
  if (/don't delay|act fast|limited time|sans\s+délai|agissez\s+vite|temps\s+limité|dernier\s+avis/.test(text))
    score += 1;
  if (/!{2,}/.test(text)) score += 1;
  return Math.min(score, 5);
}

function computeThreatScore(text: string): number {
  let score = 0;
  if (/arrest|jail|prison|warrant|arrestation|mandat|prison/.test(text)) score += 2;
  if (/suspend|terminate|close|suspendu|fermé|résili|verrouill|bloqué/.test(text)) score += 1;
  if (/legal action|lawsuit|court|poursuite|tribunal|action\s+judiciaire/.test(text)) score += 1;
  if (/police|fbi|irs|cra|\barc\b|gendarmerie/.test(text)) score += 1;
  return Math.min(score, 5);
}

function hasPaymentPressure(text: string): boolean {
  return /\bpay\b|payment|send\s+money|wire|transfer|gift\s*card|bitcoin|crypto|zelle|venmo|cash\s*app|fee|fine|debt|invoice|refund\s+claim|collect|\bmoney\b|deposit|e-?\s*transfer|\betransfer\b|\binterac\b|\bpayer\b|paiement|virement|frais\b|\bamende\b|facture|argent|carte(?:-|\s)cadeau|crypto(?:monnaie)?/i.test(
    text
  );
}

function detectPaymentIntent(text: string): string {
  if (
    /otp|one[-\s]?time|verification\s+code|code\s+de\s+vérification|enter\s+code\s+to|confirm\s+with\s+code|2fa|two[-\s]?factor/i.test(
      text
    ) &&
    /login|sign\s*in|account|connexion|compte/i.test(text)
  )
    return "credential_to_enable_payment";
  if (/\bsend\b\s+(?:a\s+)?deposit\b|\bdeposit\b|reserve\s+with\s+payment/i.test(text))
    return "direct_payment_request";
  if (
    /\bwant(?:ed|s)?\s+me\s+to\s+pay\b|\bwanting\s+me\s+to\s+pay\b|\bpay\s+them\b|\bsomeone\s+.*\bpay\b|\basked\s+me\s+to\s+pay\b|\btold\s+me\s+to\s+pay\b/i.test(
      text
    )
  )
    return "direct_payment_request";
  if (
    /\bpay\s+cash\b|\btelling\s+me\s+to\s+pay\b|\bask(?:ed|ing)\s+me\s+to\s+pay\b|\btold\s+me\s+to\s+pay\b|send\s+(?:me\s+)?cash/i.test(
      text
    )
  )
    return "direct_payment_request";
  if (
    /claim\s+(your\s+)?(prize|reward|refund)|you('ve|\s+have)\s+won|redeem\s+(your\s+)?(gift|prize)|réclamer\s+(votre\s+)?(prix|récompense)|vous\s+avez\s+gagné/i.test(
      text
    )
  )
    return "claim_reward_or_refund";
  if (
    /fine|debt|collection|overdue|unpaid|court\s+fee|penalty|owed\s+balance|amende|frais|impayé|pénalit|recouvrement/i.test(
      text
    )
  )
    return "fee_or_debt_pressure";
  if (
    /subscription|billing|invoice|payment\s+failed|renew\s+(your|the)\s+account|account\s+on\s+hold|abonnement|facturation|facture|paiement\s+refusé|renouveler\s+(votre\s+)?compte|compte\s+en\s+attente/i.test(
      text
    )
  )
    return "billing_or_account_resolution";
  if (
    /send\s+money|wire\s+funds|send\s+bitcoin|buy\s+gift\s+cards|pay\s+with|transfer\s+to\s+this|envoyer\s+(de\s+)?l'argent|virement|acheter\s+des\s+cartes?\s+cadeau|\bpayer\b\s+avec/i.test(
      text
    )
  )
    return "direct_payment_request";
  if (/\bpay\s+for\b|\basked\s+me\s+to\s+pay\b|\bon\s+vous\s+demande\s+de\s+payer\b/i.test(text))
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
  return /password|ssn|sin\b|nas\b|numéro\s+d'assurance\s+sociale|social\s+security|login|credentials|verify.*identity|confirm.*account|otp|verification\s+code|mot\s+de\s+passe|code\s+de\s+vérification|connexion|ouvrir\s+(?:une\s+)?session|confirmer.*compte/i.test(
    text
  );
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
    /\bact\s+now\b/.test(text) ||
    /\b(cliquez|confirmer|vérifier|connectez|appelez|répondez|complétez|validez|mettre\s+à\s+jour)\b/i.test(text);
  const urgency_detected =
    /\burgent\b|\bimmediately\b|\bright\s+now\b|\bnow\b|\btoday\b|final\s+notice|action\s+required|\bact\s+now\b|urgent|immédiat|immédiatement|maintenant|aujourd'hui|dernier\s+avis|action\s+requise|sans\s+délai/i.test(
      text
    );
  const threat_detected =
    /\b(?:re)?strict(?:ed|ion)?s?\b|\bsuspension\b|\bsuspended\b|\blocked\b|\bdisabled\b|\bpenalt(?:y|ies)\b|\boverdue\b|\benforcement\b|final\s+warning|avoid\s+(?:restriction|penalt)|restore\s+access|account\s+(?:at\s+risk|will\s+be\s+(?:closed|suspended))|will\s+be\s+(?:closed|suspended)|suspendu|fermé|verrouill|bloqué|pénalit|restriction|compte\s+sera/i.test(
      text
    );
  const authority_keyword_detected =
    /\bcra\b|\birs\b|\b(?:arc)\b|tax|government|justice|\bbank\b|banque|account\s+support|official\s+notice|avis\s+officiel|gouvernement/.test(text);
  const delivery_keyword_detected =
    /\bpackage\b|\bcourier\b|\bdelivery\b|\bredelivery\b|\bparcel\b|\btracking\b|\bcolis\b|livraison|suivi|postes\s+canada/.test(text);
  const financial_keyword_detected =
    /\bbank\b|\bbanque\b|\bcredit\b|\bpayment\b|\bpaiement\b|\bbilling\b|\btransfer\b|\binvoice\b|\bfacture\b|\bvirement\b/.test(text);
  const credential_request_detected =
    /\bpassword\b|\bcode\b|\botp\b|\blogin\b|verify\s+account|confirmation\s+code|mot\s+de\s+passe|code\s+de\s+vérification|connexion|confirmer\s+votre\s+identité/.test(text);
  const reward_keyword_detected =
    /\bprize\b|\breward\b|\bwon\b|\bwinner\b|\bredeem\b|\bprix\b|\bgagné\b|\bréclamer\b|\bloterie\b/.test(text);
  const account_verification_detected =
    /verify\s+your\s+account|account\s+verification|confirm\s+your\s+identity|vérifier\s+votre\s+compte|vérification\s+du\s+compte|confirmer\s+votre\s+identité/.test(text);

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

  if (riskTier === "high") return "structured_signal";
  if (riskTier === "medium" || urgency >= 2 || threat >= 1) return "weak_signal";
  if (
    paymentIntent === "unknown" &&
    hasPaymentPressure(text) &&
    (narrative === "unknown" || narrative === "none")
  )
    return "structured_signal";
  if (narrative === "unknown" && (urgency >= 1 || hasPaymentPressure(text))) return "structured_signal";

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
    /immediate|urgent|asap|act\s+now|within\s+\d+\s*(hour|minute|day)|expires?\s+(today|soon)|immédiat|immédiatement|dans\s+\d+\s*(heures?|minutes?|jours?)|expire|dernier\s+délai|action\s+requise/i.test(
      text
    ) ||
    /arrest|legal\s+action|lawsuit|warrant|police|jail|prison|arrestation|mandat|poursuite|tribunal/.test(text) ||
    /suspend|close.*account|lose\s+access|terminate.*service|locked\s+out|suspendre|fermer.*compte|perdre\s+l'accès|verrouill|compte\s+sera/i.test(
      text
    );

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
  semanticPrimary: string | null,
  platformLang: "en" | "fr",
  inputQuality: { url_only: boolean; very_short: boolean; message_like: boolean },
  riskTier: string,
  aiParseFallback: boolean,
  linkArtifact: LinkArtifact | null,
  refinementSemanticsBoost: boolean
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
    const fullLower = messageText.toLowerCase();
    const semTrim = (semanticPrimary ?? "").trim();
    const useSemantic = Boolean(refinementSemanticsBoost && semTrim.length > 0);
    const iqForCq = useSemantic ? classifyInputQuality(semTrim) : inputQuality;
    const rawForCq = useSemantic ? semTrim : messageText;
    let contextQ = assessContextQuality(rawForCq, iqForCq);
    if (refinementSemanticsBoost && (contextQ === "thin" || contextQ === "unknown")) {
      contextQ = "partial";
    }
    if (refinementSemanticsBoost && (contextQ === "fragment" || contextQ === "thin")) {
      contextQ = "partial";
    }

    const textSemantic = useSemantic ? semTrim.toLowerCase() : fullLower;
    const signalText =
      !useSemantic && contextQ === "fragment" && linkArtifact
        ? textForLinkFragmentHeuristics(messageText, linkArtifact)
        : textSemantic;

    const micro_signals = extractMicroSignals(messageText, textSemantic);
    const narrative_category = detectNarrativeCategory(textSemantic, contextQ);
    let channel_type = detectChannelType(fullLower, messageText, inputQuality, micro_signals);
    let authority_type = detectAuthorityType(textSemantic, contextQ);
    if (authority_type === "none" && micro_signals.authority_keyword_detected) authority_type = "unknown";
    const payment_intent = detectPaymentIntent(signalText);
    const payment_method = detectPaymentMethod(textSemantic, contextQ);
    const escalation_pattern = detectEscalationPattern(textSemantic, contextQ);
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
    const commLike = isCommunicationLike(textSemantic, micro_signals);

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
      !refinementSemanticsBoost &&
      riskTier === "low" &&
      richContext &&
      (intel_state === "unknown" || intel_state === "no_signal") &&
      isBenignRoutineLowRisk(textSemantic, micro_signals)
    ) {
      intel_state = "no_signal";
      gatedDims.narrative_category = "none";
      gatedDims.authority_type = "none";
      gatedDims.payment_method = "none";
      gatedDims.escalation_pattern = "none";
    }

    if (
      !refinementSemanticsBoost &&
      riskTier === "low" &&
      richContext &&
      intel_state === "unknown" &&
      ((micro_signals.has_action_request &&
        (micro_signals.urgency_detected || micro_signals.threat_detected)) ||
        (micro_signals.threat_detected && micro_signals.credential_request_detected))
    ) {
      intel_state = "structured_signal";
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

function intelSlotMissing(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v !== "string") return true;
  const s = v.trim();
  return s === "" || s === "unknown" || s === "none";
}

/**
 * Deterministic fills from refined user_context_text when enrichment/legacy left slots empty.
 * Small cue set only — not a full mapping layer.
 */
function applyRefinedContextCueBoost(intel: Record<string, unknown>, userLower: string): void {
  const u = userLower.trim();
  if (!u) return;

  const payCue =
    /\bpay\b|\bpayment\b|\bcash\b|\bmoney\b|send\s+money|\btransfer\b|\bfee\b|\bdeposit\b|e-?\s*transfer|\betransfer\b|\binterac\b/i.test(
      u
    );
  const credCue =
    /\blog\s*in\b|\blogin\b|\bsign\s*in\b|\bverify\b|\baccount\b|\bpassword\b|\bblocked\b|\bsuspended\b/i.test(u);
  const authCue =
    /\bbank\b|\brbc\b|\bdesjardins\b|\bpaypal\b|\bcra\b|\bmto\b|service\s+ontario|\bpolice\b|\bgovernment\b/i.test(u);

  if (payCue && intelSlotMissing(intel.payment_intent)) {
    intel.payment_intent = "direct_payment_request";
  }
  if (payCue && intelSlotMissing(intel.requested_action)) {
    intel.requested_action = "pay_money";
  }
  if (payCue && intelSlotMissing(intel.threat_stage)) {
    intel.threat_stage = "payment_extraction";
  }
  if (credCue && intelSlotMissing(intel.requested_action) && !payCue) {
    intel.requested_action = "submit_credentials";
  }
  if (credCue && intelSlotMissing(intel.threat_stage) && !payCue) {
    intel.threat_stage = "credential_capture";
  }
  if (authCue && intelSlotMissing(intel.authority_type)) {
    if (/\bcra\b|\bmto\b|service\s+ontario|\bpolice\b|\bgovernment\b/i.test(u)) {
      intel.authority_type = "government";
    } else if (/\bbank\b|\brbc\b|\bdesjardins\b|\bpaypal\b/i.test(u)) {
      intel.authority_type = "financial_institution";
    }
  }
}

function buildStructuredReconciliationCorpus(parts: (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .join("\n")
    .toLowerCase();
}

/** Payment language in AI summary, signals, or submission text (conservative, small rules). */
function corpusIndicatesPayment(low: string): boolean {
  if (hasPaymentPressure(low)) return true;
  return /\bsend\s+money\b|asks?\s+you\s+to\s+send|wire\s+(money|funds)|e-?\s*transfer|interac\s+transfer|demand(?:s|ed)?\s+payment|request(?:s|ed)?\s+payment|pay\s+them|pay\s+for\b|transfer\s+funds/i.test(
    low
  );
}

function corpusIndicatesCredential(low: string): boolean {
  return /\blog\s*in\b|\blogin\b|\bsign\s*in\b|\bpassword\b|verify\s+your\s+account|enter\s+your\s+password|submit\s+credentials/i.test(
    low
  );
}

function corpusIndicatesLinkPressure(low: string): boolean {
  return /\bclick\s+(the\s+)?link\b|\bopen\s+(the\s+)?link\b|\bfollow\s+(the\s+)?link\b|tap\s+here|use\s+the\s+link|https?:\/\/|www\./i.test(
    low
  );
}

function corpusIndicatesWeakStrangerContact(low: string): boolean {
  return /\bstranger\b|\bwhatsapp\b|\bsms\b|\btext\s+message\b|\bmessenger\b|facebook\s+messenger|\btelegram\b|\bsignal\b|unknown\s+sender|unknown\s+person|don'?t\s+know\s+who|don'?t\s+know\s+them\b|someone\s+i\s+don'?t\s+know\b|person\s+i\s+don'?t\s+know\b|from\s+a\s+stranger|never\s+met|random\s+number|out\s+of\s+the\s+blue|initial\s+contact|vague\s+request|message\s+from\s+someone\s+i\s+don'?t|got\s+this\s+from\s+a\s+stranger\b/i.test(
    low
  );
}

/** Explicit messaging-app names for social-lure OR-gate (not vague “message” alone). */
function corpusMessagingAppCue(low: string): boolean {
  return /\bwhatsapp\b|wa\.me\b|facebook\s+messenger|\bmessenger\b|\btelegram\b|\bsignal\b|\bimessage\b|\bwechat\b|\bdiscord\b/i.test(low);
}

/** Vague click/lure wording (intent only; must pair with stranger OR messaging_app cue). */
function corpusIndicatesVagueLurePrompt(low: string): boolean {
  return /\bcheck\s+this\s+out\b|\bcheck\s+this\b|\blook\s+at\s+this(?:\s+link)?\b|\bopen\s+this(?:\s+link)?\b|\bsee\s+this\b|\btake\s+a\s+look\b|\bhave\s+a\s+look\b|\blook\s+here\b/i.test(
    low
  );
}

function refinedContextPayCues(low: string): boolean {
  return /\bpay\b|\bcash\b|send\s+money|\btransfer\b|\bfee\b/i.test(low);
}

function corpusIndicatesUrgency(low: string): boolean {
  return /\burgent\b|\bimmediately\b|\basap\b|\bright\s+now\b|\btoday\b|act\s+now|final\s+notice|deadline|expires?\s+(today|soon)|within\s+\d+\s*(hour|minute)/i.test(
    low
  );
}

function authorityTypeConcrete(v: unknown): boolean {
  const s = String(v ?? "").trim();
  return s.length > 0 && s !== "none" && s !== "unknown";
}

/**
 * Minimum risk tiers: cautious defaults when structured/corpus signals are present.
 * Does not replace applyRiskReconciliation; runs after it as a floor.
 */
function applyRiskTierCalibrationFloors(
  tier: "low" | "medium" | "high",
  intel: Record<string, unknown>,
  corpusLower: string,
  opts: { isInsufficientContext: boolean; refined: boolean; hasLinkArtifact: boolean }
): "low" | "medium" | "high" {
  let t = tier;

  if (opts.isInsufficientContext && !opts.refined) {
    return t;
  }

  const benignPay = corpusBenignPayment(corpusLower);
  const pi = String(intel.payment_intent ?? "none");
  const hasPayIntent = pi !== "none" && pi !== "unknown" && pi !== "";
  const refinedPay = opts.refined && refinedContextPayCues(corpusLower) && !benignPay;
  const corpusPay = corpusIndicatesPayment(corpusLower) && !benignPay;

  if (hasPayIntent || refinedPay || corpusPay) {
    if (t === "low") t = "medium";
  }

  if (
    !opts.isInsufficientContext &&
    (corpusIndicatesCredential(corpusLower) || String(intel.requested_action ?? "") === "submit_credentials")
  ) {
    if (t === "low" || t === "medium") t = "high";
  }

  if (authorityTypeConcrete(intel.authority_type) && (corpusIndicatesUrgency(corpusLower) || Number(intel.urgency_score ?? 0) >= 2)) {
    if (t === "low") t = "medium";
  }

  if (String(intel.intel_state ?? "") === "weak_signal" && opts.hasLinkArtifact && t === "low") {
    t = "medium";
  }

  if (
    /\bparking\s+(fine|ticket|violation)\b|\bcontravention\b|\bstationnement\b|\bgovernment\s+fine\b/i.test(corpusLower) &&
    (corpusPay || hasPayIntent) &&
    !benignPay
  ) {
    if (t === "low") t = "medium";
    if (t === "medium" && /\bcra\b|\bmto\b|service\s+ontario|\bpolice\b/i.test(corpusLower)) {
      t = "high";
    }
  }

  /* Post-harmonize intel floors only (no enrichment coupling). */
  const narCat = String(intel.narrative_category ?? "");
  const narFam = String(intel.narrative_family ?? "");
  const reqAct = String(intel.requested_action ?? "");
  const payIntentSlot = String(intel.payment_intent ?? "none");

  if (narCat === "financial_phishing" && reqAct === "submit_credentials") {
    t = "high";
  }
  if (
    (narCat === "government_impersonation" || narFam === "government_impersonation") &&
    payIntentSlot === "direct_payment_request" &&
    reqAct === "pay_money"
  ) {
    t = "high";
  }
  if (payIntentSlot === "direct_payment_request" && reqAct === "pay_money") {
    if (t === "low") t = "medium";
  }
  if (
    (narFam === "social_engineering_opener" || narCat === "social_engineering_opener") &&
    reqAct === "click_link"
  ) {
    if (t === "low") t = "medium";
  }

  return t;
}

function applyRiskFloorRecommendation(
  current: "low" | "medium" | "high",
  floor?: "medium" | "high"
): "low" | "medium" | "high" {
  if (!floor) return current;
  if (floor === "high") return "high";
  if (floor === "medium" && current === "low") return "medium";
  return current;
}

function confidenceCalibrationRank(level: string): number {
  if (level === "high") return 2;
  if (level === "medium") return 1;
  return 0;
}

function confidenceLevelFromRank(r: number): "low" | "medium" | "high" {
  if (r >= 2) return "high";
  if (r >= 1) return "medium";
  return "low";
}

/**
 * Post-structured intel confidence only. Does not read risk_tier.
 * Caps at low when context is insufficient; raises conservatively from enrichment baseline.
 */
function applyConfidenceCalibration(
  intel: Record<string, unknown>,
  ctx: { isInsufficientContext: boolean }
): void {
  const state = String(intel.intel_state ?? "");
  if (ctx.isInsufficientContext || state === "insufficient_context") {
    intel.confidence_level = "low";
    return;
  }

  const cq = String(intel.context_quality ?? "");
  const ra = String(intel.requested_action ?? "");
  let r = confidenceCalibrationRank(String(intel.confidence_level ?? "low"));

  if (state === "structured_signal" && (cq === "partial" || cq === "full")) {
    r = Math.max(r, 1);
  }
  if (ra === "pay_money" || ra === "submit_credentials") {
    r = Math.max(r, 1);
  }
  if (
    authorityTypeConcrete(intel.authority_type) &&
    (ra === "pay_money" || ra === "submit_credentials" || ra === "click_link")
  ) {
    r = Math.max(r, 2);
  }

  if (state === "weak_signal" || cq === "thin") {
    r = Math.min(r, 1);
  }

  intel.confidence_level = confidenceLevelFromRank(r);
}

/** When context is thin/fragment and confidence is low, avoid strong intel + high risk (MSP noise). */
type ThinLowConfidenceGuardrailMeta = {
  applied: boolean;
  original_risk_tier?: string;
  original_intel_state?: string;
  context_quality?: string;
  confidence_level?: string;
};

function applyThinLowConfidenceGuardrail(
  intel: Record<string, unknown>,
  riskTier: { current: "low" | "medium" | "high" }
): ThinLowConfidenceGuardrailMeta {
  const cq = String(intel.context_quality ?? "");
  const conf = String(intel.confidence_level ?? "low");
  if (!["thin", "fragment"].includes(cq) || conf !== "low") {
    return { applied: false };
  }

  const origState = String(intel.intel_state ?? "");
  const origRisk = riskTier.current;
  let changed = false;

  if (origState === "structured_signal") {
    intel.intel_state = "weak_signal";
    changed = true;
  }
  if (origRisk === "high") {
    riskTier.current = "medium";
    changed = true;
  }

  if (!changed) return { applied: false };

  return {
    applied: true,
    original_risk_tier: origRisk,
    original_intel_state: origState,
    context_quality: cq,
    confidence_level: conf,
  };
}

function corpusBenignPayment(low: string): boolean {
  return /\bsplit\b|\breimburse\b|\bpaid\s+you\s+back\b|\bfriend\s+owed\b|\bdinner\b|\brent\s+split\b/i.test(low);
}

/**
 * Final consistency pass: structured intel must reflect payment/credential/link cues
 * visible in summary, signals, or text. Keeps rules deterministic and small.
 */
function reconcileStructuredIntelConsistency(
  intel: Record<string, unknown>,
  corpusLower: string,
  opts: { refined: boolean; contextQuality: string; hasLinkArtifact: boolean }
): void {
  const pay = corpusIndicatesPayment(corpusLower);
  const cred = corpusIndicatesCredential(corpusLower);
  const pi = String(intel.payment_intent ?? "none");

  if (pay && (pi === "none" || pi === "")) {
    intel.payment_intent = "direct_payment_request";
    intel.payment_request = true;
  } else if (pay && pi === "unknown") {
    intel.payment_intent = "direct_payment_request";
    intel.payment_request = true;
  }

  if (pay) {
    intel.payment_request = true;
  }

  const piAfter = String(intel.payment_intent ?? "none");
  if (pay && !corpusBenignPayment(corpusLower)) {
    intel.requested_action = "pay_money";
  } else if (
    cred &&
    intelSlotMissing(intel.requested_action) &&
    (piAfter === "none" || piAfter === "unknown")
  ) {
    intel.requested_action = "submit_credentials";
  } else if (opts.hasLinkArtifact && corpusIndicatesLinkPressure(corpusLower) && intelSlotMissing(intel.requested_action)) {
    intel.requested_action = "click_link";
  }

  if (pay && (intelSlotMissing(intel.threat_stage) || String(intel.threat_stage) === "unclear")) {
    intel.threat_stage = "payment_extraction";
  } else if (
    cred &&
    !pay &&
    (intelSlotMissing(intel.threat_stage) || String(intel.threat_stage) === "unclear")
  ) {
    intel.threat_stage = "credential_capture";
  }

  if (/\bcra\b|\bmto\b|service\s+ontario|\bpolice\b|\bgovernment\b|\birs\b/i.test(corpusLower) && intelSlotMissing(intel.authority_type)) {
    intel.authority_type = "government";
  } else if (/\bbank\b|\brbc\b|\bdesjardins\b|\bpaypal\b|\binterac\b/i.test(corpusLower) && intelSlotMissing(intel.authority_type)) {
    intel.authority_type = "financial_institution";
  }

  const cq = opts.contextQuality;
  if (opts.refined && ["partial", "full", "thin"].includes(cq) && String(intel.intel_state) === "insufficient_context") {
    intel.intel_state = "weak_signal";
  }

  if (
    opts.refined &&
    corpusIndicatesWeakStrangerContact(corpusLower) &&
    (String(intel.intel_state) === "no_signal" || String(intel.intel_state) === "unknown")
  ) {
    intel.intel_state = "weak_signal";
  }

  if (pay && !corpusBenignPayment(corpusLower) && (String(intel.intel_state) === "no_signal" || String(intel.intel_state) === "unknown")) {
    intel.intel_state = "weak_signal";
  }
}

/** Strong payment wording → direct_payment_request + structured analysis (not none/unknown). */
const STRONG_PAYMENT_LEXICON =
  /\bpay\b|\bdeposit\b|send\s+money|\bsend\b\s+(?:a\s+)?deposit\b|\btransfer\b|reserve\s+with\s+payment|\bfee\b|\bfine\b/i;

function corpusStrongPaymentLexicon(low: string): boolean {
  return STRONG_PAYMENT_LEXICON.test(low) && !corpusBenignPayment(low);
}

/**
 * Uses full corpus (submission + summary + signals) to upgrade intel to structured_signal,
 * direct payment intent, channel, and government narrative when cues are present.
 * Runs after reconcileStructuredIntelConsistency so refined context is fully reflected.
 */
function applyStructuredInterpretationPass(
  intel: Record<string, unknown>,
  corpusLower: string,
  opts: { refined: boolean; hasLinkArtifact: boolean }
): void {
  const strongPay = corpusStrongPaymentLexicon(corpusLower);

  if (strongPay) {
    intel.payment_intent = "direct_payment_request";
    intel.payment_request = true;
    intel.requested_action = "pay_money";
    intel.threat_stage = "payment_extraction";
    intel.intel_state = "structured_signal";
  }

  const parkingGovPay =
    strongPay &&
    /\bparking\s+(fine|ticket|violation)\b|\bcontravention\b|\bstationnement\b|\bamende\b|\bmto\b|\bcra\b/i.test(
      corpusLower
    );
  if (parkingGovPay) {
    intel.narrative_category = "government_impersonation";
    intel.narrative_family = "government_impersonation";
    if (intelSlotMissing(intel.authority_type)) {
      intel.authority_type = "government";
    }
  }

  const socialLureGate =
    !strongPay &&
    !corpusBenignPayment(corpusLower) &&
    corpusIndicatesVagueLurePrompt(corpusLower) &&
    (corpusIndicatesWeakStrangerContact(corpusLower) || corpusMessagingAppCue(corpusLower));

  const strongActionBlocksSocialLure =
    String(intel.requested_action ?? "").trim() === "pay_money" ||
    String(intel.requested_action ?? "").trim() === "submit_credentials";

  if (socialLureGate && !strongActionBlocksSocialLure) {
    intel.intel_state = "structured_signal";
    intel.requested_action = "click_link";
    if (intelSlotMissing(intel.threat_stage) || String(intel.threat_stage) === "unclear") {
      intel.threat_stage = "initial_lure";
    }
    intel.narrative_family = "social_engineering_opener";
    intel.narrative_category = "social_engineering_opener";
  }

  const hasActionVerb = /\b(click|check|tap|open|pay|send|transfer|login|log\s*in|sign\s*in|verify)\b/i.test(
    corpusLower
  );
  const linkAction =
    opts.hasLinkArtifact && /\b(click|check|tap|open|login|log\s*in|sign\s*in|verify)\b/i.test(corpusLower);
  const strangerAction = corpusIndicatesWeakStrangerContact(corpusLower) && hasActionVerb;

  if ((linkAction || strangerAction) && !corpusBenignPayment(corpusLower)) {
    intel.intel_state = "structured_signal";
    if (!strongPay && !socialLureGate && linkAction && intelSlotMissing(intel.requested_action)) {
      intel.requested_action = "click_link";
    }
    if (!strongPay && strangerAction && (intelSlotMissing(intel.threat_stage) || String(intel.threat_stage) === "unclear")) {
      intel.threat_stage = "initial_lure";
    }
  }

  // Native SMS vs messaging_app: prefer named apps when present ("texted me on WhatsApp" → messaging_app).
  if (
    /\bwhatsapp\b|wa\.me\b|facebook\s+messenger|\bmessenger\b|\btelegram\b|\bsignal\b|\bimessage\b|\bwechat\b|\bdiscord\b/i.test(
      corpusLower
    )
  ) {
    intel.channel_type = "messaging_app";
  } else if (/\bsms\b|\btext\s+message\b|\btexted\s+me\b|\bgot\s+a\s+text\b|\bvia\s+text\b/i.test(corpusLower)) {
    intel.channel_type = "sms";
  } else if (/^from:\s|^to:\s|^subject:\s/im.test(corpusLower)) {
    intel.channel_type = "email";
  }

  const pi = String(intel.payment_intent ?? "none");
  if (
    pi !== "none" &&
    pi !== "unknown" &&
    pi !== "" &&
    ["weak_signal", "unknown", "no_signal", "insufficient_context"].includes(String(intel.intel_state))
  ) {
    intel.intel_state = "structured_signal";
  }

  const cq = String(intel.context_quality ?? "");
  if (
    opts.refined &&
    ["partial", "full", "thin"].includes(cq) &&
    String(intel.intel_state) === "insufficient_context"
  ) {
    intel.intel_state =
      strongPay || linkAction || strangerAction || socialLureGate ? "structured_signal" : "weak_signal";
  }

  if (
    intelSlotMissing(intel.narrative_category) &&
    (strongPay || linkAction || strangerAction || socialLureGate) &&
    !parkingGovPay
  ) {
    if (corpusIndicatesCredential(corpusLower)) {
      intel.narrative_category = "financial_phishing";
      intel.narrative_family = "account_verification";
    }
  }
}

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
    console.error("[scan_persist_image] upload failed");
    return false;
  }
  const { error: updateError } = await supabase
    .from("scans")
    .update({ submission_image_path: objectPath })
    .eq("id", scanId);
  if (updateError) {
    console.error("[scan_persist_image_path] update failed");
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
  let user_context_text: string | undefined;
  let analysis_mode: "initial" | "refined" = "initial";
  let refinement_nonce: string | undefined;
  let refinement_parent_scan_id: string | undefined;

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
      user_context_text = body.user_context_text;
      analysis_mode = body.analysis_mode === "refined" ? "refined" : "initial";
      refinement_nonce = body.refinement_nonce;
      refinement_parent_scan_id = body.refinement_parent_scan_id;
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
      const contextTextField = formData.get("user_context_text");
      if (typeof contextTextField === "string") user_context_text = contextTextField;
      const analysisModeField = formData.get("analysis_mode");
      if (analysisModeField === "refined") analysis_mode = "refined";
      const nonceField = formData.get("refinement_nonce");
      if (typeof nonceField === "string") refinement_nonce = nonceField;
      const parentField = formData.get("refinement_parent_scan_id");
      if (typeof parentField === "string") refinement_parent_scan_id = parentField;

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
  const contextText = typeof user_context_text === "string" ? user_context_text.trim() : "";
  const isRefinedAnalysis = analysis_mode === "refined";
  const hasMeaningfulContext = contextText.replace(/[\s`'"()[\]{}<>.,;:!?-]/g, "").length >= 8;

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

    if (!contentText || !passesScanTextAdmission(contentText)) {
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
    if (!passesScanTextAdmission(contentText)) {
      logEvent("text_too_short", "info", "scan_api");
      return reject(
        "text_too_short",
        language === "fr"
          ? "Message trop court ou pas assez de détail pour analyser."
          : "Message too short or not enough detail to analyze."
      );
    }
  }

  if (isRefinedAnalysis && !hasMeaningfulContext) {
    return reject(
      "invalid_refinement_context",
      language === "fr"
        ? "Veuillez ajouter plus de contexte."
        : "Please add a bit more context."
    );
  }

  const analysisText =
    isRefinedAnalysis && hasMeaningfulContext
      ? `${contextText}\n\n[Original submission]\n${contentText}`
      : contentText;

  /* ---------- Duplicate suppression ---------- */
  if (!isRefinedAnalysis && isRepeatedScan(ip, contentText)) {
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
      messageText: analysisText,
      language,
      source,
    });

    /* ---------- Input quality classification ---------- */
    const inputQuality = classifyInputQuality(analysisText);
    const riskTier = result.risk_tier ?? "low";
    const linkExtracted = extractLinkArtifacts(contentText);
    const link_intel = linkExtracted ? linkIntelFromArtifact(linkExtracted) : null;
    if (link_intel) {
      if (link_intel.primary.flags.shortened) {
        try {
          const expansion = await expandUrl(link_intel.primary.url);
          link_intel.expansion = expansion;
        } catch {
          link_intel.expansion = { status: "failed" };
        }
      } else {
        link_intel.expansion = { status: "skipped" };
      }

      let urlForWebRisk: string | null = null;
      let webRiskCheckedType: "expanded" | "primary" | null = null;
      if (link_intel.primary.flags.shortened) {
        const exp = link_intel.expansion;
        if (
          exp &&
          exp.status === "expanded" &&
          typeof exp.final_url === "string" &&
          exp.final_url.trim().length > 0
        ) {
          urlForWebRisk = exp.final_url.trim();
          webRiskCheckedType = "expanded";
        }
      } else {
        urlForWebRisk =
          typeof link_intel.primary.url === "string" ? link_intel.primary.url.trim() : null;
        if (urlForWebRisk) webRiskCheckedType = "primary";
      }

      if (urlForWebRisk && webRiskCheckedType) {
        const webRisk = await lookupWebRisk(urlForWebRisk);
        link_intel.web_risk = {
          status: webRisk.status,
          checked_url_type: webRiskCheckedType,
          checked_at: new Date().toISOString(),
        };
      } else {
        link_intel.web_risk = {
          status: "skipped",
          checked_at: new Date().toISOString(),
        };
      }
    }
    const linkArtifact = link_intel ? linkArtifactFromLinkIntel(link_intel) : null;
    const refinementSemanticsBoost = isRefinedAnalysis && hasMeaningfulContext;
    const semanticPrimary =
      refinementSemanticsBoost && contextText.trim().length > 0 ? contextText.trim() : null;
    const enrichmentMessageText = refinementSemanticsBoost
      ? `${contextText.trim()}\n\n${contentText}`
      : contentText;
    const mapIntelRawText = semanticPrimary ? `${semanticPrimary}\n${contentText}` : analysisText;

    if (ai_parse_fallback) {
      logEvent("ai_parse_fallback", "warning", "scan_api", {
        used_hard_fallback: usedFallback,
      });
    }

    const { intel_features: rawLegacyIntel } = extractIntelFeatures(
      result,
      analysisText,
      semanticPrimary,
      language,
      inputQuality,
      riskTier,
      ai_parse_fallback,
      linkArtifact,
      refinementSemanticsBoost
    );

    const legacyIntel: Record<string, any> = {
      ...rawLegacyIntel,
      micro_signals: {
        ...rawLegacyIntel.micro_signals,
        link_shortened_detected: Boolean(linkArtifact?.is_shortened),
      },
    };

    const enrichment = buildScanEnrichment({
      messageText: enrichmentMessageText,
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
        ...(link_intel && linkArtifact
          ? { link_intel, link_artifact: linkArtifact, link_present: true }
          : {}),
        ...(isRefinedAnalysis
          ? {
              context_refined: true,
              user_context_length: contextText.length,
              user_context_text: refinementSemanticsBoost
                ? contextText.trim().slice(0, 8000)
                : undefined,
              analysis_mode: "refined",
              refinement_nonce: refinement_nonce ?? null,
            }
          : {}),
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
      mapIntelRawText
    );

    if (refinementSemanticsBoost) {
      applyRefinedContextCueBoost(intel_features as Record<string, unknown>, contextText.toLowerCase());
    }
    if (
      refinementSemanticsBoost &&
      ["fragment", "unknown"].includes(String(intel_features.context_quality))
    ) {
      (intel_features as Record<string, unknown>).context_quality = "partial";
    }

    if (
      refinementSemanticsBoost &&
      String(intel_features.intel_state) === "insufficient_context" &&
      !["fragment", "unknown"].includes(String(intel_features.context_quality))
    ) {
      (intel_features as Record<string, unknown>).intel_state = "weak_signal";
    }

    if (isRefinedAnalysis && refinement_parent_scan_id) {
      (intel_features as Record<string, unknown>).refinement_parent_scan_id = refinement_parent_scan_id;
    }

    /* ---------- Trust-floor guardrail: cap risk for insufficient/fragment context ---------- */
    let finalRiskTier = riskTier as "low" | "medium" | "high";
    let finalSummary: string | null = result.summary_sentence ?? null;

    const skipInsufficientTrustFloor = refinementSemanticsBoost;
    const isInsufficientContext =
      !skipInsufficientTrustFloor &&
      (enrichment.submissionRoute === "insufficient_context" ||
        enrichment.contextQuality === "fragment");

    if (isInsufficientContext) {
      finalRiskTier = riskTier === "high" ? "medium" : (riskTier as "low" | "medium");
      if (linkArtifact && enrichment.contextQuality === "fragment") {
        finalSummary = summaryForLinkOnlyFragment(linkArtifact, language);
      } else {
        finalSummary = getInsufficientContextSummary(language);
      }
    } else {
      const aiSum = String(finalSummary ?? "").trim();
      const enrichmentSum = enrichment.summary?.trim() ?? "";
      if (!aiSum) {
        finalSummary = enrichmentSum || null;
      } else if (
        refinementSemanticsBoost &&
        enrichmentSum.length > 24 &&
        /\bnot enough context\b|limited context|link only|insufficient to classify|classify this reliably|ne\s+contient\s+qu'un\s+lien/i.test(
          aiSum
        )
      ) {
        finalSummary = enrichment.summary ?? null;
      }
      if (!finalSummary || String(finalSummary).trim() === "") {
        finalSummary = enrichment.summary ?? null;
      }
    }

    const finalSignals = normalizeSignalsForInsufficientLinkContext(
      result.signals,
      isInsufficientContext,
      linkArtifact,
      analysisText,
      language
    );

    const signalEvidenceChunk = Array.isArray(result.signals)
      ? (result.signals as { evidence?: string }[])
          .map((s) => String(s?.evidence ?? "").trim())
          .filter(Boolean)
          .join("\n")
      : "";

    const reconciliationCorpus = buildStructuredReconciliationCorpus([
      analysisText,
      semanticPrimary,
      refinementSemanticsBoost ? contextText : null,
      typeof result.summary_sentence === "string" ? result.summary_sentence : null,
      finalSummary,
      signalEvidenceChunk,
    ]);

    reconcileStructuredIntelConsistency(intel_features as Record<string, unknown>, reconciliationCorpus, {
      refined: refinementSemanticsBoost,
      contextQuality: String(intel_features.context_quality ?? "unknown"),
      hasLinkArtifact: Boolean(linkArtifact),
    });

    applyStructuredInterpretationPass(intel_features as Record<string, unknown>, reconciliationCorpus, {
      refined: refinementSemanticsBoost,
      hasLinkArtifact: Boolean(linkArtifact),
    });
    Object.assign(intel_features, harmonizeNarratives(intel_features as Record<string, unknown>));

    const abuseInterpretation = buildAbuseInterpretation({
      intel: intel_features as Record<string, unknown>,
      linkIntel: link_intel,
      rawText: contentText,
    });
    if (abuseInterpretation) {
      (intel_features as Record<string, unknown>).abuse_interpretation_v1 = abuseInterpretation;
    }

    if (!isInsufficientContext) {
      const reconAction = !intelSlotMissing(intel_features.requested_action)
        ? String(intel_features.requested_action)
        : enrichment.requestedAction;
      const reconThreat =
        !intelSlotMissing(intel_features.threat_stage) && String(intel_features.threat_stage) !== "unclear"
          ? String(intel_features.threat_stage)
          : enrichment.threatStage;
      finalRiskTier = applyRiskReconciliation(finalRiskTier, {
        narrativeFamily: enrichment.narrativeFamily,
        impersonationEntity: enrichment.impersonationEntity,
        requestedAction: reconAction,
        threatStage: reconThreat,
      });
    }

    finalRiskTier = applyRiskTierCalibrationFloors(finalRiskTier, intel_features as Record<string, unknown>, reconciliationCorpus, {
      isInsufficientContext,
      refined: refinementSemanticsBoost,
      hasLinkArtifact: Boolean(linkArtifact),
    });

    finalRiskTier = applyRiskFloorRecommendation(
      finalRiskTier,
      abuseInterpretation?.risk_boost_floor
    );

    applyConfidenceCalibration(intel_features as Record<string, unknown>, {
      isInsufficientContext,
    });

    const riskTierRef = { current: finalRiskTier };
    const thinLowGuardMeta = applyThinLowConfidenceGuardrail(
      intel_features as Record<string, unknown>,
      riskTierRef
    );
    finalRiskTier = riskTierRef.current;

    (intel_features as Record<string, unknown>).known_core_dimension_count = countKnownCoreDimensions(
      intel_features as Record<string, unknown>
    );

    const userVerdict =
      finalRiskTier === "high" ? "scam" : finalRiskTier === "medium" ? "suspicious" : "safe";

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

    /** Refined analysis always inserts a new row so shared canonical URLs stay stable. */
    const { data: scanData, error: scanError } = await supabase
      .from("scans")
      .insert(scanRow)
      .select("id")
      .single();

    const persisted = !scanError;
    let scanId = persisted ? (scanData?.id ?? null) : null;

    if (thinLowGuardMeta.applied && scanId) {
      const guardPayload = {
        scan_id: scanId,
        original_risk_tier: thinLowGuardMeta.original_risk_tier,
        original_intel_state: thinLowGuardMeta.original_intel_state,
        context_quality: thinLowGuardMeta.context_quality,
        confidence_level: thinLowGuardMeta.confidence_level,
      };
      void logEvent("thin_low_confidence_guardrail", "info", "scan_api", guardPayload);
    }

    /* ---------- Insert raw_messages if opted in (atomic: rollback scan on failure) ---------- */
    let rawMessageError: string | null = null;
    if (!isRefinedAnalysis && rawOptIn && scanId) {
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
    console.error("SCAN_ANALYSIS_FAILED");
    return reject(
      "analysis_failed",
      language === "fr"
        ? "Erreur lors de l’analyse."
        : "Analysis failed."
    );
  }
}
