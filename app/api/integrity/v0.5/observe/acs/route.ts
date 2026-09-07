import {
  authenticateIntegrityRequest,
  integrityAuthHttpStatus,
} from "@/lib/integrity/auth";
import { observedToolCallFromACS } from "@/lib/integrity/adapters/acs";
import { storeRuntimeObservation } from "@/lib/integrity/observer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "integrity_preview_only" }, { status: 404 });
  }

  return Response.json({
    service: "ScanScam Integrity ACS Adapter",
    version: "0.5",
    status: "public-preview adapter",
    hook: "toolCallRequest",
    note: "ACS schema evolution is isolated in this adapter; the Guardian core remains protocol-neutral.",
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    const observed = observedToolCallFromACS(body);
    const stored = await storeRuntimeObservation(observed, observer);
    return Response.json({
      observation_id: stored.id,
      envelope: stored.envelope,
      envelope_hash: stored.envelope_hash,
      expires_at: stored.expires_at,
      next: "/api/integrity/v0.5/preflight",
    }, {
      status: 201,
      headers: {
        "Cache-Control": "no-store",
        "X-ScanScam-Integrity-Version": "0.5",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "acs_adapter_failed";
    return Response.json({ error: message }, { status: 400 });
  }
}
