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
};

export function formatEscalationSubject(userCompany: string, partnerName: string): string {
  return `ScanScam — Escalation from ${userCompany} for ${partnerName}`;
}

export function formatEscalationBody(params: EmailParams): string {
  const { payload, partnerName, partnerEmail } = params;
  const lines: string[] = [];

  lines.push(`ScanScam Partner Escalation`);
  lines.push(`Partner: ${partnerName}`);
  lines.push(`Intended recipient: ${partnerEmail}`);
  lines.push(``);
  lines.push(`--- Scan Details ---`);
  lines.push(`Scan ID: ${payload.scanId}`);
  lines.push(`Timestamp: ${payload.timestamp}`);
  lines.push(`Risk Tier: ${payload.riskTier}`);
  lines.push(`Summary: ${payload.summarySentence ?? "(none)"}`);
  lines.push(``);

  if (payload.source) {
    if (payload.source === "user_text") {
      lines.push(`Source: text submission`);
    } else if (payload.source === "ocr") {
      lines.push(`Source: image upload (OCR text extracted)`);
      lines.push(
        `Note: This escalation includes OCR-extracted text from an uploaded image. The original image is not attached in this MVP version.`
      );
    } else {
      lines.push(`Source: ${payload.source}`);
    }
    lines.push(``);
  }

  lines.push(`--- Raw Message ---`);
  if (payload.rawMessage) {
    lines.push(payload.rawMessage);
  } else {
    lines.push(`(Raw message unavailable: user did not opt in to raw message storage.)`);
  }
  lines.push(``);

  lines.push(`--- Structured Fields ---`);
  lines.push(`narrative_family: ${payload.narrativeFamily ?? "(unknown)"}`);
  lines.push(`impersonation_entity: ${payload.impersonationEntity ?? "(unknown)"}`);
  lines.push(`requested_action: ${payload.requestedAction ?? "(unknown)"}`);
  lines.push(`threat_stage: ${payload.threatStage ?? "(unknown)"}`);
  lines.push(`confidence_level: ${payload.confidenceLevel ?? "(unknown)"}`);
  lines.push(``);

  lines.push(`--- Submitted By ---`);
  lines.push(`Name: ${payload.userName}`);
  lines.push(`Company: ${payload.userCompany}`);
  lines.push(`Role: ${payload.userRole ?? "(not provided)"}`);

  return lines.join("\n");
}

export async function sendPartnerEscalationEmail(
  params: EmailParams & { from: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return { ok: false, error: "Email service not configured (RESEND_API_KEY missing)" };
  }

  const subject = formatEscalationSubject(params.payload.userCompany, params.partnerName);
  const body = formatEscalationBody(params);

  const isProduction = process.env.NODE_ENV === "production";
  const recipient = isProduction ? params.partnerEmail : "gab.gabcaron@gmail.com";

  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from: params.from,
    to: [recipient],
    subject,
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
