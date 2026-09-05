export type EvalLanguage = "en" | "fr";
export type EvalRisk = "low" | "medium" | "high" | "insufficient_context";

export type EvalExpected = {
  risk?: EvalRisk;
  family?: string;
  requested_action?: string;
  must_have_signals?: string[];
  must_not_have_signals?: string[];
};

export type EvalCase = {
  id: string;
  source: "gold" | "stress" | "public" | "historical_private";
  language: EvalLanguage;
  text: string;
  tags: string[];
  expected: EvalExpected;
};

export type ModelExtraction = {
  context_sufficiency: "enough" | "insufficient";
  language: "en" | "fr" | "mixed" | "unknown";
  claimed_identity_type:
    | "government"
    | "financial_institution"
    | "courier"
    | "employer"
    | "law_enforcement"
    | "platform"
    | "person"
    | "other"
    | "unknown";
  scam_family:
    | "delivery_scam"
    | "government_impersonation"
    | "law_enforcement"
    | "account_verification"
    | "employment_scam"
    | "recovery_scam"
    | "reward_claim"
    | "social_engineering_opener"
    | "investment_fraud"
    | "romance_scam"
    | "financial_phishing"
    | "tech_support"
    | "unknown";
  requested_actions: Array<
    | "click_link"
    | "call_number"
    | "submit_credentials"
    | "pay_money"
    | "reply"
    | "download_app"
    | "remote_access"
    | "move_channel"
    | "none"
    | "unknown"
  >;
  requested_assets: Array<
    | "money"
    | "password"
    | "otp_or_mfa_code"
    | "bank_login"
    | "card_data"
    | "identity_data"
    | "crypto"
    | "gift_card"
    | "remote_device_access"
    | "conversation_engagement"
    | "unknown"
  >;
  tactics: Array<{
    type:
      | "urgency"
      | "authority"
      | "fear"
      | "threat"
      | "false_trust"
      | "helpfulness"
      | "secrecy"
      | "isolation"
      | "scarcity"
      | "reward"
      | "verification_suppression"
      | "channel_migration"
      | "credential_request"
      | "financial_pressure";
    confidence: number;
  }>;
  attack_stage:
    | "initial_contact"
    | "lure"
    | "trust_building"
    | "authority_establishment"
    | "pressure_escalation"
    | "credential_capture"
    | "payment_extraction"
    | "isolation"
    | "repeat_extraction"
    | "recovery"
    | "unclear";
  confidence: number;
};

export type EvalOutput = {
  case_id: string;
  engine: string;
  latency_ms: number;
  input_tokens?: number;
  output_tokens?: number;
  error?: string;
  extraction?: ModelExtraction;
  rules?: Record<string, unknown>;
};

export type EvalScore = {
  engine: string;
  cases: number;
  errors: number;
  risk_accuracy?: number;
  family_accuracy?: number;
  action_accuracy?: number;
  french_family_accuracy?: number;
  english_family_accuracy?: number;
  avg_latency_ms: number;
  p50_latency_ms: number;
  p90_latency_ms: number;
  avg_input_tokens?: number;
  avg_output_tokens?: number;
};
