import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/proReports/serviceSupabase";
import {
  CHECKLIST_VERSION,
  EXPERIMENT_ID,
  LANGUAGE,
  PAGE_VERSION,
  PRIVACY_NOTE_VERSION,
} from "@/lib/parkingTicketText/constants";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FEEDBACK_USEFUL = new Set(["Yes", "Somewhat", "No"]);

const MAX_OPEN_TEXT = 500;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function capOpenText(value: string): string {
  const t = value.trim();
  return t.length > MAX_OPEN_TEXT ? t.slice(0, MAX_OPEN_TEXT) : t;
}

function parseSessionId(raw: unknown): string | null {
  const id = str(raw).trim();
  if (!id || !UUID_RE.test(id)) return null;
  return id;
}

export async function POST(req: NextRequest) {
  let supabase;
  try {
    supabase = getServiceSupabase();
  } catch {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const o = raw as Record<string, unknown>;
  const action = str(o.action).trim();

  if (action === "submit_completed_survey") {
    const sessionId = parseSessionId(o.session_id);
    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "missing_session_id" }, { status: 400 });
    }

    const row = {
      session_id: sessionId,
      experiment_id: EXPERIMENT_ID,
      page_version: str(o.page_version).trim() || PAGE_VERSION,
      checklist_version: str(o.checklist_version).trim() || CHECKLIST_VERSION,
      privacy_note_version: str(o.privacy_note_version).trim() || PRIVACY_NOTE_VERSION,
      concern_note_id: str(o.concern_note_id).trim(),
      utm_source: str(o.utm_source).trim(),
      utm_medium: str(o.utm_medium).trim(),
      utm_campaign: str(o.utm_campaign).trim(),
      utm_content: str(o.utm_content).trim(),
      utm_term: str(o.utm_term).trim(),
      referrer: str(o.referrer).trim(),
      page_url: str(o.page_url).trim(),
      language: str(o.language).trim() || LANGUAGE,
      q1_status: str(o.q1_status).trim(),
      q1_other: capOpenText(str(o.q1_other)),
      q2_main_concern: str(o.q2_main_concern).trim(),
      q2_other: capOpenText(str(o.q2_other)),
      q3_product_discovery: str(o.q3_product_discovery).trim(),
      q4_open_text: capOpenText(str(o.q4_open_text)),
      checklist_branch: str(o.checklist_branch).trim(),
      copied_checklist: false,
      copied_checklist_at: null,
      checklist_useful: "",
      checklist_missing_feedback: "",
      checklist_feedback_at: null,
      user_agent: str(o.user_agent).trim() || null,
    };

    const { error } = await supabase.from("survey_experiment_responses").insert(row);

    if (error) {
      const code = (error as { code?: string }).code ?? "";
      if (code === "23505") {
        return NextResponse.json({ ok: true, already: true });
      }
      return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "checklist_copied") {
    const sessionId = parseSessionId(o.session_id);
    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "missing_session_id" }, { status: 400 });
    }
    const at = str(o.copied_checklist_at).trim() || new Date().toISOString();

    const { error } = await supabase
      .from("survey_experiment_responses")
      .update({
        copied_checklist: true,
        copied_checklist_at: at,
      })
      .eq("session_id", sessionId);

    if (error) {
      return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "checklist_feedback") {
    const sessionId = parseSessionId(o.session_id);
    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "missing_session_id" }, { status: 400 });
    }
    const useful = str(o.checklist_useful).trim();
    if (!FEEDBACK_USEFUL.has(useful)) {
      return NextResponse.json({ ok: false, error: "invalid_checklist_useful" }, { status: 400 });
    }
    const missing = capOpenText(str(o.checklist_missing_feedback));
    const at = str(o.checklist_feedback_at).trim() || new Date().toISOString();

    const { error } = await supabase
      .from("survey_experiment_responses")
      .update({
        checklist_useful: useful,
        checklist_missing_feedback: missing,
        checklist_feedback_at: at,
      })
      .eq("session_id", sessionId);

    if (error) {
      return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
}
