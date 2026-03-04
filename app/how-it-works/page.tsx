"use client";

import { useEffect, useState } from "react";

/* ---------- copy ---------- */

const copy = {
  en: {
    title: "How ScanScam Works",
    backToScan: "Back to scan",

    whatScanDoesTitle: "What the scan does",
    whatScanDoes: [
      "Returns a risk tier (low / medium / high) with a short explanation.",
      "Provides recommended actions based on detected patterns.",
      "Guidance only — not legal advice.",
    ],

    dataTitle: "What data is stored",
    data: [
      "Anonymous usage identifier (random ID stored in your browser) to measure repeat use and improve the product.",
      "Fraud-pattern fields (non-identifying): urgency, authority claims, payment requests, suspicious links, etc.",
      "Approximate region (city-level) may be used to detect local scam trends.",
      "Raw message text may be stored securely for up to 30 days for system quality and improvement, then deleted automatically.",
    ],

    notCollectedTitle: "What is NOT collected",
    notCollected: [
      "No name, email, account login, or personal profile.",
      "No sale of personal data.",
      "No ad retargeting or behavioral profiling.",
    ],

    privacyTitle: "Privacy",
    privacyText: "See Privacy & Data Use for details and deletion requests.",

    contactTitle: "Contact",
    contactLabel: "For privacy or deletion requests:",
    contactEmail: "privacy@scanscam.ca",
  },
  fr: {
    title: "Comment fonctionne ScanScam",
    backToScan: "Retour",

    whatScanDoesTitle: "Ce que fait l'analyse",
    whatScanDoes: [
      "Retourne un niveau de risque (faible / moyen / élevé) avec une courte explication.",
      "Fournit des actions recommandées basées sur les schémas détectés.",
      "Conseils uniquement — pas de conseil juridique.",
    ],

    dataTitle: "Quelles données sont stockées",
    data: [
      "Identifiant d'utilisation anonyme (ID aléatoire stocké dans votre navigateur) pour mesurer la réutilisation et améliorer le produit.",
      "Champs de schémas de fraude (non identifiants) : urgence, revendications d'autorité, demandes de paiement, liens suspects, etc.",
      "Région approximative (niveau ville) peut être utilisée pour détecter les tendances de fraude locales.",
      "Le texte brut du message peut être stocké de manière sécurisée pendant 30 jours pour la qualité et l'amélioration du système, puis supprimé automatiquement.",
    ],

    notCollectedTitle: "Ce qui n'est PAS collecté",
    notCollected: [
      "Aucun nom, courriel, connexion de compte ou profil personnel.",
      "Aucune vente de données personnelles.",
      "Aucun reciblage publicitaire ou profilage comportemental.",
    ],

    privacyTitle: "Confidentialité",
    privacyText: "Voir Confidentialité et utilisation des données pour les détails et les demandes de suppression.",

    contactTitle: "Contact",
    contactLabel: "Pour les demandes liées à la confidentialité ou à la suppression :",
    contactEmail: "privacy@scanscam.ca",
  },
};

export default function HowItWorksPage() {
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

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>{t.whatScanDoesTitle}</h2>
          <ul style={styles.list}>
            {t.whatScanDoes.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>{t.dataTitle}</h2>
          <ul style={styles.list}>
            {t.data.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>{t.notCollectedTitle}</h2>
          <ul style={styles.list}>
            {t.notCollected.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>{t.privacyTitle}</h2>
          <p style={styles.paragraph}>
            <a href={`/privacy?lang=${lang}`} style={styles.inlineLink}>{t.privacyText}</a>
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>{t.contactTitle}</h2>
          <p style={styles.contactText}>
            {t.contactLabel}{" "}
            <a href={`mailto:${t.contactEmail}`} style={styles.emailLink}>
              {t.contactEmail}
            </a>
          </p>
        </section>

        <a href={`/scan?lang=${lang}`} style={styles.backLink}>
          ← {t.backToScan}
        </a>
      </div>
    </main>
  );
}

/* ---------- styles ---------- */

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#F7F8FA",
    padding: "16px",
  },
  card: {
    maxWidth: "640px",
    margin: "0 auto",
    backgroundColor: "#FFFFFF",
    borderRadius: "16px",
    padding: "28px",
    boxShadow: "0 12px 36px rgba(11,18,32,0.08)",
  },
  title: {
    fontSize: 24,
    fontWeight: 600,
    color: "#111827",
    marginBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: "#111827",
    marginBottom: 8,
  },
  list: {
    paddingLeft: 20,
    fontSize: 14,
    color: "#374151",
    lineHeight: 1.6,
    margin: 0,
  },
  paragraph: {
    fontSize: 14,
    color: "#374151",
    margin: 0,
    lineHeight: 1.6,
  },
  inlineLink: {
    color: "#2563EB",
    textDecoration: "none",
  },
  contactText: {
    fontSize: 14,
    color: "#374151",
    margin: 0,
  },
  emailLink: {
    color: "#2563EB",
    textDecoration: "none",
  },
  backLink: {
    display: "inline-block",
    marginTop: 24,
    fontSize: 14,
    color: "#2563EB",
    textDecoration: "none",
    fontWeight: 500,
  },
};
