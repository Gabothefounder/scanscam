import {
  AGENT_LAB_SCENARIOS,
  getAgentLabSummary,
  runAgentLabScenario,
  type AgentLabScenarioId,
} from "@/lib/integrity/agent-lab";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isScenario(value: string | null): value is AgentLabScenarioId {
  return !!value && (AGENT_LAB_SCENARIOS as readonly string[]).includes(value);
}

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("confirm") !== "RUN_SYNTHETIC_AGENT_LAB") {
    return Response.json({
      error: "explicit_confirmation_required",
      required_confirm: "RUN_SYNTHETIC_AGENT_LAB",
    }, { status: 400 });
  }

  const scenario = url.searchParams.get("scenario");
  if (!isScenario(scenario)) {
    return Response.json({
      error: "scenario_invalid",
      allowed: AGENT_LAB_SCENARIOS,
    }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "agent_lab_openai_key_missing" }, { status: 503 });
  }

  try {
    const run = await runAgentLabScenario(scenario);
    return Response.json({
      experiment: "agent-lab-v0.8",
      run,
      summary: await getAgentLabSummary(100),
      safety: {
        executor: "simulated",
        moves_real_money: false,
      },
    }, {
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
        "X-ScanScam-Integrity-Version": "0.8",
      },
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "agent_lab_run_failed",
    }, { status: 500 });
  }
}
