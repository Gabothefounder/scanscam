import Link from "next/link";
import { getPartnerBySlug } from "@/lib/partners";
import { PartnerScanner } from "@/components/PartnerScanner";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function PartnerPage({ params }: Props) {
  const { slug } = await params;
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
        <div style={styles.header}>
          {partner.logoUrl && (
            <img
              src={partner.logoUrl}
              alt={`${partner.name} logo`}
              style={styles.logo}
            />
          )}
          <h1 style={styles.title}>{partner.name}</h1>
        </div>
        <p style={styles.trustLine}>
          Only if you choose, scans submitted from this page can be shared with
          your IT provider for review.
        </p>
        <PartnerScanner partner={partner} />
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
    padding: "24px 28px",
    boxShadow: "0 16px 48px rgba(11,18,32,0.18)",
    border: "1px solid #D1D5DB",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  logo: {
    maxHeight: 48,
    maxWidth: 160,
    objectFit: "contain",
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: "#0B1220",
    margin: 0,
  },
  trustLine: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 1.5,
    margin: 0,
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
