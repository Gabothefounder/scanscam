import { createMcpHandler } from "@modelcontextprotocol/server";
import { after } from "next/server";
import { logEvent } from "@/lib/observability";
import {
  authenticateIntegrityRequest,
  integrityAuthHttpStatus,
} from "@/lib/integrity/auth";
import { createIntegrityActorMcpServer } from "@/lib/integrity/mcp-v1";
import { integrityV1Error } from "@/lib/integrity/public-v1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeHeader(value: string | null, max = 160): string | null {
  if (!value) return null;
  return value.slice(0, max);
}

function looksLikeMcpClient(request: Request): boolean {
  const protocolVersion = request.headers.get("mcp-protocol-version");
  if (protocolVersion) return true;

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const accept = request.headers.get("accept")?.toLowerCase() ?? "";
  return (
    request.method === "POST" &&
    contentType.includes("application/json") &&
    accept.includes("text/event-stream")
  );
}

function recordMcpRequest(
  eventType: "integrity_mcp_probe" | "integrity_mcp_authenticated_request",
  request: Request,
  context: Record<string, unknown>
) {
  after(() =>
    logEvent(eventType, "info", "integrity_mcp", {
      http_method: request.method,
      protocol_version: safeHeader(request.headers.get("mcp-protocol-version"), 40),
      user_agent: safeHeader(request.headers.get("user-agent")),
      ...context,
    })
  );
}

async function handle(request: Request): Promise<Response> {
  let identity;
  try {
    identity = await authenticateIntegrityRequest(request, "preflight:write");
  } catch (error) {
    const code = error instanceof Error ? error.message : "integrity_auth_failed";
    if (looksLikeMcpClient(request)) {
      recordMcpRequest("integrity_mcp_probe", request, {
        auth_result: code,
      });
    }
    return Response.json(integrityV1Error(code), {
      status: integrityAuthHttpStatus(code),
    });
  }

  recordMcpRequest("integrity_mcp_authenticated_request", request, {
    client_id: identity.client_id,
    client_name: identity.name.slice(0, 120),
    client_kind: identity.kind,
    credential_id: identity.credential_id,
  });

  if (!["actor", "hybrid"].includes(identity.kind)) {
    return Response.json(integrityV1Error("integrity_actor_kind_required"), {
      status: 403,
    });
  }

  const handler = createMcpHandler(
    () => createIntegrityActorMcpServer(identity),
    {
      legacy: "stateless",
    }
  );

  return handler.fetch(request);
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
