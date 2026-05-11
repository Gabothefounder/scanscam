const STORAGE_KEY = "scanscam_attribution";

const ATTR_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
] as const;

/**
 * Snapshot landing-page attribution into sessionStorage on first call.
 * Subsequent calls within the same tab/session are no-ops so the
 * original landing attribution is never overwritten by inter-page URLs.
 */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  if (sessionStorage.getItem(STORAGE_KEY)) return;

  const params = new URLSearchParams(window.location.search);
  const attr: Record<string, string> = {};

  for (const k of ATTR_PARAMS) {
    const v = params.get(k)?.trim();
    if (v) attr[k] = v;
  }

  attr.referrer = document.referrer || "";
  attr.landing_path = window.location.pathname + window.location.search;

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attr));
}

/**
 * Read the attribution snapshot captured at landing time.
 * Returns an empty object if nothing was captured (e.g. SSR or no params).
 */
export function getAttribution(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}
