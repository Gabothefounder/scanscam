import {
  AGENT_LAB_SCENARIOS,
  getAgentLabSummary,
  runAgentLabScenario,
  type AgentLabScenarioId,
} from "@/lib/integrity/agent-lab";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function previewOnly(): Response | null {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return null;
}

function isScenario(value: unknown): value is AgentLabScenarioId {
  return typeof value === "string" &&
    (AGENT_LAB_SCENARIOS as readonly string[]).includes(value);
}

export async function GET() {
  const blocked = previewOnly();
  if (blocked) return blocked;

  try {
    const summary = await getAgentLabSummary(100);
    return Response.json({
      ...summary,
      safety: {
        executor: "simulated",
        moves_real_money: false,
        production_route_enabled: false,
      },
      run_contract: {
        method: "POST",
        confirm: "RUN_SYNTHETIC_AGENT_LAB",
        scenarios: AGENT_LAB_SCENARIOS,
        all: true,
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
      error: error instanceof Error ? error.message : "agent_lab_summary_failed",
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const blocked = previewOnly();
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  if (input.confirm !== "RUN_SYNTHETIC_AGENT_LAB") {
    return Response.json({
      error: "explicit_confirmation_required",
      required_confirm: "RUN_SYNTHETIC_AGENT_LAB",
    }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "agent_lab_openai_key_missing" }, { status: 503 });
  }

  try {
    if (input.scenario === "all") {
      const runs = [];
      for (const scenario of AGENT_LAB_SCENARIOS) {
        runs.push(await runAgentLabScenario(scenario));
      }
      return Response.json({
        experiment: "agent-lab-v0.8",
        runs,
        summary: await getAgentLabSummary(100),
      }, {
        headers: {
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex",
          "X-ScanScam-Integrity-Version": "0.8",
        },
      });
    }

    if (!isScenario(input.scenario)) {
      return Response.json({
        error: "scenario_invalid",
        allowed: AGENT_LAB_SCENARIOS,
      }, { status: 400 });
    }

    const run = await runAgentLabScenario(input.scenario);
    return Response.json({
      experiment: "agent-lab-v0.8",
      run,
      summary: await getAgentLabSummary(100),
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
