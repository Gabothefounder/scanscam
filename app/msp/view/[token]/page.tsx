import { createClient } from "@supabase/supabase-js";

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

const copy = {
  en: {
    submission: "Submission",
    privateLink: "ScanScam - partner escalation (private link)",
    riskTier: "Risk tier",
    summary: "Summary",
    clientNote: "Client note",
    rawMessage: "Raw message",
    image: "Image",
    submittedImageAlt: "Submitted image",
    imageLoadError: "Image could not be loaded.",
    none: "(none)",
    notStored: "(not stored or user did not opt in)",
    notProvided: "(not provided)",
    brandLine: "Fraud Signal Intelligence",
    taglineEn: "Your next scan could stop the next scam.",
    taglineFr: "Votre prochain scan peut arreter la prochaine fraude.",
    invalidLink: "Link expired or invalid",
  },
  fr: {
    submission: "Soumission",
    privateLink: "ScanScam - escalation partenaire (lien prive)",
    riskTier: "Niveau de risque",
    summary: "Resume",
    clientNote: "Note du client",
    rawMessage: "Message brut",
    image: "Image",
    submittedImageAlt: "Image soumise",
    imageLoadError: "Impossible de charger l'image.",
    none: "(aucun)",
    notStored: "(non enregistre ou l'utilisateur n'a pas accepte)",
    notProvided: "(non fourni)",
    brandLine: "Intelligence des signaux de fraude",
    taglineEn: "Your next scan could stop the next scam.",
    taglineFr: "Votre prochain scan peut arreter la prochaine fraude.",
    invalidLink: "Lien expire ou invalide",
  },
} as const;

type PageProps = {
  params: Promise<{ token: string }> | { token: string };
  searchParams?: Promise<{ lang?: string }> | { lang?: string };
};

export default async function MspViewPage({ params, searchParams }: PageProps) {
  const tokenParams = params instanceof Promise ? await params : params;
  const query = searchParams instanceof Promise ? await searchParams : searchParams ?? {};
  const lang = query.lang === "fr" ? "fr" : "en";
  const t = copy[lang];
  const { token } = tokenParams;
  if (!token?.trim() || !UUID_RE.test(token.trim())) return renderInvalidPage(t);

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return renderInvalidPage(t);

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: access, error: accessError } = await supabase
    .from("partner_escalation_access")
    .select("scan_id, client_note, raw_text, image_path, expires_at")
    .eq("access_token", token.trim())
    .maybeSingle();

  if (accessError || !access) return renderInvalidPage(t);
  if (new Date(access.expires_at as string).getTime() < Date.now()) return renderInvalidPage(t);

  const { data: scan, error: scanError } = await supabase
    .from("scans")
    .select("risk_tier, summary_sentence")
    .eq("id", access.scan_id as string)
    .maybeSingle();

  if (scanError || !scan) return renderInvalidPage(t);

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
    scan.summary_sentence != null ? String(scan.summary_sentence) : t.none;
  const rawText =
    access.raw_text != null && String(access.raw_text).trim()
      ? String(access.raw_text)
      : t.notStored;
  const clientNote =
    access.client_note != null && String(access.client_note).trim()
      ? String(access.client_note)
      : t.notProvided;

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
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>{t.submission}</h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 24px" }}>
          {t.privateLink}
        </p>

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 6px" }}>
            {t.riskTier}
          </h2>
          <p style={{ margin: 0, fontSize: 15 }}>{riskTier}</p>
        </section>

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 6px" }}>
            {t.summary}
          </h2>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{summary}</p>
        </section>

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 6px" }}>
            {t.clientNote}
          </h2>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
            {clientNote}
          </p>
        </section>

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 6px" }}>
            {t.rawMessage}
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
              {t.image}
            </h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={signedImageUrl}
              alt={t.submittedImageAlt}
              style={{ maxWidth: "100%", height: "auto", borderRadius: 8, border: "1px solid #e5e7eb" }}
            />
          </section>
        ) : imagePathRaw ? (
          <p style={{ fontSize: 13, color: "#b45309" }}>
            {t.imageLoadError}
            {signErrorMessage ? ` (${signErrorMessage})` : ""}
          </p>
        ) : null}
        <section
          style={{
            marginTop: 24,
            paddingTop: 16,
            borderTop: "1px solid #e5e7eb",
            color: "#6b7280",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#374151" }}>ScanScam</p>
          <p style={{ margin: "4px 0 0", fontSize: 12 }}>{t.brandLine}</p>
          <p style={{ margin: "10px 0 0", fontSize: 12 }}>{t.taglineEn}</p>
          <p style={{ margin: "4px 0 0", fontSize: 12 }}>{t.taglineFr}</p>
        </section>
      </article>
    </main>
  );
}

function renderInvalidPage(t: (typeof copy)["en"] | (typeof copy)["fr"]) {
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
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>{t.invalidLink}</h1>
        <section
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: "1px solid #e5e7eb",
            color: "#6b7280",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#374151" }}>ScanScam</p>
          <p style={{ margin: "4px 0 0", fontSize: 12 }}>{t.brandLine}</p>
          <p style={{ margin: "10px 0 0", fontSize: 12 }}>{t.taglineEn}</p>
          <p style={{ margin: "4px 0 0", fontSize: 12 }}>{t.taglineFr}</p>
        </section>
      </article>
    </main>
  );
}
