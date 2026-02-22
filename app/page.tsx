"use client";

import { useEffect, useState } from "react";

/* ---------------- Copy ---------------- */

const copy = {
  en: {
    title: "Is this a scam?",
    subtext: "Paste the message or upload a screenshot to check instantly.",
    primaryCta: "Check Now",
    primarySubtext: "Anonymous. Immediate. No account required.",
    secondaryCta: "Report a Scam",
    secondarySubtext: "Already affected? Take 3 minutes to help warn others.",
    compliance:
      "By using ScanScam, you agree to anonymous collection of non-identifying fraud-pattern metadata to improve scam prevention.",
  },
  fr: {
    title: "Est-ce une arnaque ?",
    subtext: "Collez le message ou téléversez une capture d'écran pour vérifier instantanément.",
    primaryCta: "Vérifier maintenant",
    primarySubtext: "Anonyme. Immédiat. Aucun compte requis.",
    secondaryCta: "Signaler une arnaque",
    secondarySubtext: "Déjà touché(e) ? Prenez 3 minutes pour aider à prévenir les autres.",
    compliance:
      "En utilisant ScanScam, vous acceptez la collecte anonyme de métadonnées non identifiantes sur les schémas de fraude afin d'améliorer la prévention.",
  },
};

/* ---------------- Page ---------------- */

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [lang, setLang] = useState<"en" | "fr">("en");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentLang = params.get("lang") === "fr" ? "fr" : "en";
    setLang(currentLang);
    setMounted(true);
  }, []);

  // Prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  const t = copy[lang];

  return (
    <main style={styles.container}>
      {/* Main */}
      <section style={styles.main}>
        <div style={styles.card}>
          <h1 style={styles.title}>{t.title}</h1>
          <p style={styles.subtext}>{t.subtext}</p>

          <a href={`/scan?lang=${lang}`} style={styles.primaryButton}>
            {t.primaryCta}
          </a>
          <p style={styles.primarySubtext}>{t.primarySubtext}</p>

          <div style={styles.divider} />

          <a href={`/report?lang=${lang}`} style={styles.secondaryButton}>
            {t.secondaryCta}
          </a>
          <p style={styles.secondarySubtext}>{t.secondarySubtext}</p>

          <p style={styles.compliance}>{t.compliance}</p>
        </div>
      </section>
    </main>
  );
}

/* ---------------- Styles ---------------- */

const styles = {
  container: {
    height: "calc(100vh - 156px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E2E4E9",
    color: "#0B1220",
    fontFamily: "Inter, system-ui, sans-serif",
  },

  main: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: "16px",
    paddingRight: "16px",
    width: "100%",
  },

  card: {
    width: "100%",
    maxWidth: "600px",
    backgroundColor: "#FFFFFF",
    borderRadius: "14px",
    padding: "32px 28px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
    boxShadow: "0 16px 48px rgba(11,18,32,0.18)",
    border: "1px solid #D1D5DB",
  },

  title: {
    fontSize: "36px",
    lineHeight: 1.15,
    fontWeight: 700,
    letterSpacing: "-0.4px",
    textAlign: "center" as const,
  },

  subtext: {
    fontSize: "18px",
    lineHeight: 1.5,
    color: "#374151",
    textAlign: "center" as const,
  },

  primaryButton: {
    marginTop: "4px",
    padding: "14px 24px",
    backgroundColor: "#2563EB",
    color: "#FFFFFF",
    textAlign: "center" as const,
    borderRadius: "12px",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: "17px",
    boxShadow: "0 3px 8px rgba(37,99,235,0.35)",
  },

  primarySubtext: {
    marginTop: "4px",
    fontSize: "14px",
    color: "#4B5563",
    textAlign: "center" as const,
  },

  divider: {
    height: "1px",
    backgroundColor: "#E5E7EB",
    margin: "4px 0",
  },

  secondaryButton: {
    padding: "14px 24px",
    backgroundColor: "#FFFFFF",
    color: "#1F2937",
    textAlign: "center" as const,
    borderRadius: "12px",
    textDecoration: "none",
    fontWeight: 600,
    fontSize: "17px",
    border: "1px solid #94A3B8",
  },

  secondarySubtext: {
    marginTop: "4px",
    fontSize: "14px",
    color: "#374151",
    textAlign: "center" as const,
  },

  compliance: {
    marginTop: "8px",
    fontSize: "13px",
    lineHeight: 1.4,
    color: "#4B5563",
    textAlign: "center" as const,
  },
};
