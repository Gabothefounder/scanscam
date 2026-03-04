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
    reassurance: "Anonymous. No login. No personal profile.",
    policy1: "Messages may be stored securely for up to 30 days to improve detection.",
    policy2: "No personal tracking or behavioral profiling.",
    howItWorks: "How it works",
    privacyLink: "Privacy & Data Use",
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
    reassurance: "Anonyme. Aucune connexion. Aucun profil personnel.",
    policy1: "Les messages peuvent être stockés de manière sécurisée jusqu'à 30 jours pour améliorer la détection.",
    policy2: "Aucun suivi personnel ni profilage comportemental.",
    howItWorks: "Comment ça marche",
    privacyLink: "Confidentialité et utilisation des données",
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
      const payload: any = { lang, raw_opt_in: false };

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

  const textareaStyle: React.CSSProperties = {
    ...styles.textarea,
    border: textareaFocused ? "1px solid #2563EB" : "1px solid #6B7280",
    boxShadow: textareaFocused ? "0 0 0 3px rgba(37, 99, 235, 0.12)" : undefined,
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

        {/* ---------- Reassurance + policy + links ---------- */}
        <p style={styles.reassurance}>{t.reassurance}</p>
        <div style={styles.policyBlock}>
          <p style={styles.policyText}>{t.policy1}</p>
          <p style={styles.policyText}>{t.policy2}</p>
          <p style={styles.policyLinks}>
            <a href={`/how-it-works?lang=${lang}`} style={styles.policyLink}>
              {t.howItWorks}
            </a>
            {" · "}
            <a href={`/privacy?lang=${lang}`} style={styles.policyLink}>
              {t.privacyLink}
            </a>
          </p>
        </div>
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

  textarea: {
    minHeight: "140px",
    padding: "14px",
    fontSize: "16px",
    lineHeight: 1.55,
    color: "#0B1220",
    backgroundColor: "#FFFFFF",
    borderRadius: "10px",
    border: "1px solid #6B7280",
    resize: "vertical",
    outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
  },


  divider: {
    textAlign: "center",
    fontSize: 13,
    color: "#6B7280",
    fontWeight: 500,
    padding: "4px 0",
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
    padding: "12px 24px",
    fontSize: 15,
    fontWeight: 600,
    color: "#374151",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    border: "1px solid #94A3B8",
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
    padding: "14px 24px",
    fontSize: 17,
    fontWeight: 700,
    borderRadius: 12,
    border: "none",
    background: "#2563EB",
    color: "#FFFFFF",
    cursor: "pointer",
    width: "100%",
    boxShadow: "0 3px 8px rgba(37,99,235,0.35)",
    transition: "background-color 0.15s",
  },

  reassurance: {
    fontSize: 14,
    color: "#4B5563",
    textAlign: "center",
    margin: 0,
  },

  policyBlock: {
    marginTop: 4,
  },

  policyText: {
    margin: "0 0 4px",
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 1.4,
  },

  policyLinks: {
    margin: "8px 0 0",
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
  },

  policyLink: {
    color: "#2563EB",
    textDecoration: "none",
  },
};
