"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useRef, useCallback } from "react";
import { logScanEvent } from "@/lib/telemetry/logScanEvent";
import { trackConversion } from "@/lib/gtag";

/* ---------- copy ---------- */

const copy = {
  en: {
    tier: {
      low: "Low Risk",
      medium: "Medium Risk",
      high: "High Risk",
    },
    riskLevelLabel: "Risk level:",
    riskLevel: {
      low: "Low",
      medium: "Medium",
      high: "High",
    },
    defaultSummary: {
      low: "This message does not show strong scam-related manipulation patterns.",
      medium:
        "This message shows suspicious patterns commonly used in scams. Caution is advised.",
      high:
        "This message strongly resembles known scam techniques and may be attempting to manipulate you.",
    },
    actionTitle: "What to do next",
    guidance: [
      "Pause before responding — legitimate services don't require immediate action.",
      "Verify independently using a trusted contact or official website.",
    ],
    presence:
      "Whenever something feels off, ScanScam is here to help you check.",
    backHome: "Back to home",
    geoTitle: "Help protect people near you",
    geoHelper: "Help warn people near you about this scam. (Optional)",
    geoButton: "Share location",
    geoButtonReassurance: "Anonymous. No personal identifiers.",
    country: "Country",
    province: "Province",
    city: "City",
    selectCountry: "Select country",
    selectProvince: "Select province",
    saving: "Saving…",
    saved: "Saved",
  },
  fr: {
    tier: {
      low: "Risque faible",
      medium: "Risque moyen",
      high: "Risque élevé",
    },
    riskLevelLabel: "Niveau de risque :",
    riskLevel: {
      low: "Faible",
      medium: "Moyen",
      high: "Élevé",
    },
    defaultSummary: {
      low: "Ce message ne présente pas de signes clairs de manipulation frauduleuse.",
      medium:
        "Ce message présente des schémas suspects souvent associés à des fraudes. La prudence est recommandée.",
      high:
        "Ce message ressemble fortement à des techniques de fraude connues et pourrait chercher à vous manipuler.",
    },
    actionTitle: "Que faire maintenant",
    guidance: [
      "Prenez un moment avant de répondre — les services légitimes n'exigent pas d'action immédiate.",
      "Vérifiez de manière indépendante via un contact fiable ou un site officiel.",
    ],
    presence:
      "Si quelque chose vous semble étrange, ScanScam est là pour vous aider à vérifier.",
    backHome: "Retour à l'accueil",
    geoTitle: "Aidez à protéger les gens près de vous",
    geoHelper: "Aidez à prévenir les gens près de chez vous. (Optionnel)",
    geoButton: "Partager ma ville",
    geoButtonReassurance: "Anonyme. Aucun identifiant personnel.",
    country: "Pays",
    province: "Province",
    city: "Ville",
    selectCountry: "Sélectionner un pays",
    selectProvince: "Sélectionner une province",
    saving: "Enregistrement…",
    saved: "Enregistré",
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

/* ---------- Risk Meter ---------- */

const RISK_CONFIG = {
  low: { percent: 30, color: "#16A34A", bgColor: "#E8F5EC" },
  medium: { percent: 60, color: "#D97706", bgColor: "#FDF6E8" },
  high: { percent: 90, color: "#DC2626", bgColor: "#FBEAEA" },
};

function RiskMeter({ risk, label, levelText }: { risk: "low" | "medium" | "high"; label: string; levelText: string }) {
  const config = RISK_CONFIG[risk];

  return (
    <div style={styles.meterContainer} role="meter" aria-valuenow={config.percent} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div style={styles.meterTrack}>
        <div
          style={{
            ...styles.meterFillWrapper,
            width: `${config.percent}%`,
          }}
        >
          <div
            style={{
              ...styles.meterFill,
              backgroundColor: config.color,
            }}
          />
          <div
            style={{
              ...styles.meterMarker,
              backgroundColor: config.color,
            }}
          />
        </div>
      </div>
      <div style={styles.riskLevelLine}>{levelText}</div>
    </div>
  );
}

export default function ResultPage() {
  const [result, setResult] = useState<any>(null);
  const [lang, setLang] = useState<"en" | "fr">("en");

  const [countryCode, setCountryCode] = useState("");
  const [regionCode, setRegionCode] = useState("");
  const [city, setCity] = useState("");
  const [geoStatus, setGeoStatus] = useState<"idle" | "saving" | "saved">("idle");

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadRef = useRef(true);
  const conversionFiredForScanRef = useRef<string | null>(null);

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

        const scanId = parsed.scan_id;
        const hasValidResult = scanId || parsed.risk || parsed.risk_tier;
        if (hasValidResult && conversionFiredForScanRef.current !== scanId) {
          conversionFiredForScanRef.current = scanId || "no-id";
          trackConversion("AW-16787240010/-lHQCNrulP0bEMro48Q-");
        }
      }
    } catch {
      setResult(null);
    }
  }, []);

  /* ---------- auto-save geo with debounce ---------- */

  const saveGeo = useCallback(async (scanId: string, country: string, region: string, cityVal: string) => {
    if (!scanId) return;

    setGeoStatus("saving");

    try {
      await fetch("/api/scan/geo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scan_id: scanId,
          country_code: country || null,
          region_code: country === "CA" ? (region || null) : null,
          city: cityVal.trim() || null,
        }),
      });
      setGeoStatus("saved");
    } catch {
      setGeoStatus("idle");
    }
  }, []);

  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }

    const scanId = result?.scan_id;
    if (!scanId) return;

    if (!countryCode && !city.trim()) {
      return;
    }

    setGeoStatus("idle");

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      saveGeo(scanId, countryCode, regionCode, city);
    }, 800);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [countryCode, regionCode, city, result?.scan_id, saveGeo]);

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

  const riskBlockStyle = {
    ...styles.riskBlock,
    backgroundColor: RISK_CONFIG[risk].bgColor,
  };

  return (
    <main style={styles.container}>
      <section style={styles.card}>
        {/* ---------- Top Nav ---------- */}
        <div style={styles.topNav}>
          <a href={`/?lang=${lang}`} style={styles.backLink}>
            {t.backHome}
          </a>
        </div>

        {/* ---------- A) Risk Block ---------- */}
        <div style={riskBlockStyle}>
          <div style={styles[`tier_${risk}`]}>{t.tier[risk]}</div>
          <RiskMeter risk={risk} label={t.tier[risk]} levelText={`${t.riskLevelLabel} ${t.riskLevel[risk]}`} />
          <p style={styles.summary}>{summary}</p>
        </div>

        {/* ---------- Reasons (if any) ---------- */}
        {reasons.length > 0 && (
          <ul style={styles.reasons}>
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}

        {/* ---------- B) Action Block ---------- */}
        <div style={styles.actionBlock}>
          <div style={styles.actionTitle}>{t.actionTitle}</div>
          <ul style={styles.actionList}>
            {t.guidance.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
          <p style={styles.presence}>{t.presence}</p>
        </div>

        {/* ---------- C) Geo Block ---------- */}
        {scanId && (
          <div style={styles.geoSection}>
            <div style={styles.geoHeader}>
              <p style={styles.geoTitle}>{t.geoTitle}</p>
              {geoStatus === "saving" && (
                <span style={styles.geoStatusSaving}>{t.saving}</span>
              )}
              {geoStatus === "saved" && (
                <span style={styles.geoStatusSaved}>{t.saved}</span>
              )}
            </div>

            <p style={styles.geoHelper}>{t.geoHelper}</p>

            <div style={styles.geoRow}>
              <label style={styles.geoLabel}>
                {t.country}
                <select
                  style={styles.geoSelect}
                  value={countryCode}
                  onChange={(e) => {
                    const newCountry = e.target.value;
                    setCountryCode(newCountry);
                    if (newCountry !== "CA") {
                      setRegionCode("");
                    }
                  }}
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
                    onChange={(e) => setRegionCode(e.target.value)}
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
                  onChange={(e) => setCity(e.target.value)}
                  placeholder=""
                />
              </label>
            </div>

            <div style={styles.geoButtonWrapper}>
              <button
                type="button"
                style={styles.geoButton}
                onClick={() => saveGeo(scanId, countryCode, regionCode, city)}
                disabled={geoStatus === "saving"}
              >
                {t.geoButton}
              </button>
              <p style={styles.geoButtonReassurance}>{t.geoButtonReassurance}</p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

/* ---------- styles ---------- */

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "calc(100vh - 156px)",
    backgroundColor: "#E2E4E9",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: "24px 16px 16px",
  },
  card: {
    width: "100%",
    maxWidth: "600px",
    backgroundColor: "#FFFFFF",
    borderRadius: "14px",
    padding: "16px 20px 18px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    boxShadow: "0 16px 48px rgba(11,18,32,0.18)",
    border: "1px solid #D1D5DB",
  },

  topNav: {
    display: "flex",
    justifyContent: "flex-end",
  },
  backLink: {
    color: "#2563EB",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 500,
  },

  riskBlock: {
    borderRadius: 10,
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  tier_low: { fontSize: 22, fontWeight: 700, color: "#15803D", textAlign: "center" },
  tier_medium: { fontSize: 22, fontWeight: 700, color: "#B45309", textAlign: "center" },
  tier_high: { fontSize: 22, fontWeight: 700, color: "#B91C1C", textAlign: "center" },

  meterContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  meterTrack: {
    width: "100%",
    height: 14,
    backgroundColor: "#9CA3AF",
    borderRadius: 7,
    border: "1px solid #6B7280",
    position: "relative",
    overflow: "visible",
    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.1)",
  },
  meterFillWrapper: {
    height: "100%",
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  meterFill: {
    height: "100%",
    borderRadius: 7,
    width: "100%",
  },
  meterMarker: {
    position: "absolute",
    right: -5,
    top: "50%",
    transform: "translateY(-50%)",
    width: 12,
    height: 12,
    borderRadius: "50%",
    border: "2px solid #FFFFFF",
    boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
  },
  riskLevelLine: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },
  summary: {
    fontSize: 15,
    color: "#1F2937",
    lineHeight: 1.5,
    margin: 0,
  },

  reasons: {
    paddingLeft: 18,
    fontSize: 14,
    color: "#1F2937",
    lineHeight: 1.5,
    margin: 0,
  },

  actionBlock: {
    backgroundColor: "#D9DCDF",
    borderRadius: 10,
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  actionTitle: {
    fontWeight: 700,
    fontSize: 15,
    color: "#111827",
  },
  actionList: {
    margin: 0,
    paddingLeft: 16,
    fontSize: 14,
    color: "#1F2937",
    lineHeight: 1.5,
  },
  presence: {
    fontSize: 13,
    color: "#4B5563",
    margin: 0,
    marginTop: 2,
  },

  geoSection: {
    backgroundColor: "#E0EDFF",
    border: "1px solid #93C5FD",
    borderRadius: 10,
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  geoHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  geoTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#1E40AF",
    margin: 0,
  },
  geoHelper: {
    fontSize: 14,
    color: "#374151",
    margin: 0,
    lineHeight: 1.5,
  },
  geoStatusSaving: {
    fontSize: 12,
    color: "#6B7280",
    fontStyle: "italic",
  },
  geoStatusSaved: {
    fontSize: 12,
    color: "#16A34A",
    fontWeight: 500,
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
    flex: "1 1 130px",
  },
  geoSelect: {
    padding: "8px 10px",
    fontSize: 14,
    borderRadius: 6,
    border: "1px solid #9CA3AF",
    backgroundColor: "#FFFFFF",
    color: "#111827",
  },
  geoInput: {
    padding: "8px 10px",
    fontSize: 14,
    borderRadius: 6,
    border: "1px solid #9CA3AF",
    backgroundColor: "#FFFFFF",
    color: "#111827",
  },
  geoButtonWrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  geoButton: {
    backgroundColor: "#2563EB",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 8,
    padding: "10px 24px",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 3px 8px rgba(37,99,235,0.35)",
  },
  geoButtonReassurance: {
    fontSize: 11,
    color: "#6B7280",
    margin: 0,
  },
};
