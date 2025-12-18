import crypto from "crypto";

/**
 * In-memory cache of recent content hashes
 * Keyed by: ip + hash
 * TTL-based eviction
 */

type Entry = {
  timestamp: number;
};

const CACHE = new Map<string, Entry>();

const TTL_MS = 10 * 60 * 1000; // 10 minutes

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of CACHE.entries()) {
    if (now - entry.timestamp > TTL_MS) {
      CACHE.delete(key);
    }
  }
}

export function isRepeatedScan(ip: string, text: string): boolean {
  cleanup();

  const normalized = text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  const hash = crypto
    .createHash("sha256")
    .update(normalized)
    .digest("hex");

  const key = `${ip}:${hash}`;

  if (CACHE.has(key)) {
    return true;
  }

  CACHE.set(key, { timestamp: Date.now() });
  return false;
}
