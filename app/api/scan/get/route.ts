export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logEvent } from "@/lib/observability";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET /api/scan/get?scan_id=<uuid>
 * Read-only: returns safe public fields for the result page (scans table only).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const scanIdRaw = url.searchParams.get("scan_id")?.trim() ?? "";

  if (!scanIdRaw || !UUID_RE.test(scanIdRaw)) {
    await logEvent("scan_get_invalid_id", "info", "scan_get_api", {});
    return NextResponse.json(
      { ok: false, code: "invalid_scan_id", message: "Invalid scan id." },
      { status: 400 }
    );
  }

  const { data: row, error } = await supabase
    .from("scans")
    .select("id, risk_tier, summary_sentence, signals, intel_features, language, source, data_quality")
    .eq("id", scanIdRaw)
    .maybeSingle();

  if (error) {
    console.error("[scan_get] lookup failed");
    await logEvent("scan_get_failed", "warning", "scan_get_api", { scan_id: scanIdRaw });
    return NextResponse.json(
      { ok: false, code: "lookup_failed", message: "Could not load this scan." },
      { status: 500 }
    );
  }

  if (!row) {
    await logEvent("scan_get_not_found", "info", "scan_get_api", { scan_id: scanIdRaw });
    return NextResponse.json(
      { ok: false, code: "not_found", message: "Scan not found." },
      { status: 404 }
    );
  }

  const r = row as Record<string, unknown>;
  const riskTier = String(r.risk_tier ?? "low") as "low" | "medium" | "high";
  const signals = Array.isArray(r.signals) ? r.signals : [];

  /** Mirrors POST /api/scan `result` shape fields the result page reads (no extra columns). */
  const result = {
    risk_tier: riskTier,
    summary_sentence: r.summary_sentence ?? null,
    signals,
    language: r.language === "fr" ? "fr" : "en",
    source: r.source ?? "user_text",
    data_quality: r.data_quality && typeof r.data_quality === "object" ? r.data_quality : {},
    intel_features: r.intel_features && typeof r.intel_features === "object" ? r.intel_features : {},
    risk: riskTier,
    scan_id: String(r.id),
  };

  return NextResponse.json({ ok: true, result });
}
