/**
 * Centralized taxonomy enums for scan analysis.
 * Single source of truth for allowed values.
 * MVP only — no multi-label support.
 */

export const RISK_TIER = ["low", "medium", "high"] as const;
export type RiskTier = (typeof RISK_TIER)[number];

export const SUBMISSION_ROUTE = [
  "likely_scam",
  "ambiguous",
  "test",
  "insufficient_context",
] as const;
export type SubmissionRoute = (typeof SUBMISSION_ROUTE)[number];

export const NARRATIVE_FAMILY = [
  "delivery_scam",
  "government_impersonation",
  "law_enforcement",
  "account_verification",
  "employment_scam",
  "recovery_scam",
  "reward_claim",
  "social_engineering_opener",
  "investment_fraud",
  "unknown",
] as const;
export type NarrativeFamily = (typeof NARRATIVE_FAMILY)[number];

export const IMPERSONATION_ENTITY = [
  "cra",
  "service_canada",
  "rcmp",
  "canada_post",
  "wealthsimple",
  "generic_government",
  "generic_financial",
  "generic_courier",
  "unknown",
] as const;
export type ImpersonationEntity = (typeof IMPERSONATION_ENTITY)[number];

export const REQUESTED_ACTION = [
  "click_link",
  "call_number",
  "submit_credentials",
  "pay_money",
  "reply_sms",
  "download_app",
  "none",
  "unknown",
] as const;
export type RequestedAction = (typeof REQUESTED_ACTION)[number];

export const THREAT_STAGE = [
  "initial_lure",
  "credential_capture",
  "payment_extraction",
  "post_loss_recovery",
  "unclear",
] as const;
export type ThreatStage = (typeof THREAT_STAGE)[number];

export const CONFIDENCE_LEVEL = ["low", "medium", "high"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVEL)[number];

export const SOURCE_TYPE = ["user_text", "ocr"] as const;
export type SourceType = (typeof SOURCE_TYPE)[number];

export const CONTEXT_QUALITY = [
  "full",
  "partial",
  "thin",
  "fragment",
  "unknown",
] as const;
export type ContextQuality = (typeof CONTEXT_QUALITY)[number];
