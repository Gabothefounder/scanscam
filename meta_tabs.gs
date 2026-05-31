function stampRefresh_(meta) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(CFG.TABS.META) || ss.insertSheet(CFG.TABS.META);
  sh.clear();
  sh.setFrozenRows(0);

  const now = new Date();
  const nowMtl = Utilities.formatDate(now, "America/Montreal", "yyyy-MM-dd HH:mm:ss");
  const warnings = Array.isArray(meta.warnings) && meta.warnings.length > 0 ? meta.warnings.join(" | ") : "";

  const rows = [
    ["Last Refresh (America/Montreal)", nowMtl],
    ["Source Views", (meta.sourceViews || []).join(", ")],
    ["Target Daily Date", meta.selectedDate || ""],
    ["Target Day Status", meta.dayStatus || ""],
    ["Warnings", warnings],
  ];

  sh.getRange(1, 1, rows.length, 2).setValues(rows);
  sh.getRange(1, 1, 1, 2).setFontWeight("bold");
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, 2);
}
function ensureOperatingMapTab_(ss) {
  var sh = ss.getSheetByName(CFG.TABS.OPERATING_MAP)
    || ss.insertSheet(CFG.TABS.OPERATING_MAP);
  if (sh.getLastRow() > 0 || sh.getLastColumn() > 0) return;

  var headers = [
    "Tab Name",
    "Layer",
    "Primary Question",
    "Input Source",
    "Output Destination",
    "Manual / Automated",
    "Update Frequency",
    "Decision Supported",
    "Status",
    "v1.2 Notes",
  ];

  // Each row: [Tab Name, Layer, Primary Question, Input Source, Output Destination,
  //            Manual/Automated, Update Frequency, Decision Supported, Status, v1.2 Notes]
  var rows = [
    [
      "Daily Pulse",
      "PULSE",
      "What happened yesterday and is anything broken?",
      "ops_research_funnel_daily_v1 + ops_event_health_daily_v1",
      "Weekly Control Panel, Growth Lab, founder decisions",
      "Automated (decision + diagnostic zones); manual (Ad Spend, Clicks, approval cols)",
      "Daily (7 AM trigger)",
      "Daily go/no-go; experiment approval",
      "Active",
      "v1.1.2 diagnosis engine uses decision metrics first.",
    ],
    [
      "DATA_Public Funnel",
      "DATA / ARCHIVE",
      "What did the legacy event-telemetry funnel look like?",
      "ops_public_funnel_daily_clean_v1",
      "Historical reference only",
      "Automated",
      "Daily",
      "None (archive)",
      "Archive",
      "Contains rates that can exceed 1.0. Do not use for decisions.",
    ],
    [
      "DATA_CTA Segments",
      "DATA",
      "How do CTA events break down by risk tier, input type, and context quality?",
      "ops_public_cta_segments_clean_v1",
      "LLM Prompt drill-down, manual analysis",
      "Automated",
      "Daily",
      "CTA copy/placement experiments",
      "Active / legacy-derived",
      "Relies on legacy CTA event telemetry. Useful for segment analysis but not for primary product decisions.",
    ],
    [
      "DATA_Acquisition Signal Quality",
      "DATA",
      "Which UTM sources produce valid, high-signal scans?",
      "ops_acquisition_signal_quality_daily_v1",
      "Ad spend decisions, Growth Lab",
      "Automated",
      "Daily",
      "Acquisition budget allocation; campaign kill/scale",
      "Active",
      "",
    ],
    [
      "DATA_User Research",
      "DATA",
      "What are users saying in post-scan research responses?",
      "ops_user_research_export_v1",
      "User Research Summary, LLM Prompts",
      "Automated",
      "Daily",
      "PMF signal; pricing; concierge demand",
      "Active",
      "PRIVACY: User Words may contain sensitive details. Founder-only access.",
    ],
    [
      "DATA_Survey_Experiments",
      "DATA",
      "Landing-page survey experiments (parking ticket text, future variants)",
      "ops_survey_experiment_export_v1",
      "Growth Lab, experiment review",
      "Automated",
      "Daily",
      "Micro-test completions; Q3/Q4 discovery; checklist usefulness",
      "Active",
      "PRIVACY: open-text fields may contain sensitive details. No IP or email. Founder-only.",
    ],
    [
      "DATA_Event Funnel Debug",
      "DATA",
      "(Debug) Raw event counts for instrumentation troubleshooting",
      "None (headers seeded, no data feed)",
      "None",
      "Manual",
      "As needed",
      "Instrumentation debugging",
      "Stale / orphaned",
      "No Supabase view feeds this tab. Consider wiring to ops_event_health_daily_v1 or archiving.",
    ],
    [
      "DATA_Meta",
      "DATA",
      "When was the last refresh and which views were synced?",
      "Script stampRefresh_",
      "Troubleshooting",
      "Automated",
      "Daily",
      "Operational health",
      "Active",
      "",
    ],
    [
      "Weekly Control Panel",
      "DECISION",
      "What is the weekly founder-level read across all channels?",
      "ops_research_funnel_daily_v1 + ops_acquisition_signal_quality_daily_v1 + ops_user_research_export_v1 (automated) + manual decision log",
      "Growth Lab, Sales CRM, experiment decisions",
      "Hybrid (automated summary + manual decision log)",
      "Weekly (daily refresh updates summary)",
      "Weekly strategy; resource allocation; experiment approval",
      "Active (v1.3)",
      "v1.3: Automated summary from decision-safe views. Manual decision log preserved below row 16.",
    ],
    [
      "User Research Summary",
      "INTERPRETATION",
      "What does the aggregate user research signal say about PMF?",
      "Manual (paste from LLM analysis of DATA_User Research)",
      "Weekly Control Panel, Growth Lab",
      "Manual (LLM-assisted)",
      "Weekly or as volume warrants",
      "PMF direction; pricing; feature priority",
      "Active",
      "Seeded once, never overwritten by script.",
    ],
    [
      "LLM Prompts",
      "PROMPT",
      "What prompts should I use to analyze DATA_User Research?",
      "Script seed (4 prompts)",
      "User Research Summary",
      "Manual reference (no LLM API calls)",
      "As needed",
      "Analysis quality",
      "Active",
      "Seeded once, never overwritten by script.",
    ],
    [
      "Growth Lab",
      "EXPERIMENT",
      "What experiments are running, what results came back, what did we decide?",
      "Manual (founder logs from Daily Pulse, Weekly Control Panel)",
      "Weekly Control Panel, Product & Signal",
      "Manual",
      "As experiments run",
      "Experiment lifecycle; promote-to-master-context",
      "Active",
      "",
    ],
    [
      "Product & Signal",
      "DECISION",
      "What is the product health and signal quality trend?",
      "Manual (founder fills)",
      "Growth Lab, Weekly Control Panel",
      "Manual",
      "Weekly",
      "Product roadmap; signal gap prioritization",
      "Needs wiring",
      "Headers overlap with decision-view metrics (Valid Input %, Medium/High %). Could pull from ops_research_funnel_daily_v1.",
    ],
    [
      "Sales CRM",
      "SALES",
      "Where does each MSP prospect stand?",
      "Manual (founder fills)",
      "Weekly Control Panel",
      "Manual",
      "As conversations happen",
      "MSP pipeline; pilot decisions",
      "Active",
      "",
    ],
    [
      "Operating Map",
      "META",
      "How does the whole workbook fit together?",
      "Script seed (this tab)",
      "Founder orientation; cleanup planning",
      "Seed once, then manual",
      "As architecture changes",
      "Workbook governance",
      "Active (v1.2)",
      "You are here.",
    ],
  ];

  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  sh.setFrozenRows(1);

  sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sh.getRange(2, 1, rows.length, headers.length).setVerticalAlignment("top");

  // Wrap columns that contain long text.
  sh.getRange(2, 3, rows.length, 1).setWrap(true);  // Primary Question
  sh.getRange(2, 4, rows.length, 1).setWrap(true);  // Input Source
  sh.getRange(2, 5, rows.length, 1).setWrap(true);  // Output Destination
  sh.getRange(2, 6, rows.length, 1).setWrap(true);  // Manual / Automated
  sh.getRange(2, 8, rows.length, 1).setWrap(true);  // Decision Supported
  sh.getRange(2, 10, rows.length, 1).setWrap(true); // v1.2 Notes

  sh.setColumnWidth(1, 200);
  sh.setColumnWidth(2, 130);
  sh.setColumnWidth(3, 280);
  sh.setColumnWidth(4, 260);
  sh.setColumnWidth(5, 220);
  sh.setColumnWidth(6, 200);
  sh.setColumnWidth(7, 120);
  sh.setColumnWidth(8, 240);
  sh.setColumnWidth(9, 180);
  sh.setColumnWidth(10, 320);
}
