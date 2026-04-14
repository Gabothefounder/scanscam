/**
 * Google Web Risk API (v1 uris:search). Supporting signal only — never throws.
 *
 * Per Google REST docs, uris.search is GET with query params `uri` and repeated `threatTypes`
 * (not POST with a JSON body).
 */

import { urlIsEligibleForWebRiskLookup } from "@/lib/scan-analysis/expandUrl";

const WEBRISK_SEARCH_URL = "https://webrisk.googleapis.com/v1/uris:search";

const THREAT_TYPES = [
  "MALWARE",
  "SOCIAL_ENGINEERING",
  "UNWANTED_SOFTWARE",
  "SOCIAL_ENGINEERING_INTERNAL_REDIRECT",
] as const;

/** Enough for network + API; still bounded for scan latency. */
const LOOKUP_TIMEOUT_MS = 2500;

function threatTypesNonEmpty(obj: unknown): boolean {
  if (obj == null || typeof obj !== "object") return false;
  const types = (obj as Record<string, unknown>).threatTypes;
  return Array.isArray(types) && types.length > 0;
}

/** Clean URIs yield `{}`; a real match includes non-empty `threat.threatTypes`. */
function responseIndicatesThreat(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  if (threatTypesNonEmpty(o.threat)) return true;
  if (threatTypesNonEmpty(o.threatUri)) return true;
  return false;
}

export async function lookupWebRisk(url: string): Promise<{
  status: "unsafe" | "unknown" | "skipped";
}> {
  try {
    const apiKey = process.env.WEBRISK_API_KEY?.trim();
    if (!apiKey) {
      return { status: "skipped" };
    }

    const eligible = await urlIsEligibleForWebRiskLookup(url);
    if (!eligible) {
      return { status: "skipped" };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

    try {
      const params = new URLSearchParams();
      params.append("uri", url.trim());
      for (const tt of THREAT_TYPES) {
        params.append("threatTypes", tt);
      }

      const res = await fetch(
        `${WEBRISK_SEARCH_URL}?key=${encodeURIComponent(apiKey)}&${params.toString()}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        }
      );

      if (!res.ok) {
        return { status: "unknown" };
      }

      let data: unknown;
      try {
        data = await res.json();
      } catch {
        return { status: "unknown" };
      }

      if (responseIndicatesThreat(data)) {
        return { status: "unsafe" };
      }
      return { status: "unknown" };
    } catch {
      return { status: "unknown" };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    return { status: "unknown" };
  }
}
