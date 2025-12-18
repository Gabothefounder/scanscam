import { callOpenAI } from "./callOpenAI";
import { SYSTEM_PROMPT } from "./systemPrompt";
import { safeParseModelJson } from "./safeParseModelJson";
import { AnalysisResult } from "./analysisSchema";

type AnalyzeScanInput = {
  messageText: string;
  language: "en" | "fr" | "mixed";
  source: "user_text" | "ocr";
};

type AnalyzeScanOutput = {
  result: AnalysisResult;
  usedFallback: boolean;
};

export async function analyzeScan(
  input: AnalyzeScanInput
): Promise<AnalyzeScanOutput> {
  const prompt = buildPrompt(input);

  // ---- First attempt ----
  const rawResponse = await callOpenAI(prompt);
  const firstPass = safeParseModelJson(rawResponse);

  if (!firstPass.isFallback) {
    return {
      result: trimForUI(firstPass.result),
      usedFallback: false,
    };
  }

  // ---- One repair retry ----
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
    };
  }

  // ---- Final fallback ----
  logInternalFailure("retry_failed", [
    ...firstPass.errors,
    ...secondPass.errors,
  ]);

  return {
    result: secondPass.result,
    usedFallback: true,
  };
}

/* ----------------------------
   Helpers
---------------------------- */

function buildPrompt(input: AnalyzeScanInput): string {
  // IMPORTANT:
  // We treat input.language as the PLATFORM/UI language.
  // Even if the message itself is English, if language="fr" then summary_sentence MUST be French.
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
  // Server-side only. No raw message text.
  console.warn("[AI_PARSE_FAILURE]", {
    code,
    details,
    timestamp: new Date().toISOString(),
  });
}
