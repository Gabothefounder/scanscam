/**
 * Single source for insufficient-context / fragment trust-floor summaries persisted by /api/scan.
 * Keep EN/FR aligned with product tone: cautious, non-alarmist.
 */
export function getInsufficientContextSummary(language: "en" | "fr"): string {
  if (language === "fr") {
    return "Le contexte est insuffisant pour classer ce message de façon fiable. Procédez avec prudence.";
  }
  return "Not enough context is available to classify this reliably. Proceed with caution.";
}
