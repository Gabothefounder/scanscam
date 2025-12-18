import { AnalysisSchema, AnalysisResult } from "./analysisSchema";

/**
 * Attempts to safely extract and validate AI JSON output.
 * Never throws. Always returns a valid AnalysisResult.
 */
export function safeParseModelJson(raw: string): {
  result: AnalysisResult;
  isFallback: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // --- Step 1: Extract JSON block ---
  let jsonText = raw.trim();

  // Remove markdown fences if present
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/```(?:json)?/g, "").trim();
    errors.push("markdown_removed");
  }

  // Attempt to isolate first JSON object
  const firstBrace = jsonText.indexOf("{");
  const lastBrace = jsonText.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    errors.push("no_json_object_found");
    return {
      result: fallbackResult(),
      isFallback: true,
      errors,
    };
  }

  jsonText = jsonText.slice(firstBrace, lastBrace + 1);

  // --- Step 2: Parse JSON ---
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    errors.push("json_parse_failed");
    return {
      result: fallbackResult(),
      isFallback: true,
      errors,
    };
  }

  // --- Step 3: Validate against Zod schema ---
  const validation = AnalysisSchema.safeParse(parsed);

  if (!validation.success) {
    errors.push("schema_validation_failed");
    return {
      result: fallbackResult(),
      isFallback: true,
      errors,
    };
  }

  // --- Step 4: Success ---
  return {
    result: validation.data,
    isFallback: false,
    errors,
  };
}

/**
 * Conservative fallback that always renders safely.
 */
function fallbackResult(): AnalysisResult {
  return {
    version: "1.0",
    language_detected: "unknown",
    risk_tier: "low",
    confidence: 0,

    summary: {
      headline: "Unable to analyze reliably",
      why_it_matters:
        "The message could not be analyzed with confidence. If unsure, avoid clicking links and verify through official channels.",
    },

    signals: [],

    recommended_actions: [
      {
        action: "verify_independently",
        details: "Contact the organization using a trusted source.",
      },
    ],

    data_quality: {
      is_message_like: false,
      ocr_suspected_errors: false,
      notes: "Fallback result generated due to parsing or validation failure.",
    },

    safety: {
      pii_detected: false,
      pii_types: [],
    },
  };
}
