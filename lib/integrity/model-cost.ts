export type OpenAiTokenUsage = {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
};

export type OpenAiPricing = {
  model: string;
  input_per_million_usd: number;
  output_per_million_usd: number;
  snapshot_date: string;
};

const PRICING: Record<string, OpenAiPricing> = {
  "gpt-5.6-luna": {
    model: "gpt-5.6-luna",
    input_per_million_usd: 0.2,
    output_per_million_usd: 1.2,
    snapshot_date: "2026-09-06",
  },
  "gpt-5.6-terra": {
    model: "gpt-5.6-terra",
    input_per_million_usd: 2,
    output_per_million_usd: 12,
    snapshot_date: "2026-09-06",
  },
  "gpt-5.6-sol": {
    model: "gpt-5.6-sol",
    input_per_million_usd: 4,
    output_per_million_usd: 20,
    snapshot_date: "2026-09-06",
  },
  "gpt-5.6": {
    model: "gpt-5.6",
    input_per_million_usd: 4,
    output_per_million_usd: 20,
    snapshot_date: "2026-09-06",
  },
};

function finiteNonNegative(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

export function responseTokenUsage(response: unknown): OpenAiTokenUsage | null {
  if (!response || typeof response !== "object") return null;
  const usage = (response as { usage?: unknown }).usage;
  if (!usage || typeof usage !== "object") return null;
  const input = finiteNonNegative((usage as { input_tokens?: unknown }).input_tokens);
  const output = finiteNonNegative((usage as { output_tokens?: unknown }).output_tokens);
  const total = finiteNonNegative((usage as { total_tokens?: unknown }).total_tokens);
  if (!input && !output && !total) return null;
  return {
    input_tokens: input,
    output_tokens: output,
    total_tokens: total || input + output,
  };
}

export function addTokenUsage(
  a: OpenAiTokenUsage | null | undefined,
  b: OpenAiTokenUsage | null | undefined
): OpenAiTokenUsage | null {
  if (!a && !b) return null;
  return {
    input_tokens: (a?.input_tokens ?? 0) + (b?.input_tokens ?? 0),
    output_tokens: (a?.output_tokens ?? 0) + (b?.output_tokens ?? 0),
    total_tokens: (a?.total_tokens ?? 0) + (b?.total_tokens ?? 0),
  };
}

export function openAiPricing(model: string): OpenAiPricing | null {
  return PRICING[model] ?? null;
}

export function estimateOpenAiCostUsd(
  model: string,
  usage: OpenAiTokenUsage | null | undefined
): number | null {
  const pricing = openAiPricing(model);
  if (!pricing || !usage) return null;
  const amount =
    usage.input_tokens / 1_000_000 * pricing.input_per_million_usd +
    usage.output_tokens / 1_000_000 * pricing.output_per_million_usd;
  return Number(amount.toFixed(8));
}
