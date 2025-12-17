export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ocrImage } from "@/lib/ocr";

const MIN_LENGTH = 20;

/* ---------- helpers ---------- */

function reject(code: string, message: string) {
  return NextResponse.json(
    { ok: false, code, message },
    { status: 400 }
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

/* ---------- handler ---------- */

export async function POST(req: Request) {
  let body: any;

  /* --- read body safely (App Router) --- */
  try {
    const raw = await req.text();
    body = JSON.parse(raw);
  } catch {
    return reject(
      "invalid_json",
      "Invalid request payload."
    );
  }

  const { text, image, lang } = body;
  const language = lang === "fr" ? "fr" : "en";

  /* --- enforce text OR image --- */
  if (text && image) {
    return reject(
      "invalid_input",
      language === "fr"
        ? "Veuillez fournir soit un message, soit une image, pas les deux."
        : "Please provide either a message or an image, not both."
    );
  }

  let contentText = "";

  /* ---------- IMAGE PATH (C2) ---------- */
  if (image) {
    try {
      contentText = await ocrImage(image);
    } catch {
      return reject(
        "ocr_failed",
        language === "fr"
          ? "Impossible de traiter l’image fournie."
          : "We couldn’t process the provided image."
      );
    }

    if (!contentText || contentText.length < MIN_LENGTH) {
      return reject(
        "ocr_no_text",
        language === "fr"
          ? "Nous n’avons pas détecté suffisamment de texte lisible dans l’image."
          : "We couldn’t detect enough readable text in the image."
      );
    }
  }

  /* ---------- TEXT PATH ---------- */
  if (!image) {
    if (!text || typeof text !== "string") {
      return reject(
        "empty_text",
        language === "fr"
          ? "Veuillez coller le message exact que vous avez reçu."
          : "Please paste the exact message you received."
      );
    }

    contentText = text.trim();

    if (contentText.length < MIN_LENGTH) {
      return reject(
        "text_too_short",
        language === "fr"
          ? "Le message est trop court pour être analysé."
          : "The message is too short to analyze."
      );
    }
  }

  /* ---------- SHARED VALIDATION ---------- */
  if (looksLikeConversation(contentText)) {
    return reject(
      "conversation_detected",
      language === "fr"
        ? "Veuillez fournir le message exact reçu, sans contexte additionnel."
        : "Please provide the exact message received, without added context."
    );
  }

  /* ---------- MOCK RESULT (B4 contract) ---------- */
  return NextResponse.json({
    ok: true,
    result: {
      risk: "medium",
      reasons: [
        language === "fr"
          ? "Crée un sentiment d’urgence,"
          : "Creates urgency and pressure,",
        language === "fr"
          ? "Demande une action inhabituelle,"
          : "Requests an unusual action,",
      ],
    },
  });
}
