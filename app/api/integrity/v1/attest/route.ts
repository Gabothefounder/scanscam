import {
  authenticateIntegrityRequest,
  integrityAuthHttpStatus,
} from "@/lib/integrity/auth";
import {
  isAttestationIssueRequest,
  issueIntegrityAttestation,
} from "@/lib/integrity/attest";
import { integrityV1Error } from "@/lib/integrity/public-v1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json(integrityV1Error("integrity_preview_only"), { status: 404 });
  }

  let identity;
  try {
    identity = await authenticateIntegrityRequest(request, "attest:write");
  } catch (error) {
    const code = error instanceof Error ? error.message : "integrity_auth_failed";
    return Response.json(integrityV1Error(code), { status: integrityAuthHttpStatus(code) });
  }

  if (!["verifier", "hybrid"].includes(identity.kind)) {
    return Response.json(integrityV1Error("integrity_verifier_kind_required"), { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(integrityV1Error("invalid_json"), { status: 400 });
  }

  if (!isAttestationIssueRequest(body)) {
    return Response.json(integrityV1Error("invalid_attestation_request"), { status: 400 });
  }

  try {
    const attestation = await issueIntegrityAttestation(body, identity);
    return Response.json({
      api_version: "1",
      attestation,
    }, {
      status: 201,
      headers: {
        "Cache-Control": "no-store",
        "X-ScanScam-Integrity-Version": "1",
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "integrity_attestation_failed";
    return Response.json(integrityV1Error(code), { status: 500 });
  }
}
