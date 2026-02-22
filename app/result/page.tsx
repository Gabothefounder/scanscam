"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { logScanEvent } from "@/lib/telemetry/logScanEvent";

/* ---------- copy ---------- */

const copy = {
  en: {
    tier: {
      low: "Low Risk",
      medium: "Medium Risk",
      high: "High Risk",
    },
    defaultSummary: {
      low: "This message does not show strong scam-related manipulation patterns.",
      medium:
        "This message shows suspicious patterns commonly used in scams. Caution is advised.",
      high:
        "This message strongly resembles known scam techniques and may be attempting to manipulate you.",
    },
    guidanceTitle: "Before acting",
    guidance: [
      "Pause before responding — legitimate services don't require immediate action.",
      "Verify independently using a trusted contact or official website.",
    ],
    presence:
      "Whenever something feels off, ScanScam is here to help you check.",
    again: "Scan another message",
    close: "Close",
    geoTitle: "Help us understand where scams happen (optional)",
    country: "Country",
    province: "Province",
    city: "City",
    save: "Save",
    saved: "Saved",
    selectCountry: "Select country",
    selectProvince: "Select province",
  },
  fr: {
    tier: {
      low: "Risque faible",
      medium: "Risque moyen",
      high: "Risque élevé",
    },
    defaultSummary: {
      low: "Ce message ne présente pas de signes clairs de manipulation frauduleuse.",
      medium:
        "Ce message présente des schémas suspects souvent associés à des fraudes. La prudence est recommandée.",
      high:
        "Ce message ressemble fortement à des techniques de fraude connues et pourrait chercher à vous manipuler.",
    },
    guidanceTitle: "Avant d'agir",
    guidance: [
      "Prenez un moment avant de répondre — les services légitimes n'exigent pas d'action immédiate.",
      "Vérifiez de manière indépendante via un contact fiable ou un site officiel.",
    ],
    presence:
      "Si quelque chose vous semble étrange, ScanScam est là pour vous aider à vérifier.",
    again: "Analyser un autre message",
    close: "Fermer",
    geoTitle: "Aidez-nous à comprendre où les fraudes se produisent (facultatif)",
    country: "Pays",
    province: "Province",
    city: "Ville",
    save: "Enregistrer",
    saved: "Enregistré",
    selectCountry: "Sélectionner un pays",
    selectProvince: "Sélectionner une province",
  },
};

/* ---------- data ---------- */

const COUNTRIES = [
  { code: "CA", label: "Canada" },
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "FR", label: "France" },
  { code: "DE", label: "Germany" },
  { code: "AU", label: "Australia" },
  { code: "OTHER", label: "Other" },
];

const CA_PROVINCES = [
  { code: "AB", label: "Alberta" },
  { code: "BC", label: "British Columbia" },
  { code: "MB", label: "Manitoba" },
  { code: "NB", label: "New Brunswick" },
  { code: "NL", label: "Newfoundland and Labrador" },
  { code: "NS", label: "Nova Scotia" },
  { code: "NT", label: "Northwest Territories" },
  { code: "NU", label: "Nunavut" },
  { code: "ON", label: "Ontario" },
  { code: "PE", label: "Prince Edward Island" },
  { code: "QC", label: "Quebec" },
  { code: "SK", label: "Saskatchewan" },
  { code: "YT", label: "Yukon" },
];

export default function ResultPage() {
  const [result, setResult] = useState<any>(null);
  const [lang, setLang] = useState<"en" | "fr">("en");

  const [countryCode, setCountryCode] = useState("");
  const [regionCode, setRegionCode] = useState("");
  const [city, setCity] = useState("");
  const [geoSaved, setGeoSaved] = useState(false);
  const [geoSaving, setGeoSaving] = useState(false);

  /* ---------- load scan result ---------- */

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const l = params.get("lang");
      setLang(l === "fr" ? "fr" : "en");

      const stored = sessionStorage.getItem("scanResult");
      if (stored) {
        const parsed = JSON.parse(stored);
        setResult(parsed);
        
        const riskTier = parsed.risk ?? parsed.risk_tier ?? "low";
        logScanEvent("scan_shown", { tier: riskTier });
      }
    } catch {
      setResult(null);
    }
  }, []);

  /* ---------- geo save handler ---------- */

  const handleSaveGeo = async () => {
    const scanId = result?.scan_id;
    if (!scanId || geoSaving || geoSaved) return;

    setGeoSaving(true);

    try {
      await fetch("/api/scan/geo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scan_id: scanId,
          country_code: countryCode || null,
          region_code: regionCode || null,
          city: city.trim() || null,
        }),
      });
      setGeoSaved(true);
    } catch {
      // Silent failure
    } finally {
      setGeoSaving(false);
    }
  };

  if (!result) return null;

  const t = copy[lang];

  const risk: "low" | "medium" | "high" =
    result.risk ?? result.risk_tier ?? "low";

  const reasons: string[] = Array.isArray(result.reasons)
    ? result.reasons
    : Array.isArray(result.signals)
    ? result.signals.map((s: any) => s.description)
    : [];

  const summary =
    result.summary_sentence || t.defaultSummary[risk];

  const showProvinces = countryCode === "CA";
  const scanId = result?.scan_id;

  return (
    <main style={styles.container}>
      <section style={styles.card}>
        <div style={styles[`tier_${risk}`]}>{t.tier[risk]}</div>

        <p style={styles.summary}>{summary}</p>

        {reasons.length > 0 && (
          <ul style={styles.reasons}>
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}

        <div style={styles.guidance}>
          <div style={styles.guidanceTitle}>{t.guidanceTitle}</div>
          <ul>
            {t.guidance.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>

        <p style={styles.presence}>{t.presence}</p>

        {/* ---------- Optional geo section ---------- */}
        {scanId && (
          <div style={styles.geoSection}>
            <p style={styles.geoTitle}>{t.geoTitle}</p>

            <div style={styles.geoRow}>
              <label style={styles.geoLabel}>
                {t.country}
                <select
                  style={styles.geoSelect}
                  value={countryCode}
                  onChange={(e) => {
                    setCountryCode(e.target.value);
                    setRegionCode("");
                    setGeoSaved(false);
                  }}
                  disabled={geoSaved}
                >
                  <option value="">{t.selectCountry}</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>

              {showProvinces && (
                <label style={styles.geoLabel}>
                  {t.province}
                  <select
                    style={styles.geoSelect}
                    value={regionCode}
                    onChange={(e) => {
                      setRegionCode(e.target.value);
                      setGeoSaved(false);
                    }}
                    disabled={geoSaved}
                  >
                    <option value="">{t.selectProvince}</option>
                    {CA_PROVINCES.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label style={styles.geoLabel}>
                {t.city}
                <input
                  type="text"
                  style={styles.geoInput}
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    setGeoSaved(false);
                  }}
                  disabled={geoSaved}
                  placeholder=""
                />
              </label>
            </div>

            <button
              style={geoSaved ? styles.geoButtonSaved : styles.geoButton}
              onClick={handleSaveGeo}
              disabled={geoSaving || geoSaved || !countryCode}
            >
              {geoSaved ? t.saved : geoSaving ? "..." : t.save}
            </button>
          </div>
        )}

        <div style={styles.endActions}>
          <a href={`/scan?lang=${lang}`} style={styles.link}>
            {t.again}
          </a>
          <a href="/" style={styles.linkSecondary}>
            {t.close}
          </a>
        </div>
      </section>
    </main>
  );
}

/* ---------- styles ---------- */

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#F7F8FA",
    display: "flex",
    justifyContent: "center",
    padding: "16px",
  },
  card: {
    width: "100%",
    maxWidth: "560px",
    backgroundColor: "#FFFFFF",
    borderRadius: "16px",
    padding: "28px",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    boxShadow: "0 12px 36px rgba(11,18,32,0.08)",
  },
  tier_low: { fontSize: 22, fontWeight: 600, color: "#065F46" },
  tier_medium: { fontSize: 22, fontWeight: 600, color: "#92400E" },
  tier_high: { fontSize: 22, fontWeight: 600, color: "#7F1D1D" },
  summary: { fontSize: 15, color: "#111827" },
  reasons: { paddingLeft: 18, fontSize: 15, color: "#111827" },
  guidance: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: "#111827",
  },
  guidanceTitle: { fontWeight: 600, marginBottom: 6 },
  presence: { fontSize: 13, color: "#374151" },
  endActions: {
    marginTop: 8,
    display: "flex",
    justifyContent: "space-between",
    fontSize: 14,
  },
  link: { color: "#2563EB", textDecoration: "none", fontWeight: 500 },
  linkSecondary: { color: "#374151", textDecoration: "none" },

  geoSection: {
    borderTop: "1px solid #E5E7EB",
    paddingTop: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  geoTitle: {
    fontSize: 13,
    color: "#6B7280",
    margin: 0,
  },
  geoRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
  },
  geoLabel: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 13,
    color: "#374151",
    flex: "1 1 140px",
  },
  geoSelect: {
    padding: "8px 10px",
    fontSize: 14,
    borderRadius: 8,
    border: "1px solid #D1D5DB",
    backgroundColor: "#FFFFFF",
    color: "#111827",
  },
  geoInput: {
    padding: "8px 10px",
    fontSize: 14,
    borderRadius: 8,
    border: "1px solid #D1D5DB",
    backgroundColor: "#FFFFFF",
    color: "#111827",
  },
  geoButton: {
    alignSelf: "flex-start",
    padding: "8px 16px",
    fontSize: 13,
    borderRadius: 8,
    border: "none",
    backgroundColor: "#2563EB",
    color: "#FFFFFF",
    cursor: "pointer",
    fontWeight: 500,
  },
  geoButtonSaved: {
    alignSelf: "flex-start",
    padding: "8px 16px",
    fontSize: 13,
    borderRadius: 8,
    border: "1px solid #D1D5DB",
    backgroundColor: "#F3F4F6",
    color: "#6B7280",
    cursor: "default",
    fontWeight: 500,
  },
};
