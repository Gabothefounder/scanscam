import { headers } from "next/headers";

/**
 * Base URL for building absolute report links on the server (/r/[token]).
 * Order: NEXT_PUBLIC_APP_URL → VERCEL_URL (https) → request Host/Forwarded headers → null (relative).
 */
export async function resolveReportSiteOrigin(): Promise<string | null> {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (explicit) return explicit;

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//i, "");
    return `https://${host}`;
  }

  const h = await headers();
  const host =
    h.get("x-forwarded-host")?.split(",")[0]?.trim() ?? h.get("host")?.trim() ?? "";
  if (!host) return null;

  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "http";
  return `${proto}://${host}`;
}

/** Full URL to open the tokenized report, or a root-relative path if origin is unknown. */
export function buildReportAbsoluteUrl(origin: string | null, token: string): string {
  const path = `/r/${encodeURIComponent(token)}`;
  if (!origin) return path;
  return `${origin.replace(/\/+$/, "")}${path}`;
}
