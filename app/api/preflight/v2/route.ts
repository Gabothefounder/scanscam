import {
  bindAuthenticatedPrincipal,
  isUnboundTrustedPreflightRequest,
  trustedPreflight,
} from "@/lib/integrity/trusted";
import { issueAuthorizationReceipt } from "@/lib/integrity/receipts";
import {
  authenticateIntegrityRequest,
  integrityAuthHttpStatus,
} from "@/lib/integrity/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "integrity_preview_only" }, { status: 404 });
  }
  return Response.json({
    service: "ScanScam Integrity Trusted Preflight",
    version: "0.4",
    trust_model: {
      caller_supplies: ["subject_id", "goal", "proposed_action", "current_state", "trace_excerpt", "attestation_ids"],
      server_resolves: ["active principal mandate", "historical baseline", "attestation validity"],
      server_builds: ["decision capsule", "material claim set", "semantic escalation when needed"],
      authenticated_identity: ["Authorization: Bearer ssi_v1_...", "client_id", "principal_id", "scopes"],
      ignored_if_client_supplied: ["principal_id", "principal", "previous_state", "verified_evidence"],
    },
    decisions: ["ALLOW", "VERIFY", "HOLD", "BLOCK"],
    authorization: {
      issued_only_on: "ALLOW",
      one_time: true,
      default_ttl_seconds: 300,
      commit_endpoint: "/api/preflight/v2/commit",
    },
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!isUnboundTrustedPreflightRequest(body)) {
    return Response.json(
      { error: "invalid_trusted_preflight_request", message: "proposed_action.type is required" },
      { status: 400 }
    );
  }

  const trustedRequest = bindAuthenticatedPrincipal(body, identity);

  try {
    const result = await trustedPreflight(trustedRequest, body as Record<string, unknown>);
    const authorization =
      result.decision === "ALLOW"
        ? await issueAuthorizationReceipt(trustedRequest, result, identity)
        : null;

    return Response.json({
      ...result,
      authenticated_client: {
        client_id: identity.client_id,
        principal_id: identity.principal_id,
        name: identity.name,
        scopes: identity.scopes,
      },
      authorization,
    }, {
      headers: {
        "Cache-Control": "no-store",
        "X-ScanScam-Integrity-Version": "0.4",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "trusted_preflight_failed";
    const status = message === "trusted_mandate_not_found" ? 404 : 500;
    return Response.json({ error: message }, { status });
  }
}
