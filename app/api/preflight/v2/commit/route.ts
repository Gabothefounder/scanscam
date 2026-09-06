import { commitExecution, isExecutionCommitRequest } from "@/lib/integrity/receipts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    service: "ScanScam Integrity Execution Commit",
    version: "0.3",
    flow: [
      "POST /api/preflight/v2 to receive an authorization receipt when decision=ALLOW",
      "execute the exact authorized action",
      "POST this endpoint with the one-time authorization token and observed execution outcome",
    ],
    guarantees: [
      "exact action hash",
      "one-time token",
      "expiry",
      "current mandate version/hash",
      "current baseline version/hash",
      "atomic receipt consumption and baseline advancement",
    ],
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!isExecutionCommitRequest(body)) {
    return Response.json(
      {
        error: "invalid_execution_commit_request",
        message: "authorization_id, authorization_token, executed_action and outcome are required",
      },
      { status: 400 }
    );
  }

  try {
    const result = await commitExecution(body);
    const status = result.ok
      ? 200
      : result.error === "authorization_not_found"
        ? 404
        : result.error === "authorization_token_invalid"
          ? 401
          : 409;

    return Response.json(result, {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-ScanScam-Integrity-Version": "0.3",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "execution_commit_failed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
