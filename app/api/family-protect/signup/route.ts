import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/proReports/serviceSupabase";
import { sendFamilyProtectSignupNotification } from "@/lib/familyProtectSignupEmail";
import { logEvent } from "@/lib/observability";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;
const MAX_FIRST_NAME = 80;
const MAX_CONCERN = 2000;
const MAX_ATTR = 512;
const MAX_LANDING = 1024;

const WHO_PROTECT = new Set([
  "parent",
  "grandparent",
  "partner",
  "family",
  "self",
  "other",
]);

function normalizeFirstName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_FIRST_NAME) return null;
  return trimmed;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed.length > MAX_EMAIL_LEN) return null;
  if (!EMAIL_RE.test(trimmed)) return null;
  return trimmed;
}

function optionalAttr(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

/**
 * POST /api/family-protect/signup
 *
 * Stores a family-protection early-access signup in
 * `public.family_protect_signups`. Returns { ok: true } only — never echoes
 * stored PII. Founder email notification is best-effort after persist.
 */
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

  const firstName = normalizeFirstName(o.first_name);
  if (!firstName) {
    return NextResponse.json({ ok: false, error: "invalid_first_name" }, { status: 400 });
  }

  const email = normalizeEmail(o.email);
  if (!email) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  const whoProtect = String(o.who_protect ?? "").trim();
  if (!WHO_PROTECT.has(whoProtect)) {
    return NextResponse.json({ ok: false, error: "invalid_who_protect" }, { status: 400 });
  }

  const concernRaw =
    typeof o.concern_text === "string" ? o.concern_text.trim() : "";
  if (concernRaw.length > MAX_CONCERN) {
    return NextResponse.json({ ok: false, error: "concern_too_long" }, { status: 400 });
  }
  const concernText = concernRaw.length > 0 ? concernRaw : null;

  const langRaw = typeof o.lang === "string" ? o.lang.trim().toLowerCase() : "";
  const lang: "en" | "fr" | null =
    langRaw === "fr" ? "fr" : langRaw === "en" ? "en" : null;

  if (o.contact_consent !== true) {
    return NextResponse.json({ ok: false, error: "consent_required" }, { status: 400 });
  }

  const contactConsentAt = new Date().toISOString();
  const row = {
    first_name: firstName,
    email,
    who_protect: whoProtect,
    concern_text: concernText,
    lang,
    utm_source: optionalAttr(o.utm_source, MAX_ATTR),
    utm_medium: optionalAttr(o.utm_medium, MAX_ATTR),
    utm_campaign: optionalAttr(o.utm_campaign, MAX_ATTR),
    utm_term: optionalAttr(o.utm_term, MAX_ATTR),
    utm_content: optionalAttr(o.utm_content, MAX_ATTR),
    gclid: optionalAttr(o.gclid, MAX_ATTR),
    referrer: optionalAttr(o.referrer, MAX_ATTR),
    landing_path: optionalAttr(o.landing_path, MAX_LANDING),
    contact_consent_at: contactConsentAt,
  };

  const { error } = await supabase.from("family_protect_signups").insert(row);

  if (error) {
    return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });
  }

  try {
    const notify = await sendFamilyProtectSignupNotification({
      first_name: firstName,
      email,
      who_protect: whoProtect,
      lang,
      utm_source: row.utm_source,
      utm_medium: row.utm_medium,
      utm_campaign: row.utm_campaign,
      utm_term: row.utm_term,
      utm_content: row.utm_content,
      gclid: row.gclid,
      concern_submitted: concernText !== null,
      signup_at: contactConsentAt,
    });

    if (!notify.ok) {
      console.error("[family-protect-signup] notification failed:", notify.error);
      await logEvent("family_protect_signup_email_failed", "warning", "family_protect_signup_api", {
        who_protect: whoProtect,
        lang: lang ?? undefined,
      });
    }
  } catch (e) {
    console.error(
      "[family-protect-signup] notification threw:",
      e instanceof Error ? e.message : "unknown"
    );
    await logEvent("family_protect_signup_email_failed", "warning", "family_protect_signup_api", {
      who_protect: whoProtect,
      lang: lang ?? undefined,
    });
  }

  return NextResponse.json({ ok: true });
}
