import { z } from "zod";

/**
 * Canonical ReportPayload Schema
 * Matches the Report UX flow exactly.
 * Strict validation - unknown keys are rejected.
 */

export const ReportPayloadSchema = z
  .object({
    /* ---------- Required fields ---------- */

    language: z.enum(["en", "fr"]),

    ask_type: z.enum([
      "link",
      "code",
      "money",
      "personal_info",
      "download",
      "other",
    ]),

    engagement_outcome: z.enum(["stopped", "clicked", "lost_money", "unsure"]),

    consent_given: z.boolean(),

    /* ---------- Optional fields (nullable) ---------- */

    identity_impact: z
      .enum(["none", "personal_info_exposed", "account_taken_over", "unsure"])
      .nullable(),

    financial_loss_range: z
      .enum([
        "none",
        "lt_500",
        "500_5000",
        "gt_5000",
        "prefer_not_to_say",
      ])
      .nullable(),

    city: z.string().nullable(),

    story_text: z.string().nullable(),

    gap_text: z.string().nullable(),
  })
  .strict();

export type ReportPayload = z.infer<typeof ReportPayloadSchema>;

