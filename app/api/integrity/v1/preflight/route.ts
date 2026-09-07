import {
  authenticateIntegrityRequest,
  integrityAuthHttpStatus,
} from "@/lib/integrity/auth";
import { persistIntegrityChallenge } from "@/lib/integrity/challenge";
import {
  integrityV1Error,
  toIntegrityV1Preflight,
} from "@/lib/integrity/public-v1";
import {
  isIntegrityV05Request,
  runIntegrityV05,
} from "@/lib/integrity/v05";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json(integrityV1Error("integrity_preview_only"), { status: 404 });
  }

  let identity;
  try {
    identity = await authenticateIntegrityRequest(request, "preflight:write");
  } catch (error) {
    const code = error instanceof Error ? error.message : "integrity_auth_failed";
    return Response.json(integrityV1Error(code), { status: integrityAuthHttpStatus(code) });
  }

  if (!["actor", "hybrid"].includes(identity.kind)) {
    return Response.json(integrityV1Error("integrity_actor_kind_required"), { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(integrityV1Error("invalid_json"), { status: 400 });
  }

  if (!isIntegrityV05Request(body)) {
    return Response.json(integrityV1Error("invalid_integrity_v1_request"), { status: 400 });
  }

  try {
    const result = await runIntegrityV05(body, identity);
    const challenge = await persistIntegrityChallenge(result, identity);
    return Response.json(toIntegrityV1Preflight(result, challenge), {
      headers: {
        "Cache-Control": "no-store",
        "X-ScanScam-Integrity-Version": "1",
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "integrity_v1_failed";
    const status =
      code === "integrity_observation_not_independent" ? 409 :
      code.includes("not_found") ? 404 :
      code.includes("invalid") ? 409 :
      500;
    return Response.json(integrityV1Error(code), { status });
  }
}
