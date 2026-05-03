import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/proReports/serviceSupabase";
import { mergeReportFeedbackIntoSnapshot } from "@/lib/proReports/mergeReportSnapshotFeedback";

export const runtime = "nodejs";

const MAX_FEEDBACK_TEXT = 2000;
const WORTH_FIVE = new Set(["yes", "not_yet", "maybe_more_detail"] as const);

type WorthFive = "yes" | "not_yet" | "maybe_more_detail";

/**
 * Append structured feedback to pro_report_access.report_snapshot.report_feedback.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const token = String(o.token ?? "").trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "token required" }, { status: 400 });
  }

  if (typeof o.useful !== "boolean") {
    return NextResponse.json({ ok: false, error: "useful must be a boolean" }, { status: 400 });
  }

  let feedback_text = typeof o.feedback_text === "string" ? o.feedback_text.trim() : "";
  if (feedback_text.length > MAX_FEEDBACK_TEXT) {
    return NextResponse.json({ ok: false, error: "feedback_text too long" }, { status: 400 });
  }

  let worth_five: WorthFive | null = null;
  if (o.worth_five != null && o.worth_five !== "") {
    const w = String(o.worth_five).trim();
    if (!WORTH_FIVE.has(w as WorthFive)) {
      return NextResponse.json({ ok: false, error: "invalid worth_five" }, { status: 400 });
    }
    worth_five = w as WorthFive;
  }

  const supabase = getServiceSupabase();
  const { data: row, error: selErr } = await supabase
    .from("pro_report_access")
    .select("id, expires_at, report_snapshot")
    .eq("access_token", token)
    .maybeSingle();

  if (selErr) {
    return NextResponse.json({ ok: false, error: "lookup failed" }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  const expiresAt = new Date(String((row as { expires_at: string }).expires_at));
  if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "expired" }, { status: 410 });
  }

  const report_feedback = {
    useful: o.useful as boolean,
    feedback_text: feedback_text || undefined,
    worth_five: worth_five ?? undefined,
    submitted_at: new Date().toISOString(),
  };

  const merged = mergeReportFeedbackIntoSnapshot((row as { report_snapshot: unknown }).report_snapshot, report_feedback);

  const { error: upErr } = await supabase
    .from("pro_report_access")
    .update({ report_snapshot: merged })
    .eq("id", String((row as { id: string }).id));

  if (upErr) {
    return NextResponse.json({ ok: false, error: "update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
