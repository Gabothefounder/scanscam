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
      "Returns guidance only — not legal advice.",
    ],

    metadataTitle: "What metadata is stored",
    metadata: [
      "Anonymous, non-identifying fraud-pattern fields.",
      "Behavioral signals such as urgency, authority claims, payment requests, suspicious links, etc.",
      "No way to trace data back to you.",
    ],

    notCollectedTitle: "What is NOT collected",
    notCollected: [
      "No identity or account login.",
      "No personal tracking or profiling.",
      "No cookies for advertising.",
    ],

    rawOptInTitle: "Optional raw message sharing",
    rawOptIn: [
      "Only if you check the box on the scan page.",
      "Used to improve detection models.",
      "Auto-deleted after 30 days.",
    ],

    geoTitle: "Optional location after results",
    geo: [
      "Country / Province (Canada) / City — all optional.",
      "Provided after you see your scan results.",
      "Helps us understand regional scam patterns.",
    ],

    contactTitle: "Contact",
    contact: "For privacy or deletion questions: hello@scanscam.ai",
  },
  fr: {
    title: "Comment fonctionne ScanScam",
    backToScan: "Retour",

    whatScanDoesTitle: "Ce que fait l'analyse",
    whatScanDoes: [
      "Retourne un niveau de risque (faible / moyen / élevé) avec une courte explication.",
      "Fournit des actions recommandées basées sur les schémas détectés.",
      "Retourne des conseils uniquement — pas de conseil juridique.",
    ],

    metadataTitle: "Quelles métadonnées sont stockées",
    metadata: [
      "Champs anonymes et non identifiants sur les schémas de fraude.",
      "Signaux comportementaux tels que l'urgence, les revendications d'autorité, les demandes de paiement, les liens suspects, etc.",
      "Aucun moyen de relier les données à vous.",
    ],

    notCollectedTitle: "Ce qui n'est PAS collecté",
    notCollected: [
      "Aucune identité ni connexion de compte.",
      "Aucun suivi personnel ni profilage.",
      "Aucun cookie publicitaire.",
    ],

    rawOptInTitle: "Partage optionnel du texte",
    rawOptIn: [
      "Uniquement si vous cochez la case sur la page d'analyse.",
      "Utilisé pour améliorer les modèles de détection.",
      "Suppression automatique après 30 jours.",
    ],

    geoTitle: "Localisation optionnelle après les résultats",
    geo: [
      "Pays / Province (Canada) / Ville — tout est optionnel.",
      "Fourni après avoir vu vos résultats d'analyse.",
      "Nous aide à comprendre les schémas de fraude régionaux.",
    ],

    contactTitle: "Contact",
    contact: "Pour les questions de confidentialité ou de suppression : hello@scanscam.ai",
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
          <h2 style={styles.sectionTitle}>{t.metadataTitle}</h2>
          <ul style={styles.list}>
            {t.metadata.map((item, i) => (
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
          <h2 style={styles.sectionTitle}>{t.rawOptInTitle}</h2>
          <ul style={styles.list}>
            {t.rawOptIn.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>{t.geoTitle}</h2>
          <ul style={styles.list}>
            {t.geo.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>{t.contactTitle}</h2>
          <p style={styles.contactText}>{t.contact}</p>
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
  contactText: {
    fontSize: 14,
    color: "#374151",
    margin: 0,
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
