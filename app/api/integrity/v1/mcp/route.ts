import { createMcpHandler } from "@modelcontextprotocol/server";
import { after } from "next/server";
import { logEvent } from "@/lib/observability";
import {
  authenticateIntegrityRequest,
  integrityAuthHttpStatus,
} from "@/lib/integrity/auth";
import { createIntegrityActorMcpServer } from "@/lib/integrity/mcp-v1";
import { createIntegrityPublicMcpServer } from "@/lib/integrity/mcp-public";
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

function createPublicHandler(request: Request) {
  return createMcpHandler(
    () =>
      createIntegrityPublicMcpServer({
        protocol_version: safeHeader(request.headers.get("mcp-protocol-version"), 40),
        user_agent: safeHeader(request.headers.get("user-agent")),
      }),
    {
      legacy: "stateless",
    }
  );
}

async function handle(request: Request): Promise<Response> {
  let identity;
  try {
    identity = await authenticateIntegrityRequest(request, "preflight:write");
  } catch (error) {
    const code = error instanceof Error ? error.message : "integrity_auth_failed";
    const mcpClient = looksLikeMcpClient(request);

    if (mcpClient) {
      recordMcpRequest("integrity_mcp_probe", request, {
        auth_result: code,
        public_discovery_available: code === "integrity_auth_missing",
      });
    }

    // Missing credentials are no longer a dead end for MCP clients. They can
    // discover the storefront and express structured demand without exposing
    // transaction contents. Invalid/expired credentials still fail closed.
    if (mcpClient && code === "integrity_auth_missing") {
      const handler = createPublicHandler(request);
      return handler.fetch(request);
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
