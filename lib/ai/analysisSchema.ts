import { z } from "zod";

/**
 * MVP Analysis Schema
 * Enforces only what the UI consumes.
 * Optional fields prevent parse failures.
 */

export const AnalysisSchema = z.object({
  /* ---------- meta ---------- */

  version: z.literal("1.0").optional(),

  language_detected: z
    .enum(["en", "fr", "mixed", "unknown"])
    .optional(),

  /* ---------- core classification ---------- */

  risk_tier: z.enum(["low", "medium", "high"]),

  summary_sentence: z.string().max(200).optional(),

  /* ---------- signals shown to user ---------- */

  signals: z
    .array(
      z.object({
        type: z.string(),
        evidence: z.string().max(200),
        weight: z.number().int().min(1).max(5).optional(),
      })
    )
    .default([]),

  /* ---------- data quality (important) ---------- */

  data_quality: z.object({
    is_message_like: z.boolean(),
    ocr_suspected_errors: z.boolean().optional(),
    notes: z.string().optional(),
  }),

  /* ---------- future-facing fields (optional) ---------- */

  confidence: z.number().min(0).max(1).optional(),

  summary: z
    .object({
      headline: z.string().max(80),
      why_it_matters: z.string().max(240),
    })
    .optional(),

  recommended_actions: z
    .array(
      z.object({
        action: z.string(),
        details: z.string().max(200),
      })
    )
    .optional(),

  safety: z
    .object({
      pii_detected: z.boolean(),
      pii_types: z.array(z.string()),
    })
    .optional(),
});

export type AnalysisResult = z.infer<typeof AnalysisSchema>;
