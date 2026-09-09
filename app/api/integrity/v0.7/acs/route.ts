import {
  authenticateIntegrityRequest,
  integrityAuthHttpStatus,
} from "@/lib/integrity/auth";
import {
  processAcsToolCallRequest,
  processAcsToolCallResult,
} from "@/lib/integrity/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "integrity_preview_only" }, { status: 404 });
  }

  return Response.json({
    service: "ScanScam Integrity ACS Runtime Guardian",
    version: "0.7",
    acs: {
      spec: "0.1.0",
      methods: ["steps/toolCallRequest", "steps/toolCallResult"],
      profile: "schema-aligned public preview",
      acs_core_signed: false,
    },
    flow: [
      "runtime binding resolves ACS agent_id to a server-owned actor identity",
      "steps/toolCallRequest becomes a trusted runtime observation",
      "Guardian returns allow / defer / ask / deny",
      "allow is stored server-side against ACS request_id",
      "steps/toolCallResult automatically settles Commit by request_id_ref",
    ],
  });
}

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "integrity_preview_only" }, { status: 404 });
  }

  let observer;
  try {
    observer = await authenticateIntegrityRequest(request, "observe:write");
  } catch (error) {
    const message = error instanceof Error ? error.message : "integrity_auth_failed";
    return Response.json({ error: message }, { status: integrityAuthHttpStatus(message) });
  }

  if (!["observer", "hybrid"].includes(observer.kind)) {
    return Response.json({ error: "integrity_observer_kind_required" }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    }, { status: 400 });
  }

  try {
    const method = typeof body?.method === "string" ? body.method : "";
    const response =
      method === "steps/toolCallRequest"
        ? await processAcsToolCallRequest({ body, observer })
        : method === "steps/toolCallResult"
          ? await processAcsToolCallResult({ body, observer })
          : {
              jsonrpc: "2.0",
              id: body?.id ?? null,
              error: {
                code: -32601,
                message: "Method not found",
                data: { supported_methods: ["steps/toolCallRequest", "steps/toolCallResult"] },
              },
            };

    return Response.json(response, {
      headers: {
        "Cache-Control": "no-store",
        "X-ScanScam-Integrity-Version": "0.7",
        "X-ScanScam-ACS-Version": "0.1.0",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "acs_runtime_failed";
    return Response.json({
      jsonrpc: "2.0",
      id: body?.id ?? null,
      error: {
        code: -32010,
        message,
      },
    }, { status: 409 });
  }
}
