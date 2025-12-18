"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ProcessingClient() {
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "fr">("en");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const detectedLang = params.get("lang") === "fr" ? "fr" : "en";
    setLang(detectedLang);

    const timer = setTimeout(() => {
      router.push(`/result?lang=${detectedLang}`);
    }, 1200);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main style={styles.container}>
      <section style={styles.card}>
        <p style={styles.mainText}>
          {lang === "fr"
            ? "Analyse des signes courants de fraude en cours…"
            : "Checking for common scam warning signs…"}
        </p>
        <p style={styles.subText}>
          {lang === "fr"
            ? "Cela prend généralement quelques secondes."
            : "This usually takes a few seconds."}
        </p>
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
