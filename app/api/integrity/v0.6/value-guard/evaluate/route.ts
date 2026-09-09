import {
  evaluateOptionsWithValueProfile,
  type ValueOption,
} from "@/lib/integrity/value-profile";
import { getValueProfile } from "@/lib/integrity/value-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValueOption(value: unknown): value is ValueOption {
  if (!value || typeof value !== "object") return false;
  const option = value as Partial<ValueOption>;
  return (
    typeof option.id === "string" &&
    typeof option.label === "string" &&
    !!option.facts &&
    typeof option.facts === "object" &&
    !Array.isArray(option.facts)
  );
}

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "integrity_preview_only" }, { status: 404 });
  }

  return Response.json({
    service: "ScanScam Value Guard Decision Sandbox",
    version: "0.6",
    note: "This compares options supplied by the caller. It does not search, buy, book, or transact.",
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
  const options = Array.isArray(body?.options) ? body.options : [];

  if (!UUID_RE.test(profileId)) {
    return Response.json({ error: "invalid_profile_id" }, { status: 400 });
  }

  if (
    options.length < 2 ||
    options.length > 8 ||
    !options.every(isValueOption)
  ) {
    return Response.json(
      { error: "invalid_value_options", message: "Provide 2-8 structured options." },
      { status: 400 }
    );
  }

  if (Buffer.byteLength(JSON.stringify(options), "utf8") > 64_000) {
    return Response.json({ error: "value_options_too_large" }, { status: 413 });
  }

  try {
    const stored = await getValueProfile(profileId);
    const result = evaluateOptionsWithValueProfile(stored.profile, options);

    return Response.json({
      profile_id: stored.id,
      recommended_option_id: result.recommended_option_id,
      results: result.results,
    }, {
      headers: {
        "Cache-Control": "no-store",
        "X-ScanScam-Integrity-Version": "0.6",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "value_guard_evaluate_failed";
    return Response.json(
      { error: message },
      { status: message.includes("not_found") ? 404 : 500 }
    );
  }
}
