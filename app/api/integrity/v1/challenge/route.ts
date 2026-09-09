import {
  authenticateIntegrityRequest,
  integrityAuthHttpStatus,
} from "@/lib/integrity/auth";
import { retryIntegrityChallenge } from "@/lib/integrity/challenge";
import {
  integrityV1Error,
  toIntegrityV1Preflight,
} from "@/lib/integrity/public-v1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json(integrityV1Error("integrity_preview_only"), { status: 404 });
  }

  let identity;
  try {
    identity = await authenticateIntegrityRequest(request, "preflight:write");
  } catch (error) {
    const code = error instanceof Error ? error.message : "integrity_auth_failed";
    return Response.json(integrityV1Error(code), { status: integrityAuthHttpStatus(code) });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(integrityV1Error("invalid_json"), { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json(integrityV1Error("invalid_challenge_retry_request"), { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const challengeId = typeof input.challenge_id === "string" ? input.challenge_id : "";
  const attestationIds = Array.isArray(input.attestation_ids)
    ? input.attestation_ids.filter((id): id is string => typeof id === "string")
    : [];

  try {
    const retried = await retryIntegrityChallenge(challengeId, attestationIds, identity);
    return Response.json(toIntegrityV1Preflight(retried.result, retried.challenge), {
      headers: {
        "Cache-Control": "no-store",
        "X-ScanScam-Integrity-Version": "1",
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "integrity_challenge_retry_failed";
    const status =
      code.includes("not_found") ? 404 :
      code.includes("expired") || code.includes("not_open") ? 409 :
      code.includes("invalid") ? 400 :
      500;
    return Response.json(integrityV1Error(code), { status });
  }
}
