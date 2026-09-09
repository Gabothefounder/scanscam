import vision from "@google-cloud/vision";

/**
 * Load inline Google Cloud credentials from ENV.
 *
 * Supported modes:
 * - Inline JSON string (common on Vercel): parsed here and passed explicitly.
 * - File path (common locally): left to Google Application Default Credentials,
 *   which natively honors GOOGLE_APPLICATION_CREDENTIALS.
 *
 * We intentionally do not read an arbitrary filesystem path ourselves. Besides
 * avoiding duplicate Google auth behavior, that keeps the server bundle from
 * tracing the entire project because of dynamic filesystem access.
 */
function loadInlineCredentials(): Record<string, unknown> | undefined {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ?? "";

  if (!raw || !raw.startsWith("{")) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `[ocr] Failed to parse inline GOOGLE_APPLICATION_CREDENTIALS JSON: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
  }
}

const inlineCredentials = loadInlineCredentials();

/**
 * Google Vision client.
 *
 * For inline JSON we provide credentials directly. For a file path or other
 * standard Google environment configuration, omitting credentials delegates
 * authentication to Google's normal Application Default Credentials chain.
 */
const client = new vision.ImageAnnotatorClient(
  inlineCredentials ? { credentials: inlineCredentials } : {}
);

export async function ocrImage(
  base64Image: string
): Promise<string> {
  // Strip data URL prefix if present.
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
