import { cookies } from "next/headers";

const COOKIE_NAME = "internal_radar_auth";
const COOKIE_MAX_AGE = 86400; // 24 hours

function setAuthCookie() {
  return `${COOKIE_NAME}=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export async function POST(req: Request) {
  const expected = process.env.INTERNAL_RADAR_PIN;
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

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": setAuthCookie(),
    },
  });
}

export async function GET() {
  const expected = process.env.INTERNAL_RADAR_PIN;
  if (!expected || expected === "") {
    return Response.json({ ok: false }, { status: 500 });
  }

  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  const ok = cookie?.value === "1";

  return Response.json({ ok });
}
