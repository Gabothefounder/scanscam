import crypto from "crypto";

export function canonicalizeIntegrityValue(value: unknown): string {
  if (value === undefined) return "__undefined__";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalizeIntegrityValue).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalizeIntegrityValue(item)}`)
    .join(",")}}`;
}

export function hashIntegrityValue(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(canonicalizeIntegrityValue(value))
    .digest("hex");
}
