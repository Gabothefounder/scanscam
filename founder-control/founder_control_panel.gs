const CFG = {
  SUPABASE_URL: PropertiesService.getScriptProperties().getProperty("SUPABASE_URL"),
  SUPABASE_KEY: PropertiesService.getScriptProperties().getProperty("SUPABASE_KEY"),
  VIEWS: {
    FUNNEL: "ops_public_funnel_daily_clean_v1",
    CTA: "ops_public_cta_segments_clean_v1",
  },
  TABS: {
    FUNNEL: "Public Funnel",
    CTA: "CTA Segments",
    DAILY: "Daily Public Control",
    META: "_Meta",
  },
};

function refreshFounderControlPanel() {
  assertConfig_();

  const funnelRows = fetchViewRows_(CFG.VIEWS.FUNNEL);
  const ctaRows = fetchViewRows_(CFG.VIEWS.CTA);

  writeTab_(CFG.TABS.FUNNEL, funnelRows);
  writeTab_(CFG.TABS.CTA, ctaRows);

  const dailyResult = buildDailyPublicControl_(funnelRows);

  stampRefresh_({
    sourceViews: [CFG.VIEWS.FUNNEL, CFG.VIEWS.CTA],
    selectedDate: dailyResult.selectedDate,
    dayStatus: dailyResult.dayStatus,
    warnings: dailyResult.warnings,
  });
}

function fetchViewRows_(viewName) {
  const url =
    `${CFG.SUPABASE_URL}/rest/v1/${encodeURIComponent(viewName)}` +
    `?select=*&order=day_montreal.desc`;

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
  sh.clearContents();

  if (!rows || rows.length === 0) {
    sh.getRange(1, 1).setValue("No rows returned");
    return;
  }

  const headers = Object.keys(rows[0]);
  const values = rows.map((r) => headers.map((h) => r[h]));

  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.getRange(2, 1, values.length, headers.length).setValues(values);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, headers.length);
}

function buildDailyPublicControl_(funnelRows) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(CFG.TABS.DAILY) || ss.insertSheet(CFG.TABS.DAILY);
  sh.clearContents();

  const headers = [
    "Date",
    "Day Status",
    "Scans",
    "Results",
    "CTA Shown",
    "CTA Clicked",
    "Sales Page Views",
    "Unlock Completed",
    "Payment Completed",
    "Refinement Shown",
    "Refinement Submitted",
    "Errors / API Gap",
    "Main Drop-Off",
    "Auto Diagnosis",
    "Suggested Action",
    "Founder Approved?",
    "Decision Logged?",
    "Experiment Logged?",
    "Notes",
  ];

  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.setFrozenRows(1);

  const picked = selectTargetDailyRow_(funnelRows);
  if (!picked.row) {
    sh.getRange(2, 1).setValue("No daily funnel rows available");
    return {
      selectedDate: "",
      dayStatus: "NO DATA",
      warnings: ["No funnel rows returned from Supabase."],
    };
  }

  const row = picked.row;
  const scans = num_(row.scan_submit_clicked_sessions);
  const apiSuccess = num_(row.scan_api_success_sessions);
  const results = num_(row.scan_result_rendered_sessions);
  const ctaShown = num_(row.cta_shown_scans);
  const ctaClicked = num_(row.cta_clicked_scans);
  const salesViews = num_(row.pro_sales_viewed_scans);
  const unlockCompleted = num_(row.beta_unlock_completed_scans);
  const paymentCompleted = num_(row.payment_completed_scans);
  const refinementShown = num_(row.context_refinement_shown_scans);
  const refinementSubmitted = num_(row.context_refinement_submitted_scans);
  const apiGap = Math.max(scans - apiSuccess, 0);

  const diagnosisCtx = {
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
  };

  const mainDrop = inferMainDropOff_(diagnosisCtx);
  const diagnosis = diagnose_(diagnosisCtx, mainDrop);
  const suggestedAction = suggestAction_(diagnosisCtx, mainDrop);

  const outputRow = [
    picked.date,
    picked.status,
    scans,
    results,
    ctaShown,
    ctaClicked,
    salesViews,
    unlockCompleted,
    paymentCompleted,
    refinementShown,
    refinementSubmitted,
    apiGap,
    mainDrop,
    diagnosis,
    suggestedAction,
    "",
    "",
    "",
    "",
  ];

  sh.getRange(2, 1, 1, outputRow.length).setValues([outputRow]);
  sh.autoResizeColumns(1, headers.length);

  const promptStart = 5;
  sh.getRange(promptStart, 1).setValue("LLM Prompt (copy/paste):");
  sh
    .getRange(promptStart + 1, 1)
    .setValue(
      "Using the latest Daily Public Control row and CTA Segments tab, identify the biggest public-funnel bottleneck. Distinguish tracking issues from product/UI/copy issues. Recommend one action only. Do not invent metrics. If the selected day is a partial day, say so and do not overread."
    );

  return {
    selectedDate: picked.date,
    dayStatus: picked.status,
    warnings: picked.warnings,
  };
}

function selectTargetDailyRow_(funnelRows) {
  const today = getTodayMontrealDate_();
  const yesterday = getYesterdayMontrealDate_();
  const warnings = [];

  if (!Array.isArray(funnelRows) || funnelRows.length === 0) {
    return { row: null, date: "", status: "NO DATA", warnings: ["No rows returned from view."] };
  }

  const byDate = new Map();
  funnelRows.forEach((r) => {
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
      status: "PARTIAL DAY - DO NOT OVERREAD",
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
  if (m.scans > 0 && m.apiGap / m.scans > 0.1) {
    return "Submit -> API Success";
  }

  const ctaCtr = m.ctaShown > 0 ? m.ctaClicked / m.ctaShown : null;
  if (m.ctaShown > 0 && ctaCtr != null && ctaCtr < 0.2) {
    return "CTA Shown -> CTA Clicked";
  }

  if (m.ctaClicked > 0 && m.salesViews < m.ctaClicked) {
    return "CTA Clicked -> Sales Page";
  }

  if (m.salesViews > 0 && Math.max(m.unlockCompleted, m.paymentCompleted) < m.salesViews) {
    return "Sales Page -> Unlock/Payment";
  }

  const refinementRate = m.refinementShown > 0 ? m.refinementSubmitted / m.refinementShown : null;
  if (m.refinementShown >= 10 && refinementRate != null && refinementRate < 0.25) {
    return "Refinement Shown -> Refinement Submitted";
  }

  return "No clear bottleneck / needs more data";
}

function diagnose_(row, mainDrop) {
  if (row.scans < 20) {
    return "Sample too small. Continue collecting data.";
  }
  if (mainDrop === "Submit -> API Success") {
    return "Likely API/tracking continuity issue in top funnel.";
  }
  if (mainDrop === "CTA Shown -> CTA Clicked") {
    return "CTA is visible but users are not clicking. Likely CTA relevance/messaging friction.";
  }
  if (mainDrop === "CTA Clicked -> Sales Page") {
    return "Users click CTA but do not reach sales page. Likely routing or tracking issue.";
  }
  if (mainDrop === "Sales Page -> Unlock/Payment") {
    return "Users reach sales page but do not unlock/pay. Likely offer/checkout friction.";
  }
  if (mainDrop === "Refinement Shown -> Refinement Submitted") {
    return "Refinement is shown often but rarely submitted. Likely refinement UX friction or low intent.";
  }
  return "No clear dominant bottleneck in current data.";
}

function suggestAction_(row, mainDrop) {
  if (row.scans < 20) {
    return "Collect more data before changing the funnel.";
  }
  if (mainDrop === "Submit -> API Success") {
    return "Validate scan_api_success and scan_result_rendered telemetry continuity.";
  }
  if (mainDrop === "CTA Shown -> CTA Clicked") {
    return "A/B test CTA copy/placement for the highest-volume CTA segment.";
  }
  if (mainDrop === "CTA Clicked -> Sales Page") {
    return "Check CTA click routing into pro sales page.";
  }
  if (mainDrop === "Sales Page -> Unlock/Payment") {
    return "Review sales page / unlock copy and friction.";
  }
  if (mainDrop === "Refinement Shown -> Refinement Submitted") {
    return "Simplify or demote refinement prompt and test whether CTA clarity improves.";
  }
  return "Collect another day before intervention.";
}

function stampRefresh_(meta) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(CFG.TABS.META) || ss.insertSheet(CFG.TABS.META);
  sh.clearContents();

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
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, 2);
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
