"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const copy = {
  en: {
    main: "Checking for common scam warning signs…",
    sub: "This usually takes a few seconds.",
  },
  fr: {
    main: "Analyse des signes courants de fraude en cours…",
    sub: "Cela prend généralement quelques secondes.",
  },
};

export default function ProcessingPage() {
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "fr">("en");

  useEffect(() => {
    // Read query params safely on client only
    const params = new URLSearchParams(window.location.search);
    const detectedLang = params.get("lang") === "fr" ? "fr" : "en";
    setLang(detectedLang);

    const timer = setTimeout(() => {
      router.push(`/result?lang=${detectedLang}`);
    }, 1200);

    return () => clearTimeout(timer);
  }, [router]);

  const t = copy[lang];

  return (
    <main style={styles.container}>
      <section style={styles.card}>
        <p style={styles.mainText}>{t.main}</p>
        <p style={styles.subText}>{t.sub}</p>
      </section>
    </main>
  );
}

/* ---------- styles ---------- */

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#F7F8FA",
    fontFamily: "Inter, system-ui, sans-serif",
    color: "#0B1220",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
  },
  card: {
    width: "100%",
    maxWidth: "420px",
    backgroundColor: "#FFFFFF",
    borderRadius: "16px",
    padding: "32px",
    textAlign: "center" as const,
    boxShadow: "0 12px 36px rgba(11,18,32,0.08)",
  },
  mainText: {
    fontSize: "18px",
    fontWeight: 500,
  },
  subText: {
    marginTop: "10px",
    fontSize: "14px",
    color: "#8A8F98",
  },
};
