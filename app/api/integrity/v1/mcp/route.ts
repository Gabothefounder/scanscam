import { createMcpHandler } from "@modelcontextprotocol/server";
import {
  authenticateIntegrityRequest,
  integrityAuthHttpStatus,
} from "@/lib/integrity/auth";
import { createIntegrityActorMcpServer } from "@/lib/integrity/mcp-v1";
import { integrityV1Error } from "@/lib/integrity/public-v1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<Response> {
  let identity;
  try {
    identity = await authenticateIntegrityRequest(request, "preflight:write");
  } catch (error) {
    const code = error instanceof Error ? error.message : "integrity_auth_failed";
    return Response.json(integrityV1Error(code), {
      status: integrityAuthHttpStatus(code),
    });
  }

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
