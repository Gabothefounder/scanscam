/**
 * Product telemetry contract.
 *
 * Keep this file free of browser/server-only imports so both client instrumentation
 * and /api/telemetry validate against the exact same vocabulary.
 *
 * Privacy rule: telemetry describes product behavior, never message/story content.
 */
export const TELEMETRY_EVENTS = [
  // Core scan funnel
  "scan_attempt",
  "scan_processing",
  "scan_shown",
  "scan_consent",
  "scan_viewed",
  "scan_submit_clicked",
  "scan_request_sent",
  "scan_result_received",
  "scan_result_rendered",
  "scan_abandon_before_result",
  "scan_consent_clicked_allow",
  "scan_consent_clicked_deny",
  "scan_error",
  "scan_created",
  "scan_stage_timing",

  // Product navigation / intent
  "page_view",
  "intent_selected",
  "post_scan_action_selected",

  // Context / rescue / reports
  "context_refinement_shown",
  "context_refinement_submitted",
  "context_refinement_completed_analysis",
  "report_cta_viewed",
  "report_cta_clicked",
  "report_mission_viewed",
  "report_mission_continue",
  "report_step_viewed",
  "report_step_back",
  "report_exit",
  "report_submit_clicked",
  "report_submit_success",
  "report_submit_failed",

  // Atlas / Journey / learning / network
  "atlas_viewed",
  "atlas_current_opened",
  "atlas_find_mine_clicked",
  "journey_started",
  "journey_completed",
  "contribution_prompt_viewed",
  "contribution_submitted",
  "cognitive_defense_opened",
  "network_contact_clicked",
  "family_interest_started",

  // Existing experiments / monetization
  "telemetry_rejected_payload",
  "cta_shown",
  "cta_clicked",
  "pro_preview_viewed",
  "pro_sales_viewed",
  "pro_unlock_clicked",
  "beta_unlock_started",
  "beta_unlock_completed",
  "report_feedback_submitted",
  "user_state_selected",
  "pro_useful_yes",
  "pro_useful_no",
  "user_research_cta_viewed",
  "user_research_cta_clicked",
  "user_research_started",
  "user_research_completed",
  "user_research_full_report_unlocked",
  "human_review_cta_viewed",
  "human_review_cta_clicked",
  "guide_report_cta_viewed",
  "guide_report_cta_clicked",
  "guide_report_optin_submitted",
  "guide_report_unlocked",
  "conversation_page_view",
  "conversation_booking_click",
  "conversation_email_click",
  "family_protect_page_view",
  "family_protect_cta_click",
  "family_protect_signup",
] as const;

export type TelemetryEvent = (typeof TELEMETRY_EVENTS)[number];

export const TELEMETRY_PROP_KEYS = [
  // Generic product dimensions
  "flow",
  "step",
  "surface",
  "intent",
  "target",
  "stage",
  "action",
  "entry_mode",
  "result_source",
  "consented",

  // Scan / model dimensions
  "risk_tier",
  "ui_action",
  "latency_ms",
  "duration_ms",
  "total_ms",
  "ai_ms",
  "ocr_ms",
  "link_intel_ms",
  "persist_ms",
  "error_code",
  "build_id",
  "input_length",
  "attempt_id",
  "mode",
  "trigger_reason",
  "input_type",
  "char_len_bucket",
  "intel_state",
  "context_quality",
  "analysis_mode",

  // Atlas dimensions: normalized labels only, never raw artifacts
  "current_family",
  "channel",
  "primary_request",
  "signal_count",

  // Attribution / experiments
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "cta_reason",
  "variant",
  "web_risk_status",
  "link_type",
  "domain_signal",
  "state",
  "price",
  "report_useful",
  "worth_five",
  "source",
  "lang",
  "cta_variant",
  "who_protect_category",
] as const;

export type TelemetryPropKey = (typeof TELEMETRY_PROP_KEYS)[number];
export type TelemetryProps = Partial<Record<TelemetryPropKey, unknown>>;

export const TELEMETRY_BANNED_KEYS = [
  "text",
  "message",
  "content",
  "body",
  "prompt",
  "input",
  "email",
  "phone",
  "url",
  "link",
] as const;

/** Legacy names remain accepted while old deployed clients age out. */
export const LEGACY_TELEMETRY_EVENT_MAP: Record<string, string> = {
  scan_attempt: "scan_submit_clicked",
  scan_shown: "scan_result_rendered",
  scan_created: "scan_api_success",
};
