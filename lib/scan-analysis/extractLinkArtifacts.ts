/**
 * Synchronous, local URL parsing for intel_features (no network, no external APIs).
 * Extracts a single first link and basic host/TLD heuristics.
 */

import assert from "node:assert/strict";

export type LinkArtifact = {
  url: string;
  domain: string | null;
  root_domain: string | null;
  tld: string | null;
  is_shortened: boolean;
  is_ip_address: boolean;
  has_suspicious_tld: boolean;
};

const SHORTENER_ROOTS = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
]);

const SUSPICIOUS_TLDS = new Set(["xyz", "top", "click", "link", "ru", "cn"]);

/** Common ccSLD-style suffixes (keep small; not a full PSL). */
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

const IPV4_HOST = /^(?:\d{1,3}\.){3}\d{1,3}$/;

const HTTPS_OR_HTTP = /https?:\/\/[^\s<>"'`)\]})]+/i;
const WWW_HOST = /\bwww\.[^\s<>"'`)\]})]+/i;

function trimTrailingPunct(s: string): string {
  return s.replace(/[.,;:!?)\]}>`]+$/u, "");
}

/** Trim markdown/chat wrappers and quotes so host/tld are not polluted (e.g. desjardins.com`). */
function sanitizeUrlCandidate(s: string): string {
  let t = s.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1).trim();
  else if (t.length >= 2 && t.startsWith("'") && t.endsWith("'")) t = t.slice(1, -1).trim();
  t = t.replace(/^`+/u, "").replace(/`+$/u, "");
  t = trimTrailingPunct(t);
  t = t.replace(/`+$/u, "").replace(/^`+/u, "");
  return t.trim();
}

function scrubHostname(host: string): string {
  return host.replace(/^`+/u, "").replace(/`+$/u, "").trim();
}

/** First http(s) URL in text; if none, first www. host with https:// prepended for parsing. */
function extractFirstUrlCandidate(text: string): string | null {
  const httpsMatch = HTTPS_OR_HTTP.exec(text);
  if (httpsMatch) return sanitizeUrlCandidate(trimTrailingPunct(httpsMatch[0]));
  const wwwMatch = WWW_HOST.exec(text);
  if (wwwMatch) return sanitizeUrlCandidate(trimTrailingPunct(`https://${wwwMatch[0]}`));
  return null;
}

function parseUrlLoose(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    try {
      return new URL(`https://${raw}`);
    } catch {
      return null;
    }
  }
}

function hostnameFromRawFallback(raw: string): string | null {
  const withoutProto = raw.replace(/^https?:\/\//i, "").split(/[/\s?#]/)[0] ?? "";
  const host = withoutProto.split("@").pop()?.split(":")[0]?.trim();
  return host && host.length > 0 ? host : null;
}

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

export function extractLinkArtifacts(text: string): LinkArtifact | null {
  const candidate = extractFirstUrlCandidate(text);
  if (!candidate) return null;

  let urlObj: URL | null = parseUrlLoose(candidate);
  let hostname: string | null = urlObj?.hostname ?? null;
  if (!hostname || hostname.length === 0) {
    hostname = hostnameFromRawFallback(candidate);
  }
  if (!hostname) return null;

  hostname = scrubHostname(hostname);
  const domain = hostname.toLowerCase();
  let normalizedUrl = urlObj?.href ?? candidate;
  normalizedUrl = normalizedUrl.replace(/`+$/u, "");
  const root_domain = computeRootDomain(hostname);
  const tld = computeTld(hostname);
  const is_ip_address = IPV4_HOST.test(hostname);
  const is_shortened = root_domain != null && SHORTENER_ROOTS.has(root_domain);
  const has_suspicious_tld = tld != null && SUSPICIOUS_TLDS.has(tld);

  return {
    url: normalizedUrl,
    domain,
    root_domain,
    tld,
    is_shortened,
    is_ip_address,
    has_suspicious_tld,
  };
}

/** Dev / ad-hoc checks (no test runner in repo). */
export function verifyExtractLinkArtifacts(): void {
  const a = extractLinkArtifacts("check https://bit.ly/abc123 out");
  assert.ok(a);
  assert.equal(a!.is_shortened, true);
  assert.equal(a!.root_domain, "bit.ly");

  const b = extractLinkArtifacts("http://secure-login-paypal.xyz/login");
  assert.ok(b);
  assert.equal(b!.has_suspicious_tld, true);
  assert.equal(b!.root_domain, "secure-login-paypal.xyz");

  const c = extractLinkArtifacts("https://www.desjardins.com/path");
  assert.ok(c);
  assert.equal(c!.root_domain, "desjardins.com");
  assert.equal(c!.is_shortened, false);

  const tick = extractLinkArtifacts("`https://www.desjardins.com/path`");
  assert.ok(tick);
  assert.equal(tick!.domain, "www.desjardins.com");
  assert.equal(tick!.tld, "com");
}
