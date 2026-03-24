"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScannerForm } from "@/components/ScannerForm";

/* ---------- copy ---------- */

const copy = {
  en: {
    title: "Paste the suspicious message below",
    subline: "Or upload a screenshot instead.",
    helperText:
      "Works with suspicious messages, emails, links, screenshot text, or call transcripts. Paste the full message when possible — not just the link — for better analysis.",
    reassurance: "No login. Instant results. No personal profile.",
    disclaimer:
      "By using ScanScam, you agree that messages may be securely stored for up to 30 days to improve detection. No accounts or personal profiles are created.",
    howItWorks: "How it works",
    privacyLink: "Privacy & Data Use",
  },
  fr: {
    title: "Collez le message suspect ci-dessous",
    subline: "Ou téléversez une capture d'écran.",
    helperText:
      "Messages suspects, courriels, liens, texte de captures d'écran ou transcriptions d'appels. Collez le message complet lorsque possible — pas seulement le lien — pour une meilleure analyse.",
    reassurance: "Aucune connexion. Résultats instantanés. Aucun profil personnel.",
    disclaimer:
      "En utilisant ScanScam, vous acceptez que les messages puissent être stockés de manière sécurisée jusqu'à 30 jours pour améliorer la détection. Aucun compte ni profil personnel n'est créé.",
    howItWorks: "Comment ça marche",
    privacyLink: "Confidentialité et utilisation des données",
  },
};

export default function ScanPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [lang, setLang] = useState<"en" | "fr">("en");
  const [attribution, setAttribution] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentLang = params.get("lang") === "fr" ? "fr" : "en";
    setLang(currentLang);
    const attr = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid"];
    const out: Record<string, string | null> = {};
    attr.forEach((k) => {
      const v = params.get(k);
      out[k] = v ? v.trim() || null : null;
    });
    setAttribution(out);
    setMounted(true);
  }, []);

  const t = copy[lang];

  const handleScanSuccess = (result: Record<string, unknown>) => {
    sessionStorage.setItem("scanResult", JSON.stringify(result));
    const attrProps: Record<string, string> = {};
    if (attribution.utm_source) attrProps.utm_source = attribution.utm_source;
    if (attribution.utm_campaign) attrProps.utm_campaign = attribution.utm_campaign;
    if (attribution.utm_term) attrProps.utm_term = attribution.utm_term;
    if (attribution.utm_medium) attrProps.utm_medium = attribution.utm_medium;
    if (attribution.utm_content) attrProps.utm_content = attribution.utm_content;
    if (attribution.gclid) attrProps.gclid = attribution.gclid;
    if (Object.keys(attrProps).length > 0) {
      sessionStorage.setItem("scan_attribution", JSON.stringify(attrProps));
    }
    router.push(`/result?lang=${lang}`);
  };

  if (!mounted) return null;

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>{t.title}</h1>
          <p style={styles.subline}>{t.subline}</p>
          <p style={styles.helperText}>{t.helperText}</p>
        </div>

        <ScannerForm lang={lang} onScanSuccess={handleScanSuccess} />

        <p style={styles.reassurance}>{t.reassurance}</p>
        <p style={styles.disclaimer}>{t.disclaimer}</p>
        <p style={styles.footerLinks}>
          <a href={`/how-it-works?lang=${lang}`} style={styles.footerLink}>
            {t.howItWorks}
          </a>
          {" · "}
          <a href={`/privacy?lang=${lang}`} style={styles.footerLink}>
            {t.privacyLink}
          </a>
        </p>
      </section>
    </main>
  );
}

/* ---------- styles ---------- */

const styles: Record<string, React.CSSProperties> = {
  page: {
    height: "calc(100vh - 156px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#E2E4E9",
    padding: "0 16px",
  },
  card: {
    width: "100%",
    maxWidth: "640px",
    background: "#FFFFFF",
    padding: "32px 28px",
    borderRadius: "14px",
    boxShadow: "0 16px 48px rgba(11,18,32,0.18)",
    border: "1px solid #D1D5DB",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  header: {
    textAlign: "center",
    marginBottom: 0,
  },
  title: {
    fontSize: 26,
    fontWeight: 700,
    color: "#0B1220",
    margin: 0,
    marginBottom: 6,
  },
  subline: {
    fontSize: 15,
    color: "#4B5563",
    margin: 0,
  },
  helperText: {
    fontSize: 13,
    color: "#6B7280",
    margin: "8px 0 0",
    lineHeight: 1.5,
    textAlign: "center",
  },
  reassurance: {
    fontSize: 15,
    fontWeight: 500,
    color: "#374151",
    textAlign: "center",
    margin: 0,
  },
  disclaimer: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 1.5,
    margin: "4px 0 0",
  },
  footerLinks: {
    margin: "8px 0 0",
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
  },
  footerLink: {
    color: "#2563EB",
    textDecoration: "none",
  },
};
