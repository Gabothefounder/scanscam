import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createProReportAccess } from "@/lib/proReports/createProReportAccess";

const COOKIE_NAME = "internal_radar_auth";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireInternalAuth(): Promise<NextResponse | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (cookie?.value !== "1") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/**
 * Dev/internal: mint a shareable pro report token for a scan (no Stripe).
 * Requires `internal_radar_auth` cookie (same as other internal radar routes).
 */
export async function POST(req: NextRequest) {
  const denied = await requireInternalAuth();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const scanId =
    body && typeof body === "object" && "scan_id" in body
      ? String((body as { scan_id?: unknown }).scan_id ?? "").trim()
      : "";

  if (!scanId || !UUID_RE.test(scanId)) {
    return NextResponse.json({ ok: false, error: "scan_id must be a UUID" }, { status: 400 });
  }

  try {
    const { token, expiresAt } = await createProReportAccess(scanId);
    const origin = req.nextUrl.origin;
    const url = `${origin}/r/${encodeURIComponent(token)}`;
    return NextResponse.json({
      ok: true,
      token,
      url,
      expires_at: expiresAt.toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "create failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
