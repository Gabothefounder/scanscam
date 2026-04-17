export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

/**
 * POST /api/scan/geo
 * Updates geo fields on an existing scan record.
 */
export async function POST(req: Request) {
  let body: any;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "invalid_json", message: "Invalid JSON" },
      { status: 400 }
    );
  }

  const { scan_id, country_code, region_code, city } = body;

  /* ---------- Validate scan_id ---------- */
  if (!scan_id || typeof scan_id !== "string") {
    return NextResponse.json(
      { ok: false, code: "missing_scan_id", message: "scan_id is required" },
      { status: 400 }
    );
  }

  /* ---------- Validate country_code (2-letter if provided) ---------- */
  if (country_code !== undefined && country_code !== null) {
    if (typeof country_code !== "string" || !/^[A-Z]{2}$/i.test(country_code)) {
      return NextResponse.json(
        { ok: false, code: "invalid_country_code", message: "country_code must be 2-letter string" },
        { status: 400 }
      );
    }
  }

  /* ---------- Build update payload ---------- */
  const updateData: Record<string, any> = {};

  if (typeof country_code === "string" && country_code.length === 2) {
    updateData.country_code = country_code.toUpperCase();

    // region_code only valid for CA
    if (country_code.toUpperCase() === "CA" && typeof region_code === "string" && region_code.length > 0) {
      updateData.region_code = region_code.toUpperCase();
    } else {
      updateData.region_code = null;
    }
  }

  if (typeof city === "string" && city.trim().length > 0) {
    updateData.city = city.trim();
  }

  if (Object.keys(updateData).length === 0) {
    return new Response(null, { status: 204 });
  }

  /* ---------- Update scans record ---------- */
  const { error } = await supabase
    .from("scans")
    .update(updateData)
    .eq("id", scan_id);

  if (error) {
    console.error("[scan/geo] update failed");
    return NextResponse.json(
      { ok: false, code: "update_failed", message: "Database update failed" },
      { status: 500 }
    );
  }

  return new Response(null, { status: 204 });
}
