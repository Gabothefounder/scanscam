/**
 * Ephemeral session ID for telemetry.
 * 24h rolling window, stored in localStorage (not cookies).
 */

const STORAGE_KEY = "scanscam_sid";
const STORAGE_TS_KEY = "scanscam_sid_ts";
const TTL_MS = 24 * 60 * 60 * 1000;

function randomId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getSessionId(): string {
  if (typeof window === "undefined" || !window.localStorage) {
    return randomId();
  }

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    const tsStr = window.localStorage.getItem(STORAGE_TS_KEY);
    const now = Date.now();

    if (existing && tsStr) {
      const ts = parseInt(tsStr, 10);
      if (!isNaN(ts) && now - ts < TTL_MS) {
        return existing;
      }
    }

    const id = randomId();
    window.localStorage.setItem(STORAGE_KEY, id);
    window.localStorage.setItem(STORAGE_TS_KEY, String(now));
    return id;
  } catch {
    return randomId();
  }
}
