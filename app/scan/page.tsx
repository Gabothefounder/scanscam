"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ScanPage() {
  /* ---------- hooks ---------- */

  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [lang, setLang] = useState<"en" | "fr">("en");

  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /* ---------- resolve language after mount ---------- */

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentLang = params.get("lang") === "fr" ? "fr" : "en";
    setLang(currentLang);
    setMounted(true);
  }, []);

  /* ---------- copy ---------- */

  const t = {
    placeholder:
      lang === "fr" ? "Collez le message ici…" : "Paste the message here…",
    upload:
      lang === "fr"
        ? "Téléverser une capture d’écran"
        : "Upload a screenshot",
    scan: lang === "fr" ? "Analyser" : "Scan",
    scanning:
      lang === "fr" ? "Analyse en cours…" : "Analyzing…",
    anonymous:
      lang === "fr"
        ? "L’analyse est anonyme. Rien n’est lié à vous."
        : "Analysis is anonymous. Nothing is linked to you.",
  };

  /* ---------- helpers ---------- */

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const clearImage = () => {
    setImageFile(null);
  };

  /* ---------- main action ---------- */

  const handleScan = async () => {
    setError(null);
    setLoading(true);

    try {
      const payload: any = { lang };

      if (imageFile) {
        payload.image = await fileToBase64(imageFile);
      } else {
        payload.text = text;
      }

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.ok) {
        setError(data.message);
        setLoading(false);
        return;
      }

      sessionStorage.setItem("scanResult", JSON.stringify(data.result));
      router.push(`/result?lang=${lang}`);
    } catch {
      setError(
        lang === "fr"
          ? "Une erreur est survenue. Veuillez réessayer."
          : "Something went wrong. Please try again."
      );
      setLoading(false);
    }
  };

  /* ---------- hydration-safe ---------- */

  if (!mounted) return null;

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <textarea
          style={styles.textarea}
          placeholder={t.placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!!imageFile || loading}
        />

        <div style={styles.uploadRow}>
          <label style={styles.uploadLabel}>
            {t.upload}
            <input
              type="file"
              accept="image/*"
              hidden
              disabled={loading}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setImageFile(e.target.files[0]);
                  setText("");
                }
              }}
            />
          </label>

          {imageFile && (
            <div style={styles.imagePreview}>
              <span style={styles.fileName}>{imageFile.name}</span>
              <button
                onClick={clearImage}
                style={styles.clearButton}
                disabled={loading}
              >
                ×
              </button>
            </div>
          )}
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <button
          onClick={handleScan}
          style={styles.scanButton}
          disabled={loading}
        >
          {loading ? t.scanning : t.scan}
        </button>

        <p style={styles.microcopy}>{t.anonymous}</p>
      </section>
    </main>
  );
}

/* ---------- styles ---------- */

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#F7F8FA",
    padding: "16px",
  },

  card: {
    maxWidth: "720px",
    margin: "0 auto",
    background: "#FFFFFF",
    padding: "22px",
    borderRadius: "14px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },

  textarea: {
    minHeight: "160px",
    padding: "14px",
    fontSize: "16px",
    lineHeight: 1.5,
    color: "#111827",            // typed text (FIX)
    backgroundColor: "#FFFFFF",
    borderRadius: "10px",
    border: "1px solid #D1D5DB",
    resize: "vertical",
    outline: "none",
  },

  uploadRow: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  uploadLabel: {
    fontSize: "14px",
    color: "#2E6BFF",
    cursor: "pointer",
    width: "fit-content",
    fontWeight: 500,
  },

  imagePreview: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "14px",
  },

  fileName: {
    color: "#111827",            // FIX
  },

  clearButton: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "18px",
    color: "#4B5563",            // FIX
  },

  error: {
    color: "#B91C1C",
    fontSize: "14px",
  },

  scanButton: {
    padding: "14px",
    fontSize: "16px",
    borderRadius: "10px",
    border: "none",
    background: "#2E6BFF",
    color: "#FFFFFF",
    cursor: "pointer",
    fontWeight: 600,
  },

  microcopy: {
    fontSize: "13px",
    color: "#374151",            // FIX
    textAlign: "center",
  },
};
