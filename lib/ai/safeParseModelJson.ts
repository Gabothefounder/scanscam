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
 * Schema-valid placeholder when the model output cannot be parsed.
 *
 * AnalysisSchema requires risk_tier ∈ {low,medium,high}. We keep "low" only as an
 * internal placeholder — it is NOT a low-risk classification. Downstream code must
 * set analysis_status="unavailable" when usedFallback and must never present this
 * as green Low Risk / "safe" / defaultSummary.low (see applyHardFallbackPresentation).
 */
function fallbackResult(): AnalysisResult {
  return {
    version: "1.0",
    language_detected: "unknown",
    // Placeholder for Zod only — gated by analysis_status=unavailable on hard fallback.
    risk_tier: "low",
    confidence: 0,

    summary_sentence:
      "We could not analyze this message reliably. If unsure, do not click links and verify through an official channel.",

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
      notes: "Fallback result generated due to parsing or validation failure. Not a low-risk label.",
    },

    safety: {
      pii_detected: false,
      pii_types: [],
    },
  };
}
