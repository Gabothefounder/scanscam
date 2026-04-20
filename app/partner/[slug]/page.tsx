import Link from "next/link";
import { getPartnerBySlug } from "@/lib/partners";
import { PartnerScanner } from "@/components/PartnerScanner";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ lang?: string }>;
};

const partnerCopy = {
  en: {
    subtitle: "Security Message Scanner",
    helperText:
      "Paste a message, link, or screenshot to check if it may be a scam.",
    trustLine: "This tool does not access your inbox or systems.",
    placeholder: "Paste message, link, or content here...",
    uploadLabel: "Upload a screenshot",
    button: "Scan Message",
    buttonLoading: "Analyzing...",
  },
  fr: {
    subtitle: "Analyseur de messages suspects",
    helperText:
      "Collez un message, un lien ou une capture d’écran pour vérifier s’il pourrait s’agir d’une arnaque.",
    trustLine: "Cet outil n’accède pas à votre boîte courriel ni à vos systèmes.",
    placeholder: "Collez le message, le lien ou le contenu ici...",
    uploadLabel: "Téléverser une capture d’écran",
    button: "Analyser le message",
    buttonLoading: "Analyse en cours...",
  },
} as const;

export default async function PartnerPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const lang = resolvedSearchParams?.lang === "fr" ? "fr" : "en";
  const t = partnerCopy[lang];
  const partner = getPartnerBySlug(slug);

  if (!partner || !partner.active) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <h1 style={styles.title}>Partner not found</h1>
          <p style={styles.fallbackText}>
            This partner link is invalid or inactive. You can still scan messages
            using our public scanner.
          </p>
          <Link href="/scan" style={styles.link}>
            Go to scanner
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.partnerHeader}>
          {partner.logoUrl && (
            <div style={styles.logoFrame}>
              <img
                src={partner.logoUrl}
                alt={`${partner.name} logo`}
                style={styles.logo}
              />
            </div>
          )}
          <h1 style={styles.partnerLabel}>{partner.name}</h1>
        </div>
        <h2 style={styles.subtitle}>{t.subtitle}</h2>
        <p style={styles.poweredBy}>Powered by ScanScam</p>
        <p style={styles.helperText}>{t.helperText}</p>
        <p style={styles.trustLine}>{t.trustLine}</p>
        <PartnerScanner
          partner={partner}
          copyOverrides={{
            placeholder: t.placeholder,
            uploadLabel: t.uploadLabel,
            button: t.button,
            buttonLoading: t.buttonLoading,
          }}
        />
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "calc(100vh - 156px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#E2E4E9",
    padding: "24px 16px",
  },
  card: {
    width: "100%",
    maxWidth: "600px",
    background: "#FFFFFF",
    borderRadius: "14px",
    padding: "28px 28px",
    boxShadow: "0 16px 48px rgba(11,18,32,0.18)",
    border: "1px solid #D1D5DB",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  partnerHeader: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  logoFrame: {
    width: "100%",
    maxWidth: 260,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    border: "1px solid #E5E7EB",
    backgroundColor: "#F8FAFC",
    padding: "8px 14px",
  },
  logo: {
    maxHeight: 112,
    maxWidth: "100%",
    objectFit: "contain",
  },
  partnerLabel: {
    margin: 0,
    fontSize: 36,
    fontWeight: 800,
    letterSpacing: "0.01em",
    color: "#0F172A",
    lineHeight: 1.1,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 21,
    fontWeight: 600,
    color: "#1E293B",
    margin: 0,
    textAlign: "center",
    lineHeight: 1.3,
  },
  poweredBy: {
    fontSize: 13,
    fontWeight: 500,
    color: "#64748B",
    margin: 0,
    textAlign: "center",
    lineHeight: 1.4,
  },
  helperText: {
    fontSize: 16,
    color: "#334155",
    lineHeight: 1.5,
    margin: 0,
    textAlign: "center",
  },
  trustLine: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 1.5,
    margin: 0,
    textAlign: "center",
  },
  fallbackText: {
    fontSize: 15,
    color: "#4B5563",
    lineHeight: 1.5,
    margin: "0 0 16px",
  },
  link: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: 500,
    textDecoration: "none",
  },
};
