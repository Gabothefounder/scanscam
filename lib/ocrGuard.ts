// lib/ocrGuard.ts

type OCRStats = {
  failures: number;
  lowText: number;
  lastSeen: number;
};

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_FAILURES = 3;
const MAX_LOW_TEXT = 3;

// In-memory store (ephemeral, resets on deploy)
const ocrMap = new Map<string, OCRStats>();

function now() {
  return Date.now();
}

function getStats(ip: string): OCRStats {
  const existing = ocrMap.get(ip);

  if (!existing || now() - existing.lastSeen > WINDOW_MS) {
    const fresh = { failures: 0, lowText: 0, lastSeen: now() };
    ocrMap.set(ip, fresh);
    return fresh;
  }

  existing.lastSeen = now();
  return existing;
}

/**
 * Check whether OCR is temporarily blocked for this IP
 */
export function isOCRBlocked(ip: string): boolean {
  const stats = getStats(ip);

  return (
    stats.failures >= MAX_FAILURES ||
    stats.lowText >= MAX_LOW_TEXT
  );
}

/**
 * Record OCR outcome
 */
export function recordOCRResult(
  ip: string,
  outcome: "success" | "failure" | "low_text"
) {
  const stats = getStats(ip);

  if (outcome === "failure") stats.failures += 1;
  if (outcome === "low_text") stats.lowText += 1;
}
