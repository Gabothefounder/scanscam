import OpenAI from "openai";
import {
  emptyHumanValueProfile,
  normalizeHumanValueProfile,
  type HumanValueProfile,
  type ValueCoachQuestion,
} from "./value-profile";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL =
  process.env.VALUE_GUARD_MODEL ||
  process.env.INTEGRITY_SEMANTIC_MODEL ||
  process.env.SCAN_ANALYSIS_MODEL ||
  "gpt-5.6-luna";

const PRIMITIVE_VALUE_SCHEMA = {
  anyOf: [
    { type: "string", maxLength: 240 },
    { type: "number" },
    { type: "boolean" },
    { type: "null" },
    {
      type: "array",
      maxItems: 20,
      items: {
        anyOf: [
          { type: "string", maxLength: 240 },
          { type: "number" },
          { type: "boolean" },
          { type: "null" },
        ],
      },
    },
  ],
} as const;

const TARGET_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    kind: {
      type: "string",
      enum: ["fact", "action_amount", "action_type", "effect"],
    },
    fact_key: { type: ["string", "null"], maxLength: 160 },
  },
  required: ["kind", "fact_key"],
} as const;

const PROFILE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    version: { type: "string", enum: ["0.6"] },
    summary: {
      type: "array",
      maxItems: 12,
      items: { type: "string", maxLength: 240 },
    },
    hard_rules: {
      type: "array",
      maxItems: 40,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", maxLength: 120 },
          label: { type: "string", maxLength: 180 },
          target: TARGET_SCHEMA,
          operator: {
            type: "string",
            enum: ["eq", "neq", "in", "not_in", "lte", "gte", "exists"],
          },
          value: PRIMITIVE_VALUE_SCHEMA,
          effect: { type: "string", enum: ["block", "require_approval"] },
          reason: { type: "string", maxLength: 300 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          source: {
            type: "string",
            enum: ["explicit", "tradeoff", "observed_choice", "inferred"],
          },
        },
        required: [
          "id",
          "label",
          "target",
          "operator",
          "value",
          "effect",
          "reason",
          "confidence",
          "source",
        ],
      },
    },
    preferences: {
      type: "array",
      maxItems: 60,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", maxLength: 120 },
          label: { type: "string", maxLength: 180 },
          target: TARGET_SCHEMA,
          kind: { type: "string", enum: ["match", "minimize", "maximize", "qualitative"] },
          operator: {
            anyOf: [
              {
                type: "string",
                enum: ["eq", "neq", "in", "not_in", "lte", "gte", "exists"],
              },
              { type: "null" },
            ],
          },
          value: PRIMITIVE_VALUE_SCHEMA,
          mode: { type: "string", enum: ["prefer", "avoid"] },
          strength: {
            type: "string",
            enum: ["light", "moderate", "strong", "very_strong"],
          },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          private: { type: "boolean" },
          max_premium_percent: {
            anyOf: [
              { type: "number", minimum: 0, maximum: 500 },
              { type: "null" },
            ],
          },
          source: {
            type: "string",
            enum: ["explicit", "tradeoff", "observed_choice", "inferred"],
          },
        },
        required: [
          "id",
          "label",
          "target",
          "kind",
          "operator",
          "value",
          "mode",
          "strength",
          "confidence",
          "private",
          "max_premium_percent",
          "source",
        ],
      },
    },
    limits: {
      type: "object",
      additionalProperties: false,
      properties: {
        currency: { type: ["string", "null"], maxLength: 12 },
        max_autonomous_amount: {
          anyOf: [{ type: "number", minimum: 0 }, { type: "null" }],
        },
        human_approval_amount: {
          anyOf: [{ type: "number", minimum: 0 }, { type: "null" }],
        },
        budgets: {
          type: "array",
          maxItems: 20,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string", maxLength: 120 },
              limit: { type: "number", minimum: 0 },
              currency: { type: ["string", "null"], maxLength: 12 },
              window_seconds: { type: "integer", minimum: 60, maximum: 31536000 },
              effects: {
                type: "array",
                maxItems: 12,
                items: { type: "string", maxLength: 80 },
              },
              action_types: {
                type: "array",
                maxItems: 12,
                items: { type: "string", maxLength: 80 },
              },
              mode: { type: "string", enum: ["approval", "deny"] },
            },
            required: [
              "id",
              "limit",
              "currency",
              "window_seconds",
              "effects",
              "action_types",
              "mode",
            ],
          },
        },
      },
      required: [
        "currency",
        "max_autonomous_amount",
        "human_approval_amount",
        "budgets",
      ],
    },
    open_questions: {
      type: "array",
      maxItems: 12,
      items: { type: "string", maxLength: 240 },
    },
    learned_from_decisions: { type: "integer", minimum: 0 },
  },
  required: [
    "version",
    "summary",
    "hard_rules",
    "preferences",
    "limits",
    "open_questions",
    "learned_from_decisions",
  ],
} as const;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    assistant_message: { type: "string", maxLength: 900 },
    event_summary: {
      type: "array",
      maxItems: 8,
      items: { type: "string", maxLength: 220 },
    },
    profile: PROFILE_SCHEMA,
    next_question: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string", maxLength: 120 },
            text: { type: "string", maxLength: 500 },
            format: {
              type: "string",
              enum: ["choice", "text", "number", "yes_no"],
            },
            options: {
              type: "array",
              maxItems: 8,
              items: { type: "string", maxLength: 160 },
            },
            rationale: { type: "string", maxLength: 400 },
          },
          required: ["id", "text", "format", "options", "rationale"],
        },
        { type: "null" },
      ],
    },
    ready_to_publish: { type: "boolean" },
  },
  required: [
    "assistant_message",
    "event_summary",
    "profile",
    "next_question",
    "ready_to_publish",
  ],
} as const;

export type ValueCoachTurn = {
  assistant_message: string;
  event_summary: string[];
  profile: HumanValueProfile;
  next_question: ValueCoachQuestion | null;
  ready_to_publish: boolean;
  model: string | null;
};

export async function compileValueCoachTurn(input: {
  profile?: HumanValueProfile;
  question_count: number;
  current_question?: ValueCoachQuestion | null;
  user_message: string;
}): Promise<ValueCoachTurn> {
  const currentProfile = normalizeHumanValueProfile(
    input.profile ?? emptyHumanValueProfile()
  );

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("value_guard_model_unavailable");
  }

  const payload = {
    question_count: input.question_count,
    current_question: input.current_question ?? null,
    current_profile: currentProfile,
    user_answer: input.user_message.slice(0, 5000),
  };

  const params: any = {
    model: MODEL,
    instructions: [
      "You are the private preference compiler for ScanScam Value Guard.",
      "Your job is to learn how this principal wants autonomous agents to make trade-offs.",
      "The human speaks naturally. Never ask the human to assign numeric weights.",
      "Internally, represent clear preferences using strength and confidence.",
      "A hard rule may be created ONLY when the user explicitly states a boundary such as never, always, do not, ask me before, require approval, or a clear numeric limit.",
      "Never turn an inferred preference into a block or approval rule.",
      "Preferences may concern literally anything: price, privacy, geography, time, reliability, environmental impact, brands, data residency, travel style, vendors, convenience, open source, family preferences, scheduling, or custom facts.",
      "Use target.kind=fact for arbitrary observable properties. fact_key should be a concise dot path such as supplier_country, flight.red_eye, hosting.region, privacy.sells_personal_data, warranty_years, or brand.",
      "Use target.kind=action_amount only for monetary action limits or relative price preferences.",
      "Use kind=minimize or maximize ONLY for genuinely numeric observable facts such as price, latency, carbon, travel time, or warranty years. For minimize/maximize, operator should be null.",
      "Use kind=qualitative when the user clearly cares about something but it is not operationally defined yet, such as 'privacy matters a lot'. Keep operator null and value null, preserve it as a private preference, and ask a concrete follow-up rather than inventing a score.",
      "For country facts such as supplier_country, use ISO 3166-1 alpha-2 values when known (Canada=CA, United States=US).",
      "Use kind=match for categorical/boolean preferences. A match requires an operator.",
      "Keep preferences private by default.",
      "max_premium_percent is only for a preference when the user gives enough information about how much extra they would tolerate. Otherwise use null.",
      "Explicit statements should usually have confidence 0.9-1.0. Trade-off answers usually 0.7-0.95. Weak inference should stay <=0.55.",
      "If a concept is underspecified, ask rather than invent. Example: if the user says 'local' but you do not know what local means, ask.",
      "Ask ONE next question at a time, chosen for maximum decision value. Prefer concrete trade-off questions over abstract ratings.",
      "Examples: 'Would you still prefer the local option if it cost about 10% more?' or 'Should red-eye flights be a preference to avoid, or should I always ask you first?'",
      "Avoid an exhausting questionnaire. By roughly 5-8 useful answers, mark ready_to_publish unless a major ambiguity remains.",
      "When question_count is below 3, normally ask another high-information question unless the user explicitly says they are done or refuses further questions.",
      "The user can later correct the profile conversationally; when they do, update or remove prior entries rather than duplicating them.",
      "Do not store or repeat sensitive secrets. The event_summary should contain only the structured preference learned, not the raw answer.",
      "assistant_message should briefly reflect what you learned and naturally introduce next_question when present.",
      "Return only the required structured JSON.",
    ].join("\n"),
    input: JSON.stringify(payload),
    store: false,
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "scanscam_value_guard_profile_v06",
        strict: true,
        schema: RESPONSE_SCHEMA,
      },
    },
    max_output_tokens: 2600,
  };

  if (MODEL.startsWith("gpt-5")) {
    params.reasoning = { effort: "none" };
  }

  const response: any = await client.responses.create(params);
  if (!response.output_text) throw new Error("value_guard_model_empty");

  const parsed = JSON.parse(response.output_text) as Omit<ValueCoachTurn, "model">;
  return {
    ...parsed,
    profile: normalizeHumanValueProfile(parsed.profile),
    next_question: parsed.next_question
      ? {
          ...parsed.next_question,
          options: parsed.next_question.options ?? [],
        }
      : null,
    model: MODEL,
  };
}
