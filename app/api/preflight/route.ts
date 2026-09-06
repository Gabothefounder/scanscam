import { isDecisionCapsule, preflight } from "@/lib/integrity/preflight";

export const runtime = "nodejs";

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "integrity_preview_only" }, { status: 404 });
  }
  return Response.json({
    service: "ScanScam Integrity Preflight",
    version: "0.1",
    decision_capsule: {
      required: ["proposed_action.type"],
      recommended: [
        "principal.mandate",
        "previous_state",
        "current_state",
        "claims",
        "proposed_action.amount",
        "proposed_action.irreversible",
      ],
    },
    checks: ["change", "mandate", "commitment", "verify", "challenge"],
    decisions: ["ALLOW", "VERIFY", "HOLD", "BLOCK"],
    privacy: "v0.1 is deterministic and does not persist the submitted decision capsule.",
  });
}

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "integrity_preview_only" }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!isDecisionCapsule(body)) {
    return Response.json(
      {
        error: "invalid_decision_capsule",
        message: "proposed_action.type is required",
      },
      { status: 400 }
    );
  }

  return Response.json(preflight(body), {
    headers: {
      "Cache-Control": "no-store",
      "X-ScanScam-Integrity-Version": "0.1",
    },
  });
}
