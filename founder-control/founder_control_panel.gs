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
    USER_RESEARCH_SUMMARY: "User Research Summary",
    LLM_PROMPTS: "LLM Prompts",
    OPERATING_MAP: "Operating Map",
  },
};

function refreshFounderControlPanel() {
  assertConfig_();
  ensureFounderFacingTabs_();

  const funnelRows = fetchViewRows_(CFG.VIEWS.FUNNEL);
  const researchFunnelRows = fetchViewRows_(CFG.VIEWS.RESEARCH_FUNNEL);
  const eventHealthRows = fetchViewRows_(CFG.VIEWS.EVENT_HEALTH);
  const ctaRows = fetchViewRows_(CFG.VIEWS.CTA);
  const acquisitionRows = fetchViewRows_(CFG.VIEWS.ACQUISITION_SIGNAL);
  const userResearchRows = fetchViewRows_(
    CFG.VIEWS.USER_RESEARCH,
    "submitted_at.desc"
  );

  writeTab_(CFG.TABS.FUNNEL, funnelRows);
  writeTab_(CFG.TABS.CTA, ctaRows);
  writeTab_(CFG.TABS.ACQUISITION_SIGNAL_QUALITY, acquisitionRows);
  writeTab_(CFG.TABS.USER_RESEARCH, userResearchRows);

  const dailyResult = buildDailyPulse_(researchFunnelRows, eventHealthRows);
  buildWeeklyControlPanel_(researchFunnelRows, acquisitionRows, userResearchRows);

  stampRefresh_({
    sourceViews: [
      CFG.VIEWS.FUNNEL,
      CFG.VIEWS.RESEARCH_FUNNEL,
      CFG.VIEWS.EVENT_HEALTH,
      CFG.VIEWS.CTA,
      CFG.VIEWS.ACQUISITION_SIGNAL,
      CFG.VIEWS.USER_RESEARCH,
    ],
    selectedDate: dailyResult.selectedDate,
    dayStatus: dailyResult.dayStatus,
    warnings: dailyResult.warnings,
  });
}

function fetchViewRows_(viewName, orderBy) {
  const order = orderBy || "day_montreal.desc";
  const url =
    `${CFG.SUPABASE_URL}/rest/v1/${encodeURIComponent(viewName)}` +
    `?select=*&order=${encodeURIComponent(order)}`;

  const resp = UrlFetchApp.fetch(url, {
    method: "get",
    muteHttpExceptions: true,
    headers: {
      apikey: CFG.SUPABASE_KEY,
      Authorization: `Bearer ${CFG.SUPABASE_KEY}`,
    },
  });

  const code = resp.getResponseCode();
  const text = resp.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error(`Supabase fetch failed for ${viewName}. HTTP ${code}.`);
  }

  const payload = JSON.parse(text);
  return Array.isArray(payload) ? payload : [];
}

function writeTab_(tabName, rows) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(tabName) || ss.insertSheet(tabName);
  // Strong reset so legacy spreadsheet formatting does not leak into new data.
  sh.clear();
  sh.setFrozenRows(0);

  if (!rows || rows.length === 0) {
    sh.getRange(1, 1).setValue("No rows returned");
    return;
  }

  const headers = Object.keys(rows[0]);
  const values = rows.map((r) => headers.map((h) => r[h]));

  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.getRange(2, 1, values.length, headers.length).setValues(values);
  sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  sh.setFrozenRows(1);
  applyColumnFormats_(sh, headers, values.length);
  sh.autoResizeColumns(1, headers.length);
}

function buildDailyPublicControl_(researchFunnelRows, eventHealthRows) {
  return buildDailyPulse_(researchFunnelRows, eventHealthRows);
}

function buildDailyPulse_(researchFunnelRows, eventHealthRows) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(CFG.TABS.DAILY) || ss.insertSheet(CFG.TABS.DAILY);
  sh.clear();
  sh.setFrozenRows(0);

  const headers = [
    // Decision zone (from ops_research_funnel_daily_v1)
    "Date",
    "Day Status",
    "User Research Responses",
    "Total Scans",
    "Valid Scans",
    "Valid Scan Rate",
    "Medium/High Scans",
    "Medium/High Scan Rate",
    "Research / Scan Rate",
    // Diagnostic zone (from ops_event_health_daily_v1)
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
    // Auto-analysis (driven by diagnostic counts)
    "Main Drop-Off",
    "Instrumentation Status",
    "Auto Diagnosis",
    "Suggested Action",
    // Manual
    "Ad Spend",
    "Clicks",
    "Founder Approved?",
    "Decision Logged?",
    "Experiment Logged?",
    "Notes",
  ];

  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  sh.setFrozenRows(1);

  const picked = selectTargetDailyRow_(researchFunnelRows);
  if (!picked.row) {
    sh.getRange(2, 1).setValue("No daily funnel rows available");
    return {
      selectedDate: "",
      dayStatus: "NO DATA",
      warnings: ["No rows returned from ops_research_funnel_daily_v1."],
    };
  }

  // Decision metrics from research funnel view.
  const d = picked.row;
  const userResearch = num_(d.user_research_responses);
  const totalScans = num_(d.scans_table_scan_count);
  const validScans = num_(d.valid_scan_count);
  const validScanRate = num_(d.valid_scan_rate);
  const medHighScans = num_(d.medium_high_scan_count);
  const medHighRate = num_(d.medium_high_scan_rate);
  const researchPerScan = num_(d.research_response_per_scan_rate);

  // Diagnostic counts from event health view (matched by day_montreal).
  const ehByDate = new Map();
  (eventHealthRows || []).forEach(function (r) {
    if (r && r.day_montreal) ehByDate.set(String(r.day_montreal), r);
  });
  const eh = ehByDate.get(picked.date) || {};

  const scans = num_(eh.scan_submit_clicked_sessions);
  const apiSuccess = num_(eh.scan_api_success_sessions);
  const results = num_(eh.scan_result_rendered_sessions);
  const ctaShown = num_(eh.cta_shown_scans);
  const ctaClicked = num_(eh.cta_clicked_scans);
  const salesViews = num_(eh.pro_sales_viewed_scans);
  const unlockCompleted = num_(eh.beta_unlock_completed_scans);
  const paymentCompleted = num_(eh.payment_completed_scans);
  const refinementShown = num_(eh.context_refinement_shown_scans);
  const refinementSubmitted = num_(eh.context_refinement_submitted_scans);
  const apiGap = Math.max(scans - apiSuccess, 0);

  const diagnosisCtx = {
    selectedDayStatus: picked.status,
    // Decision metrics (ops_research_funnel_daily_v1).
    totalScans,
    validScanRate,
    medHighRate,
    researchPerScan,
    // Diagnostic telemetry (ops_event_health_daily_v1).
    scans,
    apiSuccess,
    results,
    refinementShown,
    refinementSubmitted,
    apiGap,
  };

  const mainDrop = inferMainDropOff_(diagnosisCtx);
  const instrumentationStatus = instrumentationStatus_(diagnosisCtx, mainDrop);
  const diagnosis = diagnose_(diagnosisCtx, mainDrop);
  const suggestedAction = suggestAction_(diagnosisCtx, mainDrop);

  const outputRow = [
    // Decision
    picked.date,
    picked.status,
    userResearch,
    totalScans,
    validScans,
    validScanRate,
    medHighScans,
    medHighRate,
    researchPerScan,
    // Diagnostic
    scans,
    apiSuccess,
    results,
    ctaShown,
    ctaClicked,
    salesViews,
    unlockCompleted,
    paymentCompleted,
    refinementShown,
    refinementSubmitted,
    apiGap,
    // Auto-analysis
    mainDrop,
    instrumentationStatus,
    diagnosis,
    suggestedAction,
    // Manual
    "",
    "",
    "",
    "",
    "",
    "",
  ];

  sh.getRange(2, 1, 1, outputRow.length).setValues([outputRow]);
  sh.getRange(2, 1, 1, outputRow.length).setNumberFormat("0");
  sh.getRange(2, 1).setNumberFormat("yyyy-mm-dd");
  // Rate columns: Valid Scan Rate (col 6), Medium/High Scan Rate (col 8), Research / Scan Rate (col 9).
  sh.getRange(2, 6).setNumberFormat("0.00%");
  sh.getRange(2, 8).setNumberFormat("0.00%");
  sh.getRange(2, 9).setNumberFormat("0.00%");
  sh.autoResizeColumns(1, headers.length);

  const promptStart = 5;
  sh.getRange(promptStart, 1).setValue("LLM Prompt (copy/paste):");
  sh
    .getRange(promptStart + 1, 1)
    .setValue(
      "Using the latest Daily Pulse row, DATA_CTA Segments, and DATA_Acquisition Signal Quality, identify the biggest bottleneck. Decision metrics (cols 1-9) are scans-table based. Diagnostic metrics (cols 10-20) are event-telemetry based; use them to explain instrumentation gaps, not for product decisions. Recommend one action only. Do not invent metrics. If the selected day is a partial day, say so and do not overread."
    );

  return {
    selectedDate: picked.date,
    dayStatus: picked.status,
    warnings: picked.warnings,
  };
}

function selectTargetDailyRow_(dailyRows) {
  const today = getTodayMontrealDate_();
  const yesterday = getYesterdayMontrealDate_();
  const warnings = [];

  if (!Array.isArray(dailyRows) || dailyRows.length === 0) {
    return {
      row: null,
      date: "",
      status: "NO DATA",
      warnings: ["No rows returned from ops_research_funnel_daily_v1."],
    };
  }

  const byDate = new Map();
  dailyRows.forEach((r) => {
    if (r && r.day_montreal) byDate.set(String(r.day_montreal), r);
  });

  if (byDate.has(yesterday)) {
    return { row: byDate.get(yesterday), date: yesterday, status: "COMPLETE (YESTERDAY)", warnings };
  }

  const sortedDates = Array.from(byDate.keys()).sort().reverse();
  const fallbackDate = sortedDates[0];
  const fallbackRow = byDate.get(fallbackDate);

  if (fallbackDate === today) {
    warnings.push("Latest available row is today (partial day).");
    return {
      row: fallbackRow,
      date: fallbackDate,
      status: "PARTIAL DAY — DO NOT OVERREAD",
      warnings,
    };
  }

  warnings.push(`Yesterday (${yesterday}) missing; using latest available day (${fallbackDate}).`);
  return {
    row: fallbackRow,
    date: fallbackDate,
    status: "FALLBACK (LATEST AVAILABLE DAY)",
    warnings,
  };
}

function inferMainDropOff_(m) {
  // A. Instrumentation: API gap (event-health, session/session).
  if (m.scans > 0 && m.apiGap / m.scans > 0.1) {
    return "Submit -> API Success";
  }

  // B. Instrumentation: result rendering gap (event-health).
  if (m.scans > 0 && m.results === 0) {
    return "Result Rendering Gap";
  }

  // C-E use decision metrics; require minimum sample from scans table.
  if (m.totalScans >= 20) {
    // C. Decision: input quality.
    if (m.validScanRate < 0.3) {
      return "Low Valid Scan Rate";
    }

    // D. Decision: risk classification quality.
    if (m.medHighRate < 0.1) {
      return "Low Medium/High Rate";
    }

    // E. Decision: research funnel conversion.
    if (m.researchPerScan < 0.03) {
      return "Low Research Response Rate";
    }
  }

  // F. Refinement activity (event-health, scan/scan).
  var refinementRate = m.refinementShown > 0 ? m.refinementSubmitted / m.refinementShown : null;
  if (m.refinementShown >= 10 && refinementRate != null && refinementRate < 0.25) {
    return "Refinement Shown -> Refinement Submitted";
  }

  return "No clear bottleneck / needs more data";
}

function instrumentationStatus_(row, mainDrop) {
  if (row.selectedDayStatus === "PARTIAL DAY — DO NOT OVERREAD") {
    return "PARTIAL DAY — DO NOT OVERREAD";
  }
  if (row.scans > 0 && row.results === 0) {
    return "RESULT TRACKING MISSING";
  }
  if (row.apiGap > 0 && row.scans > 0 && row.apiGap / row.scans > 0.1) {
    return "API GAP";
  }
  if (row.totalScans > 0 && row.totalScans < 20) {
    return "SAMPLE TOO SMALL";
  }
  if (mainDrop === "No clear bottleneck / needs more data") {
    return "NEEDS REVIEW";
  }
  return "OK";
}

function diagnose_(row, mainDrop) {
  if (row.totalScans < 20) {
    return "Sample too small. Continue collecting data.";
  }
  if (mainDrop === "Submit -> API Success") {
    return "Likely API/tracking continuity issue in top funnel.";
  }
  if (mainDrop === "Result Rendering Gap") {
    return "Scans succeed but results are not rendering.";
  }
  if (mainDrop === "Low Valid Scan Rate") {
    return "Most scans lack sufficient context for valid analysis.";
  }
  if (mainDrop === "Low Medium/High Rate") {
    return "Few scans reach medium or high risk tier.";
  }
  if (mainDrop === "Low Research Response Rate") {
    return "Users complete scans but rarely fill the research form.";
  }
  if (mainDrop === "Refinement Shown -> Refinement Submitted") {
    return "Refinement is shown often but rarely submitted. Likely refinement UX friction or low intent.";
  }
  return "No clear dominant bottleneck in current data.";
}

function suggestAction_(row, mainDrop) {
  if (row.totalScans < 20) {
    return "Collect more data before changing the funnel.";
  }
  if (mainDrop === "Submit -> API Success") {
    return "Validate scan_api_success and scan_result_rendered telemetry continuity.";
  }
  if (mainDrop === "Result Rendering Gap") {
    return "Check scan_result_rendered telemetry and result rendering pipeline.";
  }
  if (mainDrop === "Low Valid Scan Rate") {
    return "Review input quality: fragment/link-only inputs may dominate.";
  }
  if (mainDrop === "Low Medium/High Rate") {
    return "Check whether acquisition quality or analysis calibration is suppressing meaningful classifications.";
  }
  if (mainDrop === "Low Research Response Rate") {
    return "Review research form visibility, timing, and perceived value.";
  }
  if (mainDrop === "Refinement Shown -> Refinement Submitted") {
    return "Simplify or demote refinement prompt and test whether CTA clarity improves.";
  }
  return "Collect another day before intervention.";
}

// ---------------------------------------------------------------------------
// Weekly Control Panel (v1.3) — hybrid: automated summary + manual decision log
// ---------------------------------------------------------------------------

function buildWeeklyControlPanel_(researchFunnelRows, acquisitionRows, userResearchRows) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(CFG.TABS.WEEKLY) || ss.insertSheet(CFG.TABS.WEEKLY);

  var weekEnd = getYesterdayMontrealDate_();
  var endDate = parseYmd_(weekEnd);
  var startDate = new Date(endDate.getTime());
  startDate.setUTCDate(startDate.getUTCDate() - 6);
  var weekStart = formatYmd_(startDate);

  var metrics = aggregateWeeklyResearchFunnel_(researchFunnelRows, weekStart, weekEnd);
  var acq = aggregateWeeklyAcquisition_(acquisitionRows, weekStart, weekEnd);
  var ur = aggregateWeeklyUserResearch_(userResearchRows, weekStart, weekEnd);

  // --- Automated section: rows 1–14. Only clear this zone. ---
  var autoRows = 14;
  var maxCol = Math.max(sh.getLastColumn(), 11);
  if (maxCol > 0 && autoRows > 0) {
    sh.getRange(1, 1, autoRows, maxCol).clear();
    sh.getRange(1, 1, autoRows, maxCol).setNumberFormat("@");
  }

  // Block 1 — Weekly Metrics (rows 1–3)
  var metricsHeaders = [
    "Week Start", "Week End", "Total Scans", "Valid Scans",
    "Avg Valid Scan Rate", "Medium/High Scans", "Avg Medium/High Scan Rate",
    "User Research Responses", "Avg Research / Scan Rate",
    "Main Weekly Bottleneck", "Suggested Weekly Focus",
  ];
  sh.getRange(1, 1, 1, metricsHeaders.length).setValues([metricsHeaders]);
  sh.getRange(1, 1, 1, metricsHeaders.length).setFontWeight("bold");

  var mainDrop = inferWeeklyBottleneck_(metrics);
  var weeklyFocus = suggestWeeklyFocus_(mainDrop);

  var metricsRow = [
    weekStart, weekEnd, metrics.totalScans, metrics.validScans,
    metrics.avgValidRate, metrics.medHighScans, metrics.avgMedHighRate,
    metrics.userResearchResponses, metrics.avgResearchRate,
    mainDrop, weeklyFocus,
  ];
  sh.getRange(2, 1, 1, metricsRow.length).setValues([metricsRow]);
  sh.getRange(2, 1).setNumberFormat("yyyy-mm-dd");  // Week Start
  sh.getRange(2, 2).setNumberFormat("yyyy-mm-dd");  // Week End
  sh.getRange(2, 3).setNumberFormat("0");            // Total Scans
  sh.getRange(2, 4).setNumberFormat("0");            // Valid Scans
  sh.getRange(2, 5).setNumberFormat("0.00%");        // Avg Valid Scan Rate
  sh.getRange(2, 6).setNumberFormat("0");            // Medium/High Scans
  sh.getRange(2, 7).setNumberFormat("0.00%");        // Avg Medium/High Scan Rate
  sh.getRange(2, 8).setNumberFormat("0");            // User Research Responses
  sh.getRange(2, 9).setNumberFormat("0.00%");        // Avg Research / Scan Rate
  sh.getRange(2, 10).setNumberFormat("@");           // Main Weekly Bottleneck
  sh.getRange(2, 11).setNumberFormat("@");           // Suggested Weekly Focus

  // Block 2 — Acquisition (rows 4–6, row 4 = header, row 5 = sub-header, row 6 = data)
  var acqHeaders = [
    "Top UTM Source", "Top Campaign", "Best Valid Scan Rate Source",
    "Worst Valid Scan Rate Source", "Paid Scan Count", "Organic Scan Count",
    "UTM Coverage Warning",
  ];
  sh.getRange(4, 1).setValue("ACQUISITION").setFontWeight("bold");
  sh.getRange(5, 1, 1, acqHeaders.length).setValues([acqHeaders]);
  sh.getRange(5, 1, 1, acqHeaders.length).setFontWeight("bold");

  var acqRow = [
    acq.topSource, acq.topCampaign, acq.bestValidRateSource,
    acq.worstValidRateSource, acq.paidScanCount, acq.organicScanCount,
    acq.utmWarning,
  ];
  sh.getRange(6, 1, 1, acqRow.length).setValues([acqRow]);
  sh.getRange(6, 1).setNumberFormat("@");            // Top UTM Source
  sh.getRange(6, 2).setNumberFormat("@");            // Top Campaign
  sh.getRange(6, 3).setNumberFormat("@");            // Best Valid Scan Rate Source
  sh.getRange(6, 4).setNumberFormat("@");            // Worst Valid Scan Rate Source
  sh.getRange(6, 5).setNumberFormat("0");            // Paid Scan Count
  sh.getRange(6, 6).setNumberFormat("0");            // Organic Scan Count
  sh.getRange(6, 7).setNumberFormat("@");            // UTM Coverage Warning

  // Block 3 — User Research (rows 8–10)
  var urHeaders = [
    "Research Response Count", "Dominant User Need", "Pricing Signal",
    "Product Signal", "Quote / Note", "Needs LLM Review?",
  ];
  sh.getRange(8, 1).setValue("USER RESEARCH").setFontWeight("bold");
  sh.getRange(9, 1, 1, urHeaders.length).setValues([urHeaders]);
  sh.getRange(9, 1, 1, urHeaders.length).setFontWeight("bold");

  var urRow = [
    ur.responseCount, ur.dominantNeed, ur.pricingSignal,
    ur.productSignal, "", ur.needsLlmReview,
  ];
  sh.getRange(10, 1, 1, urRow.length).setValues([urRow]);
  sh.getRange(10, 1).setNumberFormat("0");           // Research Response Count
  sh.getRange(10, 2).setNumberFormat("@");           // Dominant User Need
  sh.getRange(10, 3).setNumberFormat("@");           // Pricing Signal
  sh.getRange(10, 4).setNumberFormat("@");           // Product Signal
  sh.getRange(10, 5).setNumberFormat("@");           // Quote / Note
  sh.getRange(10, 6).setNumberFormat("@");           // Needs LLM Review?

  // Block 4 — LLM Prompt (rows 12–13)
  sh.getRange(12, 1).setValue("LLM Prompt (copy/paste):").setFontWeight("bold");
  sh.getRange(13, 1).setValue(
    "Using Weekly Control Panel, Daily Pulse, DATA_Acquisition Signal Quality, " +
    "and DATA_User Research, recommend one weekly priority only."
  );

  // --- Manual section: row 16+ — seed once, never overwrite. ---
  var manualHeaderRow = 16;
  var manualDataRow = manualHeaderRow + 1;
  var existingManual = "";
  try {
    existingManual = sh.getRange(manualDataRow, 1).getValue();
  } catch (_) { /* empty sheet edge case */ }

  if (!existingManual) {
    var decisionHeaders = [
      "Week Start", "Founder Decision", "Next Experiment",
      "Review Date", "Notes",
    ];
    sh.getRange(manualHeaderRow, 1)
      .setValue("WEEKLY DECISION LOG")
      .setFontWeight("bold");
    sh.getRange(manualDataRow, 1, 1, decisionHeaders.length)
      .setValues([decisionHeaders]);
    sh.getRange(manualDataRow, 1, 1, decisionHeaders.length)
      .setFontWeight("bold");
  }

  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, metricsHeaders.length);
}

function aggregateWeeklyResearchFunnel_(rows, weekStart, weekEnd) {
  var totalScans = 0, validScans = 0, medHighScans = 0, urResponses = 0;

  (rows || []).forEach(function (r) {
    var d = String(r.day_montreal || "");
    if (d >= weekStart && d <= weekEnd) {
      totalScans += num_(r.scans_table_scan_count);
      validScans += num_(r.valid_scan_count);
      medHighScans += num_(r.medium_high_scan_count);
      urResponses += num_(r.user_research_responses);
    }
  });

  return {
    totalScans: totalScans,
    validScans: validScans,
    avgValidRate: totalScans > 0 ? validScans / totalScans : 0,
    medHighScans: medHighScans,
    avgMedHighRate: totalScans > 0 ? medHighScans / totalScans : 0,
    userResearchResponses: urResponses,
    avgResearchRate: totalScans > 0 ? urResponses / totalScans : 0,
  };
}

function aggregateWeeklyAcquisition_(rows, weekStart, weekEnd) {
  var sourceMap = {};   // utm_source -> { scans, valid }
  var campaignMap = {}; // utm_campaign -> { scans }
  var paidScans = 0;
  var organicScans = 0;
  var totalScans = 0;
  var emptySourceScans = 0;

  (rows || []).forEach(function (r) {
    var d = String(r.day_montreal || "");
    if (d < weekStart || d > weekEnd) return;

    var src = String(r.utm_source || "").toLowerCase();
    var med = String(r.utm_medium || "").toLowerCase();
    var camp = String(r.utm_campaign || "");
    var sc = num_(r.scan_count);
    var vc = num_(r.valid_scan_count);
    var vr = num_(r.valid_scan_rate);

    totalScans += sc;

    var srcKey = r.utm_source || "(none)";
    if (!sourceMap[srcKey]) sourceMap[srcKey] = { scans: 0, valid: 0 };
    sourceMap[srcKey].scans += sc;
    sourceMap[srcKey].valid += vc;

    var campKey = camp || "(none)";
    if (!campaignMap[campKey]) campaignMap[campKey] = { scans: 0 };
    campaignMap[campKey].scans += sc;

    if (med.indexOf("cpc") >= 0 || med.indexOf("paid") >= 0) {
      paidScans += sc;
    }
    if (!med || med === "(none)" || med === "organic" || med === "none") {
      organicScans += sc;
    }
    if (!src || src === "(none)" || src === "none") {
      emptySourceScans += sc;
    }
  });

  var topSource = "(none)";
  var topCampaign = "(none)";
  var bestValidRateSource = "Not enough data";
  var worstValidRateSource = "Not enough source-level volume";
  var bestRate = -1;
  var worstRate = 2;

  var sources = Object.keys(sourceMap);
  sources.forEach(function (s) {
    var info = sourceMap[s];
    if (info.scans > (sourceMap[topSource] || { scans: 0 }).scans) topSource = s;
    var rate = info.scans > 0 ? info.valid / info.scans : 0;
    if (info.scans >= 5 && rate > bestRate) {
      bestRate = rate;
      bestValidRateSource = s;
    }
    if (info.scans >= 20 && rate < worstRate) {
      worstRate = rate;
      worstValidRateSource = s;
    }
  });

  var campaigns = Object.keys(campaignMap);
  campaigns.forEach(function (c) {
    if (campaignMap[c].scans > (campaignMap[topCampaign] || { scans: 0 }).scans) {
      topCampaign = c;
    }
  });

  var utmWarning = "";
  if (totalScans > 0 && emptySourceScans / totalScans > 0.5) {
    utmWarning = "UTM attribution incomplete \u2014 keyword-level optimization unavailable.";
  }

  return {
    topSource: topSource,
    topCampaign: topCampaign,
    bestValidRateSource: bestValidRateSource,
    worstValidRateSource: worstValidRateSource,
    paidScanCount: paidScans,
    organicScanCount: organicScans,
    utmWarning: utmWarning,
  };
}

function aggregateWeeklyUserResearch_(rows, weekStart, weekEnd) {
  var count = 0;
  var needCounts = {};
  var priceCounts = {};
  var helpCounts = {};

  (rows || []).forEach(function (r) {
    var ts = String(r.submitted_at || "").substring(0, 10);
    if (ts < weekStart || ts > weekEnd) return;
    count++;

    var need = String(r.situation || "").trim();
    if (need) needCounts[need] = (needCounts[need] || 0) + 1;

    var price = String(r.price_range || "").trim();
    if (price) priceCounts[price] = (priceCounts[price] || 0) + 1;

    var help = String(r.desired_help || "").trim();
    if (help) helpCounts[help] = (helpCounts[help] || 0) + 1;
  });

  return {
    responseCount: count,
    dominantNeed: topKey_(needCounts),
    pricingSignal: topKey_(priceCounts),
    productSignal: topKey_(helpCounts),
    needsLlmReview: count >= 5 ? "Yes" : "Not enough data",
  };
}

function topKey_(counts) {
  var best = "";
  var max = 0;
  var keys = Object.keys(counts);
  for (var i = 0; i < keys.length; i++) {
    if (counts[keys[i]] > max) {
      max = counts[keys[i]];
      best = keys[i];
    }
  }
  return best || "(none)";
}

function inferWeeklyBottleneck_(m) {
  if (m.totalScans < 20) return "No clear bottleneck / needs more data";
  if (m.avgValidRate < 0.3) return "Low Valid Scan Rate";
  if (m.avgMedHighRate < 0.1) return "Low Medium/High Rate";
  if (m.avgResearchRate < 0.03) return "Low Research Response Rate";
  return "No clear bottleneck / needs more data";
}

function suggestWeeklyFocus_(mainDrop) {
  if (mainDrop === "Low Valid Scan Rate") {
    return "Focus on input quality: review acquisition sources producing invalid scans.";
  }
  if (mainDrop === "Low Medium/High Rate") {
    return "Focus on risk classification: check analysis calibration and acquisition quality.";
  }
  if (mainDrop === "Low Research Response Rate") {
    return "Focus on research form: review visibility, timing, and perceived value.";
  }
  return "No single bottleneck dominates. Review Daily Pulse trends for emerging patterns.";
}

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

/**
 * Operating Map (v1.2)
 *
 * System-of-record for the entire Founder Control Panel workbook.
 * Lists every tab with its layer, purpose, data flow, and status.
 *
 * Seed-once: only populates when the tab is empty so the founder
 * can annotate freely without losing edits on daily refresh.
 */
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

function ensureTabWithHeaders_(ss, tabName, headers) {
  const sh = ss.getSheetByName(tabName) || ss.insertSheet(tabName);
  if (!headers || headers.length === 0) return;
  const lastCol = sh.getLastColumn();
  const lastRow = sh.getLastRow();
  if (lastRow === 0 || lastCol === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, headers.length);
  }
}

function applyColumnFormats_(sheet, headers, rowCount) {
  if (!headers || headers.length === 0 || rowCount <= 0) return;

  const startRow = 2;
  const totalCols = headers.length;
  const dataRange = sheet.getRange(startRow, 1, rowCount, totalCols);

  // Baseline to plain number format across full data block to prevent
  // old currency/percent formats from persisting.
  dataRange.setNumberFormat("0");

  headers.forEach((header, idx) => {
    const h = String(header || "").toLowerCase();
    const col = idx + 1;
    const colRange = sheet.getRange(startRow, col, rowCount, 1);

    const isRateCol =
      h.includes("rate") || h.includes("pct") || h.includes("ctr");
    const isDateCol = h === "day_montreal" || h === "date";

    if (isRateCol) {
      colRange.setNumberFormat("0.00%");
    } else if (isDateCol) {
      colRange.setNumberFormat("yyyy-mm-dd");
    }
  });
}

function getYesterdayMontrealDate_() {
  const today = parseYmd_(getTodayMontrealDate_());
  today.setUTCDate(today.getUTCDate() - 1);
  return formatYmd_(today);
}

function getTodayMontrealDate_() {
  return Utilities.formatDate(new Date(), "America/Montreal", "yyyy-MM-dd");
}

function setSecrets_(supabaseUrl, supabaseKey) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty("SUPABASE_URL", String(supabaseUrl || "").trim());
  props.setProperty("SUPABASE_KEY", String(supabaseKey || "").trim());
}

function assertConfig_() {
  if (!CFG.SUPABASE_URL || !CFG.SUPABASE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_KEY in Script Properties.");
  }
}

function num_(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseYmd_(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ""));
  if (!m) {
    throw new Error(`Invalid ymd: ${ymd}`);
  }
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function formatYmd_(d) {
  return Utilities.formatDate(d, "UTC", "yyyy-MM-dd");
}
