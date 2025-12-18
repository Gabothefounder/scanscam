import vision from "@google-cloud/vision";

/**
 * Google Vision client
 * Credentials are loaded from an ENV VAR (required on Vercel).
 */
const client = new vision.ImageAnnotatorClient({
  credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS)
    : undefined,
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
