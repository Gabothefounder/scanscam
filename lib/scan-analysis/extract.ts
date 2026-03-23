/**
 * Rule-based feature extraction.
 * Simple, inspectable regex matching. Single-label only.
 */

import type {
  NarrativeFamily,
  ImpersonationEntity,
  RequestedAction,
  ThreatStage,
} from "./taxonomy";

export type ExtractInput = {
  messageText: string;
  contextQuality: string;
  submissionRoute: string;
};

export type ExtractResult = {
  narrativeFamily: NarrativeFamily;
  impersonationEntity: ImpersonationEntity;
  requestedAction: RequestedAction;
  threatStage: ThreatStage;
};

/**
 * Skip extraction when context is fragment/unknown, or when thin and not likely_scam.
 * Allow extraction for thin context when router has flagged likely_scam.
 */
function shouldSkipExtraction(ctx: string, route: string): boolean {
  if (ctx === "fragment" || ctx === "unknown") return true;
  if (ctx === "thin" && route !== "likely_scam") return true;
  return false;
}

// ---------------------------------------------------------------------------
// narrativeFamily: scam story type
// Order matters: first match wins. More specific before generic.
// ---------------------------------------------------------------------------

const NARRATIVE_RULES: { id: NarrativeFamily; test: RegExp }[] = [
  { id: "recovery_scam", test: /\brecover\b|funds?\s+recover|contact\s+recovery\b/i },
  { id: "social_engineering_opener", test: /\bwrong\s+number\b|sorry.*wrong\b|who\s+is\s+this\b|reconnect\b|long\s+time\s+no\b/i },
  { id: "law_enforcement", test: /\brcmp\b|royal\s+canadian\s+mounted|\bpolice\b|arrest\b|warrant\b|jail\b/i },
  { id: "government_impersonation", test: /\b(cra|arc|irs)\b|tax\s+(return|refund|debt)|revenue\s+canada|government\s+fine/i },
  { id: "account_verification", test: /\bverify\s+(your\s+)?account\b|account\s+suspend|unusual\s+activity|confirm\s+identity\b/i },
  { id: "delivery_scam", test: /\bpackage\b|delivery\b|courier\b|usps\b|fedex\b|ups\b|tracking\s+number\b|redeliver/i },
  { id: "employment_scam", test: /\bjob\b|work\s+from\s+home|easy\s+money|interview\s+position\b/i },
  { id: "reward_claim", test: /\bprize\b|winner\b|won\b|congratulations.*won|redeem\s+(your\s+)?(gift|prize)\b/i },
  { id: "investment_fraud", test: /\binvestment\b|crypto\b|bitcoin\b|forex\b|guaranteed\s+return\b/i },
];

function extractNarrativeFamily(
  text: string,
  contextQuality: string,
  submissionRoute: string
): NarrativeFamily {
  if (shouldSkipExtraction(contextQuality, submissionRoute)) return "unknown";
  const hit = NARRATIVE_RULES.find((r) => r.test.test(text));
  return hit ? hit.id : "unknown";
}

// ---------------------------------------------------------------------------
// impersonationEntity: who is being impersonated
// Canada-specific entities first, then generic.
// ---------------------------------------------------------------------------

const IMPERSONATION_RULES: { id: ImpersonationEntity; test: RegExp }[] = [
  { id: "cra", test: /\b(cra|arc)\b|revenue\s+canada\b/i },
  { id: "service_canada", test: /\bservice\s+canada\b/i },
  { id: "rcmp", test: /\brcmp\b|royal\s+canadian\s+mounted\b/i },
  { id: "canada_post", test: /\bcanada\s*post\b|canadapost\b/i },
  { id: "wealthsimple", test: /\bwealthsimple\b/i },
  { id: "generic_government", test: /\bgovernment\b|tax\s+agency\b|police\b|court\b|warrant\b/i },
  { id: "generic_financial", test: /\bbank\b|paypal\b|visa\b|mastercard\b|credit\s+union\b|financial\s+institution\b/i },
  { id: "generic_courier", test: /\bfedex\b|ups\b|usps\b|purolator\b|dhl\b|courier\b/i },
];

function extractImpersonationEntity(
  text: string,
  contextQuality: string,
  submissionRoute: string
): ImpersonationEntity {
  if (shouldSkipExtraction(contextQuality, submissionRoute)) return "unknown";
  const hit = IMPERSONATION_RULES.find((r) => r.test.test(text));
  return hit ? hit.id : "unknown";
}

// ---------------------------------------------------------------------------
// requestedAction: what the victim is pushed to do
// ---------------------------------------------------------------------------

const ACTION_RULES: { id: RequestedAction; test: RegExp }[] = [
  { id: "submit_credentials", test: /\bpassword\b|login\b|sign\s*in\b|otp\b|verification\s+code\b|verify\s+identity\b|enter\s+code\b/i },
  { id: "pay_money", test: /\bpay\b|send\s+money\b|wire\b|transfer\b|gift\s*card\b|bitcoin\b|etransfer\b|zelle\b|venmo\b/i },
  { id: "click_link", test: /\bclick\b|tap\b|open\s+link\b|visit\b|follow\s+link\b|https?:\/\//i },
  { id: "call_number", test: /\bcall\b|phone\b|dial\b|ring\s+us\b|reach\s+us\s+at\b|\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/ },
  { id: "reply_sms", test: /\breply\b|text\s+back\b|respond\b|message\s+us\b/i },
  { id: "download_app", test: /\bdownload\b|install\s+(the\s+)?app\b/i },
];

function extractRequestedAction(
  text: string,
  contextQuality: string,
  submissionRoute: string
): RequestedAction {
  if (shouldSkipExtraction(contextQuality, submissionRoute)) return "unknown";
  const hit = ACTION_RULES.find((r) => r.test.test(text));
  return hit ? hit.id : "none";
}

// ---------------------------------------------------------------------------
// threatStage: phase of the scam lifecycle
// ---------------------------------------------------------------------------

const THREAT_RULES: { id: ThreatStage; test: RegExp }[] = [
  { id: "post_loss_recovery", test: /\brecover\s+funds\b|contact\s+recovery\b|get\s+your\s+money\s+back\b/i },
  { id: "credential_capture", test: /\botp\b|verification\s+code\b|password\b|login\b|verify\s+account\b|confirm\s+identity\b/i },
  { id: "payment_extraction", test: /\bpay\b|send\s+money\b|wire\b|transfer\b|gift\s*card\b|fee\b|fine\b/i },
  { id: "initial_lure", test: /\bwrong\s+number\b|hey\b|hi\b|reconnect\b|long\s+time\b|prize\b|winner\b|you('ve|\s+have)\s+won\b/i },
];

function extractThreatStage(
  text: string,
  contextQuality: string,
  submissionRoute: string
): ThreatStage {
  if (shouldSkipExtraction(contextQuality, submissionRoute)) return "unclear";
  const hit = THREAT_RULES.find((r) => r.test.test(text));
  return hit ? hit.id : "unclear";
}

// ---------------------------------------------------------------------------
// Main extract function
// ---------------------------------------------------------------------------

export function extract(input: ExtractInput): ExtractResult {
  const text = input.messageText.toLowerCase();
  const ctx = input.contextQuality;
  const route = input.submissionRoute;

  return {
    narrativeFamily: extractNarrativeFamily(text, ctx, route),
    impersonationEntity: extractImpersonationEntity(text, ctx, route),
    requestedAction: extractRequestedAction(text, ctx, route),
    threatStage: extractThreatStage(text, ctx, route),
  };
}
