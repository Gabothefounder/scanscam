"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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

export default function ProcessingInner() {
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "fr">("en");

  /* ---------- resolve language on client only ---------- */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setLang(params.get("lang") === "fr" ? "fr" : "en");
  }, []);

  const t = copy[lang];

  /* ---------- redirect after brief pause ---------- */
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push(`/result?lang=${lang}`);
    }, 1200);

    return () => clearTimeout(timer);
  }, [lang, router]);

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
