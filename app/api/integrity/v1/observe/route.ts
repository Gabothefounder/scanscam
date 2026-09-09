import {
  authenticateIntegrityRequest,
  integrityAuthHttpStatus,
} from "@/lib/integrity/auth";
import {
  isObservedToolCallInput,
  storeRuntimeObservation,
} from "@/lib/integrity/observer";
import { integrityV1Error } from "@/lib/integrity/public-v1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json(integrityV1Error("integrity_preview_only"), { status: 404 });
  }

  let identity;
  try {
    identity = await authenticateIntegrityRequest(request, "observe:write");
  } catch (error) {
    const code = error instanceof Error ? error.message : "integrity_auth_failed";
    return Response.json(integrityV1Error(code), { status: integrityAuthHttpStatus(code) });
  }

  if (!["observer", "hybrid"].includes(identity.kind)) {
    return Response.json(integrityV1Error("integrity_observer_kind_required"), { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(integrityV1Error("invalid_json"), { status: 400 });
  }

  if (!isObservedToolCallInput(body)) {
    return Response.json(integrityV1Error("invalid_runtime_observation"), { status: 400 });
  }

  try {
    const observation = await storeRuntimeObservation(body, identity);
    return Response.json({
      api_version: "1",
      observation_id: observation.id,
      envelope_hash: observation.envelope_hash,
      expires_at: observation.expires_at,
    }, {
      status: 201,
      headers: {
        "Cache-Control": "no-store",
        "X-ScanScam-Integrity-Version": "1",
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "integrity_observation_failed";
    const status = code === "integrity_observation_duplicate_step" ? 409 : 500;
    return Response.json(integrityV1Error(code), { status });
  }
}
