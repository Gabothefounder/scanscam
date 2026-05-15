function ensureFounderFacingTabs_() {
  const ss = SpreadsheetApp.getActive();
  ensureTabWithHeaders_(ss, CFG.TABS.WEEKLY, []);
  ensureTabWithHeaders_(ss, CFG.TABS.DAILY, [
    "Date",
    "Day Status",
    "User Research Responses",
    "Total Scans",
    "Valid Scans",
    "Valid Scan Rate",
    "Medium/High Scans",
    "Medium/High Scan Rate",
    "Research / Scan Rate",
    "Scan Submits [sessions]",
    "API Success [sessions]",
    "Results [sessions]",
    "CTA Shown [scans]",
    "CTA Clicked [scans]",
    "Sales Views [scans]",
    "Unlock [scans]",
    "Payment [scans]",
    "Refinement Shown [scans]",
    "Refinement Submitted [scans]",
    "API Gap [sessions]",
    "Main Drop-Off",
    "Instrumentation Status",
    "Auto Diagnosis",
    "Suggested Action",
    "Ad Spend",
    "Clicks",
    "Founder Approved?",
    "Decision Logged?",
    "Experiment Logged?",
    "Notes",
  ]);
  ensureTabWithHeaders_(ss, CFG.TABS.GROWTH, [
    "Date",
    "Area",
    "Type",
    "Hypothesis or Decision",
    "Evidence",
    "Metric",
    "Result",
    "Decision",
    "Next Action",
    "Promote to Master Context?",
    "Notes",
  ]);
  ensureTabWithHeaders_(ss, CFG.TABS.PRODUCT, [
    "Date",
    "Scan Count",
    "Valid Input %",
    "Context Sufficient %",
    "Link-only %",
    "Fragment %",
    "Medium/High %",
    "Fallback %",
    "Dominant Signal Gap",
    "Dominant Gap %",
    "Scan Error Count",
    "API Gap",
    "Top Product Issue",
    "Severity",
    "Next Product Action",
    "Notes",
  ]);
  ensureTabWithHeaders_(ss, CFG.TABS.SALES, [
    "Company",
    "Contact",
    "Status",
    "Last Touch",
    "Next Touch",
    "Pain Hypothesis",
    "Objection",
    "Pilot Fit 1-5",
    "Next Action",
    "Notes",
  ]);
  ensureTabWithHeaders_(ss, CFG.TABS.FUNNEL, []);
  ensureTabWithHeaders_(ss, CFG.TABS.CTA, []);
  ensureTabWithHeaders_(ss, CFG.TABS.ACQUISITION_SIGNAL_QUALITY, []);
  ensureTabWithHeaders_(ss, CFG.TABS.DEBUG, ["Date", "Event", "Count", "Notes"]);
  ensureTabWithHeaders_(ss, CFG.TABS.META, []);
  ensureTabWithHeaders_(ss, CFG.TABS.USER_RESEARCH, []);
  ensureTabWithHeaders_(ss, CFG.TABS.SURVEY_EXPERIMENTS, []);
  ensureUserResearchSummaryTab_(ss);
  ensureLlmPromptsTab_(ss);
  ensureOperatingMapTab_(ss);
}

/**
 * User Research Summary
 *
 * Founder-readable analysis skeleton for PMF review. Section labels only;
 * no formulas. Filled manually or with paste-from-LLM output.
 *
 * Idempotent: only seeds when the tab is empty so manual notes/values
 * are never overwritten by the daily refresh.
 */
function ensureUserResearchSummaryTab_(ss) {
  const sh = ss.getSheetByName(CFG.TABS.USER_RESEARCH_SUMMARY)
    || ss.insertSheet(CFG.TABS.USER_RESEARCH_SUMMARY);
  if (sh.getLastRow() > 0 || sh.getLastColumn() > 0) return;

  // [row, col, value] tuples; sparse layout, A1-style.
  const writes = [
    [1, 1, "User Research Summary"],

    [3, 1, "Volume"],
    [4, 1, "Total responses"],
    [5, 1, "Last 24h"],
    [6, 1, "Last 7 days"],

    [8, 1, "Top Situations"],
    [9, 1, "Situation"],
    [9, 2, "Count"],
    [9, 3, "Notes"],

    [16, 1, "Top Desired Help"],
    [17, 1, "Desired Help"],
    [17, 2, "Count"],
    [17, 3, "Notes"],

    [24, 1, "Price Signal"],
    [25, 1, "Price Range"],
    [25, 2, "Count"],
    [25, 3, "Notes"],

    [32, 1, "Premium / Concierge Signal"],
    [33, 1, "Signal"],
    [33, 2, "Count"],
    [33, 3, "Notes"],

    [40, 1, "User Language Themes"],
    [41, 1, "Theme"],
    [41, 2, "Example / Paraphrase"],
    [41, 3, "Product Implication"],

    [50, 1, "Next Experiment"],
    [51, 1, "Recommendation"],
    [51, 2, "Reason"],
    [51, 3, "Status"],
  ];
  writes.forEach(function (w) {
    sh.getRange(w[0], w[1]).setValue(w[2]);
  });

  // Lightweight visual hierarchy.
  sh.getRange(1, 1).setFontWeight("bold").setFontSize(14);
  [3, 8, 16, 24, 32, 40, 50].forEach(function (r) {
    sh.getRange(r, 1).setFontWeight("bold");
  });
  // Sub-header rows (column labels).
  [9, 17, 25, 33, 41, 51].forEach(function (r) {
    sh.getRange(r, 1, 1, 3).setFontWeight("bold");
  });
  sh.setColumnWidth(1, 220);
  sh.setColumnWidth(2, 320);
  sh.setColumnWidth(3, 380);
}

/**
 * LLM Prompts
 *
 * Reusable manual prompts for Gemini/ChatGPT analysis of DATA_User Research.
 * Headers + four seed rows. Idempotent: only seeds when the tab is empty so
 * the founder can edit prompt text or "Last Used" without losing changes on
 * the next daily refresh.
 *
 * No automatic LLM calls in Phase 1 - this tab is reference-only.
 */
function ensureLlmPromptsTab_(ss) {
  const sh = ss.getSheetByName(CFG.TABS.LLM_PROMPTS)
    || ss.insertSheet(CFG.TABS.LLM_PROMPTS);
  const headers = [
    "Prompt Name",
    "Use Case",
    "Frequency",
    "Prompt",
    "Last Used",
    "Output Destination",
  ];
  const headerRowMissing = sh.getLastRow() === 0 || sh.getLastColumn() === 0;
  if (headerRowMissing) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 220);
    sh.setColumnWidth(2, 260);
    sh.setColumnWidth(3, 110);
    sh.setColumnWidth(4, 540);
    sh.setColumnWidth(5, 130);
    sh.setColumnWidth(6, 240);
  }

  // Seed only when no prompt rows exist yet (i.e. only header is present).
  if (sh.getLastRow() > 1) return;

  const dailyPrompt = [
    "Analyze the DATA_User Research tab for the last 24 hours.",
    "",
    "Summarize:",
    "1. Number of new responses.",
    "2. Top situations.",
    "3. Top desired help options.",
    "4. Top price ranges.",
    "5. Any high-intent users:",
    "   - already acted",
    "   - wants to recover money",
    "   - wants human support",
    "   - wants help reporting",
    "   - selected around_50, monthly_50_plus, or high_end_150_500",
    "6. Best user-language themes from User Words.",
    "   Paraphrase sensitive details.",
    "7. One action I should take tomorrow.",
    "",
    "End with:",
    "Date | New Responses | Top Situation | Top Help | Top Price | Main Insight | Action",
  ].join("\n");

  const weeklyPrompt = [
    "Analyze DATA_User Research for the last 7 days.",
    "",
    "Give me a founder-level PMF read:",
    "1. Is the sample too small, directional, or meaningful?",
    "2. What are the top situations?",
    "3. What type of help do users want most?",
    "4. Are users mostly quick-check users, report users, action-plan users, concierge users, human-support users, or deeper-investigation users?",
    "5. What price ranges have signal?",
    "6. Is there evidence for a paid product?",
    "7. Is there evidence for a human-in-the-loop anti-fraud concierge?",
    "8. What user phrases should influence landing page copy?",
    "9. What should I test next week?",
    "",
    "Pick one main recommendation.",
  ].join("\n");

  const copyPrompt = [
    "Analyze the User Words column in DATA_User Research.",
    "",
    "Extract:",
    "1. Repeated phrases users use.",
    "2. Emotional words.",
    "3. What users are afraid of.",
    "4. What users are trying to decide.",
    "5. What users want help with.",
    "6. Objections or confusion.",
    "7. Words I should use in ScanScam copy.",
    "",
    "Then create:",
    "- 5 headline ideas",
    "- 5 CTA ideas",
    "- 5 \u201Cwhat you get\u201D bullets",
    "- 5 reassurance lines",
    "",
    "Do not repeat sensitive personal details. Paraphrase when needed.",
  ].join("\n");

  const premiumPrompt = [
    "Analyze DATA_User Research for premium support signals.",
    "",
    "Look for rows where:",
    "- Desired Help includes guided_until_resolved",
    "- Desired Help includes human_case_support",
    "- Desired Help includes limit_damage",
    "- Desired Help includes deeper_check",
    "- Price Range is around_50",
    "- Price Range is monthly_50_plus",
    "- Price Range is high_end_150_500",
    "- User Words mention fear, money loss, bank, police, already clicked, already paid, workplace, client, family member, or needing help",
    "",
    "Answer:",
    "1. How many rows show premium intent?",
    "2. What situations create the strongest premium intent?",
    "3. Do users seem to want a bot concierge, a human, or both?",
    "4. What would the premium offer be?",
    "5. What price point should I test?",
    "6. What CTA should I test for this segment?",
    "",
    "Keep it practical and direct.",
  ].join("\n");

  const rows = [
    [
      "Daily User Research Review",
      "Review newest user research responses",
      "Daily",
      dailyPrompt,
      "",
      "User Research Summary",
    ],
    [
      "Weekly PMF Review",
      "Weekly product-market-fit read",
      "Weekly",
      weeklyPrompt,
      "",
      "User Research Summary / Growth Lab",
    ],
    [
      "Copywriting Gold",
      "Extract customer language for landing pages and CTAs",
      "Weekly",
      copyPrompt,
      "",
      "Copy Bank / Growth Lab",
    ],
    [
      "Premium Concierge Signal Review",
      "Identify high-value concierge / human-support opportunities",
      "Weekly",
      premiumPrompt,
      "",
      "Growth Lab / Decision Log",
    ],
  ];
  sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  // Wrap the long prompt + use-case columns so they stay readable.
  sh.getRange(2, 1, rows.length, headers.length).setVerticalAlignment("top");
  sh.getRange(2, 2, rows.length, 1).setWrap(true);
  sh.getRange(2, 4, rows.length, 1).setWrap(true);
}
