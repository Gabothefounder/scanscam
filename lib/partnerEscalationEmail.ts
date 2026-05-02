/**
 * Partner escalation email formatting and delivery.
 * Uses Resend. Requires RESEND_API_KEY and RESEND_FROM_EMAIL.
 */

import { Resend } from "resend";

export type WebRiskDisplayStatus =
  | "unsafe"
  | "clean"
  | "error"
  | "skipped"
  /** Legacy persisted scans only */
  | "unknown";

export type EscalationLinkIntel = {
  primaryHost: string;
  shortened: boolean;
  expansionStatus: "expanded" | "failed" | "timeout" | "skipped" | null;
  finalHost: string | null;
  /** Present when `link_intel.web_risk` exists with a known status. */
  webRiskStatus?: WebRiskDisplayStatus;
};

const WEB_RISK_LINE: Record<WebRiskDisplayStatus, string> = {
  unsafe: "Flagged by external threat intelligence",
  clean: "External threat check completed: no known threats listed",
  error: "External threat database check failed or timed out",
  skipped: "Link not checked by external database",
  unknown: "No known threats detected in external database",
};

export type EscalationPayload = {
  riskTier: string;
  summarySentence: string | null;
  rawMessage: string | null;
  source: string | null;
  userName: string;
  userCompany: string;
  userRole: string | null;
  clientNote: string | null;
  timestamp: string;
  scanId: string;
  narrativeFamily: string | null;
  impersonationEntity: string | null;
  requestedAction: string | null;
  threatStage: string | null;
  confidenceLevel: string | null;
  linkIntel?: EscalationLinkIntel | null;
  userAddedContext: string | null;
};

export type EmailParams = {
  payload: EscalationPayload;
  partnerName: string;
  partnerEmail: string;
  viewSubmissionUrl?: string | null;
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

function normalizeViewSubmissionUrl(viewSubmissionUrl?: string | null): string | null {
  if (typeof viewSubmissionUrl !== "string") return null;
  const trimmed = viewSubmissionUrl.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatLinkInMessageSectionPlain(link: EscalationLinkIntel): string[] {
  const lines: string[] = [];
  lines.push(`Link in this message`);
  lines.push(``);
  lines.push(`Submitted link host: ${link.primaryHost}`);
  if (link.shortened) {
    lines.push(`Shortened link: yes`);
    if (link.expansionStatus === "expanded" && link.finalHost) {
      lines.push(`Resolved destination: ${link.finalHost}`);
    } else if (link.expansionStatus !== "expanded") {
      lines.push(`Destination could not be resolved automatically`);
    }
    lines.push(
      `Resolution is automatic and may not reflect the link at the time of access.`
    );
  }
  if (link.webRiskStatus) {
    lines.push(`External link check: ${WEB_RISK_LINE[link.webRiskStatus]}`);
  }
  lines.push(``);
  return lines;
}

function formatLinkInMessageSectionHtml(link: EscalationLinkIntel): string {
  const blocks: string[] = [];
  blocks.push(
    `<div style="margin:0 0 20px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">`
  );
  blocks.push(
    `<p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.06em;color:#64748b;">LINK IN THIS MESSAGE</p>`
  );
  blocks.push(
    `<p style="margin:0 0 4px;font-size:14px;"><strong>Submitted link host:</strong> ${escapeHtml(link.primaryHost)}</p>`
  );
  if (link.shortened) {
    blocks.push(`<p style="margin:0 0 4px;font-size:14px;">Shortened link: yes</p>`);
    if (link.expansionStatus === "expanded" && link.finalHost) {
      blocks.push(
        `<p style="margin:0 0 4px;font-size:14px;"><strong>Resolved destination:</strong> ${escapeHtml(link.finalHost)}</p>`
      );
    } else if (link.expansionStatus !== "expanded") {
      blocks.push(
        `<p style="margin:0 0 4px;font-size:14px;color:#64748b;">Destination could not be resolved automatically</p>`
      );
    }
    blocks.push(
      `<p style="margin:8px 0 0;font-size:12px;color:#64748b;">Resolution is automatic and may not reflect the link at the time of access.</p>`
    );
  }
  if (link.webRiskStatus) {
    const isUnsafe = link.webRiskStatus === "unsafe";
    const isWarnBox = link.webRiskStatus === "error";
    const boxStyle = isUnsafe
      ? "margin:12px 0 0;padding:10px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;"
      : isWarnBox
        ? "margin:12px 0 0;padding:10px 12px;background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;"
        : "margin:12px 0 0;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;";
    const textStyle = isUnsafe
      ? "margin:0;font-size:13px;font-weight:700;color:#991b1b;"
      : isWarnBox
        ? "margin:0;font-size:13px;font-weight:600;color:#92400e;"
        : "margin:0;font-size:13px;color:#334155;";
    blocks.push(
      `<div style="${boxStyle}"><p style="${textStyle}">External link check: ${escapeHtml(WEB_RISK_LINE[link.webRiskStatus])}</p></div>`
    );
  }
  blocks.push(`</div>`);
  return blocks.join("");
}

export function formatEscalationBody(params: EmailParams): string {
  const { payload, partnerName } = params;
  const lines: string[] = [];
  const submittedCompany = payload.userCompany?.trim() || "(not provided)";
  const submittedRole = payload.userRole?.trim() || "(not provided)";
  const viewUrl = normalizeViewSubmissionUrl(params.viewSubmissionUrl);

  lines.push(`========================================`);
  lines.push(`SCANSCAM PARTNER ALERT`);
  lines.push(`========================================`);
  lines.push(``);
  lines.push(`New suspicious message — open the secure review page for full context when possible.`);
  lines.push(``);

  if (viewUrl != null) {
    lines.push(`REVIEW FULL SUBMISSION (primary)`);
    lines.push(viewUrl);
    lines.push(``);
    lines.push(`----------------------------------------`);
    lines.push(``);
  }

  lines.push(`RISK TIER`);
  lines.push(`${payload.riskTier}`);
  lines.push(``);
  lines.push(`SUMMARY`);
  lines.push(`${payload.summarySentence ?? "(none)"}`);
  lines.push(``);

  const added = payload.userAddedContext?.trim();
  if (added) {
    lines.push(`ADDED CONTEXT (from user in ScanScam)`);
    lines.push(added);
    lines.push(``);
  }

  if (payload.linkIntel) {
    lines.push(...formatLinkInMessageSectionPlain(payload.linkIntel));
  }

  lines.push(`----------------------------------------`);
  lines.push(`SUBMITTED BY`);
  lines.push(`Name: ${payload.userName}`);
  lines.push(`Company: ${submittedCompany}`);
  lines.push(`Role: ${submittedRole}`);
  lines.push(``);
  lines.push(`NOTE FOR IT PROVIDER`);
  lines.push(payload.clientNote?.trim() ? payload.clientNote.trim() : `(not provided)`);
  lines.push(``);
  lines.push(`SUBMITTED TO`);
  lines.push(partnerName);
  lines.push(``);

  lines.push(`RAW MESSAGE PREVIEW`);
  const rawForPreview =
    payload.rawMessage != null && String(payload.rawMessage).trim().length > 0
      ? String(payload.rawMessage)
      : "";
  if (rawForPreview) {
    lines.push(truncateRawPreview(rawForPreview, RAW_PREVIEW_MAX_CHARS));
  } else if (viewUrl != null) {
    lines.push(`(Open the review link above for the full message.)`);
  } else {
    lines.push(`(Original submission text was not retained for this scan.)`);
  }
  lines.push(``);
  lines.push(`SCAN DETAILS`);
  lines.push(`Scan ID: ${payload.scanId}`);
  lines.push(`Source: ${formatSourceLine(payload.source)}`);
  lines.push(``);
  lines.push(`ScanScam · Fraud Signal Intelligence`);

  return lines.join("\n");
}

export function formatEscalationHtml(params: EmailParams): string {
  const { payload, partnerName } = params;
  const viewUrl = normalizeViewSubmissionUrl(params.viewSubmissionUrl);
  const summary = payload.summarySentence ?? "(none)";
  const userNote = payload.clientNote?.trim() ? payload.clientNote.trim() : "(not provided)";
  const submittedCompany = payload.userCompany?.trim() || "(not provided)";
  const submittedRole = payload.userRole?.trim() || "(not provided)";
  const added = payload.userAddedContext?.trim();
  const rawForPreview =
    payload.rawMessage != null && String(payload.rawMessage).trim().length > 0
      ? truncateRawPreview(String(payload.rawMessage), RAW_PREVIEW_MAX_CHARS)
      : viewUrl != null
        ? "(Open the review button above for the full message.)"
        : "(Original submission text was not retained for this scan.)";

  const addedBlock = added
    ? `<div style="margin:0 0 20px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
  <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.06em;color:#64748b;">ADDED CONTEXT</p>
  <p style="margin:0;font-size:14px;white-space:pre-wrap;line-height:1.45;">${escapeHtml(added)}</p>
</div>`
    : "";

  const ctaBlock =
    viewUrl != null
      ? `<div style="margin:0 0 24px;text-align:center;">
  <a href="${escapeHtml(viewUrl)}" style="display:inline-block;padding:14px 28px;background:#2563eb;color:#ffffff !important;font-weight:700;font-size:15px;text-decoration:none;border-radius:10px;">Open secure review page</a>
  <p style="margin:10px 0 0;font-size:12px;color:#64748b;">Full message, context, and signals — primary triage surface</p>
</div>`
      : "";

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" style="max-width:600px;border-collapse:collapse;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#0f172a;padding:20px 24px;">
        <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.08em;color:#94a3b8;">SCANSCAM PARTNER ALERT</p>
        <p style="margin:8px 0 0;font-size:20px;font-weight:700;color:#f8fafc;line-height:1.25;">New suspicious message</p>
      </td></tr>
      <tr><td style="padding:24px 24px 8px;">
        ${ctaBlock}
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.06em;color:#64748b;">RISK TIER</p>
        <p style="margin:0 0 20px;font-size:16px;font-weight:600;">${escapeHtml(payload.riskTier)}</p>
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.06em;color:#64748b;">SUMMARY</p>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.5;">${escapeHtml(summary)}</p>
        ${addedBlock}
        ${payload.linkIntel ? formatLinkInMessageSectionHtml(payload.linkIntel) : ""}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:8px 0 20px;" />
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.06em;color:#64748b;">SUBMITTED BY</p>
        <p style="margin:0;font-size:14px;"><strong>Name:</strong> ${escapeHtml(payload.userName)}</p>
        <p style="margin:4px 0 0;font-size:14px;"><strong>Company:</strong> ${escapeHtml(submittedCompany)}</p>
        <p style="margin:4px 0 16px;font-size:14px;"><strong>Role:</strong> ${escapeHtml(submittedRole)}</p>
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.06em;color:#64748b;">NOTE FOR IT PROVIDER</p>
        <p style="margin:0 0 20px;font-size:14px;white-space:pre-wrap;line-height:1.45;">${escapeHtml(userNote)}</p>
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.06em;color:#64748b;">SUBMITTED TO</p>
        <p style="margin:0 0 20px;font-size:14px;">${escapeHtml(partnerName)}</p>
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.06em;color:#64748b;">RAW MESSAGE PREVIEW</p>
        <p style="margin:0 0 20px;font-size:13px;line-height:1.45;color:#374151;white-space:pre-wrap;">${escapeHtml(rawForPreview)}</p>
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.06em;color:#64748b;">SCAN DETAILS</p>
        <p style="margin:0;font-size:13px;color:#4b5563;">Scan ID: ${escapeHtml(payload.scanId)}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#4b5563;">Source: ${escapeHtml(formatSourceLine(payload.source))}</p>
      </td></tr>
      <tr><td style="padding:16px 24px 24px;border-top:1px solid #f1f5f9;">
        <p style="margin:0;font-size:15px;font-weight:700;">ScanScam</p>
        <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">Fraud Signal Intelligence</p>
      </td></tr>
    </table>
  </td></tr>
</table>`.trim();
}

export async function sendPartnerEscalationEmail(
  params: EmailParams & { from: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return { ok: false, error: "Email service not configured (RESEND_API_KEY missing)" };
  }

  const subject = formatEscalationSubject(params.payload.userCompany, params.partnerName);
  let body: string;
  let html: string;
  try {
    body = formatEscalationBody(params);
    html = formatEscalationHtml(params);
  } catch (e) {
    console.error("[partner-escalation-email] body formatting failed");
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Email body formatting failed",
    };
  }
  body = stripNul(body);
  html = stripNul(html);

  const recipient = params.partnerEmail?.trim();
  if (!recipient) {
    return { ok: false, error: "Partner email address missing" };
  }

  const resend = new Resend(apiKey);

  const fromValue = params.from;
  const toValue = recipient;

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
