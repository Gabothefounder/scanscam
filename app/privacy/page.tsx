"use client";

import { useEffect, useState } from "react";

/* ---------- copy ---------- */

const copy = {
  en: {
    title: "Privacy & Data Use",
    backHome: "Back to home",
    intro: "ScanScam is designed to protect your privacy while helping detect scam patterns.",
    whatWeStore: "What we store: anonymous usage identifiers, fraud-pattern fields (urgency, authority, payment requests, links), approximate region (city-level), and raw message text for up to 30 days when shared for improvement.",
    deletion: "To request deletion of your data or for privacy questions, contact us.",
    contact: "privacy@scanscam.ca",
  },
  fr: {
    title: "Confidentialité et utilisation des données",
    backHome: "Retour à l'accueil",
    intro: "ScanScam est conçu pour protéger votre vie privée tout en aidant à détecter les schémas de fraude.",
    whatWeStore: "Ce que nous stockons : identifiants d'utilisation anonymes, champs de schémas de fraude (urgence, autorité, demandes de paiement, liens), région approximative (niveau ville), et texte brut des messages jusqu'à 30 jours lorsqu'il est partagé pour l'amélioration.",
    deletion: "Pour demander la suppression de vos données ou pour des questions de confidentialité, contactez-nous.",
    contact: "privacy@scanscam.ca",
  },
};

export default function PrivacyPage() {
  const [mounted, setMounted] = useState(false);
  const [lang, setLang] = useState<"en" | "fr">("en");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const l = params.get("lang");
    setLang(l === "fr" ? "fr" : "en");
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const t = copy[lang];

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>{t.title}</h1>

        <p style={styles.paragraph}>{t.intro}</p>

        <p style={styles.paragraph}>{t.whatWeStore}</p>

        <p style={styles.paragraph}>
          {t.deletion}{" "}
          <a href={`mailto:${t.contact}`} style={styles.emailLink}>
            {t.contact}
          </a>
        </p>

        <a href={`/?lang=${lang}`} style={styles.backLink}>
          ← {t.backHome}
        </a>
      </div>
    </main>
  );
}

/* ---------- styles ---------- */

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "calc(100vh - 156px)",
    backgroundColor: "#E2E4E9",
    padding: "24px 16px",
  },
  card: {
    maxWidth: "640px",
    margin: "0 auto",
    backgroundColor: "#FFFFFF",
    borderRadius: "14px",
    padding: "28px",
    boxShadow: "0 16px 48px rgba(11,18,32,0.18)",
    border: "1px solid #D1D5DB",
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "#0B1220",
    marginBottom: 20,
  },
  paragraph: {
    fontSize: 15,
    color: "#374151",
    lineHeight: 1.6,
    margin: "0 0 16px",
  },
  emailLink: {
    color: "#2563EB",
    textDecoration: "none",
  },
  backLink: {
    display: "inline-block",
    marginTop: 20,
    fontSize: 14,
    color: "#2563EB",
    textDecoration: "none",
    fontWeight: 500,
  },
};
