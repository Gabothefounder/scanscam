/**
 * Google Web Risk API (v1 uris:search). Supporting signal only — never throws.
 *
 * Per Google REST docs, uris.search is GET with query params `uri` and repeated `threatTypes`
 * (not POST with a JSON body).
 */

import { urlIsEligibleForWebRiskLookup } from "@/lib/scan-analysis/expandUrl";

const WEBRISK_SEARCH_URL = "https://webrisk.googleapis.com/v1/uris:search";

/**
 * Threat types sent to uris:search. SOCIAL_ENGINEERING_INTERNAL_REDIRECT was removed:
 * it is not supported on all Web Risk API tiers / can yield 400 INVALID_ARGUMENT when combined
 * with other types or for some projects.
 */
const THREAT_TYPES = ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"] as const;

/** Enough for network + API; still bounded for scan latency. */
const LOOKUP_TIMEOUT_MS = 2500;

function threatTypesNonEmpty(obj: unknown): boolean {
  if (obj == null || typeof obj !== "object") return false;
  const types = (obj as Record<string, unknown>).threatTypes;
  return Array.isArray(types) && types.length > 0;
}

/** Collect threat type strings from threat / threatUri nodes. */
function collectThreatTypes(data: unknown): string[] {
  const out = new Set<string>();
  if (!data || typeof data !== "object") return [];
  const o = data as Record<string, unknown>;
  for (const key of ["threat", "threatUri"] as const) {
    const node = o[key];
    if (node == null || typeof node !== "object") continue;
    const types = (node as Record<string, unknown>).threatTypes;
    if (!Array.isArray(types)) continue;
    for (const t of types) {
      if (typeof t === "string" && t.trim()) out.add(t.trim());
    }
  }
  return [...out];
}

/** True when API reports a match with non-empty threatTypes. */
function responseIndicatesThreat(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  if (threatTypesNonEmpty(o.threat)) return true;
  if (threatTypesNonEmpty(o.threatUri)) return true;
  return false;
}

function parseGoogleApiErrorMessage(body: unknown): string | undefined {
  if (body == null || typeof body !== "object") return undefined;
  const err = (body as Record<string, unknown>).error;
  if (err == null || typeof err !== "object") return undefined;
  const msg = (err as Record<string, unknown>).message;
  return typeof msg === "string" && msg.trim() ? msg.trim() : undefined;
}

export type WebRiskLookupResult = {
  status: "unsafe" | "clean" | "error" | "skipped";
  threat_types?: string[];
  error_reason?: string;
  http_status?: number;
  api_error_message?: string;
};

export async function lookupWebRisk(url: string): Promise<WebRiskLookupResult> {
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
        let api_error_message: string | undefined;
        try {
          const errBody = await res.json();
          api_error_message = parseGoogleApiErrorMessage(errBody);
} catch {
}
        return {
          status: "error",
          error_reason: "api_http_error",
          http_status: res.status,
          ...(api_error_message ? { api_error_message } : {}),
        };
      }

      let data: unknown;
      try {
        data = await res.json();
      } catch {
        return { status: "error", error_reason: "response_json_parse" };
      }

      if (responseIndicatesThreat(data)) {
        const threat_types = collectThreatTypes(data);
return {
          status: "unsafe",
          ...(threat_types.length > 0 ? { threat_types } : {}),
        };
      }
return { status: "clean" };
    } catch {
      return { status: "error", error_reason: "network_or_timeout" };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    return { status: "error", error_reason: "unexpected" };
  }
}
