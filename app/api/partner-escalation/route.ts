import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPartnerBySlug } from "@/lib/partners";
import {
  sendPartnerEscalationEmail,
  type EscalationPayload,
} from "@/lib/partnerEscalationEmail";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "ScanScam <onboarding@resend.dev>";

const CLIENT_NOTE_MAX_LEN = 2000;
const MSP_ACCESS_EXPIRY_DAYS = 21;

/** Absolute origin for MSP links: no trailing slash, single scheme (no double https://). */
function getPublicAppBaseUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    let s = explicit.replace(/\/+$/, "");
    if (/^https?:\/\//i.test(s)) return s;
    return `https://${s.replace(/^\/+/, "")}`;
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    if (!host) return null;
    return `https://${host}`;
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const scanId = typeof body.scan_id === "string" ? body.scan_id.trim() : null;
    const partnerSlug =
      typeof body.partner_slug === "string" ? body.partner_slug.trim() : null;
    const userName = typeof body.user_name === "string" ? body.user_name.trim() : null;
    const userCompany =
      typeof body.user_company === "string" ? body.user_company.trim() : null;
    const userRole =
      typeof body.user_role === "string" ? body.user_role.trim() || null : null;
    let clientNote: string | null = null;
    if (body.client_note != null && body.client_note !== "") {
      if (typeof body.client_note !== "string") {
        return NextResponse.json(
          { ok: false, message: "client_note must be a string when provided" },
          { status: 400 }
        );
      }
      const trimmed = body.client_note.trim();
      if (trimmed.length > CLIENT_NOTE_MAX_LEN) {
        return NextResponse.json(
          {
            ok: false,
            message: `client_note must be at most ${CLIENT_NOTE_MAX_LEN} characters`,
          },
          { status: 400 }
        );
      }
      clientNote = trimmed || null;
    }

    if (!scanId || !partnerSlug || !userName || !userCompany) {
      return NextResponse.json(
        {
          ok: false,
          message: "Missing required fields: scan_id, partner_slug, user_name, user_company",
        },
        { status: 400 }
      );
    }

    const partner = getPartnerBySlug(partnerSlug);
    if (!partner || !partner.active) {
      return NextResponse.json(
        { ok: false, message: "Invalid or inactive partner" },
        { status: 400 }
      );
    }

    const { data: scanRow, error: scanError } = await supabase
      .from("scans")
      .select(
        "id, risk_tier, summary_sentence, intel_features, source, created_at, submission_image_path"
      )
      .eq("id", scanId)
      .single();

    if (scanError || !scanRow) {
      return NextResponse.json(
        { ok: false, message: "Scan not found" },
        { status: 404 }
      );
    }

    const { data: rawRow } = await supabase
      .from("raw_messages")
      .select("message_text")
      .eq("scan_id", scanId)
      .maybeSingle();

    const intel = (scanRow.intel_features ?? {}) as Record<string, unknown>;

    const payload: EscalationPayload = {
      riskTier: String(scanRow.risk_tier ?? "low"),
      summarySentence:
        scanRow.summary_sentence != null ? String(scanRow.summary_sentence) : null,
      rawMessage: rawRow?.message_text != null ? String(rawRow.message_text) : null,
      source: scanRow.source != null ? String(scanRow.source) : null,
      userName,
      userCompany,
      userRole,
      clientNote,
      timestamp: scanRow.created_at
        ? new Date(scanRow.created_at).toISOString()
        : new Date().toISOString(),
      scanId,
      narrativeFamily:
        intel.narrative_family != null ? String(intel.narrative_family) : null,
      impersonationEntity:
        intel.impersonation_entity != null ? String(intel.impersonation_entity) : null,
      requestedAction:
        intel.requested_action != null ? String(intel.requested_action) : null,
      threatStage: intel.threat_stage != null ? String(intel.threat_stage) : null,
      confidenceLevel:
        intel.confidence_level != null ? String(intel.confidence_level) : null,
    };

    const rawText = rawRow?.message_text != null ? String(rawRow.message_text) : null;
    const submissionImagePath =
      scanRow.submission_image_path != null ? String(scanRow.submission_image_path) : null;
    const expiresAt = new Date(
      Date.now() + MSP_ACCESS_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const scanSource = scanRow.source != null ? String(scanRow.source) : null;
    const isOcr = scanSource === "ocr";
    console.log("[partner-escalation-debug] pre-upsert", {
      scan_id: scanId,
      input_type: isOcr ? "image_ocr" : "text",
      source: scanSource,
      has_raw_text: Boolean(rawText?.length),
      raw_text_length: rawText?.length ?? 0,
      has_image_path: Boolean(submissionImagePath),
    });

    const { data: accessRows, error: accessErr } = await supabase
      .from("partner_escalation_access")
      .upsert(
        {
          scan_id: scanId,
          client_note: clientNote,
          raw_text: rawText,
          image_path: submissionImagePath,
          expires_at: expiresAt,
        },
        { onConflict: "scan_id" }
      )
      .select("access_token");

    let accessToken =
      accessRows && accessRows.length > 0 ? String(accessRows[0].access_token ?? "") : "";
    if (!accessErr && !accessToken) {
      const { data: fallbackRow } = await supabase
        .from("partner_escalation_access")
        .select("access_token")
        .eq("scan_id", scanId)
        .maybeSingle();
      accessToken = fallbackRow?.access_token ? String(fallbackRow.access_token) : "";
    }

    console.log("[partner-escalation-debug] post-upsert", {
      input_type: isOcr ? "image_ocr" : "text",
      upsert_error: accessErr?.message ?? null,
      access_token_resolved: Boolean(accessToken),
    });

    let viewSubmissionUrl: string | null = null;
    if (accessErr) {
      console.error("[partner-escalation] partner_escalation_access upsert:", accessErr.message);
    } else if (accessToken) {
      const base = getPublicAppBaseUrl();
      if (base) {
        viewSubmissionUrl = `${base}/msp/view/${accessToken}`;
      } else {
        console.warn(
          "[partner-escalation] NEXT_PUBLIC_APP_URL (or VERCEL_URL) unset; MSP view link omitted from email"
        );
      }
    }

    console.log("[partner-escalation-debug] pre-send-email", {
      input_type: isOcr ? "image_ocr" : "text",
      has_view_submission_url: Boolean(viewSubmissionUrl),
    });

    const result = await sendPartnerEscalationEmail({
      payload,
      partnerName: partner.name,
      partnerEmail: partner.email,
      from: FROM_EMAIL,
      viewSubmissionUrl,
      submissionImagePathPresent: Boolean(submissionImagePath),
    });

    console.log("[partner-escalation-debug] post-send-email", {
      input_type: isOcr ? "image_ocr" : "text",
      ok: result.ok,
      error: result.ok ? null : result.error,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, message: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[partner-escalation]", err);
    return NextResponse.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
