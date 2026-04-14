/**
 * Safe, bounded HTTP redirect expansion for shortened URLs (Phase 2a).
 * Never throws — returns structured status for intel_features.link_intel.expansion.
 */

import * as dns from "node:dns/promises";
import net from "node:net";

import type { ExpandUrlOutcome } from "@/lib/scan-analysis/linkIntel";

const MAX_REDIRECTS = 5;
const TOTAL_BUDGET_MS = 1000;

/** Mirrors extractLinkArtifacts TWO_LEVEL_TLDS for consistent final_domain / tld. */
const TWO_LEVEL_TLDS = new Set([
  "co.uk",
  "com.au",
  "co.nz",
  "com.br",
  "co.jp",
  "com.mx",
  "co.za",
  "com.ar",
]);

function computeRootDomain(hostname: string): string | null {
  const h = hostname.toLowerCase().replace(/^www\./, "");
  const parts = h.split(".").filter((p) => p.length > 0);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  const lastTwo = parts.slice(-2).join(".");
  if (parts.length >= 3 && TWO_LEVEL_TLDS.has(lastTwo)) {
    return parts.slice(-3).join(".");
  }
  return lastTwo;
}

function computeTld(hostname: string): string | null {
  const root = computeRootDomain(hostname);
  if (!root) return null;
  const dot = root.lastIndexOf(".");
  if (dot <= 0 || dot === root.length - 1) return null;
  return root.slice(dot + 1).toLowerCase();
}

function parseIpv4(s: string): [number, number, number, number] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return null;
  const parts = m.slice(1).map((x) => Number(x));
  if (parts.some((p) => p > 255)) return null;
  return parts as [number, number, number, number];
}

function isPrivateOrLocalIpv4(ip: string): boolean {
  const p = parseIpv4(ip);
  if (!p) return false;
  const [a, b] = p;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isPrivateOrLocalIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateOrLocalIpv4(ip);
  if (!net.isIPv6(ip)) return true;
  const n = ip.toLowerCase();
  if (n === "::1") return true;
  if (n.startsWith("fe80:")) return true;
  if (/^f[c-d][0-9a-f]:/i.test(n)) return true;
  const m = /::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(n);
  if (m) return isPrivateOrLocalIpv4(m[1]);
  return false;
}

function stripIpv6Brackets(hostname: string): string {
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    return hostname.slice(1, -1);
  }
  return hostname;
}

export async function isHostPublic(hostname: string): Promise<boolean> {
  const raw = stripIpv6Brackets(hostname);
  if (!raw) return false;
  if (raw === "localhost" || raw.endsWith(".localhost") || raw.endsWith(".local")) return false;

  if (net.isIP(raw)) {
    return !isPrivateOrLocalIp(raw);
  }

  try {
    const addrs = await dns.lookup(raw, { all: true, verbatim: true });
    if (!addrs.length) return false;
    for (const { address } of addrs) {
      if (isPrivateOrLocalIp(address)) return false;
    }
  } catch {
    return false;
  }
  return true;
}

function finalHostMeta(finalUrl: string): Pick<
  ExpandUrlOutcome,
  "final_url" | "final_domain" | "final_root_domain" | "final_tld"
> {
  let u: URL;
  try {
    u = new URL(finalUrl);
  } catch {
    return { final_url: finalUrl };
  }
  const host = u.hostname ? stripIpv6Brackets(u.hostname).toLowerCase() : "";
  if (!host) {
    return { final_url: u.href };
  }
  const domain = host;
  const root = computeRootDomain(host);
  const tld = computeTld(host);
  return {
    final_url: u.href,
    final_domain: domain || undefined,
    final_root_domain: root ?? undefined,
    final_tld: tld ?? undefined,
  };
}

async function drainBody(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch {
    /* ignore */
  }
}

/**
 * Follow redirects (max 5), http(s) only, ~1000ms total budget, SSRF guard per hop.
 */
export async function expandUrl(url: string): Promise<ExpandUrlOutcome> {
  const deadline = Date.now() + TOTAL_BUDGET_MS;

  const remainingMs = () => Math.max(0, deadline - Date.now());

  try {
    let currentUrl = url.trim();
    if (!currentUrl) {
      return { status: "failed" };
    }

    let redirectCount = 0;

    for (;;) {
      if (remainingMs() <= 0) {
        return { status: "timeout", redirect_count: redirectCount };
      }

      let parsed: URL;
      try {
        parsed = new URL(currentUrl);
      } catch {
        return { status: "failed", redirect_count: redirectCount };
      }

      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { status: "failed", redirect_count: redirectCount };
      }

      const hostOk = await isHostPublic(parsed.hostname);
      if (!hostOk) {
        return { status: "failed", redirect_count: redirectCount };
      }

      const controller = new AbortController();
      const ms = remainingMs();
      const timeoutId = setTimeout(() => controller.abort(), ms);

      let res: Response;
      try {
        res = await fetch(currentUrl, {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            Accept: "*/*",
            "User-Agent": "ScanScamUrlExpansion/1.0 (+https://scanscam)",
          },
        });
      } catch (e: unknown) {
        clearTimeout(timeoutId);
        const name = e && typeof e === "object" && "name" in e ? String((e as { name: string }).name) : "";
        if (name === "AbortError") {
          return { status: "timeout", redirect_count: redirectCount };
        }
        return { status: "failed", redirect_count: redirectCount };
      }
      clearTimeout(timeoutId);

      const status = res.status;

      if (status >= 300 && status < 400) {
        await drainBody(res);
        if (redirectCount >= MAX_REDIRECTS) {
          return { status: "failed", redirect_count: redirectCount };
        }
        const loc = res.headers.get("location");
        if (!loc || !loc.trim()) {
          return { status: "failed", redirect_count: redirectCount };
        }
        try {
          currentUrl = new URL(loc.trim(), currentUrl).href;
        } catch {
          return { status: "failed", redirect_count: redirectCount };
        }
        redirectCount += 1;
        continue;
      }

      await drainBody(res);
      const meta = finalHostMeta(currentUrl);
      return {
        status: "expanded",
        ...meta,
        redirect_count: redirectCount,
      };
    }
  } catch {
    return { status: "failed" };
  }
}

/** http(s) only, same host publicity guard as expandUrl (for Web Risk and similar). */
export async function urlIsEligibleForWebRiskLookup(url: string): Promise<boolean> {
  try {
    const trimmed = url.trim();
    if (!trimmed) return false;
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    return await isHostPublic(parsed.hostname);
  } catch {
    return false;
  }
}
