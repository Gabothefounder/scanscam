import {
  activateValueProfile,
  getValueProfile,
} from "@/lib/integrity/value-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "integrity_preview_only" }, { status: 404 });
  }

  return Response.json({
    service: "ScanScam Value Guard Publish",
    version: "0.6",
    effect: "Compiles the structured human profile into the active server-side Guardian mandate for this preview principal.",
  });
}

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "integrity_preview_only" }, { status: 404 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const profileId = typeof body?.profile_id === "string" ? body.profile_id : "";
  if (!UUID_RE.test(profileId)) {
    return Response.json({ error: "invalid_profile_id" }, { status: 400 });
  }

  try {
    const stored = await getValueProfile(profileId);
    if (
      stored.profile.hard_rules.length === 0 &&
      stored.profile.preferences.length === 0 &&
      stored.profile.limits.max_autonomous_amount === null &&
      stored.profile.limits.human_approval_amount === null
    ) {
      return Response.json(
        { error: "value_profile_empty" },
        { status: 409 }
      );
    }

    const activated = await activateValueProfile(profileId);
    return Response.json({
      ok: true,
      ...activated,
      message: "The private Value Guard profile is now compiled into this preview principal's active Guardian mandate.",
    }, {
      headers: {
        "Cache-Control": "no-store",
        "X-ScanScam-Integrity-Version": "0.6",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "value_guard_publish_failed";
    return Response.json(
      { error: message },
      { status: message.includes("not_found") ? 404 : 500 }
    );
  }
}
