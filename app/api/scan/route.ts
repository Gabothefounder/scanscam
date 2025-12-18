export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";

import { ocrImage } from "@/lib/ocr";
import { analyzeScan } from "@/lib/ai/analyzeScan";
import { checkRateLimit } from "@/lib/rateLimit";
import { isRepeatedScan } from "@/lib/repeatGuard";
import { isOCRBlocked, recordOCRResult } from "@/lib/ocrGuard";
import { logEvent } from "@/lib/observability";

const MIN_LENGTH = 20;

/* -------------------------------------------------
   Helpers
-------------------------------------------------- */

function reject(
  code: string,
  message: string,
  status = 400
) {
  return NextResponse.json(
    { ok: false, code, message },
    { status }
  );
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

  /* ---------- Hardened IP extraction (E1) ---------- */
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    crypto.randomUUID(); // isolation only

  /* ---------- Rate limiting (E1) ---------- */
  if (!checkRateLimit(ip)) {
    logEvent("rate_limited", "warning", "scan_api");
    return reject(
      "rate_limited",
      "Too many requests. Please try again later.",
      429
    );
  }

  /* ---------- Safe JSON parse ---------- */
  try {
    const raw = await req.text();
    body = JSON.parse(raw);
  } catch {
    logEvent("invalid_json", "info", "scan_api");
    return reject(
      "invalid_json",
      "Invalid request payload."
    );
  }

  const { text, image, lang } = body;
  const language: "en" | "fr" = lang === "fr" ? "fr" : "en";

  /* ---------- Enforce text XOR image ---------- */
  if (text && image) {
    logEvent("invalid_input", "info", "scan_api");
    return reject(
      "invalid_input",
      language === "fr"
        ? "Veuillez fournir soit un message, soit une image, pas les deux."
        : "Please provide either a message or an image, not both."
    );
  }

  let contentText = "";
  let source: "user_text" | "ocr" = "user_text";

  /* ---------- IMAGE PATH (OCR) ---------- */
  if (image) {
    if (isOCRBlocked(ip)) {
      logEvent("ocr_blocked", "warning", "ocr");
      return reject(
        "ocr_temporarily_blocked",
        language === "fr"
          ? "Trop de tentatives OCR échouées. Réessayez plus tard ou utilisez le texte."
          : "Too many failed image scans. Please try again later or use text.",
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
          ? "Impossible de traiter l’image fournie."
          : "We couldn’t process the provided image."
      );
    }

    if (!contentText || contentText.length < MIN_LENGTH) {
      recordOCRResult(ip, "low_text");
      logEvent("ocr_low_text", "info", "ocr");

      return reject(
        "ocr_no_text",
        language === "fr"
          ? "Nous n’avons pas détecté suffisamment de texte lisible dans l’image."
          : "We couldn’t detect enough readable text in the image."
      );
    }

    recordOCRResult(ip, "success");
  }

  /* ---------- TEXT PATH ---------- */
  if (!image) {
    if (!text || typeof text !== "string") {
      logEvent("empty_text", "info", "scan_api");
      return reject(
        "empty_text",
        language === "fr"
          ? "Veuillez coller le message exact que vous avez reçu."
          : "Please paste the exact message you received."
      );
    }

    contentText = text.trim();

    if (contentText.length < MIN_LENGTH) {
      logEvent("text_too_short", "info", "scan_api");
      return reject(
        "text_too_short",
        language === "fr"
          ? "Le message est trop court pour être analysé."
          : "The message is too short to analyze."
      );
    }
  }

  /* ---------- Non-message detection ---------- */
  if (looksLikeConversation(contentText)) {
    logEvent("non_message_input", "info", "scan_api");
    return reject(
      "conversation_detected",
      language === "fr"
        ? "Veuillez fournir le message exact reçu, sans contexte additionnel."
        : "Please provide the exact message received, without added context."
    );
  }

  /* ---------- Repeated scan suppression ---------- */
  if (isRepeatedScan(ip, contentText)) {
    logEvent("duplicate_scan", "info", "scan_api");
    return reject(
      "duplicate_scan",
      language === "fr"
        ? "Ce message a déjà été analysé récemment."
        : "This message was already analyzed recently.",
      429
    );
  }

  /* ---------- AI Analysis ---------- */
  try {
    const { result } = await analyzeScan({
      messageText: contentText,
      language,
      source,
    });

    /**
     * 🔑 NORMALIZATION LAYER (CRITICAL)
     * Convert AI schema → frontend schema explicitly.
     * No fallbacks, no guessing.
     */

    const normalizedResult = {
      risk: result.risk_tier,
      summary_sentence: result.summary_sentence,
      reasons:
        Array.isArray(result.signals)
          ? result.signals.map((s: any) => s.description)
          : [],
    };

    return NextResponse.json({
      ok: true,
      result: normalizedResult,
    });
  } catch (err) {
    logEvent("analysis_failed", "critical", "ai");
    console.error("SCAN_ANALYSIS_FAILED", err);

    return reject(
      "analysis_failed",
      language === "fr"
        ? "Une erreur est survenue lors de l’analyse."
        : "An error occurred during analysis."
    );
  }
}
