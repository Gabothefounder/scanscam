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
  void partnerName;
  const company = userCompany?.trim();
  return company
    ? `ScanScam — New suspicious message from ${company}`
    : "ScanScam — New suspicious message";
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatEscalationBody(params: EmailParams): string {
  const { payload, partnerName } = params;
  const lines: string[] = [];
  const submittedCompany = payload.userCompany?.trim() || "(not provided)";
  const submittedRole = payload.userRole?.trim() || "(not provided)";
  const viewUrl = params.viewSubmissionUrl?.trim();

  lines.push(`ScanScam Alert — New suspicious message`);
  lines.push(``);
  lines.push(`Submitted by`);
  lines.push(``);
  lines.push(`Name: ${payload.userName}`);
  lines.push(`Company: ${submittedCompany}`);
  lines.push(`Role: ${submittedRole}`);
  lines.push(``);
  lines.push(`User note`);
  lines.push(payload.clientNote?.trim() ? payload.clientNote.trim() : `(not provided)`);
  lines.push(``);
  lines.push(`Submitted to`);
  lines.push(partnerName);
  lines.push(``);
  lines.push(`Risk tier`);
  lines.push(`${payload.riskTier}`);
  lines.push(``);
  lines.push(`Summary`);
  lines.push(`${payload.summarySentence ?? "(none)"}`);
  lines.push(``);
  if (viewUrl) {
    lines.push(`View full submission:`);
    lines.push(viewUrl);
    lines.push(``);
  }

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
  lines.push(`Scan details`);
  lines.push(`Scan ID: ${payload.scanId}`);
  lines.push(`Source: ${formatSourceLine(payload.source)}`);
  lines.push(``);
  lines.push(`ScanScam`);
  lines.push(`Fraud Signal Intelligence`);
  lines.push(``);
  lines.push(`Your next scan could stop the next scam.`);
  lines.push(`Votre prochain scan peut arrêter la prochaine fraude.`);

  return lines.join("\n");
}

export function formatEscalationHtml(params: EmailParams): string {
  const { payload, partnerName } = params;
  const viewUrl = params.viewSubmissionUrl?.trim() || "";
  const summary = payload.summarySentence ?? "(none)";
  const userNote = payload.clientNote?.trim() ? payload.clientNote.trim() : "(not provided)";
  const submittedCompany = payload.userCompany?.trim() || "(not provided)";
  const submittedRole = payload.userRole?.trim() || "(not provided)";
  const rawForPreview =
    payload.rawMessage != null && String(payload.rawMessage).trim().length > 0
      ? truncateRawPreview(String(payload.rawMessage), RAW_PREVIEW_MAX_CHARS)
      : viewUrl
        ? "(Not included here - open the secure link above for the full message.)"
        : "(Not available - user did not opt in to storing the full message.)";

  return `
<div style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.5;font-size:14px;">
  <p style="margin:0 0 8px 0;">ScanScam Alert - New suspicious message</p>
  <p style="margin:0 0 4px 0;"><strong>Submitted by</strong></p>
  <p style="margin:0;"><strong>Name:</strong> ${escapeHtml(payload.userName)}</p>
  <p style="margin:0;"><strong>Company:</strong> ${escapeHtml(submittedCompany)}</p>
  <p style="margin:0 0 16px 0;"><strong>Role:</strong> ${escapeHtml(submittedRole)}</p>
  <p style="margin:0 0 4px 0;"><strong>User note</strong></p>
  <p style="margin:0 0 16px 0;white-space:pre-wrap;">${escapeHtml(userNote)}</p>
  <p style="margin:0 0 4px 0;"><strong>Submitted to</strong></p>
  <p style="margin:0 0 16px 0;">${escapeHtml(partnerName)}</p>
  <p style="margin:0 0 4px 0;"><strong>Risk tier</strong></p>
  <p style="margin:0 0 16px 0;">${escapeHtml(payload.riskTier)}</p>
  <p style="margin:0 0 4px 0;"><strong>Summary</strong></p>
  <p style="margin:0 0 16px 0;">${escapeHtml(summary)}</p>
  ${
    viewUrl
      ? `<p style="margin:0 0 4px 0;"><strong>View full submission:</strong></p>
  <p style="margin:0 0 16px 0;"><a href="${escapeHtml(viewUrl)}" style="color:#2563eb;text-decoration:underline;">${escapeHtml(viewUrl)}</a></p>`
      : ""
  }
  <p style="margin:0 0 4px 0;"><strong>Raw message preview</strong></p>
  <p style="margin:0 0 16px 0;white-space:pre-wrap;">${escapeHtml(rawForPreview)}</p>
  <p style="margin:0 0 4px 0;"><strong>Scan details</strong></p>
  <p style="margin:0;">Scan ID: ${escapeHtml(payload.scanId)}</p>
  <p style="margin:0 0 16px 0;">Source: ${escapeHtml(formatSourceLine(payload.source))}</p>
  <p style="margin:0;"><strong>ScanScam</strong></p>
  <p style="margin:0;">Fraud Signal Intelligence</p>
  <p style="margin:12px 0 0 0;">Your next scan could stop the next scam.</p>
  <p style="margin:4px 0 0 0;">Votre prochain scan peut arrêter la prochaine fraude.</p>
</div>`.trim();
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
  let html: string;
  try {
    body = formatEscalationBody(params);
    html = formatEscalationHtml(params);
  } catch (e) {
    console.error("[partner-escalation-email-debug] formatEscalationBody threw", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Email body formatting failed",
    };
  }
  body = stripNul(body);
  html = stripNul(html);

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
    html,
  });

  if (error) {
    return { ok: false, error: error.message ?? "Failed to send email" };
  }

  if (!data?.id) {
    return { ok: false, error: "No confirmation from email service" };
  }

  return { ok: true };
}
