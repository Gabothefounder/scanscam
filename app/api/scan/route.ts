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

  /* ---------- IP extraction ---------- */
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    crypto.randomUUID();

  /* ---------- Rate limiting ---------- */
  if (!checkRateLimit(ip)) {
    logEvent("rate_limited", "warning", "scan_api");
    return reject("rate_limited", "Too many requests.", 429);
  }

  /* ---------- Parse body ---------- */
  try {
    body = JSON.parse(await req.text());
  } catch {
    logEvent("invalid_json", "info", "scan_api");
    return reject("invalid_json", "Invalid request payload.");
  }

  const { text, image, lang } = body;
  const language: "en" | "fr" = lang === "fr" ? "fr" : "en";

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
      return reject("ocr_blocked", "OCR temporarily blocked.", 429);
    }

    try {
      contentText = await ocrImage(image);
      source = "ocr";
    } catch {
      recordOCRResult(ip, "failure");
      logEvent("ocr_failed", "warning", "ocr");
      return reject("ocr_failed", "Image could not be processed.");
    }

    if (!contentText || contentText.length < MIN_LENGTH) {
      recordOCRResult(ip, "low_text");
      logEvent("ocr_low_text", "info", "ocr");
      return reject("ocr_no_text", "Not enough readable text.");
    }

    recordOCRResult(ip, "success");
  }

  /* ---------- Text path ---------- */
  if (!image) {
    if (!text || typeof text !== "string") {
      logEvent("empty_text", "info", "scan_api");
      return reject("empty_text", "No text provided.");
    }

    contentText = text.trim();

    if (contentText.length < MIN_LENGTH) {
      logEvent("text_too_short", "info", "scan_api");
      return reject("text_too_short", "Message too short.");
    }
  }

  /* ---------- Non-message detection ---------- */
  if (looksLikeConversation(contentText)) {
    logEvent("non_message_input", "info", "scan_api");
    return reject("conversation_detected", "Not a received message.");
  }

  /* ---------- Duplicate suppression ---------- */
  if (isRepeatedScan(ip, contentText)) {
    logEvent("duplicate_scan", "info", "scan_api");
    return reject("duplicate_scan", "Duplicate scan.", 429);
  }

  /* ---------- AI analysis ---------- */
  try {
    const { result } = await analyzeScan({
      messageText: contentText,
      language,
      source,
    });

    /* ---------- CANONICAL RESPONSE ---------- */
    return NextResponse.json({
      ok: true,
      result: {
        /* AI / DB schema */
        ...result,

        /* Server truth */
        language,
        source,
        data_quality: {
          is_message_like: true,
          ...(result.data_quality ?? {}),
        },

        /* Frontend compatibility */
        risk: result.risk_tier,
        reasons: Array.isArray(result.signals)
          ? result.signals.map((s: any) => s.description)
          : [],
      },
    });
  } catch (err) {
    logEvent("analysis_failed", "critical", "ai");
    console.error("SCAN_ANALYSIS_FAILED", err);
    return reject("analysis_failed", "Analysis failed.");
  }
}
