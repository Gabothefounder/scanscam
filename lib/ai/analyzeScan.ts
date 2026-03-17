import { callOpenAI } from "./callOpenAI";
import { SYSTEM_PROMPT } from "./systemPrompt";
import { safeParseModelJson } from "./safeParseModelJson";
import { AnalysisResult } from "./analysisSchema";

type AnalyzeScanInput = {
  messageText: string;
  language: "en" | "fr" | "mixed";
  source: "user_text" | "ocr";
};

/**
 * ai_parse_fallback: true if first-pass parse failed (retry used) OR final hard fallback used.
 * usedFallback: true only when the hard-coded fallback result is returned after retry also failed.
 */
export type AnalyzeScanOutput = {
  result: AnalysisResult;
  usedFallback: boolean;
  ai_parse_fallback: boolean;
};

export async function analyzeScan(input: AnalyzeScanInput): Promise<AnalyzeScanOutput> {
  const prompt = buildPrompt(input);

  const rawResponse = await callOpenAI(prompt);
  const firstPass = safeParseModelJson(rawResponse);

  if (!firstPass.isFallback) {
    return {
      result: trimForUI(firstPass.result),
      usedFallback: false,
      ai_parse_fallback: false,
    };
  }

  const repairPrompt =
    prompt +
    "\n\nIMPORTANT: Your previous output was invalid. Return ONLY valid JSON matching the required schema AND the REQUIRED_OUTPUT_LANGUAGE constraint.";

  const retryResponse = await callOpenAI(repairPrompt);
  const secondPass = safeParseModelJson(retryResponse);

  if (!secondPass.isFallback) {
    logInternalFailure("first_pass_failed", firstPass.errors);
    return {
      result: trimForUI(secondPass.result),
      usedFallback: false,
      ai_parse_fallback: true,
    };
  }

  logInternalFailure("retry_failed", [...firstPass.errors, ...secondPass.errors]);

  return {
    result: secondPass.result,
    usedFallback: true,
    ai_parse_fallback: true,
  };
}

function buildPrompt(input: AnalyzeScanInput): string {
  const requiredOutputLanguage = input.language === "mixed" ? "en" : input.language;

  return `
${SYSTEM_PROMPT}

=== OUTPUT CONSTRAINT (NON-NEGOTIABLE) ===
REQUIRED_OUTPUT_LANGUAGE = ${requiredOutputLanguage}

=== REQUIRED OUTPUT STRUCTURE (JSON ONLY) ===
{
  "risk_tier": "low | medium | high",
  "summary_sentence": "string (optional, max 200 chars, MUST be in REQUIRED_OUTPUT_LANGUAGE)",
  "signals": [
    {
      "type": "string",
      "evidence": "verbatim excerpt from message_text",
      "weight": 1-5
    }
  ],
  "data_quality": {
    "is_message_like": boolean,
    "ocr_suspected_errors": boolean
  }
}

=== SCAN PAYLOAD ===
message_text:
"""${input.messageText}"""

platform_language: "${requiredOutputLanguage}"
source: "${input.source}"
`;
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
    details,
    timestamp: new Date().toISOString(),
  });
}
