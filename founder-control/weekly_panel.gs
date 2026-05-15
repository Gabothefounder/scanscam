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
