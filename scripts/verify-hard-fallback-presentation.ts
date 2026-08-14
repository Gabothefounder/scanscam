/**
 * Phase 0 Priority 1 regression: hard AI fallback never reassures as safe/low.
 * Run: npx tsx scripts/verify-hard-fallback-presentation.ts
 */

import { safeParseModelJson } from "../lib/ai/safeParseModelJson";
import {
  applyHardFallbackPresentation,
  verifyHardFallbackPresentation,
} from "../lib/ai/hardFallbackPresentation";

verifyHardFallbackPresentation();

const parsed = safeParseModelJson("this is not json at all");
if (!parsed.isFallback) {
  throw new Error("expected isFallback for invalid model output");
}
if (parsed.result.risk_tier !== "low") {
  throw new Error(
    "schema placeholder may remain low; presentation must gate on analysis_status"
  );
}
if (/doesn.?t look like a typical scam/i.test(parsed.result.summary_sentence ?? "")) {
  throw new Error("fallbackResult must not use reassuring low defaultSummary copy");
}

const gated = applyHardFallbackPresentation({
  usedFallback: true,
  riskTier: parsed.result.risk_tier,
  summarySentence: parsed.result.summary_sentence ?? null,
  language: "en",
});
if (gated.analysis_status !== "unavailable") throw new Error("gated: unavailable");
if (gated.user_verdict === "safe") throw new Error("gated: not safe");
if (gated.used_fallback !== true) throw new Error("gated: used_fallback");

console.log("verify-hard-fallback-presentation: OK");
