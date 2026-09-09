import {
  authenticateIntegrityRequest,
  integrityAuthHttpStatus,
} from "@/lib/integrity/auth";
import {
  isAttestationIssueRequest,
  issueIntegrityAttestation,
} from "@/lib/integrity/attest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "integrity_preview_only" }, { status: 404 });
  }

  return Response.json({
    service: "ScanScam Integrity Verifier",
    version: "0.5",
    purpose: "Issue principal-scoped attestations that can satisfy Guardian challenge requirements.",
    trust_model: "Verifier identity is separate from the acting client; raw actor claims cannot self-verify.",
  });
}

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "integrity_preview_only" }, { status: 404 });
  }

  let identity;
  try {
    identity = await authenticateIntegrityRequest(request, "attest:write");
  } catch (error) {
    const message = error instanceof Error ? error.message : "integrity_auth_failed";
    return Response.json({ error: message }, { status: integrityAuthHttpStatus(message) });
  }

  if (!["verifier", "hybrid"].includes(identity.kind)) {
    return Response.json({ error: "integrity_verifier_kind_required" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!isAttestationIssueRequest(body)) {
    return Response.json({ error: "invalid_attestation_request" }, { status: 400 });
  }

  try {
    const attestation = await issueIntegrityAttestation(body, identity);
    return Response.json({ attestation }, {
      status: 201,
      headers: {
        "Cache-Control": "no-store",
        "X-ScanScam-Integrity-Version": "0.5",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "integrity_attestation_failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
