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
