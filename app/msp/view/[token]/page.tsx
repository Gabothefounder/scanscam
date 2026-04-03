import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const SUBMISSION_IMAGES_BUCKET = "submission-images";

/** Object key inside the bucket only; strip accidental `bucket/` prefix so .from(bucket) does not double-prefix. */
function normalizeBucketObjectPath(stored: string, bucketId: string): string {
  let p = String(stored).trim().replace(/^\/+/, "");
  const prefix = `${bucketId}/`;
  if (p.startsWith(prefix)) {
    p = p.slice(prefix.length);
  }
  return p.replace(/^\/+/, "");
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function MspViewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token?.trim() || !UUID_RE.test(token.trim())) notFound();

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) notFound();

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: access, error: accessError } = await supabase
    .from("partner_escalation_access")
    .select("scan_id, client_note, raw_text, image_path, expires_at")
    .eq("access_token", token.trim())
    .maybeSingle();

  if (accessError || !access) notFound();
  if (new Date(access.expires_at as string).getTime() < Date.now()) notFound();

  const { data: scan, error: scanError } = await supabase
    .from("scans")
    .select("risk_tier, summary_sentence")
    .eq("id", access.scan_id as string)
    .maybeSingle();

  if (scanError || !scan) notFound();

  let signedImageUrl: string | null = null;
  let signErrorMessage: string | null = null;
  const imagePathRaw =
    access.image_path != null && String(access.image_path).trim() !== ""
      ? String(access.image_path).trim()
      : null;

  console.log("[msp-view-debug] image_path from DB", {
    has_image_path: Boolean(imagePathRaw),
    image_path_raw: imagePathRaw,
    bucket: SUBMISSION_IMAGES_BUCKET,
  });

  if (imagePathRaw) {
    const objectPath = normalizeBucketObjectPath(imagePathRaw, SUBMISSION_IMAGES_BUCKET);
    console.log("[msp-view-debug] normalized object path for sign", {
      object_path: objectPath,
    });

    const { data: signed, error: signError } = await supabase.storage
      .from(SUBMISSION_IMAGES_BUCKET)
      .createSignedUrl(objectPath, 3600);

    if (signError) {
      signErrorMessage = signError.message;
      console.error("[msp-view-debug] createSignedUrl error", {
        message: signError.message,
        object_path: objectPath,
      });
    } else {
      signedImageUrl = signed?.signedUrl ?? null;
      console.log("[msp-view-debug] createSignedUrl result", {
        success: Boolean(signedImageUrl),
        signed_url_prefix: signedImageUrl ? signedImageUrl.split("?")[0] + "?…" : null,
      });
    }
  }

  const riskTier = String(scan.risk_tier ?? "low");
  const summary =
    scan.summary_sentence != null ? String(scan.summary_sentence) : "(none)";
  const rawText =
    access.raw_text != null && String(access.raw_text).trim()
      ? String(access.raw_text)
      : "(not stored or user did not opt in)";
  const clientNote =
    access.client_note != null && String(access.client_note).trim()
      ? String(access.client_note)
      : "(not provided)";

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#f3f4f6",
        padding: "24px 16px",
        fontFamily: "system-ui, sans-serif",
        color: "#111827",
      }}
    >
      <article
        style={{
          maxWidth: 720,
          margin: "0 auto",
          backgroundColor: "#fff",
          borderRadius: 12,
          padding: 24,
          border: "1px solid #e5e7eb",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>Submission</h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 24px" }}>
          ScanScam — partner escalation (private link)
        </p>

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 6px" }}>
            Risk tier
          </h2>
          <p style={{ margin: 0, fontSize: 15 }}>{riskTier}</p>
        </section>

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 6px" }}>
            Summary
          </h2>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{summary}</p>
        </section>

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 6px" }}>
            Client note
          </h2>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
            {clientNote}
          </p>
        </section>

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 6px" }}>
            Raw message
          </h2>
          <pre
            style={{
              margin: 0,
              padding: 12,
              backgroundColor: "#f9fafb",
              borderRadius: 8,
              fontSize: 13,
              lineHeight: 1.45,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {rawText}
          </pre>
        </section>

        {signedImageUrl ? (
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 8px" }}>
              Image
            </h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={signedImageUrl}
              alt="Submitted image"
              style={{ maxWidth: "100%", height: "auto", borderRadius: 8, border: "1px solid #e5e7eb" }}
            />
          </section>
        ) : imagePathRaw ? (
          <p style={{ fontSize: 13, color: "#b45309" }}>
            Image could not be loaded.
            {signErrorMessage ? ` (${signErrorMessage})` : ""}
          </p>
        ) : null}
      </article>
    </main>
  );
}
