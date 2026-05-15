/**
 * RETIRED — do not deploy.
 *
 * Survey experiment responses are stored in Supabase (`survey_experiment_responses`)
 * and synced to the Founder Control Center via `ops_survey_experiment_export_v1`
 * → tab `DATA_Survey_Experiments` in founder_control_panel.gs.
 *
 * Next.js writes via POST /api/parking-text/sheet using SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY (see app/api/parking-text/sheet/route.ts).
 *
 * This file is kept for reference only. Remove from the bound Apps Script project
 * if it was previously added. Do not deploy a Web App for parking survey ingestion.
 */

var PARKING_TAB = "DATA_PARKING_TEXT_V1";

var HEADER_ORDER = [
  "created_at",
  "page_version",
  "checklist_version",
  "privacy_note_version",
  "concern_note_id",
  "session_id",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "referrer",
  "page_url",
  "language",
  "q1_status",
  "q1_other",
  "q2_main_concern",
  "q2_other",
  "q3_product_discovery",
  "q4_open_text",
  "checklist_branch",
  "copied_checklist",
  "copied_checklist_at",
  "checklist_useful",
  "checklist_missing_feedback",
  "checklist_feedback_at",
  "user_agent",
];

var SECRET_KEY = "PARKING_TEXT_SHEET_WEBHOOK_SECRET";

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut_({ ok: false, error: "empty_body" });
    }
    var body = JSON.parse(e.postData.contents);
    if (!body || typeof body !== "object") {
      return jsonOut_({ ok: false, error: "invalid_json" });
    }

    var expected = PropertiesService.getScriptProperties().getProperty(SECRET_KEY);
    if (!expected || body.webhook_secret !== expected) {
      return jsonOut_({ ok: false, error: "unauthorized" });
    }
    delete body.webhook_secret;

    var action = String(body.action || "").trim();
    if (action === "submit_completed_survey") {
      return handleSubmit_(body);
    }
    if (action === "checklist_copied") {
      return handleCopied_(body);
    }
    if (action === "checklist_feedback") {
      return handleFeedback_(body);
    }
    return jsonOut_({ ok: false, error: "invalid_action" });
  } catch (err) {
    return jsonOut_({ ok: false, error: "server_error" });
  }
}

function handleSubmit_(body) {
  var sh = ensureSheet_();
  trimBodyStrings_(body);
  capOpenText_(body, "q1_other", 500);
  capOpenText_(body, "q2_other", 500);
  capOpenText_(body, "q4_open_text", 500);

  var row = HEADER_ORDER.map(function (key) {
    if (key === "copied_checklist") {
      return body.copied_checklist === true || body.copied_checklist === "true";
    }
    var v = body[key];
    if (v === undefined || v === null) return "";
    if (typeof v === "boolean") return v;
    return String(v);
  });

  sh.appendRow(row);
  return jsonOut_({ ok: true });
}

function handleCopied_(body) {
  var sessionId = String(body.session_id || "").trim();
  var at = String(body.copied_checklist_at || "").trim();
  if (!sessionId) {
    return jsonOut_({ ok: false, error: "missing_session_id" });
  }

  var sh = ensureSheet_();
  var map = headerMap_(sh);
  if (!map.session_id || !map.copied_checklist || !map.copied_checklist_at) {
    return jsonOut_({ ok: false, error: "bad_headers" });
  }

  var last = sh.getLastRow();
  if (last < 2) {
    return jsonOut_({ ok: false, error: "session_id_not_found" });
  }

  var rowIndex = findRowBySessionId_(sh, map.session_id, sessionId);
  if (rowIndex < 0) {
    return jsonOut_({ ok: false, error: "session_id_not_found" });
  }

  sh.getRange(rowIndex, map.copied_checklist).setValue(true);
  sh.getRange(rowIndex, map.copied_checklist_at).setValue(at);
  return jsonOut_({ ok: true });
}

function handleFeedback_(body) {
  var sessionId = String(body.session_id || "").trim();
  if (!sessionId) {
    return jsonOut_({ ok: false, error: "missing_session_id" });
  }

  trimBodyStrings_(body);
  capOpenText_(body, "checklist_missing_feedback", 500);

  var useful = String(body.checklist_useful || "").trim();
  var missing = String(body.checklist_missing_feedback || "");
  var at = String(body.checklist_feedback_at || "").trim();

  var sh = ensureSheet_();
  var map = headerMap_(sh);
  if (
    !map.session_id ||
    !map.checklist_useful ||
    !map.checklist_missing_feedback ||
    !map.checklist_feedback_at
  ) {
    return jsonOut_({ ok: false, error: "bad_headers" });
  }

  var rowIndex = findRowBySessionId_(sh, map.session_id, sessionId);
  if (rowIndex < 0) {
    return jsonOut_({ ok: false, error: "session_id_not_found" });
  }

  sh.getRange(rowIndex, map.checklist_useful).setValue(useful);
  sh.getRange(rowIndex, map.checklist_missing_feedback).setValue(missing);
  sh.getRange(rowIndex, map.checklist_feedback_at).setValue(at);
  return jsonOut_({ ok: true });
}

function findRowBySessionId_(sh, colSession, sessionId) {
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var vals = sh.getRange(2, colSession, last, colSession).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0] || "").trim() === sessionId) {
      return i + 2;
    }
  }
  return -1;
}

function ensureSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(PARKING_TAB);
  if (!sh) {
    sh = ss.insertSheet(PARKING_TAB);
  }
  var first = sh.getRange(1, 1, 1, HEADER_ORDER.length).getValues()[0];
  var empty = first.every(function (c) {
    return String(c || "").trim() === "";
  });
  if (empty) {
    sh.getRange(1, 1, 1, HEADER_ORDER.length).setValues([HEADER_ORDER]);
    return sh;
  }
  syncMissingHeaders_(sh);
  return sh;
}

/** Add feedback columns before user_agent on sheets created before v1.1. */
function syncMissingHeaders_(sh) {
  var map = headerMap_(sh);
  if (map.checklist_useful && map.checklist_missing_feedback && map.checklist_feedback_at) {
    return;
  }
  if (!map.user_agent) {
    return;
  }
  var colUser = map.user_agent;
  sh.insertColumnsBefore(colUser, 3);
  sh.getRange(1, colUser, 1, colUser + 2).setValues([
    ["checklist_useful", "checklist_missing_feedback", "checklist_feedback_at"],
  ]);
}

function headerMap_(sh) {
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || "").trim();
    if (h) map[h] = i + 1;
  }
  return map;
}

function trimBodyStrings_(body) {
  var keys = Object.keys(body);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (typeof body[k] === "string") {
      body[k] = body[k].trim();
    }
  }
}

function capOpenText_(body, field, maxLen) {
  if (typeof body[field] !== "string") return;
  if (body[field].length > maxLen) {
    body[field] = body[field].substring(0, maxLen);
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
