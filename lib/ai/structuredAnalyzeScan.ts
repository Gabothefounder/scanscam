import OpenAI from "openai";
import { AnalysisSchema, type AnalysisResult } from "./analysisSchema";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const PRIMARY_SCAN_MODEL = process.env.SCAN_ANALYSIS_MODEL || "gpt-5.6-luna";

const SCAN_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    risk_tier: { type: "string", enum: ["low", "medium", "high"] },
    language_detected: { type: "string", enum: ["en", "fr", "mixed", "unknown"] },
    summary_sentence: { type: ["string", "null"], maxLength: 200 },
    signals: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string" },
          evidence: { type: "string", maxLength: 200 },
          weight: { type: "integer", minimum: 1, maximum: 5 },
        },
        required: ["type", "evidence", "weight"],
      },
    },
    data_quality: {
      type: "object",
      additionalProperties: false,
      properties: {
        is_message_like: { type: "boolean" },
        ocr_suspected_errors: { type: "boolean" },
      },
      required: ["is_message_like", "ocr_suspected_errors"],
    },
    semantic: {
      type: "object",
      additionalProperties: false,
      properties: {
        context_sufficiency: { type: "string", enum: ["enough", "insufficient"] },
        claimed_identity_type: {
          type: "string",
          enum: ["government","financial_institution","courier","employer","law_enforcement","platform","person","other","unknown"],
        },
        scam_family: {
          type: "string",
          enum: ["delivery_scam","government_impersonation","law_enforcement","account_verification","employment_scam","recovery_scam","reward_claim","social_engineering_opener","investment_fraud","romance_scam","financial_phishing","tech_support","unknown"],
        },
        requested_actions: {
          type: "array",
          maxItems: 5,
          items: { type: "string", enum: ["click_link","call_number","submit_credentials","pay_money","reply","download_app","remote_access","move_channel","none","unknown"] },
        },
        requested_assets: {
          type: "array",
          maxItems: 5,
          items: { type: "string", enum: ["money","password","otp_or_mfa_code","bank_login","card_data","identity_data","crypto","gift_card","remote_device_access","conversation_engagement","unknown"] },
        },
        tactics: {
          type: "array",
          maxItems: 8,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string", enum: ["urgency","authority","fear","threat","false_trust","helpfulness","secrecy","isolation","scarcity","reward","verification_suppression","channel_migration","credential_request","financial_pressure"] },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              evidence: { type: ["string", "null"], maxLength: 200 },
            },
            required: ["type", "confidence", "evidence"],
          },
        },
        attack_stage: {
          type: "string",
          enum: ["initial_contact","lure","trust_building","authority_establishment","pressure_escalation","credential_capture","payment_extraction","isolation","repeat_extraction","recovery","unclear"],
        },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
      required: [
        "context_sufficiency",
        "claimed_identity_type",
        "scam_family",
        "requested_actions",
        "requested_assets",
        "tactics",
        "attack_stage",
        "confidence"
      ],
    },
  },
  required: [
    "risk_tier",
    "language_detected",
    "summary_sentence",
    "signals",
    "data_quality",
    "semantic"
  ],
} as const;

function outputLanguage(language: "en" | "fr" | "mixed"): "en" | "fr" {
  return language === "fr" ? "fr" : "en";
}

function instructions(language: "en" | "fr" | "mixed"): string {
  const out = outputLanguage(language);
  return [
    "You are ScanScam's semantic fraud-analysis sensor.",
    "",
    "Analyze one received message. Extract observable deception/manipulation structure conservatively and consistently in English and French.",
    "",
    "USER-FACING RISK COMPATIBILITY:",
    "- low: enough context and no clear scam manipulation patterns.",
    "- medium: one or more meaningful scam/manipulation patterns, or a suspicious requested action.",
    "- high: multiple strong patterns or a critical combination.",
    "- delivery_scam with only a link/address-update request and no explicit payment, credential, account-loss, or legal threat should normally remain medium rather than high.",
    "- urgency/immediate action PLUS threat of account suspension, lockout, loss of access, service disruption, legal/payment consequence => high.",
    '- If context is insufficient, semantic.context_sufficiency MUST be "insufficient". risk_tier is only a compatibility field; do not treat lack of context as evidence of safety.',
    "",
    "SEMANTIC EXTRACTION:",
    "- claimed_identity_type: type of identity/authority being claimed, not a guessed real sender.",
    "- scam_family: choose only when the message supports it.",
    "- family precedence: if a government/tax/police/municipal identity is explicitly claimed, prefer government_impersonation or law_enforcement over financial_phishing/account_verification. Use account_verification for account suspension/lockout/verification stories that seek login or verification credentials when the core claimed identity is a bank/platform/service. Use financial_phishing for broader financial impersonation/payment/credential stories that do not fit those more specific families.",
    "- requested_actions: literal immediate behaviors the recipient is asked to take, even in benign messages. Extract what is explicitly requested; do not infer a later step. A link alone supports click_link, not submit_credentials or pay_money unless credentials/payment are explicitly requested.",
    "- requested_assets: include only assets directly requested or strongly entailed by an explicit action. Do NOT infer credentials, card_data, or money merely because a link exists. A payment request supports money, not an unspecified payment instrument.",
    "- tactics are manipulation mechanisms, not mere keywords. Operational urgency in an otherwise ordinary message (for example a meeting moved urgently) is not an urgency manipulation tactic unless it pressures the recipient into a suspicious or consequential action.",
    "- verification_suppression: discourages independent checking (stay on line, don't tell bank/family, use only supplied contact, etc.).",
    "- channel_migration: pushes the person to another app/channel.",
    "- attack_stage: best supported stage; use unclear when unsupported.",
    "- confidence measures confidence in extraction, NOT probability of fraud.",
    "",
    "SIGNALS:",
    "- type is short English snake_case.",
    "- evidence MUST be a verbatim excerpt from the supplied message.",
    "- never invent evidence.",
    "",
    "SUMMARY:",
    "- null for low risk or insufficient context unless a short neutral clarification is useful.",
    "- for medium/high: one neutral sentence under 200 characters.",
    "- generated prose MUST be in " + (out === "fr" ? "French" : "English") + ".",
    "- do not quote or paraphrase private content in the summary.",
    "",
    "Return only the structured response required by the schema.",
  ].join("\n");
}

export type StructuredAnalysisOutput = {
  result: AnalysisResult;
  model: string;
  input_tokens?: number;
  output_tokens?: number;
};

export async function analyzeScanStructured(input: {
  messageText: string;
  language: "en" | "fr" | "mixed";
  source: "user_text" | "ocr";
  modelOverride?: string;
}): Promise<StructuredAnalysisOutput> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");

  const model = input.modelOverride || PRIMARY_SCAN_MODEL;
  const params: any = {
    model,
    instructions: instructions(input.language),
    input: "source=" + input.source + "\nmessage:\n" + input.messageText,
    store: false,
    text: {
      verbosity: model === "gpt-4o-mini" ? "medium" : "low",
      format: {
        type: "json_schema",
        name: "scanscam_analysis_v3",
        strict: true,
        schema: SCAN_OUTPUT_SCHEMA,
      },
    },
    max_output_tokens: 900,
  };
  if (model.startsWith("gpt-5")) {
    params.reasoning = { effort: "none" };
  }

  const response: any = await client.responses.create(params);

  if (!response.output_text) {
    throw new Error("structured_analysis_empty:" + response.status);
  }

  const parsed = JSON.parse(response.output_text);
  const validated = AnalysisSchema.parse(parsed);

  return {
    result: validated,
    model,
    input_tokens: response.usage?.input_tokens,
    output_tokens: response.usage?.output_tokens,
  };
}
