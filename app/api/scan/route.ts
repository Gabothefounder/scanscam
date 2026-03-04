export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

import { ocrImage } from "@/lib/ocr";
import { analyzeScan } from "@/lib/ai/analyzeScan";
import { checkRateLimit } from "@/lib/rateLimit";
import { isRepeatedScan } from "@/lib/repeatGuard";
import { isOCRBlocked, recordOCRResult } from "@/lib/ocrGuard";
import { logEvent } from "@/lib/observability";

/* -------------------------------------------------
   Supabase client — SERVER ONLY
-------------------------------------------------- */

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

/* -------------------------------------------------
   Intel features extraction
-------------------------------------------------- */

const REQUIRED_INTEL_KEYS = [
  "narrative_category",
  "authority_type",
  "brand_mentions",
  "channel_type",
  "escalation_pattern",
  "urgency_score",
  "threat_score",
  "payment_request",
  "payment_method",
  "credential_request",
  "link_present",
  "callback_number_present",
  "emotion_vectors",
  "language_variant",
  "risk_score_numeric",
] as const;

function extractIntelFeatures(
  result: any,
  messageText: string
): { intel_features: Record<string, any>; mode: "full" | "extraction_failed" } {
  try {
    const text = messageText.toLowerCase();

    const intel: Record<string, any> = {
      narrative_category: detectNarrativeCategory(text),
      authority_type: detectAuthorityType(text),
      brand_mentions: detectBrandMentions(text),
      channel_type: detectChannelType(text),
      escalation_pattern: detectEscalationPattern(text),
      urgency_score: computeUrgencyScore(text),
      threat_score: computeThreatScore(text),
      payment_request: hasPaymentRequest(text),
      payment_method: detectPaymentMethod(text),
      credential_request: hasCredentialRequest(text),
      link_present: /https?:\/\/|www\./i.test(messageText),
      callback_number_present: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(messageText),
      emotion_vectors: detectEmotionVectors(text),
      language_variant: result.language ?? "en",
      risk_score_numeric: riskTierToNumeric(result.risk_tier ?? result.risk ?? "low"),
    };

    const missingKeys = REQUIRED_INTEL_KEYS.filter((k) => intel[k] === undefined);
    if (missingKeys.length > 0) {
      return {
        intel_features: { extraction_failed: true, reason: `missing_keys: ${missingKeys.join(",")}` },
        mode: "extraction_failed",
      };
    }

    return { intel_features: intel, mode: "full" };
  } catch (err: any) {
    return {
      intel_features: { extraction_failed: true, reason: err?.message ?? "unknown_error" },
      mode: "extraction_failed",
    };
  }
}

function detectNarrativeCategory(text: string): string {
  if (/lottery|winner|prize|won/.test(text)) return "prize_scam";
  if (/irs|tax|government|arrest|warrant/.test(text)) return "government_impersonation";
  if (/bank|account.*suspend|verify.*account/.test(text)) return "financial_phishing";
  if (/tech support|virus|computer.*infected/.test(text)) return "tech_support";
  if (/romance|love|dating|meet/.test(text)) return "romance_scam";
  if (/investment|crypto|bitcoin|guaranteed.*return/.test(text)) return "investment_fraud";
  if (/job|work.*from.*home|easy.*money/.test(text)) return "employment_scam";
  if (/package|delivery|usps|fedex|ups/.test(text)) return "delivery_scam";
  return "unknown";
}

function detectAuthorityType(text: string): string {
  if (/police|fbi|irs|government|official/.test(text)) return "government";
  if (/bank|paypal|visa|mastercard/.test(text)) return "financial_institution";
  if (/microsoft|apple|google|amazon/.test(text)) return "tech_company";
  if (/ceo|manager|hr|boss/.test(text)) return "corporate";
  return "unknown";
}

function detectBrandMentions(text: string): string[] {
  const brands = ["amazon", "paypal", "apple", "microsoft", "google", "netflix", "facebook", "meta", "instagram", "whatsapp", "bank of america", "chase", "wells fargo", "usps", "fedex", "ups"];
  return brands.filter((b) => text.includes(b));
}

function detectChannelType(text: string): string {
  if (/sms|text message/.test(text)) return "sms";
  if (/email|@/.test(text)) return "email";
  if (/whatsapp/.test(text)) return "whatsapp";
  if (/call|phone|voicemail/.test(text)) return "phone";
  return "unknown";
}

function detectEscalationPattern(text: string): string {
  if (/immediate|urgent|now|today|within.*hour/.test(text)) return "time_pressure";
  if (/arrest|legal.*action|lawsuit|police/.test(text)) return "legal_threat";
  if (/suspend|close.*account|lose.*access/.test(text)) return "account_threat";
  return "unknown";
}

function computeUrgencyScore(text: string): number {
  let score = 0;
  if (/urgent|immediately|asap|right now/.test(text)) score += 2;
  if (/today|within.*hour|expires/.test(text)) score += 1;
  if (/don't delay|act fast|limited time/.test(text)) score += 1;
  if (/!{2,}/.test(text)) score += 1;
  return Math.min(score, 5);
}

function computeThreatScore(text: string): number {
  let score = 0;
  if (/arrest|jail|prison|warrant/.test(text)) score += 2;
  if (/suspend|terminate|close/.test(text)) score += 1;
  if (/legal action|lawsuit|court/.test(text)) score += 1;
  if (/police|fbi|irs/.test(text)) score += 1;
  return Math.min(score, 5);
}

function hasPaymentRequest(text: string): boolean {
  return /pay|payment|send.*money|wire|transfer|gift card|bitcoin|crypto|zelle|venmo|cash app/.test(text);
}

function detectPaymentMethod(text: string): string {
  if (/gift card/.test(text)) return "gift_card";
  if (/bitcoin|crypto|btc|eth/.test(text)) return "cryptocurrency";
  if (/wire.*transfer|western union|moneygram/.test(text)) return "wire_transfer";
  if (/zelle|venmo|cash app|paypal/.test(text)) return "p2p_app";
  if (/credit card|debit card/.test(text)) return "card";
  return "unknown";
}

function hasCredentialRequest(text: string): boolean {
  return /password|ssn|social security|login|credentials|verify.*identity|confirm.*account/.test(text);
}

function detectEmotionVectors(text: string): string[] {
  const vectors: string[] = [];
  if (/fear|scared|worried|concern/.test(text)) vectors.push("fear");
  if (/urgent|hurry|immediate/.test(text)) vectors.push("urgency");
  if (/congratulations|winner|lucky/.test(text)) vectors.push("excitement");
  if (/trust|secure|safe|official/.test(text)) vectors.push("false_trust");
  if (/help|assist|support/.test(text)) vectors.push("helpfulness");
  return vectors;
}

function riskTierToNumeric(tier: string): number {
  if (tier === "high") return 85;
  if (tier === "medium") return 50;
  return 15;
}

const MIN_LENGTH = 20;

/* -------------------------------------------------
   Helpers
-------------------------------------------------- */

function reject(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function looksLikeConversation(text: string): boolean {
  const markers = [
    "i think",
    "i feel",
    "what should i do",
    "can you help",
  ];
  const lower = text.toLowerCase();
  return markers.some((m) => lower.includes(m));
}

/* -------------------------------------------------
   POST /api/scan
-------------------------------------------------- */

export async function POST(req: Request) {
  let body: any;

  /* ---------- IP extraction (ephemeral) ---------- */
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    crypto.randomUUID();

  /* ---------- Rate limiting ---------- */
  if (!checkRateLimit(ip)) {
    logEvent("rate_limited", "warning", "scan_api");
    return reject("rate_limited", "Too many requests.", 429);
  }

  /* ---------- Vercel geo headers (coarse, no IP/UA stored) ---------- */
  const h = new Headers(req.headers);
  const rawCountry = h.get("x-vercel-ip-country")?.trim() ?? "";
  const rawRegion = h.get("x-vercel-ip-country-region")?.trim() ?? "";
  const rawCity = h.get("x-vercel-ip-city")?.trim() ?? "";
  const vercel_country_code = rawCountry ? rawCountry.toUpperCase() : null;
  const vercel_region_code = rawRegion || null;
  const vercel_city = rawCity || null;

  /* ---------- Parse body (JSON or FormData) ---------- */
  const contentType = req.headers.get("content-type") ?? "";
  console.log("[scan_debug]", { contentType });

  let text: string | undefined;
  let image: string | undefined;
  let lang: string | undefined;
  let raw_opt_in: boolean | string | undefined;
  let country_code: string | undefined;
  let region_code: string | undefined;
  let city: string | undefined;

  /* ---------- Strict content-type check ---------- */
  if (!contentType.includes("application/json") && !contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { ok: false, code: "unsupported_media_type", message: "Expected application/json or multipart/form-data" },
      { status: 415 }
    );
  }

  try {
    if (contentType.includes("application/json")) {
      const body = await req.json();
      text = body.text;
      image = body.image;
      lang = body.lang;
      raw_opt_in = body.raw_opt_in;
      country_code = body.country_code;
      region_code = body.region_code;
      city = body.city;
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();

      const textField = formData.get("text");
      if (typeof textField === "string") text = textField;

      const langField = formData.get("lang");
      if (typeof langField === "string") lang = langField;

      const rawOptInField = formData.get("raw_opt_in");
      if (rawOptInField === "true") {
        raw_opt_in = true;
      } else if (rawOptInField === "false") {
        raw_opt_in = false;
      }

      const countryField = formData.get("country_code");
      if (typeof countryField === "string") country_code = countryField;

      const regionField = formData.get("region_code");
      if (typeof regionField === "string") region_code = regionField;

      const cityField = formData.get("city");
      if (typeof cityField === "string") city = cityField;

      const imageField = formData.get("image");
      if (imageField && typeof imageField === "object" && "arrayBuffer" in imageField) {
        const file = imageField as File;
        const buffer = Buffer.from(await file.arrayBuffer());
        const base64 = buffer.toString("base64");
        const mimeType = file.type || "image/png";
        image = `data:${mimeType};base64,${base64}`;
      } else if (typeof imageField === "string") {
        image = imageField;
      }
    }
  } catch {
    logEvent("invalid_payload", "info", "scan_api");
    return reject("invalid_payload", "Invalid request payload.");
  }

  const language: "en" | "fr" = lang === "fr" ? "fr" : "en";
  const rawOptIn = raw_opt_in === true || raw_opt_in === "true";

  /* ---------- XOR enforcement ---------- */
  if (text && image) {
    logEvent("invalid_input", "info", "scan_api");
    return reject(
      "invalid_input",
      language === "fr"
        ? "Veuillez fournir soit un message, soit une image."
        : "Please provide either text or an image."
    );
  }

  let contentText = "";
  let source: "user_text" | "ocr" = "user_text";

  /* ---------- OCR path ---------- */
  if (image) {
    if (isOCRBlocked(ip)) {
      logEvent("ocr_blocked", "warning", "ocr");
      return reject(
        "ocr_blocked",
        language === "fr"
          ? "OCR temporairement bloqué."
          : "OCR temporarily blocked.",
        429
      );
    }

    try {
      contentText = await ocrImage(image);
      source = "ocr";
    } catch {
      recordOCRResult(ip, "failure");
      logEvent("ocr_failed", "warning", "ocr");
      return reject(
        "ocr_failed",
        language === "fr"
          ? "Impossible de traiter l’image."
          : "Image could not be processed."
      );
    }

    if (!contentText || contentText.length < MIN_LENGTH) {
      recordOCRResult(ip, "low_text");
      logEvent("ocr_low_text", "info", "ocr");
      return reject(
        "ocr_no_text",
        language === "fr"
          ? "Texte lisible insuffisant."
          : "Not enough readable text."
      );
    }

    recordOCRResult(ip, "success");
  }

  /* ---------- Text path ---------- */
  if (!image) {
    if (!text || typeof text !== "string") {
      logEvent("empty_text", "info", "scan_api");
      return reject(
        "empty_text",
        language === "fr"
          ? "Aucun texte fourni."
          : "No text provided."
      );
    }

    contentText = text.trim();

    if (contentText.length < MIN_LENGTH) {
      logEvent("text_too_short", "info", "scan_api");
      return reject(
        "text_too_short",
        language === "fr"
          ? "Message trop court."
          : "Message too short."
      );
    }
  }

  /* ---------- Non-message detection ---------- */
  if (looksLikeConversation(contentText)) {
    logEvent("non_message_input", "info", "scan_api");
    return reject(
      "conversation_detected",
      language === "fr"
        ? "Veuillez fournir le message exact reçu."
        : "Please provide the exact received message."
    );
  }

  /* ---------- Duplicate suppression ---------- */
  if (isRepeatedScan(ip, contentText)) {
    logEvent("duplicate_scan", "info", "scan_api");
    return reject(
      "duplicate_scan",
      language === "fr"
        ? "Message déjà analysé récemment."
        : "Message already analyzed recently.",
      429
    );
  }

  /* ---------- AI analysis ---------- */
  try {
    const { result } = await analyzeScan({
      messageText: contentText,
      language,
      source,
    });

    /* ---------- Extract intel features ---------- */
    const { intel_features, mode: intelMode } = extractIntelFeatures(result, contentText);

    /* ---------- Derive user_verdict from risk_tier ---------- */
    const riskTier = result.risk_tier ?? "low";
    const userVerdict = riskTier === "high" ? "scam" : riskTier === "medium" ? "suspicious" : "safe";

    /* ---------- Insert into scans (ALWAYS) ---------- */
    const scanRow: Record<string, any> = {
      risk_tier: riskTier,
      summary_sentence: result.summary_sentence ?? null,
      signals: result.signals ?? [],
      language,
      source,
      data_quality: { is_message_like: true },
      used_fallback: false,
      intel_features,
      raw_opt_in: rawOptIn,
    };
    if (vercel_country_code) scanRow.country_code = vercel_country_code;
    if (vercel_region_code) scanRow.region_code = vercel_region_code;
    if (vercel_city) scanRow.city = vercel_city;

    const { data: scanData, error: scanError } = await supabase
      .from("scans")
      .insert(scanRow)
      .select("id")
      .single();

    const persisted = !scanError;
    const scanId = persisted ? (scanData?.id ?? null) : null;

    /* ---------- Insert raw_messages if opted in ---------- */
    let rawMessageError: string | null = null;
    if (rawOptIn && scanId) {
      const { error: rawError } = await supabase.from("raw_messages").insert({
        scan_id: scanId,
        message_text: contentText,
        source,
        delete_after: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
      if (rawError) {
        rawMessageError = rawError.message;
      }
    }

    /* ---------- Structured log ---------- */
    console.log("[scan_persist]", JSON.stringify({
      scan_id: scanId,
      persisted,
      raw_opt_in: rawOptIn,
      intel_features_mode: intelMode,
      supabase_error: scanError?.message ?? rawMessageError ?? null,
    }));

    /**
     * 🔑 CANONICAL RESPONSE
     * - Server owns: language, source, data_quality
     * - AI owns: risk_tier, signals, summary_sentence
     * - vNext: scan_id, user_verdict, intel_features
     */

    return NextResponse.json({
      ok: true,
      result: {
        /* AI output (as-is) */
        ...result,

        /* Server truth */
        language,
        source,
        data_quality: {
          is_message_like: true,
        },

        /* Frontend compatibility (legacy) */
        risk: result.risk_tier,
        reasons: Array.isArray(result.signals)
          ? result.signals.map((s: any) => s.description)
          : [],

        /* vNext fields */
        scan_id: scanId,
        persisted,
        user_verdict: userVerdict,
        intel_features,
      },
    });
  } catch (err) {
    logEvent("analysis_failed", "critical", "ai");
    console.error("SCAN_ANALYSIS_FAILED", err);
    return reject(
      "analysis_failed",
      language === "fr"
        ? "Erreur lors de l’analyse."
        : "Analysis failed."
    );
  }
}
