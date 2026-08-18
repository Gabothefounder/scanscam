/**
 * Founder notification for Family Protect early-access signups.
 * Uses Resend (same provider as partner escalation). Requires RESEND_API_KEY.
 */

import { Resend } from "resend";

const FROM_EMAIL = "ScanScam <alerts@scanscam.ca>";
const TO_EMAIL = "hello@scanscam.ca";

export type FamilyProtectSignupNotifyPayload = {
  first_name: string;
  email: string;
  who_protect: string;
  lang: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  gclid: string | null;
  concern_submitted: boolean;
  signup_at: string;
};

function formatSourceLine(p: FamilyProtectSignupNotifyPayload): string {
  const parts: string[] = [];
  if (p.utm_source) parts.push(`source=${p.utm_source}`);
  if (p.utm_medium) parts.push(`medium=${p.utm_medium}`);
  if (p.utm_campaign) parts.push(`campaign=${p.utm_campaign}`);
  if (p.utm_term) parts.push(`term=${p.utm_term}`);
  if (p.utm_content) parts.push(`content=${p.utm_content}`);
  if (p.gclid) parts.push(`gclid=${p.gclid}`);
  return parts.length > 0 ? parts.join(" · ") : "(none)";
}

function formatBody(p: FamilyProtectSignupNotifyPayload): string {
  return [
    "New ScanScam Family Protect signup",
    "",
    `First name: ${p.first_name}`,
    `Email: ${p.email}`,
    `Who they want to protect: ${p.who_protect}`,
    `Language: ${p.lang ?? "(unknown)"}`,
    `Source / UTM: ${formatSourceLine(p)}`,
    `Concern/story submitted: ${p.concern_submitted ? "Yes" : "No"}`,
    `Signup timestamp: ${p.signup_at}`,
  ].join("\n");
}

export async function sendFamilyProtectSignupNotification(
  payload: FamilyProtectSignupNotifyPayload
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return { ok: false, error: "Email service not configured (RESEND_API_KEY missing)" };
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: [TO_EMAIL],
    replyTo: payload.email,
    subject: "New ScanScam Family Protect signup",
    text: formatBody(payload),
  });

  if (error) {
    return { ok: false, error: error.message ?? "Failed to send email" };
  }

  if (!data?.id) {
    return { ok: false, error: "No confirmation from email service" };
  }

  return { ok: true };
}
