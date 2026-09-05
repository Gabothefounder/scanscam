import { callOpenAI } from "./callOpenAI";
import { SYSTEM_PROMPT } from "./systemPrompt";
import { safeParseModelJson } from "./safeParseModelJson";
import { type AnalysisResult } from "./analysisSchema";
import { analyzeScanStructured, PRIMARY_SCAN_MODEL } from "./structuredAnalyzeScan";

type AnalyzeScanInput = {
  messageText: string;
  language: "en" | "fr" | "mixed";
  source: "user_text" | "ocr";
};

export type AnalyzeScanOutput = {
  result: AnalysisResult;
  usedFallback: boolean;
  ai_parse_fallback: boolean;
  model: string;
  analysis_path: "structured_primary" | "legacy_fallback" | "hard_fallback";
  input_tokens?: number;
  output_tokens?: number;
};

/**
 * V3 transition strategy:
 * 1. GPT-5.6 Luna + Responses Structured Outputs is the primary semantic sensor.
 * 2. The historical gpt-4o-mini JSON path remains as a compatibility fallback.
 * 3. Deterministic reconciliation in /api/scan remains authoritative for floors/guardrails
 *    until the evaluation suite proves individual legacy layers can be retired.
 */
export async function analyzeScan(input: AnalyzeScanInput): Promise<AnalyzeScanOutput> {
  try {
    const structured = await analyzeScanStructured(input);
    return {
      result: trimForUI(structured.result),
      usedFallback: false,
      ai_parse_fallback: false,
      model: structured.model,
      analysis_path: "structured_primary",
      input_tokens: structured.input_tokens,
      output_tokens: structured.output_tokens,
    };
  } catch (error) {
    console.warn("[STRUCTURED_ANALYSIS_FAILURE]", {
      model: PRIMARY_SCAN_MODEL,
      error: error instanceof Error ? error.message.slice(0, 240) : "unknown",
      timestamp: new Date().toISOString(),
    });
  }

  // Compatibility fallback: keep the old path available while Luna is evaluated in production.
  const prompt = buildLegacyPrompt(input);
  const rawResponse = await callOpenAI(prompt);
  const firstPass = safeParseModelJson(rawResponse);

  if (!firstPass.isFallback) {
    return {
      result: trimForUI(firstPass.result),
      usedFallback: false,
      ai_parse_fallback: true,
      model: "gpt-4o-mini",
      analysis_path: "legacy_fallback",
    };
  }

  const repairPrompt =
    prompt +
    "\n\nIMPORTANT: Your previous output was invalid. Return ONLY valid JSON matching the required schema AND the REQUIRED_OUTPUT_LANGUAGE constraint.";

  const retryResponse = await callOpenAI(repairPrompt);
  const secondPass = safeParseModelJson(retryResponse);

  if (!secondPass.isFallback) {
    logInternalFailure("legacy_first_pass_failed", firstPass.errors);
    return {
      result: trimForUI(secondPass.result),
      usedFallback: false,
      ai_parse_fallback: true,
      model: "gpt-4o-mini",
      analysis_path: "legacy_fallback",
    };
  }

  logInternalFailure("legacy_retry_failed", [...firstPass.errors, ...secondPass.errors]);

  return {
    result: secondPass.result,
    usedFallback: true,
    ai_parse_fallback: true,
    model: "gpt-4o-mini",
    analysis_path: "hard_fallback",
  };
}

function buildLegacyPrompt(input: AnalyzeScanInput): string {
  const requiredOutputLanguage = input.language === "mixed" ? "en" : input.language;

  return [
    SYSTEM_PROMPT,
    "",
    "=== OUTPUT CONSTRAINT (NON-NEGOTIABLE) ===",
    "REQUIRED_OUTPUT_LANGUAGE = " + requiredOutputLanguage,
    "",
    "=== LANGUAGE CONTEXT (FOR THIS REQUEST) ===",
    "PLATFORM_LANGUAGE = " + requiredOutputLanguage,
    "(message may be English or French; classify by meaning. summary_sentence must match PLATFORM_LANGUAGE.)",
    "",
    "=== REQUIRED OUTPUT STRUCTURE (JSON ONLY) ===",
    '{ "risk_tier":"low | medium | high","language_detected":"en | fr | mixed | unknown","summary_sentence":"string","signals":[{"type":"snake_case","evidence":"verbatim","weight":1}],"data_quality":{"is_message_like":true,"ocr_suspected_errors":false} }',
    "",
    "=== SCAN PAYLOAD ===",
    "message_text:",
    '"""' + input.messageText + '"""',
    "",
    'platform_language: "' + requiredOutputLanguage + '"',
    'source: "' + input.source + '"',
  ].join("\n");
}

function trimForUI(result: AnalysisResult): AnalysisResult {
  return {
    ...result,
    signals: result.signals
      .slice()
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
      .slice(0, 2),
  };
}

function logInternalFailure(code: string, details: string[]) {
  console.warn("[AI_PARSE_FAILURE]", {
    code,
    detail_count: Array.isArray(details) ? details.length : 0,
    timestamp: new Date().toISOString(),
  });
}
