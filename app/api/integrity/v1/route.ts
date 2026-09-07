import { integrityV1Error } from "@/lib/integrity/public-v1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json(integrityV1Error("integrity_preview_only"), { status: 404 });
  }

  return Response.json({
    api_version: "1",
    service: "ScanScam Integrity",
    status: "preview",
    dispositions: ["ALLOW", "CHALLENGE", "APPROVAL_REQUIRED", "DENY"],
    endpoints: {
      observe: "/api/integrity/v1/observe",
      preflight: "/api/integrity/v1/preflight",
      attest: "/api/integrity/v1/attest",
      challenge: "/api/integrity/v1/challenge",
      commit: "/api/integrity/v1/commit",
    },
    auth: "Bearer ssi_v1_* credential with endpoint-specific scope",
    contract: "Frozen public v1 adapter over evolving Guardian internals.",
  }, {
    headers: {
      "Cache-Control": "no-store",
      "X-ScanScam-Integrity-Version": "1",
    },
  });
}
