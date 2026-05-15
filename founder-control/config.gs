const CFG = {
  SUPABASE_URL: PropertiesService.getScriptProperties().getProperty("SUPABASE_URL"),
  SUPABASE_KEY: PropertiesService.getScriptProperties().getProperty("SUPABASE_KEY"),
  VIEWS: {
    /** Legacy event-telemetry view — synced to DATA_Public Funnel for archival. */
    FUNNEL: "ops_public_funnel_daily_clean_v1",
    /** Decision-safe view (v1.1.1) — standalone, no event telemetry. */
    RESEARCH_FUNNEL: "ops_research_funnel_daily_v1",
    /** Diagnostic counts-only view (v1.1.1) — no rates, unit-labeled columns. */
    EVENT_HEALTH: "ops_event_health_daily_v1",
    CTA: "ops_public_cta_segments_clean_v1",
    ACQUISITION_SIGNAL: "ops_acquisition_signal_quality_daily_v1",
    // PRIVACY: ops_user_research_export_v1.user_words is explicit user research
    // input and may contain sensitive details. Internal founder analysis only.
    USER_RESEARCH: "ops_user_research_export_v1",
    SURVEY_EXPERIMENTS: "ops_survey_experiment_export_v1",
  },
  TABS: {
    FUNNEL: "DATA_Public Funnel",
    CTA: "DATA_CTA Segments",
    /** Former paid-report / ads-quality tab name; sync target for ACQUISITION_SIGNAL view only. */
    ACQUISITION_SIGNAL_QUALITY: "DATA_Acquisition Signal Quality",
    DAILY: "Daily Pulse",
    META: "DATA_Meta",
    DEBUG: "DATA_Event Funnel Debug",
    WEEKLY: "Weekly Control Panel",
    GROWTH: "Growth Lab",
    PRODUCT: "Product & Signal",
    SALES: "Sales CRM",
    USER_RESEARCH: "DATA_User Research",
    SURVEY_EXPERIMENTS: "DATA_Survey_Experiments",
    USER_RESEARCH_SUMMARY: "User Research Summary",
    LLM_PROMPTS: "LLM Prompts",
    OPERATING_MAP: "Operating Map",
  },
};
