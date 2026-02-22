"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { logScanEvent } from "@/lib/telemetry/logScanEvent";

/* ---------- copy ---------- */

const copy = {
  en: {
    title: "Paste the suspicious message below",
    subline: "Or upload a screenshot instead.",
    placeholder: "Paste the message here…",
    divider: "— OR —",
    uploadLabel: "📷 Upload a screenshot",
    button: "Scan",
    buttonLoading: "Analyzing…",
    reassurance: "Anonymous. Nothing is linked to you.",
    toggle: "Help improve scam detection (optional)",
    checkbox: "Share this message anonymously (deleted after 30 days)",
    smallNote: "We store pattern data only. No personal identifiers.",
    howItWorks: "How it works",
    errorGeneric: "Something went wrong. Please try again.",
  },
  fr: {
    title: "Collez le message suspect ci-dessous",
    subline: "Ou téléversez une capture d'écran.",
    placeholder: "Collez le message ici…",
    divider: "— OU —",
    uploadLabel: "📷 Téléverser une capture d'écran",
    button: "Analyser",
    buttonLoading: "Analyse en cours…",
    reassurance: "Analyse anonyme. Rien n'est lié à vous.",
    toggle: "Aider à améliorer la détection (optionnel)",
    checkbox: "Partager ce message anonymement (supprimé après 30 jours)",
    smallNote: "Nous conservons seulement des données de détection, sans information personnelle.",
    howItWorks: "Comment ça marche",
    errorGeneric: "Une erreur est survenue. Veuillez réessayer.",
  },
};

export default function ScanPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [lang, setLang] = useState<"en" | "fr">("en");

  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rawOptIn, setRawOptIn] = useState(false);
  const [optInOpen, setOptInOpen] = useState(false);
  const [textareaFocused, setTextareaFocused] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentLang = params.get("lang") === "fr" ? "fr" : "en";
    setLang(currentLang);
    setMounted(true);
  }, []);

  const t = copy[lang];

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

  const handleScan = async () => {
    setError(null);
    logScanEvent("scan_attempt", { length: text.length });
    setLoading(true);

    try {
      const payload: any = { lang, raw_opt_in: rawOptIn };

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
      setError(t.errorGeneric);
      setLoading(false);
    }
  };

  if (!mounted) return null;

  const textareaStyle = {
    ...styles.textarea,
    ...(textareaFocused ? styles.textareaFocused : {}),
  };

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        {/* ---------- Title + Subline ---------- */}
        <div style={styles.header}>
          <h1 style={styles.title}>{t.title}</h1>
          <p style={styles.subline}>{t.subline}</p>
        </div>

        {/* ---------- Textarea ---------- */}
        <textarea
          style={textareaStyle}
          placeholder={t.placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setTextareaFocused(true)}
          onBlur={() => setTextareaFocused(false)}
          disabled={!!imageFile || loading}
          aria-label={t.placeholder}
        />

        {/* ---------- Divider ---------- */}
        <div style={styles.divider}>{t.divider}</div>

        {/* ---------- Upload Row ---------- */}
        <div style={styles.uploadSection}>
          <label style={styles.uploadLabel}>
            <span style={styles.uploadButton}>{t.uploadLabel}</span>
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
                aria-label="Remove file"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* ---------- Error ---------- */}
        {error && <p style={styles.error} role="alert">{error}</p>}

        {/* ---------- Submit Button ---------- */}
        <button
          onClick={handleScan}
          style={styles.scanButton}
          disabled={loading || (!text.trim() && !imageFile)}
        >
          {loading ? t.buttonLoading : t.button}
        </button>

        {/* ---------- Reassurance ---------- */}
        <p style={styles.reassurance}>{t.reassurance}</p>

        {/* ---------- Collapsible Opt-In Section (below primary action) ---------- */}
        <div style={styles.optInSection}>
          <button
            type="button"
            onClick={() => setOptInOpen(!optInOpen)}
            style={styles.optInToggle}
            aria-expanded={optInOpen}
          >
            {optInOpen ? "▼" : "▶"} {t.toggle}
          </button>

          {optInOpen && (
            <div style={styles.optInContent}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={rawOptIn}
                  onChange={(e) => setRawOptIn(e.target.checked)}
                  disabled={loading}
                  style={styles.checkbox}
                />
                <span>{t.checkbox}</span>
              </label>
              <p style={styles.smallNote}>{t.smallNote}</p>
              <a href={`/how-it-works?lang=${lang}`} style={styles.howItWorksLink}>
                {t.howItWorks}
              </a>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

/* ---------- styles ---------- */

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#F7F8FA",
    padding: "16px 16px 32px",
  },

  card: {
    maxWidth: "800px",
    margin: "0 auto",
    background: "#FFFFFF",
    padding: "28px 32px",
    borderRadius: "18px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },

  header: {
    textAlign: "center",
    marginBottom: 0,
  },

  title: {
    fontSize: 24,
    fontWeight: 600,
    color: "#111827",
    margin: 0,
    marginBottom: 6,
  },

  subline: {
    fontSize: 15,
    color: "#6B7280",
    margin: 0,
  },

  textarea: {
    minHeight: "160px",
    padding: "16px",
    fontSize: "17px",
    lineHeight: 1.6,
    color: "#111827",
    backgroundColor: "#F8FAFC",
    borderRadius: "12px",
    border: "2px solid #9CA3AF",
    resize: "vertical",
    outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
  },

  textareaFocused: {
    borderColor: "#2563EB",
    boxShadow: "0 0 0 4px rgba(37, 99, 235, 0.15)",
    backgroundColor: "#FFFFFF",
  },

  divider: {
    textAlign: "center",
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: 500,
    padding: "8px 0",
    letterSpacing: "0.5px",
  },

  uploadSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
  },

  uploadLabel: {
    cursor: "pointer",
  },

  uploadButton: {
    display: "inline-block",
    padding: "12px 28px",
    fontSize: 15,
    fontWeight: 500,
    color: "#2563EB",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    border: "2px solid #2563EB",
    transition: "background-color 0.15s",
  },

  imagePreview: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontSize: 15,
    color: "#374151",
    padding: "10px 16px",
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
  },

  fileName: {
    color: "#111827",
    fontWeight: 500,
  },

  clearButton: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 22,
    color: "#6B7280",
    padding: "4px 8px",
    lineHeight: 1,
  },

  error: {
    color: "#B91C1C",
    fontSize: 16,
    textAlign: "center",
    margin: 0,
    padding: "14px 16px",
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    fontWeight: 500,
  },

  scanButton: {
    padding: "16px",
    fontSize: 18,
    fontWeight: 600,
    borderRadius: 12,
    border: "none",
    background: "#2563EB",
    color: "#FFFFFF",
    cursor: "pointer",
    width: "100%",
    transition: "background-color 0.15s",
  },

  reassurance: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    margin: 0,
  },

  optInSection: {
    borderTop: "1px solid #E5E7EB",
    paddingTop: 16,
    marginTop: 4,
  },

  optInToggle: {
    background: "none",
    border: "none",
    fontSize: 14,
    color: "#6B7280",
    cursor: "pointer",
    padding: 0,
    textAlign: "left",
    width: "100%",
  },

  optInContent: {
    marginTop: 14,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    paddingLeft: 4,
  },

  checkboxLabel: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    fontSize: 16,
    color: "#374151",
    cursor: "pointer",
    lineHeight: 1.5,
  },

  checkbox: {
    marginTop: 4,
    width: 20,
    height: 20,
    cursor: "pointer",
  },

  smallNote: {
    fontSize: 14,
    color: "#6B7280",
    margin: 0,
    paddingLeft: 32,
  },

  howItWorksLink: {
    fontSize: 14,
    color: "#2563EB",
    textDecoration: "none",
    paddingLeft: 32,
    fontWeight: 500,
  },
};
