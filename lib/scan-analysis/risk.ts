/**
 * Lightweight rule-based risk scoring. MVP trust-floor only.
 * Not a full weighted model.
 */

import type { RiskTier, ConfidenceLevel } from "./taxonomy";

export type RiskInput = {
  submissionRoute: string;
  narrativeFamily: string;
  impersonationEntity: string;
  requestedAction: string;
  threatStage: string;
  contextQuality?: string;
};

export type RiskResult = {
  riskTier: RiskTier;
  riskScore: number;
  confidenceLevel: ConfidenceLevel;
};

// Authority entities: impersonation implies trust abuse
const AUTHORITY_ENTITIES = new Set([
  "cra",
  "service_canada",
  "rcmp",
  "generic_government",
  "generic_financial",
]);

// Strong requested actions: victim is pushed to act
const STRONG_ACTIONS = new Set([
  "submit_credentials",
  "pay_money",
  "click_link",
  "call_number",
]);

function hasAuthority(i: string): boolean {
  return AUTHORITY_ENTITIES.has(i);
}

function hasStrongAction(a: string): boolean {
  return STRONG_ACTIONS.has(a);
}

function isThinContext(q: string | undefined): boolean {
  return q === "fragment" || q === "thin" || q === "unknown" || !q;
}

/**
 * insufficient_context -> cap at 45, avoid strong-scam output
 */
function applyInsufficientContextCap(
  route: string,
  score: number,
  tier: RiskTier
): { riskScore: number; riskTier: RiskTier } {
  if (route !== "insufficient_context") return { riskScore: score, riskTier: tier };
  const cappedScore = Math.min(score, 45);
  const cappedTier = cappedScore >= 70 ? "medium" : tier === "high" ? "medium" : tier;
  return { riskScore: cappedScore, riskTier: cappedTier };
}

/**
 * Derive confidence from context and signal alignment
 */
function deriveConfidence(
  contextQuality: string | undefined,
  narrativeFamily: string,
  impersonationEntity: string,
  requestedAction: string
): ConfidenceLevel {
  if (isThinContext(contextQuality)) return "low";

  if (contextQuality === "full") {
    const hasNarrative = narrativeFamily !== "unknown";
    const hasEntity = impersonationEntity !== "unknown";
    const hasAction = requestedAction !== "none" && requestedAction !== "unknown";
    if (hasNarrative && hasEntity && hasAction) return "high";
  }

  if (contextQuality === "partial") return "medium";

  return "low";
}

export function computeRisk(input: RiskInput): RiskResult {
  const {
    submissionRoute,
    narrativeFamily,
    impersonationEntity,
    requestedAction,
    threatStage,
    contextQuality,
  } = input;

  let score = 15;
  let tier: RiskTier = "low";

  // -------------------------------------------------------------------------
  // High floor: recovery scam, account_verification + submit_credentials
  // -------------------------------------------------------------------------

  if (narrativeFamily === "recovery_scam") {
    score = 80;
    tier = "high";
  } else if (
    narrativeFamily === "account_verification" &&
    requestedAction === "submit_credentials"
  ) {
    score = 75;
    tier = "high";
  } else if (
    narrativeFamily === "government_impersonation" ||
    narrativeFamily === "law_enforcement"
  ) {
    if (hasStrongAction(requestedAction)) {
      score = 75;
      tier = "high";
    } else {
      score = 60;
      tier = "medium";
    }
  } else if (hasAuthority(impersonationEntity) && hasStrongAction(requestedAction)) {
    score = 70;
    tier = "high";
  } else if (hasAuthority(impersonationEntity) || hasStrongAction(requestedAction)) {
    score = Math.max(score, 55);
    tier = "medium";
  } else if (narrativeFamily === "social_engineering_opener") {
    score = 45;
    tier = "medium";
  } else if (submissionRoute === "likely_scam") {
    score = Math.max(score, 55);
    tier = "medium";
  }

  // -------------------------------------------------------------------------
  // Threat stage bumps: credential_capture, payment_extraction
  // -------------------------------------------------------------------------

  if (threatStage === "credential_capture" && score < 70) {
    score = Math.max(score, 60);
    tier = tier === "low" ? "medium" : tier;
  }
  if (threatStage === "payment_extraction" && score < 70) {
    score = Math.max(score, 60);
    tier = tier === "low" ? "medium" : tier;
  }

  // -------------------------------------------------------------------------
  // insufficient_context cap
  // -------------------------------------------------------------------------

  const { riskScore, riskTier } = applyInsufficientContextCap(
    submissionRoute,
    score,
    tier
  );

  const confidenceLevel = deriveConfidence(
    contextQuality,
    narrativeFamily,
    impersonationEntity,
    requestedAction
  );

  return {
    riskTier: riskTier,
    riskScore: riskScore,
    confidenceLevel,
  };
}
