import { isTrustedPreflightRequest, trustedPreflight } from "@/lib/integrity/trusted";
import { issueAuthorizationReceipt } from "@/lib/integrity/receipts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    service: "ScanScam Integrity Trusted Preflight",
    version: "0.2",
    trust_model: {
      caller_supplies: ["principal_id", "subject_id", "goal", "proposed_action", "current_state", "trace_excerpt", "attestation_ids"],
      server_resolves: ["active principal mandate", "historical baseline", "attestation validity"],
      server_builds: ["decision capsule", "material claim set", "semantic escalation when needed"],
      ignored_if_client_supplied: ["principal", "previous_state", "verified_evidence"],
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!isTrustedPreflightRequest(body)) {
    return Response.json(
      { error: "invalid_trusted_preflight_request", message: "principal_id and proposed_action.type are required" },
      { status: 400 }
    );
  }

  try {
    const result = await trustedPreflight(body, body as Record<string, unknown>);
    const authorization =
      result.decision === "ALLOW"
        ? await issueAuthorizationReceipt(body, result)
        : null;

    return Response.json({ ...result, authorization }, {
      headers: {
        "Cache-Control": "no-store",
        "X-ScanScam-Integrity-Version": "0.3",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "trusted_preflight_failed";
    const status = message === "trusted_mandate_not_found" ? 404 : 500;
    return Response.json({ error: message }, { status });
  }
}
