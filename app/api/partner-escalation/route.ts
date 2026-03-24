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
      .select("id, risk_tier, summary_sentence, intel_features, source, created_at")
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

    const result = await sendPartnerEscalationEmail({
      payload,
      partnerName: partner.name,
      partnerEmail: partner.email,
      from: FROM_EMAIL,
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
