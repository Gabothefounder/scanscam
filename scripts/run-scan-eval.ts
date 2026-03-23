/**
 * Replay/eval harness for scan enrichment layer.
 * Uses buildScanEnrichment(); no DB writes, no API calls.
 *
 * Run: npx tsx scripts/run-scan-eval.ts
 * Optional: npx tsx scripts/run-scan-eval.ts --out eval-results.json
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { buildScanEnrichment } from "../lib/scan-analysis";

type FixtureCase = { label: string; input: string };

type EvalOutputRow = {
  label: string;
  input: string;
  submissionRoute: string;
  narrativeFamily: string;
  impersonationEntity: string;
  requestedAction: string;
  threatStage: string;
  confidenceLevel: string;
  contextQuality: string;
  summary: string | null;
};

function loadFixture(): FixtureCase[] {
  const path = resolve(process.cwd(), "tests/fixtures/scan-eval-set.json");
  const raw = readFileSync(path, "utf-8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error("Fixture must be a JSON array of { label, input }");
  }
  for (const row of data) {
    if (typeof row?.label !== "string" || typeof row?.input !== "string") {
      throw new Error("Each fixture case must have label and input (strings)");
    }
  }
  return data;
}

function runEval(): EvalOutputRow[] {
  const cases = loadFixture();
  const results: EvalOutputRow[] = [];

  for (const c of cases) {
    const r = buildScanEnrichment({
      messageText: c.input,
      language: "en",
      source: "user_text",
    });

    results.push({
      label: c.label,
      input: c.input,
      submissionRoute: r.submissionRoute,
      narrativeFamily: r.narrativeFamily,
      impersonationEntity: r.impersonationEntity,
      requestedAction: r.requestedAction,
      threatStage: r.threatStage,
      confidenceLevel: r.confidenceLevel,
      contextQuality: r.contextQuality ?? "—",
      summary: r.summary,
    });
  }

  return results;
}

function printResults(results: EvalOutputRow[]) {
  for (const r of results) {
    console.log("\n" + "─".repeat(60));
    console.log(`LABEL:   ${r.label}`);
    console.log(`INPUT:   ${r.input.slice(0, 60)}${r.input.length > 60 ? "..." : ""}`);
    console.log("─".repeat(60));
    console.log(`  submissionRoute:     ${r.submissionRoute}`);
    console.log(`  narrativeFamily:     ${r.narrativeFamily}`);
    console.log(`  impersonationEntity: ${r.impersonationEntity}`);
    console.log(`  requestedAction:     ${r.requestedAction}`);
    console.log(`  threatStage:         ${r.threatStage}`);
    console.log(`  confidenceLevel:     ${r.confidenceLevel}`);
    console.log(`  contextQuality:      ${r.contextQuality}`);
    console.log(`  summary:             ${r.summary ?? "(null)"}`);
  }
  console.log("\n" + "─".repeat(60) + "\n");
}

function main() {
  const outFlag = process.argv.find((a) => a.startsWith("--out="));
  const outPath = outFlag?.slice(6);

  const results = runEval();
  printResults(results);

  if (outPath) {
    const abs = resolve(process.cwd(), outPath);
    writeFileSync(abs, JSON.stringify(results, null, 2), "utf-8");
    console.log(`Output written to ${abs}\n`);
  }
}

main();
