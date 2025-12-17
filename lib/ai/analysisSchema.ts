import { z } from "zod";

export const AnalysisSchema = z.object({
  version: z.literal("1.0"),

  language_detected: z.enum(["en", "fr", "mixed", "unknown"]),

  risk_tier: z.enum(["low", "medium", "high"]),

  confidence: z.number().min(0).max(1),

  summary: z.object({
    headline: z.string().max(80),
    why_it_matters: z.string().max(240),
  }),

  signals: z
    .array(
      z.object({
        type: z.enum([
          "urgency",
          "authority",
          "payment",
          "link",
          "credential",
          "secrecy",
          "threat",
          "too_good_to_be_true",
          "impersonation",
          "remote_access",
          "personal_data",
          "other",
        ]),
        evidence: z.string().max(200),
        weight: z.number().int().min(1).max(5),
      })
    )
    .max(10),

  recommended_actions: z.array(
    z.object({
      action: z.enum([
        "do_not_click",
        "do_not_send_money",
        "verify_independently",
        "contact_official_channel",
        "block_report",
        "secure_accounts",
        "other",
      ]),
      details: z.string().max(200),
    })
  ),

  data_quality: z.object({
    is_message_like: z.boolean(),
    ocr_suspected_errors: z.boolean(),
    notes: z.string().max(200),
  }),

  safety: z.object({
    pii_detected: z.boolean(),
    pii_types: z.array(z.string()),
  }),
});

export type AnalysisResult = z.infer<typeof AnalysisSchema>;
