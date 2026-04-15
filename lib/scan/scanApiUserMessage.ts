/**
 * Maps POST /api/scan error codes to calm, non-technical user-facing copy.
 * Single source of truth for ScannerForm + ResultView refinement.
 */

export type ScanApiUserLang = "en" | "fr";

const MESSAGES: Record<
  ScanApiUserLang,
  { errorGeneric: string; errorHighDemand: string }
> = {
  en: {
    errorGeneric: "Could not process right now. Please try again.",
    errorHighDemand:
      "High demand right now. Processing may take a few seconds.",
  },
  fr: {
    errorGeneric: "Impossible de traiter pour le moment. Veuillez réessayer.",
    errorHighDemand:
      "Forte demande en ce moment. Le traitement peut prendre quelques secondes.",
  },
};

/** Throttling / capacity-style responses — never show API `message`. */
const HIGH_DEMAND_CODES = new Set(["rate_limited", "duplicate_scan", "ocr_blocked"]);

/** API returns localized, actionable validation text — pass through. */
const USER_ACTIONABLE_CODES = new Set([
  "invalid_input",
  "empty_text",
  "text_too_short",
  "invalid_refinement_context",
  "ocr_no_text",
  "ocr_failed",
]);

export function scanApiUserMessage(
  lang: ScanApiUserLang,
  code: string | undefined,
  apiMessage: string | undefined
): string {
  const m = MESSAGES[lang];
  if (code && HIGH_DEMAND_CODES.has(code)) return m.errorHighDemand;
  if (code && USER_ACTIONABLE_CODES.has(code) && apiMessage) return apiMessage;
  return m.errorGeneric;
}
