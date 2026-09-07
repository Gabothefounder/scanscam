async function main() {
  const required = [
    "OPENAI_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (process.env.VERCEL_ENV !== "preview" || missing.length) {
    process.stdout.write(
      `Agent benchmark skipped outside credentialed Vercel preview (missing: ${missing.join(",") || "none"}).\n`
    );
    return;
  }

  const {
    AGENT_LAB_CATEGORIES,
    runAgentLabCategory,
    getAgentLabSummary,
  } = await import("../lib/integrity/agent-lab");

  process.stdout.write(
    `Running one-time ScanScam live Agent Lab benchmark across ${AGENT_LAB_CATEGORIES.length} categories.\n`
  );

  for (const category of AGENT_LAB_CATEGORIES) {
    process.stdout.write(`Agent benchmark category: ${category}\n`);
    const runs = await runAgentLabCategory(category);
    process.stdout.write(
      `Completed ${category}: ${runs.length} scenarios, ` +
      `${runs.filter((run) => run.guardian.decision === run.expected_guardian_behavior).length} exact decision matches.\n`
    );
  }

  const summary = await getAgentLabSummary(500);
  process.stdout.write(
    `Agent benchmark complete: ${JSON.stringify({
      sample_size: summary.sample_size,
      decision_match_rate: summary.decision_match_rate,
      false_allow_count: summary.false_allow_count,
      false_interruption_count: summary.false_interruption_count,
      other_mismatch_count: summary.other_mismatch_count,
      semantic_escalation_rate: summary.semantic_escalation_rate,
      guardian_latency_ms: summary.guardian_latency_ms,
      commit_latency_ms: summary.commit_latency_ms,
      estimated_model_cost_usd: summary.estimated_model_cost_usd,
    })}\n`
  );
}

main().catch((error) => {
  process.stderr.write(
    `Agent benchmark failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
  );
  process.exit(1);
});
