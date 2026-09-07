import type {
  MandateBudget,
  MandateRule,
  Primitive,
  PrincipalMandate,
  ValueObjective,
} from "./preflight";
import { hashIntegrityValue } from "./canonical";

export type ValueStrength = "light" | "moderate" | "strong" | "very_strong";
export type ValueSource = "explicit" | "tradeoff" | "observed_choice" | "inferred";
export type ValueTargetKind = "fact" | "action_amount" | "action_type" | "effect";
export type ValuePreferenceKind = "match" | "minimize" | "maximize" | "qualitative";

export type ValueTarget = {
  kind: ValueTargetKind;
  fact_key: string | null;
};

export type HumanHardRule = {
  id: string;
  label: string;
  target: ValueTarget;
  operator: MandateRule["operator"];
  value: Primitive;
  effect: "block" | "require_approval";
  reason: string;
  confidence: number;
  source: ValueSource;
};

export type HumanPreference = {
  id: string;
  label: string;
  target: ValueTarget;
  kind: ValuePreferenceKind;
  operator: MandateRule["operator"] | null;
  value: Primitive;
  mode: "prefer" | "avoid";
  strength: ValueStrength;
  confidence: number;
  private: boolean;
  max_premium_percent: number | null;
  source: ValueSource;
};

export type HumanValueLimits = {
  currency: string | null;
  max_autonomous_amount: number | null;
  human_approval_amount: number | null;
  budgets: MandateBudget[];
};

export type HumanValueProfile = {
  version: "0.6";
  summary: string[];
  hard_rules: HumanHardRule[];
  preferences: HumanPreference[];
  limits: HumanValueLimits;
  open_questions: string[];
  learned_from_decisions: number;
};

export type ValueCoachQuestion = {
  id: string;
  text: string;
  format: "choice" | "text" | "number" | "yes_no";
  options: string[];
  rationale: string;
};

export type ValueOption = {
  id: string;
  label: string;
  price?: number;
  currency?: string;
  effect?: string;
  action_type?: string;
  facts: Record<string, Primitive>;
};

export type ValueOptionResult = {
  id: string;
  label: string;
  disposition: "eligible" | "approval_required" | "denied";
  utility: number;
  normalized_score: number;
  matched_preferences: string[];
  tradeoff_notes: string[];
  hard_rule_reasons: string[];
};

export function emptyHumanValueProfile(): HumanValueProfile {
  return {
    version: "0.6",
    summary: [],
    hard_rules: [],
    preferences: [],
    limits: {
      currency: null,
      max_autonomous_amount: null,
      human_approval_amount: null,
      budgets: [],
    },
    open_questions: [],
    learned_from_decisions: 0,
  };
}

export function initialValueCoachQuestion(): ValueCoachQuestion {
  return {
    id: "hard-boundaries",
    text: "Start with the boundaries: what should an agent never do, or never do without asking you first?",
    format: "text",
    options: [],
    rationale: "Hard boundaries should come from you explicitly; the system should never infer them from a preference.",
  };
}

function normalizeCountryValue(factKey: string | null, value: Primitive): Primitive {
  if (!factKey || !/(^|\.)(country|country_code)$|_country$/i.test(factKey)) return value;
  if (typeof value !== "string") return value;

  const normalized = value.trim().toLowerCase();
  const map: Record<string, string> = {
    canada: "CA",
    canadian: "CA",
    ca: "CA",
    "united states": "US",
    "united states of america": "US",
    usa: "US",
    us: "US",
    american: "US",
    mexico: "MX",
    mexican: "MX",
    "united kingdom": "GB",
    britain: "GB",
    british: "GB",
    uk: "GB",
    gb: "GB",
    france: "FR",
    french: "FR",
  };

  return map[normalized] ?? value;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function strengthWeight(strength: ValueStrength): number {
  switch (strength) {
    case "light": return 20;
    case "moderate": return 40;
    case "strong": return 70;
    case "very_strong": return 90;
  }
}

function targetField(target: ValueTarget): string | null {
  switch (target.kind) {
    case "fact":
      return target.fact_key
        ? `context.action_envelope.policy_facts.${target.fact_key}`
        : null;
    case "action_amount":
      return "action.amount";
    case "action_type":
      return "action.type";
    case "effect":
      return "action.metadata.integrity_effect";
  }
}

export function normalizeHumanValueProfile(profile: HumanValueProfile): HumanValueProfile {
  const hardRules = profile.hard_rules
    .filter((rule) => !!targetField(rule.target))
    .map((rule) => ({
      ...rule,
      id: rule.id.trim().slice(0, 120),
      label: rule.label.trim().slice(0, 180),
      reason: rule.reason.trim().slice(0, 300),
      confidence: clamp01(rule.confidence),
      value: normalizeCountryValue(rule.target.fact_key, rule.value),
    }))
    .filter((rule) => rule.id && rule.label);

  const preferences = profile.preferences
    .filter((preference) => !!targetField(preference.target))
    .map((preference) => ({
      ...preference,
      id: preference.id.trim().slice(0, 120),
      label: preference.label.trim().slice(0, 180),
      confidence: clamp01(preference.confidence),
      max_premium_percent:
        preference.max_premium_percent === null ||
        !Number.isFinite(preference.max_premium_percent)
          ? null
          : Math.max(0, Math.min(500, preference.max_premium_percent)),
      private: preference.private !== false,
      value: normalizeCountryValue(preference.target.fact_key, preference.value),
    }))
    .filter((preference) => preference.id && preference.label);

  return {
    version: "0.6",
    summary: profile.summary.map((item) => item.trim().slice(0, 240)).filter(Boolean).slice(0, 12),
    hard_rules: hardRules.slice(0, 40),
    preferences: preferences.slice(0, 60),
    limits: {
      currency: profile.limits.currency?.trim().toUpperCase().slice(0, 12) || null,
      max_autonomous_amount:
        profile.limits.max_autonomous_amount === null
          ? null
          : Math.max(0, profile.limits.max_autonomous_amount),
      human_approval_amount:
        profile.limits.human_approval_amount === null
          ? null
          : Math.max(0, profile.limits.human_approval_amount),
      budgets: (profile.limits.budgets ?? []).slice(0, 20),
    },
    open_questions: profile.open_questions
      .map((item) => item.trim().slice(0, 240))
      .filter(Boolean)
      .slice(0, 12),
    learned_from_decisions: Math.max(0, Math.floor(profile.learned_from_decisions ?? 0)),
  };
}

export function compileValueProfileToMandate(profile: HumanValueProfile): PrincipalMandate {
  const normalized = normalizeHumanValueProfile(profile);

  const rules: MandateRule[] = normalized.hard_rules.flatMap((rule) => {
    const field = targetField(rule.target);
    if (!field) return [];
    return [{
      id: rule.id,
      field,
      operator: rule.operator,
      value: rule.value,
      effect: rule.effect,
      reason: rule.reason || rule.label,
    }];
  });

  const objectives: ValueObjective[] = normalized.preferences.flatMap((preference) => {
    if (preference.kind !== "match") return [];
    const field = targetField(preference.target);
    if (!field || !preference.operator) return [];

    const confidenceMultiplier = 0.45 + 0.55 * clamp01(preference.confidence);
    const weight = Math.round(strengthWeight(preference.strength) * confidenceMultiplier);

    return [{
      id: preference.id,
      field,
      operator: preference.operator,
      value: preference.value,
      mode: preference.mode,
      weight,
      reason: preference.label,
      private: preference.private,
    }];
  });

  return {
    currency: normalized.limits.currency ?? undefined,
    max_autonomous_amount: normalized.limits.max_autonomous_amount ?? undefined,
    human_approval_amount: normalized.limits.human_approval_amount ?? undefined,
    rules,
    objectives,
    budgets: normalized.limits.budgets,
  };
}

export function valueProfileHashes(profile: HumanValueProfile): {
  profile_hash: string;
  compiled_mandate: PrincipalMandate;
  compiled_mandate_hash: string;
} {
  const normalized = normalizeHumanValueProfile(profile);
  const mandate = compileValueProfileToMandate(normalized);
  return {
    profile_hash: hashIntegrityValue(normalized),
    compiled_mandate: mandate,
    compiled_mandate_hash: hashIntegrityValue(mandate),
  };
}

function nestedFact(facts: Record<string, Primitive>, key: string | null): Primitive | undefined {
  if (!key) return undefined;
  let current: Primitive = facts;
  for (const part of key.split(".").filter(Boolean)) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = current[part];
  }
  return current;
}

function targetValue(option: ValueOption, target: ValueTarget): Primitive | undefined {
  switch (target.kind) {
    case "fact":
      return nestedFact(option.facts, target.fact_key);
    case "action_amount":
      return option.price;
    case "action_type":
      return option.action_type;
    case "effect":
      return option.effect;
  }
}

function primitiveEqual(a: Primitive | undefined, b: Primitive | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function conditionMatches(
  actual: Primitive | undefined,
  operator: MandateRule["operator"],
  expected: Primitive
): boolean {
  if (operator !== "exists" && (actual === undefined || actual === null)) return false;
  switch (operator) {
    case "eq": return primitiveEqual(actual, expected);
    case "neq": return !primitiveEqual(actual, expected);
    case "in":
      return Array.isArray(expected)
        ? expected.some((item) => primitiveEqual(actual, item))
        : false;
    case "not_in":
      return Array.isArray(expected)
        ? !expected.some((item) => primitiveEqual(actual, item))
        : false;
    case "lte":
      return typeof actual === "number" && typeof expected === "number" && actual <= expected;
    case "gte":
      return typeof actual === "number" && typeof expected === "number" && actual >= expected;
    case "exists":
      return actual !== undefined && actual !== null;
  }
}

function numericTarget(option: ValueOption, preference: HumanPreference): number | null {
  const value = targetValue(option, preference.target);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function evaluateOptionsWithValueProfile(
  profile: HumanValueProfile,
  options: ValueOption[]
): {
  recommended_option_id: string | null;
  results: ValueOptionResult[];
} {
  const normalized = normalizeHumanValueProfile(profile);
  const cheapest = options
    .map((option) => option.price)
    .filter((price): price is number => typeof price === "number" && Number.isFinite(price))
    .reduce<number | null>((min, price) => min === null ? price : Math.min(min, price), null);

  const numericRanges = new Map<string, { min: number; max: number }>();
  for (const preference of normalized.preferences) {
    if (preference.kind === "match" || preference.kind === "qualitative") continue;
    const values = options
      .map((option) => numericTarget(option, preference))
      .filter((value): value is number => value !== null);
    if (!values.length) continue;
    numericRanges.set(preference.id, { min: Math.min(...values), max: Math.max(...values) });
  }

  const results = options.map<ValueOptionResult>((option) => {
    const hardRuleReasons: string[] = [];
    let disposition: ValueOptionResult["disposition"] = "eligible";

    for (const rule of normalized.hard_rules) {
      if (!conditionMatches(targetValue(option, rule.target), rule.operator, rule.value)) continue;
      hardRuleReasons.push(rule.reason || rule.label);
      if (rule.effect === "block") disposition = "denied";
      else if (disposition !== "denied") disposition = "approval_required";
    }

    const matchedPreferences: string[] = [];
    const tradeoffNotes: string[] = [];
    let utility = 0;

    for (const preference of normalized.preferences) {
      const baseWeight = strengthWeight(preference.strength) *
        (0.45 + 0.55 * clamp01(preference.confidence));

      if (preference.kind === "qualitative") {
        continue;
      }

      if (preference.kind === "match") {
        if (!preference.operator) continue;
        const matched = conditionMatches(
          targetValue(option, preference.target),
          preference.operator,
          preference.value
        );
        if (!matched) continue;

        if (
          preference.max_premium_percent !== null &&
          cheapest !== null &&
          option.price !== undefined &&
          cheapest > 0
        ) {
          const premium = ((option.price - cheapest) / cheapest) * 100;
          if (premium > preference.max_premium_percent) {
            tradeoffNotes.push(
              `${preference.label} matches, but the ${premium.toFixed(1)}% premium exceeds your learned ${preference.max_premium_percent.toFixed(0)}% tolerance.`
            );
            continue;
          }
        }

        utility += preference.mode === "prefer" ? baseWeight : -baseWeight;
        matchedPreferences.push(preference.label);
        continue;
      }

      const value = numericTarget(option, preference);
      const range = numericRanges.get(preference.id);
      if (value === null || !range) continue;
      const span = range.max - range.min;
      const normalizedPosition = span === 0 ? 0.5 : (value - range.min) / span;
      const directional = preference.kind === "maximize"
        ? normalizedPosition
        : 1 - normalizedPosition;
      utility += baseWeight * (directional - 0.5) * 2;
      matchedPreferences.push(preference.label);
    }

    return {
      id: option.id,
      label: option.label,
      disposition,
      utility: Number(utility.toFixed(2)),
      normalized_score: 0,
      matched_preferences: matchedPreferences,
      tradeoff_notes: tradeoffNotes,
      hard_rule_reasons: hardRuleReasons,
    };
  });

  const eligible = results.filter((result) => result.disposition !== "denied");
  const minUtility = eligible.length ? Math.min(...eligible.map((result) => result.utility)) : 0;
  const maxUtility = eligible.length ? Math.max(...eligible.map((result) => result.utility)) : 0;
  const span = maxUtility - minUtility;

  for (const result of results) {
    if (result.disposition === "denied") {
      result.normalized_score = 0;
      continue;
    }
    result.normalized_score = span === 0
      ? 50
      : Number((((result.utility - minUtility) / span) * 100).toFixed(1));
  }

  const recommended = [...eligible]
    .sort((a, b) => {
      if (a.disposition !== b.disposition) {
        if (a.disposition === "eligible") return -1;
        if (b.disposition === "eligible") return 1;
      }
      return b.utility - a.utility;
    })[0];

  return {
    recommended_option_id: recommended?.id ?? null,
    results,
  };
}
