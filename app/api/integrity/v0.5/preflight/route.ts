import {
  authenticateIntegrityRequest,
  integrityAuthHttpStatus,
} from "@/lib/integrity/auth";
import {
  isIntegrityV05Request,
  runIntegrityV05,
} from "@/lib/integrity/v05";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "integrity_preview_only" }, { status: 404 });
  }

  return Response.json({
    service: "ScanScam Integrity Guardian",
    version: "0.5",
    input: {
      required: ["observation_id"],
      optional: ["attestation_ids"],
      deliberately_not_trusted_from_actor: [
        "principal_id",
        "proposed_action",
        "current_state",
        "aggregate_spend",
        "semantic_mode",
        "causal_trace",
      ],
    },
    dispositions: ["ALLOW", "CHALLENGE", "APPROVAL_REQUIRED", "DENY"],
    flow: "runtime observer -> canonical Action Envelope -> trusted context -> Guardian -> client-bound authorization",
  });
}

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "integrity_preview_only" }, { status: 404 });
  }

  let identity;
  try {
    identity = await authenticateIntegrityRequest(request, "preflight:write");
  } catch (error) {
    const message = error instanceof Error ? error.message : "integrity_auth_failed";
    return Response.json({ error: message }, { status: integrityAuthHttpStatus(message) });
  }

  if (!["actor", "hybrid"].includes(identity.kind)) {
    return Response.json({ error: "integrity_actor_kind_required" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!isIntegrityV05Request(body)) {
    return Response.json({ error: "invalid_integrity_v05_request" }, { status: 400 });
  }

  try {
    const result = await runIntegrityV05(body, identity);
    return Response.json(result, {
      headers: {
        "Cache-Control": "no-store",
        "X-ScanScam-Integrity-Version": "0.5",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "integrity_v05_failed";
    const status =
      message === "integrity_observation_not_independent" ? 409 :
      message.includes("not_found") ? 404 :
      message.includes("invalid") ? 409 :
      500;
    return Response.json({ error: message }, { status });
  }
}
