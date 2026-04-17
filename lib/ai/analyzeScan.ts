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

=== LANGUAGE CONTEXT (FOR THIS REQUEST) ===
PLATFORM_LANGUAGE = ${requiredOutputLanguage}
(message may be English or French; classify by meaning. summary_sentence must match PLATFORM_LANGUAGE.
Signal "type" values remain English snake_case as in the system prompt.)

=== REQUIRED OUTPUT STRUCTURE (JSON ONLY) ===
{
  "risk_tier": "low | medium | high",
  "language_detected": "en | fr | mixed | unknown (optional; best guess of the message_text language)",
  "summary_sentence": "string (optional, max 200 chars, MUST be in REQUIRED_OUTPUT_LANGUAGE)",
  "signals": [
    {
      "type": "English snake_case tactic label (e.g. urgency_time_pressure, credential_phishing)",
      "evidence": "verbatim excerpt from message_text (may be EN or FR)",
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
  const detailCount = Array.isArray(details) ? details.length : 0;
  console.warn("[AI_PARSE_FAILURE]", {
    code,
    detail_count: detailCount,
    timestamp: new Date().toISOString(),
  });
}
