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

function isCategory(value: unknown): value is string {
  return typeof value === "string" &&
    (AGENT_LAB_CATEGORIES as readonly string[]).includes(value);
}

export async function GET() {
  const blocked = previewOnly();
  if (blocked) return blocked;

  try {
    const summary = await getAgentLabSummary(500);
    return Response.json({
      ...summary,
      safety: {
        executor: "simulated",
        moves_real_money: false,
        changes_real_permissions: false,
        publishes_real_data: false,
        signs_real_contracts: false,
        production_route_enabled: false,
      },
      run_contract: {
        method: "POST",
        confirm: "RUN_SYNTHETIC_AGENT_LAB",
        scenarios: AGENT_LAB_SCENARIOS,
        categories: AGENT_LAB_CATEGORIES,
        note: "Run one scenario or one category per request. The 42-case corpus is intentionally not executed inside one 60-second function invocation.",
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
      return Response.json({
        error: "run_corpus_by_category",
        categories: AGENT_LAB_CATEGORIES,
        reason: "The 42-case live corpus is split into bounded category runs to stay within the preview function duration limit.",
      }, { status: 400 });
    }

    if (isCategory(input.category)) {
      const runs = await runAgentLabCategory(input.category);
      return Response.json({
        runs,
        category: input.category,
        summary: await getAgentLabSummary(500),
      }, {
        headers: {
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex",
          "X-ScanScam-Integrity-Version": "0.10",
        },
      });
    }

    if (!isScenario(input.scenario)) {
      return Response.json({
        error: "scenario_invalid",
        allowed: AGENT_LAB_SCENARIOS,
        categories: AGENT_LAB_CATEGORIES,
      }, { status: 400 });
    }

    const run = await runAgentLabScenario(input.scenario);
    return Response.json({
      run,
      summary: await getAgentLabSummary(500),
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
