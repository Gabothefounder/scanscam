import vision from "@google-cloud/vision";
import fs from "node:fs";

/**
 * Load Google Cloud credentials from ENV.
 * Supports both:
 * - JSON string (common on Vercel)
 * - File path (common locally)
 */
function loadCredentials(): Record<string, any> | undefined {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";

  if (!raw.trim()) {
    return undefined;
  }

  try {
    if (raw.trim().startsWith("{")) {
      return JSON.parse(raw);
    } else {
      const contents = fs.readFileSync(raw, "utf8");
      return JSON.parse(contents);
    }
  } catch (err: any) {
    throw new Error(
      `[ocr] Failed to load GOOGLE_APPLICATION_CREDENTIALS: ${err?.message ?? "unknown error"}`
    );
  }
}

/**
 * Google Vision client
 * Credentials are loaded from an ENV VAR (required on Vercel).
 */
const client = new vision.ImageAnnotatorClient({
  credentials: loadCredentials(),
});

export async function ocrImage(
  base64Image: string
): Promise<string> {
  // Strip data URL prefix if present
  const cleaned = base64Image.replace(
    /^data:image\/[a-zA-Z]+;base64,/,
    ""
  );

  const [result] = await client.textDetection({
    image: { content: cleaned },
  });

  const text =
    result.textAnnotations?.[0]?.description ?? "";

  return text.trim();
}
