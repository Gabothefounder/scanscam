/**
 * Semantic admission for scan text: allows short, high-signal inputs without a raw length floor.
 * Used by ScannerForm and POST /api/scan so client and server match.
 */

const HAS_URL_SCHEME = /https?:\/\//i;
const HAS_WWW_HOST = /\bwww\.\S/i;
const HAS_COMMON_TLD =
  /\.(?:com|org|net|io|ly|xyz|ca|co|uk|app|me|info|biz|tv|gov|edu|ru|de|fr|nl|au)\b/i;

/** Action / request verbs (word-boundary safe). */
const ACTION_VERBS =
  /\b(pay|send|login|log\s*in|sign\s*in|verify|click|check|transfer)\b/i;

/** High-signal scam / risk keywords. */
const SCAM_KEYWORDS =
  /\b(money|account|password|fine|urgent|bank|stranger|whatsapp|deposit)\b/i;

/**
 * True when text should be accepted for analysis (not bare noise).
 * Rejects empty input and 1–2 letter/digit tokens like "a", "ok", "hi", "?".
 */
export function passesScanTextAdmission(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;

  const lettersDigits = t.replace(/[^a-z0-9]+/gi, "");
  if (lettersDigits.length <= 2) return false;

  const lower = t.toLowerCase();

  if (HAS_URL_SCHEME.test(t) || HAS_WWW_HOST.test(t) || HAS_COMMON_TLD.test(t)) return true;
  if (ACTION_VERBS.test(lower)) return true;
  if (SCAM_KEYWORDS.test(lower)) return true;

  const words = t.split(/\s+/).filter((w) => w.length > 0);
  if (words.length >= 2) return true;

  return false;
}

export function scanTextAdmissionErrorMessage(lang: "en" | "fr"): string {
  return lang === "fr"
    ? "Impossible d'analyser ce message pour l'instant. Ajoutez plus de détails (par exemple: lien, demande reçue, ou contexte)."
    : "We cannot analyze this yet. Add more detail (for example: the link, what they asked you to do, or context).";
}
