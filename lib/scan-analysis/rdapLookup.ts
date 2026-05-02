/**
 * RDAP domain registration lookup via rdap.org redirect bootstrap.
 * Supporting signal only — never throws.
 */

import type { DomainRegistrationLookup } from "@/lib/scan-analysis/linkIntel";

const RDAP_DOMAIN_URL = "https://rdap.org/domain/";
const LOOKUP_TIMEOUT_MS = 2500;

function normalizeDomain(domain: string): string | null {
  const d = domain.trim().toLowerCase().replace(/\.$/, "");
  if (!d || d.length > 253) return null;
  if (d.includes("/") || d.includes("?") || d.includes("#")) return null;
  return d;
}

function extractRegistrationDate(events: unknown): string | null {
  if (!Array.isArray(events)) return null;
  for (const ev of events) {
    if (ev == null || typeof ev !== "object") continue;
    const o = ev as Record<string, unknown>;
    if (String(o.eventAction ?? "").toLowerCase() !== "registration") continue;
    const date = o.eventDate;
    if (typeof date === "string" && date.trim()) return date.trim();
  }
  return null;
}

/** Best-effort registrar name from RDAP entities (roles includes registrar). */
function extractRegistrarName(entities: unknown): string | null {
  if (!Array.isArray(entities)) return null;
  for (const ent of entities) {
    if (ent == null || typeof ent !== "object") continue;
    const o = ent as Record<string, unknown>;
    const roles = o.roles;
    if (!Array.isArray(roles) || !roles.some((r) => String(r).toLowerCase() === "registrar")) {
      continue;
    }
    const vcard = o.vcardArray;
    if (!Array.isArray(vcard) || vcard.length < 2) continue;
    const inner = vcard[1];
    if (!Array.isArray(inner)) continue;
    for (const row of inner) {
      if (!Array.isArray(row) || row.length < 4) continue;
      if (String(row[0]).toLowerCase() !== "fn") continue;
      const val = row[3];
      if (typeof val === "string" && val.trim()) return val.trim();
    }
  }
  return null;
}

export async function lookupDomainRegistration(domain: string): Promise<DomainRegistrationLookup> {
  try {
    const normalized = normalizeDomain(domain);
    if (!normalized) {
      return { status: "skipped", source: "rdap", error_reason: "invalid_domain" };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

    try {
      const url = `${RDAP_DOMAIN_URL}${encodeURIComponent(normalized)}`;
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/rdap+json, application/json, */*" },
        signal: controller.signal,
        redirect: "follow",
      });

      if (!res.ok) {
        return {
          status: "error",
          source: "rdap",
          error_reason: `http_${res.status}`,
        };
      }

      let data: unknown;
      try {
        data = await res.json();
      } catch {
        return { status: "error", source: "rdap", error_reason: "json_parse" };
      }

      if (!data || typeof data !== "object") {
        return { status: "error", source: "rdap", error_reason: "invalid_body" };
      }

      const o = data as Record<string, unknown>;
      const created_at = extractRegistrationDate(o.events) ?? null;
      const registrar = extractRegistrarName(o.entities) ?? null;

      return {
        status: "ok",
        source: "rdap",
        created_at,
        registrar,
      };
    } catch {
      return { status: "error", source: "rdap", error_reason: "network_or_timeout" };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    return { status: "error", source: "rdap", error_reason: "unexpected" };
  }
}
