/**
 * Partner escalation email formatting and delivery.
 * Uses Resend. Requires RESEND_API_KEY and RESEND_FROM_EMAIL.
 */

import { Resend } from "resend";

export type EscalationPayload = {
  riskTier: string;
  summarySentence: string | null;
  rawMessage: string | null;
  source: string | null;
  userName: string;
  userCompany: string;
  userRole: string | null;
  /** Optional user context for IT (API field: client_note). */
  clientNote: string | null;
  timestamp: string;
  scanId: string;
  narrativeFamily: string | null;
  impersonationEntity: string | null;
  requestedAction: string | null;
  threatStage: string | null;
  confidenceLevel: string | null;
};

export type EmailParams = {
  payload: EscalationPayload;
  partnerName: string;
  partnerEmail: string;
  /** Absolute URL to MSP full submission view; omitted from email if null */
  viewSubmissionUrl?: string | null;
  /** For debug logs only — whether scans.submission_image_path was set */
  submissionImagePathPresent?: boolean;
};

export function formatEscalationSubject(userCompany: string, partnerName: string): string {
  return `ScanScam — Escalation from ${userCompany} for ${partnerName}`;
}

const RAW_PREVIEW_MAX_CHARS = 400;

function formatSourceLine(source: string | null): string {
  if (!source) return "(unknown)";
  if (source === "user_text") return "Text";
  if (source === "ocr") return "Image (OCR)";
  return source;
}

function truncateRawPreview(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}

/** Resend / transports can reject bodies containing NUL bytes; OCR can rarely emit them. */
function stripNul(s: string): string {
  return s.replace(/\0/g, "");
}

export function formatEscalationBody(params: EmailParams): string {
  const { payload, partnerName } = params;
  const lines: string[] = [];

  lines.push(`ScanScam Alert — New suspicious message`);
  lines.push(`Submitted to: ${partnerName}`);
  lines.push(``);

  const viewUrl = params.viewSubmissionUrl?.trim();
  if (viewUrl) {
    lines.push(`View full submission:`);
    lines.push(viewUrl);
    lines.push(``);
    lines.push(``);
  }

  lines.push(`Risk tier`);
  lines.push(`${payload.riskTier}`);
  lines.push(``);

  lines.push(`Summary`);
  lines.push(`${payload.summarySentence ?? "(none)"}`);
  lines.push(``);

  lines.push(`User note`);
  lines.push(payload.clientNote?.trim() ? payload.clientNote.trim() : `(not provided)`);
  lines.push(``);

  lines.push(`Scan details`);
  lines.push(`Scan ID: ${payload.scanId}`);
  lines.push(`Source: ${formatSourceLine(payload.source)}`);
  lines.push(
    `Submitted by: ${payload.userName} / ${payload.userCompany} / ${payload.userRole?.trim() || "(role not provided)"}`
  );
  lines.push(``);

  lines.push(`Raw message preview`);
  const rawForPreview =
    payload.rawMessage != null && String(payload.rawMessage).trim().length > 0
      ? String(payload.rawMessage)
      : "";
  if (rawForPreview) {
    lines.push(truncateRawPreview(rawForPreview, RAW_PREVIEW_MAX_CHARS));
  } else if (viewUrl) {
    lines.push(`(Not included here — open the secure link above for the full message.)`);
  } else {
    lines.push(`(Not available — user did not opt in to storing the full message.)`);
  }
  lines.push(``);

  if (viewUrl) {
    lines.push(`Use the link at the top for the complete submission, including any image and full text.`);
  }

  return lines.join("\n");
}

export async function sendPartnerEscalationEmail(
  params: EmailParams & { from: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return { ok: false, error: "Email service not configured (RESEND_API_KEY missing)" };
  }

  const src = params.payload.source ?? null;
  const hasRaw =
    params.payload.rawMessage != null && String(params.payload.rawMessage).trim().length > 0;
  const hasViewUrl = Boolean(params.viewSubmissionUrl?.trim());

  console.log("[partner-escalation-email-debug] enter sendPartnerEscalationEmail", {
    source: src,
    has_raw_message: hasRaw,
    has_submission_image_path: Boolean(params.submissionImagePathPresent),
    has_view_submission_url: hasViewUrl,
  });

  const subject = formatEscalationSubject(params.payload.userCompany, params.partnerName);
  let body: string;
  try {
    body = formatEscalationBody(params);
  } catch (e) {
    console.error("[partner-escalation-email-debug] formatEscalationBody threw", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Email body formatting failed",
    };
  }
  body = stripNul(body);

  // TEMP (live email testing): force partner escalation delivery to this inbox.
  // TODO: switch back to the real partner recipient (params.partnerEmail) after testing.
  const recipient = "gestionrockwell@gmail.com";

  const resend = new Resend(apiKey);

  const fromValue = params.from;
  const toValue = recipient;
  console.log("RESEND from:", fromValue);
  console.log("RESEND to:", toValue);

  console.log("[partner-escalation-email-debug] pre-resend.send", {
    source: src,
    has_raw_message: hasRaw,
    has_submission_image_path: Boolean(params.submissionImagePathPresent),
    has_view_submission_url: hasViewUrl,
    subject_length: subject.length,
    body_length: body.length,
  });

  const { data, error } = await resend.emails.send({
    from: fromValue,
    to: [toValue],
    replyTo: "hello@scanscam.ca",
    subject: stripNul(subject),
    text: body,
  });

  if (error) {
    return { ok: false, error: error.message ?? "Failed to send email" };
  }

  if (!data?.id) {
    return { ok: false, error: "No confirmation from email service" };
  }

  return { ok: true };
}
