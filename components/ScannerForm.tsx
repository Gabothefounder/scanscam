"use client";

import { useEffect, useState } from "react";
import { scanApiUserMessage, isSoftThrottleCode } from "@/lib/scan/scanApiUserMessage";
import { passesScanTextAdmission, scanTextAdmissionErrorMessage } from "@/lib/scan/scanTextAdmission";
import { logScanEvent } from "@/lib/telemetry/logScanEvent";
import { captureAttribution, getAttribution } from "@/lib/attribution";
import type { PartnerConfig } from "@/lib/partners";

const copy = {
  en: {
    placeholder: "Paste the message here…",
    divider: "— OR —",
    uploadLabel: "📷 Upload a screenshot",
    button: "Scan",
    buttonLoading: "Analyzing…",
    errorTextAdmission: scanTextAdmissionErrorMessage("en"),
  },
  fr: {
    placeholder: "Collez le message ici…",
    divider: "— OU —",
    uploadLabel: "📷 Téléverser une capture d'écran",
    button: "Analyser",
    buttonLoading: "Analyse en cours…",
    errorTextAdmission: scanTextAdmissionErrorMessage("fr"),
  },
};

type Props = {
  lang: "en" | "fr";
  onScanSuccess: (result: Record<string, unknown>) => void;
  partner?: PartnerConfig | null;
  copyOverrides?: Partial<{
    placeholder: string;
    divider: string;
    uploadLabel: string;
    button: string;
    buttonLoading: string;
  }>;
};

export function ScannerForm({ lang, onScanSuccess, copyOverrides }: Props) {
  const [mounted, setMounted] = useState(false);
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [textareaFocused, setTextareaFocused] = useState(false);
  const [admissionError, setAdmissionError] = useState(false);
  const [softError, setSoftError] = useState(false);

  useEffect(() => {
    captureAttribution();
    setMounted(true);
  }, []);

  const t = {
    ...copy[lang],
    ...copyOverrides,
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const clearImage = () => {
    setImageFile(null);
    if (admissionError) setAdmissionError(false);
  };

  const handleScan = async () => {
    setError(null);
    setAdmissionError(false);
    setSoftError(false);
    const attempt_id = crypto.randomUUID();
    sessionStorage.setItem("scan_attempt_id", attempt_id);

    const attr = getAttribution();
    const attrProps: Record<string, string> = {};
    if (attr.utm_source) attrProps.utm_source = attr.utm_source;
    if (attr.utm_campaign) attrProps.utm_campaign = attr.utm_campaign;
    if (attr.utm_term) attrProps.utm_term = attr.utm_term;
    if (attr.utm_medium) attrProps.utm_medium = attr.utm_medium;
    if (attr.utm_content) attrProps.utm_content = attr.utm_content;
    if (attr.gclid) attrProps.gclid = attr.gclid;

    logScanEvent("scan_attempt", {
      props: { input_length: text.length, attempt_id, ...attrProps },
    });
    setLoading(true);
    logScanEvent("scan_processing", { props: { attempt_id } });

    const trimmedText = text.trim();
    if (!imageFile && !passesScanTextAdmission(trimmedText)) {
      setError(t.errorTextAdmission);
      setAdmissionError(true);
      setLoading(false);
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        lang,
        raw_opt_in: true,
        referrer: attr.referrer || null,
        landing_path: attr.landing_path || null,
      };
      Object.assign(payload, attrProps);

      if (imageFile) {
        payload.image = await fileToBase64(imageFile);
        sessionStorage.setItem(
          "scan_submission",
          JSON.stringify({
            lang,
            source: "ocr",
            created_at: Date.now(),
          })
        );
      } else {
        payload.text = trimmedText;
        sessionStorage.setItem(
          "scan_submission",
          JSON.stringify({
            lang,
            source: "user_text",
            text: trimmedText,
            created_at: Date.now(),
          })
        );
      }

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.ok) {
        const code = (data?.code as string) ?? "api_error";
        logScanEvent("scan_error", {
          props: { error_code: code },
        });
        setSoftError(isSoftThrottleCode(code));
        setError(
          scanApiUserMessage(
            lang,
            data?.code as string | undefined,
            data?.message as string | undefined
          )
        );
        setLoading(false);
        return;
      }

      const scanId = data.result?.scan_id;
      const persisted = data.result?.persisted === true;
      if (persisted && scanId) {
        logScanEvent("scan_created", {
          scan_id: scanId,
          props: { attempt_id, input_length: text.length, ...attrProps },
        });
      }

      onScanSuccess(data.result);
    } catch {
      logScanEvent("scan_error", { props: { error_code: "network_error" } });
      setError(scanApiUserMessage(lang, undefined, undefined));
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
    <>
      <textarea
        style={textareaStyle}
        placeholder={t.placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (admissionError) setAdmissionError(false);
        }}
        onFocus={() => setTextareaFocused(true)}
        onBlur={() => setTextareaFocused(false)}
        disabled={!!imageFile || loading}
        aria-label={t.placeholder}
      />

      <div style={styles.divider}>{t.divider}</div>

      <div style={styles.uploadSection}>
        <label style={styles.uploadLabel}>
          <span style={styles.uploadButton}>{t.uploadLabel}</span>
          <input
            type="file"
            accept="image/*"
            hidden
            disabled={loading}
            onChange={(e) => {
              if (e.target.files?.[0]) {
                setImageFile(e.target.files[0]);
                setText("");
                if (admissionError) setAdmissionError(false);
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

      {(admissionError || error) && (
        <p style={!admissionError && softError ? styles.infoNotice : styles.error} role="alert">
          {admissionError ? t.errorTextAdmission : error}
        </p>
      )}

      <button
        onClick={handleScan}
        style={styles.scanButton}
        disabled={
          loading ||
          (!text.trim() && !imageFile)
        }
      >
        {loading ? t.buttonLoading : t.button}
      </button>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
  infoNotice: {
    color: "#334155",
    fontSize: 15,
    textAlign: "center",
    margin: 0,
    padding: "12px 16px",
    backgroundColor: "#F1F5F9",
    border: "1px solid #CBD5E1",
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
};
