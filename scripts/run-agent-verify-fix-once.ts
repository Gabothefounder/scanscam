async function main() {
  const required = [
    "OPENAI_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (process.env.GITHUB_ACTIONS === "true" || process.env.VERCEL_ENV !== "preview" || missing.length) {
    process.stdout.write(
      `Verify-fix benchmark skipped outside credentialed Vercel preview (missing: ${missing.join(",") || "none"}).\n`
    );
    return;
  }

  const { runAgentLabCategory } = await import("../lib/integrity/agent-lab");
  const runs = await runAgentLabCategory("verify");
  const matches = runs.filter(
    (run) => run.guardian.decision === run.expected_guardian_behavior
  );

  process.stdout.write(
    `Verify-fix cohort complete: ${matches.length}/${runs.length} exact. ` +
    `${JSON.stringify(runs.map((run) => ({
      scenario: run.scenario,
      expected: run.expected_guardian_behavior,
      actual: run.guardian.decision,
      semantic: run.guardian.semantic_ran,
    })))}\n`
  );

  if (matches.length !== runs.length) process.exit(1);
}

main().catch((error) => {
  process.stderr.write(
    `Verify-fix benchmark failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
  );
  process.exit(1);
});
