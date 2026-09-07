import {
  authenticateIntegrityRequest,
  integrityAuthHttpStatus,
} from "@/lib/integrity/auth";
import {
  integrityV1Error,
  toIntegrityV1Commit,
} from "@/lib/integrity/public-v1";
import {
  commitExecution,
  isExecutionCommitRequest,
} from "@/lib/integrity/receipts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json(integrityV1Error("integrity_preview_only"), { status: 404 });
  }

  let identity;
  try {
    identity = await authenticateIntegrityRequest(request, "commit:write");
  } catch (error) {
    const code = error instanceof Error ? error.message : "integrity_auth_failed";
    return Response.json(integrityV1Error(code), { status: integrityAuthHttpStatus(code) });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(integrityV1Error("invalid_json"), { status: 400 });
  }

  if (!isExecutionCommitRequest(body)) {
    return Response.json(integrityV1Error(
      "invalid_execution_commit_request",
      "authorization_id, authorization_token, executed_action and outcome are required"
    ), { status: 400 });
  }

  try {
    const result = await commitExecution(body, identity);
    const status = result.ok
      ? 200
      : result.error === "authorization_not_found"
        ? 404
        : result.error === "authorization_token_invalid"
          ? 401
          : result.error === "authorization_client_mismatch"
            ? 403
            : 409;

    return Response.json(toIntegrityV1Commit(result), {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-ScanScam-Integrity-Version": "1",
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "execution_commit_failed";
    return Response.json(integrityV1Error(code), { status: 500 });
  }
}
