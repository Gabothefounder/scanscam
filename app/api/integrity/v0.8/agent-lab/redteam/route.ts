import {
  AGENT_LAB_CATEGORIES,
  AGENT_LAB_SCENARIOS,
  getAgentLabSummary,
  runAgentLabCategory,
  runAgentLabScenario,
  type AgentLabScenarioId,
} from "@/lib/integrity/agent-lab";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isScenario(value: string | null): value is AgentLabScenarioId {
  return !!value && (AGENT_LAB_SCENARIOS as readonly string[]).includes(value);
}

function isCategory(value: string | null): value is string {
  return !!value && (AGENT_LAB_CATEGORIES as readonly string[]).includes(value);
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

  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "agent_lab_openai_key_missing" }, { status: 503 });
  }

  const category = url.searchParams.get("category");
  if (category) {
    if (!isCategory(category)) {
      return Response.json({
        error: "category_invalid",
        allowed: AGENT_LAB_CATEGORIES,
      }, { status: 400 });
    }

    try {
      const runs = await runAgentLabCategory(category);
      return Response.json({
        category,
        runs,
        summary: await getAgentLabSummary(500),
        safety: {
          executor: "simulated",
          moves_real_money: false,
        },
      }, {
        headers: {
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex",
          "X-ScanScam-Integrity-Version": "0.10",
        },
      });
    } catch (error) {
      return Response.json({
        error: error instanceof Error ? error.message : "agent_lab_run_failed",
      }, { status: 500 });
    }
  }

  const scenario = url.searchParams.get("scenario");
  if (!isScenario(scenario)) {
    return Response.json({
      error: "scenario_invalid",
      allowed: AGENT_LAB_SCENARIOS,
      categories: AGENT_LAB_CATEGORIES,
    }, { status: 400 });
  }

  const repeatRaw = Number(url.searchParams.get("repeat") ?? "1");
  const repeat = Number.isInteger(repeatRaw)
    ? Math.min(5, Math.max(1, repeatRaw))
    : 1;

  try {
    const runs = [];
    for (let index = 0; index < repeat; index += 1) {
      runs.push(await runAgentLabScenario(scenario));
    }

    return Response.json({
      repeat,
      runs,
      run: repeat === 1 ? runs[0] : undefined,
      summary: await getAgentLabSummary(500),
      safety: {
        executor: "simulated",
        moves_real_money: false,
      },
    }, {
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
        "X-ScanScam-Integrity-Version": "0.10",
      },
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "agent_lab_run_failed",
    }, { status: 500 });
  }
}
