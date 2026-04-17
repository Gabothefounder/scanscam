/**
 * Smoke test for scan-analysis. Run: npx tsx scripts/smoke-test-scan-analysis.ts
 */
import { buildScanEnrichment } from "../lib/scan-analysis";

const cases: { id: string; input: string }[] = [
  { id: "A", input: "https://phish-site.com/login" },
  { id: "B", input: "This is a test message" },
  { id: "C", input: "Your CRA refund is ready. Verify now." },
  { id: "D", input: "Your package is held. Pay fee at link." },
  { id: "E", input: "Hey, did you get my last message?" },
  { id: "F", input: "We can recover your lost crypto funds. Contact recovery team now." },
  { id: "G", input: "Can you confirm if you received my previous email?" },
  { id: "H", input: "Wealthsimple: verify your account to avoid suspension." },
];

for (const c of cases) {
  const r = buildScanEnrichment({
    messageText: c.input,
    language: "en",
    source: "user_text",
  });
  console.log(`\n--- ${c.id} ---`);
  console.log("contextQuality:", r.contextQuality, "| submissionRoute:", r.submissionRoute);
  console.log("riskScore:", r.riskScore, "| riskTier:", r.riskTier, "| confidenceLevel:", r.confidenceLevel);
}
