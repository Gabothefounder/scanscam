import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/proReports/serviceSupabase";

export const runtime = "nodejs";

const ALLOWED_KEYS = new Set(["arrival","identity","pressure","emotion","request","interruption"]);
const ALLOWED_MODES = new Set(["scan","lived","helping","learn"]);

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function sanitizeSignals(value: unknown): Record<string, string[]> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, string[]> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    if (!Array.isArray(raw)) return null;
    const vals = raw
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim().slice(0, 64))
      .filter(Boolean)
      .slice(0, 12);
    out[key] = Array.from(new Set(vals));
  }
  return out;
}

export async function POST(req: NextRequest) {
  let supabase;
  try {
    supabase = getServiceSupabase();
  } catch {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;

  if (o.consent !== true) {
    return NextResponse.json({ ok: false, error: "consent_required" }, { status: 400 });
  }

  const sessionId = isUuid(o.session_id) ? o.session_id : null;
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "invalid_session_id" }, { status: 400 });
  }

  const lang = o.lang === "fr" ? "fr" : o.lang === "en" ? "en" : null;
  const entryMode = typeof o.entry_mode === "string" && ALLOWED_MODES.has(o.entry_mode)
    ? o.entry_mode
    : null;
  const selectedSignals = sanitizeSignals(o.selected_signals);
  const actionIds = Array.isArray(o.action_ids)
    ? Array.from(new Set(o.action_ids.filter((x): x is string => typeof x === "string")
      .map((x) => x.trim().slice(0, 64)).filter(Boolean))).slice(0, 12)
    : [];

  if (!lang || !entryMode || !selectedSignals) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const scanId = isUuid(o.scan_id) ? o.scan_id : null;
  const consentVersion = typeof o.consent_version === "string"
    ? o.consent_version.trim().slice(0, 64)
    : "atlas_pattern_v1";

  const row = {
    session_id: sessionId,
    scan_id: scanId,
    lang,
    entry_mode: entryMode,
    selected_signals: selectedSignals,
    action_ids: actionIds,
    consent_version: consentVersion || "atlas_pattern_v1",
    consented_at: new Date().toISOString(),
    share_scope: "anonymous_pattern",
    private_text_included: false,
  };

  const { error } = await supabase
    .from("atlas_contributions")
    .upsert(row, { onConflict: "session_id" });

  if (error) {
    return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
