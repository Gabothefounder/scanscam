import {
  authenticateIntegrityRequest,
  integrityAuthHttpStatus,
} from "@/lib/integrity/auth";
import {
  isObservedToolCallInput,
  storeRuntimeObservation,
} from "@/lib/integrity/observer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "integrity_preview_only" }, { status: 404 });
  }

  return Response.json({
    service: "ScanScam Integrity Runtime Observer",
    version: "0.5",
    purpose: "Receive the real pre-execution tool call from an independent runtime hook and produce a canonical Action Envelope.",
    compatible_hook_target: "ACS toolCallRequest",
    privacy: "Raw tool arguments are normalized in memory and are not persisted; the stored observation contains selected facts plus an arguments hash.",
  });
}

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "integrity_preview_only" }, { status: 404 });
  }

  let identity;
  try {
    identity = await authenticateIntegrityRequest(request, "observe:write");
  } catch (error) {
    const message = error instanceof Error ? error.message : "integrity_auth_failed";
    return Response.json({ error: message }, { status: integrityAuthHttpStatus(message) });
  }

  if (!["observer", "hybrid"].includes(identity.kind)) {
    return Response.json({ error: "integrity_observer_kind_required" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!isObservedToolCallInput(body)) {
    return Response.json({ error: "invalid_runtime_observation" }, { status: 400 });
  }

  try {
    const observation = await storeRuntimeObservation(body, identity);
    return Response.json({
      observation_id: observation.id,
      envelope: observation.envelope,
      envelope_hash: observation.envelope_hash,
      expires_at: observation.expires_at,
      observer: {
        client_id: identity.client_id,
        kind: identity.kind,
      },
    }, {
      status: 201,
      headers: {
        "Cache-Control": "no-store",
        "X-ScanScam-Integrity-Version": "0.5",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "integrity_observation_failed";
    const status = message === "integrity_observation_duplicate_step" ? 409 : 500;
    return Response.json({ error: message }, { status });
  }
}
