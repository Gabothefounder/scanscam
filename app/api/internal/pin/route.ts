import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const COOKIE_NAME = "internal_radar_auth";

export async function POST(req: Request) {
  const expected = process.env.INTERNAL_RADAR_PIN;
  // DEBUG: remove after confirming env loading
  console.log("[pin] POST: INTERNAL_RADAR_PIN present?", !!expected, "len=" + (expected?.length ?? 0));
  if (!expected || expected === "") {
    return Response.json(
      { ok: false, error: "Internal radar PIN is not configured" },
      { status: 500 }
    );
  }

  let body: { pin?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const pin = typeof body?.pin === "string" ? body.pin.trim() : "";
  if (pin !== expected) {
    return Response.json({ ok: false, error: "Incorrect PIN" }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  return Response.json({ ok: true });
}

export async function GET() {
  const expected = process.env.INTERNAL_RADAR_PIN;
  // DEBUG: remove after confirming env loading
  console.log("[pin] GET: INTERNAL_RADAR_PIN present?", !!expected, "len=" + (expected?.length ?? 0));
  if (!expected || expected === "") {
    return Response.json(
      { ok: false, error: "Internal radar PIN is not configured" },
      { status: 500 }
    );
  }

  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  const ok = cookie?.value === "1";

  return Response.json({ ok });
}
