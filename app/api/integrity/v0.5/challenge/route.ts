import {
  authenticateIntegrityRequest,
  integrityAuthHttpStatus,
} from "@/lib/integrity/auth";
import { retryIntegrityChallenge } from "@/lib/integrity/challenge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "integrity_preview_only" }, { status: 404 });
  }

  return Response.json({
    service: "ScanScam Integrity Challenge Retry",
    version: "0.5",
    flow: "CHALLENGE -> independent attestation(s) -> retry same observation -> ALLOW / APPROVAL_REQUIRED / DENY",
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

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const challengeId = typeof body?.challenge_id === "string" ? body.challenge_id : "";
  const attestationIds = Array.isArray(body?.attestation_ids)
    ? body.attestation_ids.filter((id: unknown): id is string => typeof id === "string")
    : [];

  try {
    const retried = await retryIntegrityChallenge(challengeId, attestationIds, identity);
    return Response.json(retried, {
      headers: {
        "Cache-Control": "no-store",
        "X-ScanScam-Integrity-Version": "0.5",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "integrity_challenge_retry_failed";
    const status =
      message.includes("not_found") ? 404 :
      message.includes("expired") || message.includes("not_open") ? 409 :
      message.includes("invalid") ? 400 :
      500;
    return Response.json({ error: message }, { status });
  }
}
