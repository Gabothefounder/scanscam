/**
 * Top-level submission routing and context assessment.
 * Routes to: likely_scam | ambiguous | test | insufficient_context
 *
 * Conservative logic: prefer ambiguous over likely_scam when unsure.
 * Do not introduce likely_legit yet.
 */

import type { ContextQuality, SubmissionRoute } from "./taxonomy";

export type ContextAssessmentInput = {
  messageText: string;
};

/**
 * Fragment: raw URL/domain only, or almost no semantic content
 * (e.g. URL-heavy with negligible surrounding text).
 */
function isFragmentContent(text: string): boolean {
  const trimmed = text.trim();
  if (/^(https?:\/\/\S+|www\.\S+)$/i.test(trimmed)) return true;
  // Very short and dominated by URL-like patterns
  if (trimmed.length < 40) {
    const nonUrl = trimmed.replace(/https?:\/\/\S+|www\.\S+/gi, "").replace(/\s/g, "");
    if (nonUrl.length < 5) return true;
  }
  return false;
}

/**
 * Assess how much usable context the message provides.
 * Practical, intuitive rules.
 */
export function assessContextQuality(
  input: ContextAssessmentInput
): ContextQuality {
  const trimmed = input.messageText.trim();
  const len = trimmed.length;
  const lines = trimmed.split(/\n/).filter((l) => l.trim().length > 0).length;

  // fragment: raw URL/domain only, almost no semantic content
  if (isFragmentContent(trimmed)) return "fragment";

  // thin: one short line with limited context
  if (lines <= 1 && len < 120) return "thin";

  // full: clearly structured message/email/SMS with enough content
  const hasEmailHeaders = /^from:\s|^to:\s|^subject:\s/im.test(trimmed);
  if (hasEmailHeaders && len > 200) return "full";
  if (lines >= 4 && len > 400) return "full";

  // partial: meaningful text but incomplete context
  if (lines >= 2 || len >= 150) return "partial";
  if (len >= 120) return "partial";

  return "unknown";
}

/**
 * Obvious scam cues used for likely_scam routing.
 * Conservative: only strong, well-known patterns.
 */
const OBVIOUS_SCAM_CUES = [
  /\b(cra|arc|irs)\b/i,
  /\btax\s+(return|refund|debt)\b/i,
  /\barrest|warrant|police|revenue\s+canada\b/i,
  /\bpackage|delivery|courier|usps|fedex|ups|tracking\s+number\b/i,
  /\baccount\s+suspend|verify\s+account|unusual\s+activity\b/i,
  /\bbank|credit\s+union|paypal\b/i,
  /\burgent|immediately|act\s+now|within\s+\d+\s*(hour|minute)\b/i,
  /\bsuspen\w*|close\s+account|lose\s+access|locked\s+out\b/i,
  /\bprize|winner|won|congratulations.*won\b/i,
  /\bjob|work\s+from\s+home|easy\s+money\b/i,
  /\brecover\s+(your\s+)?(lost\s+)?(crypto\s+)?funds?\b|contact\s+recovery\b|crypto\s+recovery\b/i,
  /\bwrong\s+number\b|did\s+you\s+get\s+my\s+last\s+message\b|found\s+your\s+number\s+in\s+my\s+contacts\b|texted\s+the\s+wrong\s+number|long\s+time\s+no\s+talk\b|are\s+you\s+still\s+working\s+(in|at)\b|since\s+you'?re\s+here\b/i,
];

function hasObviousScamCues(text: string): boolean {
  return OBVIOUS_SCAM_CUES.some((re) => re.test(text));
}

/**
 * Explicit test-style phrases only. Conservative: do not treat
 * words like "fake", "demo", "example" alone as test.
 */
const TEST_PHRASES = [
  /\bthis\s+is\s+(a\s+)?test\b/i,
  /\btest\s+message\b/i,
  /\bsample\s+scam\b/i,
  /\bignore\s+this\s+test\b/i,
  /\bjust\s+(a\s+)?test\b/i,
  /\btesting\s+only\b/i,
];

function isObviousTest(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 10) return false;
  return TEST_PHRASES.some((re) => re.test(trimmed));
}

export type RouterInput = {
  messageText: string;
};

/**
 * Determine top-level submission route.
 * Conservative: prefer ambiguous when unsure. insufficient_context
 * reserved for raw URL, domain only, or extremely content-poor input.
 */
export function routeSubmission(input: RouterInput): SubmissionRoute {
  const trimmed = input.messageText.trim();

  // Raw URL only or domain only -> insufficient_context
  if (/^(https?:\/\/\S+|www\.\S+)$/i.test(trimmed)) return "insufficient_context";

  // Extremely content-poor: URL-heavy with negligible semantic text
  if (isFragmentContent(trimmed)) return "insufficient_context";

  // Explicit test-style phrases -> test
  if (isObviousTest(trimmed)) return "test";

  // Otherwise: ambiguous or likely_scam based on obvious scam cues
  if (hasObviousScamCues(trimmed)) return "likely_scam";

  return "ambiguous";
}
