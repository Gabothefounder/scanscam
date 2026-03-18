"use client";

import { useEffect, useState } from "react";
import FraudLandscapeCard from "@/app/components/charts/FraudLandscapeCard";
import { formatLandscapeLabel } from "@/app/components/charts/utils";
import { FRAUD_LABEL_FR } from "@/lib/brief";

type RiskCounts = { low: number; medium: number; high: number; total: number };

type BriefData = {
  week_start: string;
  generated_at: string;
  scan_count: number;
  top_narrative: string;
  top_narrative_raw?: string;
  top_channel: string;
  top_authority: string | null;
  top_payment_method: string | null;
  fraud_label: string;
  how_it_works: string;
  protection_tip: string;
  how_it_works_fr?: string;
  protection_tip_fr?: string;
  narratives?: { value: string; scan_count: number; share_of_week: number }[];
  channels?: { value: string; scan_count: number; share_of_week: number }[];
  risk_index?: number;
  previous_risk_index?: number | null;
  risk_index_delta?: number | null;
  risk_index_trend?: "up" | "down" | "flat" | null;
  risk_counts?: RiskCounts;
  signals_limited?: boolean;
};

function formatWeek(iso: string, locale: string): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  return d.toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", { year: "numeric", month: "long", day: "numeric" });
}

function formatGeneratedAt(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(locale === "fr" ? "fr-CA" : "en-CA", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function hasValue(s: string | null | undefined): boolean {
  const t = String(s ?? "").trim();
  return t.length > 0 && t !== "—";
}

const COPY = {
  en: {
    intro: "",
    titleLead: "Pre-fraud behavioral signals in Canada — by ScanScam",
    titleSub: "Early behavioral signals before financial loss",
    titleProvenance:
      "Weekly public signal brief based on suspicious messages submitted to ScanScam in Canada.",
    weekOf: "Week of",
    generated: "Generated",
    riskIndexLabel: "Risk Index",
    riskLow: "Low",
    riskMedium: "Medium",
    riskHigh: "High",
    riskIndexBasedOn: "",
    trendUp: "up",
    trendDown: "down",
    trendFlat: "unchanged",
    noDominant: "No single dominant pattern identified this week.",
    mostFrequent: "{fraud_label} appeared most frequently this week.",
    signalsLimited: "{fraud_label} appeared most frequently this week.",
    chartNarratives: "Distribution of signals this week",
    chartSub: "Based on submitted messages",
    fraudSignalThisWeek: "Predominant fraud this week",
    sectionWhatSeeing: "What we’re seeing",
    seeingLine1: "{fraud_label} were the most frequent this week.",
    seeingLine2: "No major surge detected this week.",
    sectionRiskIndex: "ScanScam Risk Index",
    riskIndexContext: "Overall level of suspicious activity this week",
    riskIndexSub: "Moderate activity",
    riskCaution: "Stay cautious with urgent or unexpected requests.",
    sectionHowWorks: "How this scam works",
    howItWorksSubhead: "How it works",
    howWorksLine1: "Scammers claim you’ve won a prize, refund, or reward.",
    howWorksLead: "They may ask you to:",
    howWorksBullet1: "pay a fee",
    howWorksBullet2: "share personal details",
    howWorksBullet3: "click a suspicious link",
    howWorksLine2: "They use urgency to push quick action.",
    sectionWhatKnow: "What to know",
    whatKnowBullet1: "Legitimate prizes do not require payment",
    whatKnowBullet2: "Do not share personal information",
    whatKnowBullet3: "If you didn’t enter anything → it’s likely a scam",
    sectionCta: "Check a message",
    ctaButton: "Scan a suspicious message",
    ctaSupport: "Check a message for free — help stop the next scam.",
    prefraudTitle: "For institutions and professionals",
    prefraudAudience: "",
    prefraudSummary: "For institutions and professionals",
    prefraudBullet1: "Weekly intelligence brief",
    prefraudBullet2: "Fraud radar dashboard",
    prefraudBullet3: "Emerging scam signals",
    prefraudBullet4: "Regional and hyperlocal views",
    prefraudBullet5: "Pilot collaborations (public & private)",
    prefraudContact: "Contact",
    methodology: "",
    loading: "Loading weekly brief…",
    noData: "No data available.",
  },
  fr: {
    intro: "",
    titleLead: "Signaux pré-fraude au Canada — par ScanScam",
    titleSub: "Signaux comportementaux avant toute perte financière",
    titleProvenance:
      "Bulletin hebdomadaire basé sur des messages suspects soumis à ScanScam au Canada",
    weekOf: "Semaine du",
    generated: "Généré le",
    riskIndexLabel: "Indice de risque",
    riskLow: "Faible",
    riskMedium: "Moyen",
    riskHigh: "Élevé",
    riskIndexBasedOn: "",
    trendUp: "à la hausse",
    trendDown: "en baisse",
    trendFlat: "inchangé",
    noDominant: "Aucun schéma dominant identifié cette semaine.",
    mostFrequent: "{fraud_label} est apparue le plus souvent cette semaine.",
    signalsLimited: "{fraud_label} est apparue le plus souvent cette semaine.",
    chartNarratives: "Répartition des signaux cette semaine",
    chartSub: "Selon les messages soumis",
    fraudSignalThisWeek: "Signal de fraude cette semaine",
    sectionWhatSeeing: "Ce qu’on observe",
    seeingLine1: "Les arnaques {fraud_label} sont les plus fréquentes cette semaine.",
    seeingLine2: "Aucune hausse majeure détectée cette semaine.",
    sectionRiskIndex: "Indice de risque ScanScam",
    riskIndexContext: "Niveau global d’activité suspecte cette semaine",
    riskIndexSub: "Activité modérée",
    riskCaution: "Restez prudent face aux demandes urgentes ou inattendues.",
    sectionHowWorks: "Comment cette arnaque fonctionne",
    howItWorksSubhead: "Comment fonctionne l’arnaque",
    howWorksLine1: "Les fraudeurs prétendent que vous avez gagné un prix, un remboursement ou une récompense.",
    howWorksLead: "Ils peuvent vous demander de :",
    howWorksBullet1: "payer des frais",
    howWorksBullet2: "fournir des informations personnelles",
    howWorksBullet3: "cliquer sur un lien suspect",
    howWorksLine2: "Elle utilise l’urgence pour pousser à agir rapidement.",
    sectionWhatKnow: "À savoir",
    whatKnowBullet1: "Un vrai prix ne demande pas de paiement",
    whatKnowBullet2: "Ne partagez pas d’informations personnelles",
    whatKnowBullet3: "Si vous n’avez rien demandé → c’est probablement une arnaque",
    sectionCta: "Vérifier un message",
    ctaButton: "Analyser un message suspect",
    ctaSupport: "Vérifiez un message gratuitement. Aidez à stopper la prochaine arnaque.",
    prefraudTitle: "Pour les institutions et les professionnels",
    prefraudAudience: "",
    prefraudSummary: "Pour les institutions et professionnels",
    prefraudBullet1: "Bulletin d’intelligence hebdomadaire",
    prefraudBullet2: "Tableau de bord radar fraude",
    prefraudBullet3: "Signaux de fraude émergents",
    prefraudBullet4: "Vues régionales et hyperlocales",
    prefraudBullet5: "Collaborations pilotes (public & privé)",
    prefraudContact: "Contact",
    methodology: "",
    loading: "Chargement du bulletin…",
    noData: "Aucune donnée disponible.",
  },
} as const;

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    maxWidth: 720,
    margin: "0 auto",
    padding: "28px 20px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#1a1a1a",
    backgroundColor: "#fff",
  },
  intro: {
    margin: "0 0 10px",
    fontSize: 15,
    lineHeight: 1.5,
    color: "#57606a",
  },
  header: {
    marginBottom: 22,
    paddingBottom: 12,
    borderBottom: "1px solid #e0e0e0",
  },
  title: {
    margin: "0 0 4px",
    fontSize: 20,
    fontWeight: 700,
    color: "#1a1a1a",
    letterSpacing: "-0.02em",
  },
  titleSub: {
    margin: "0 0 8px",
    fontSize: 13,
    color: "#57606a",
    lineHeight: 1.35,
  },
  titleProvenance: {
    margin: "0 0 8px",
    fontSize: 13,
    color: "#57606a",
    lineHeight: 1.35,
  },
  smallSupport: {
    margin: "6px 0 0",
    fontSize: 13,
    lineHeight: 1.35,
    color: "#57606a",
  },
  meta: {
    margin: "4px 0 0",
    fontSize: 14,
    lineHeight: 1.4,
    color: "#57606a",
  },
  section: {
    marginTop: 40,
    marginBottom: 24,
    breakInside: "avoid",
  },
  chartWrap: {
    marginTop: 4,
  },
  chartNarrow: {
    maxWidth: "70%",
    margin: "0 auto",
    padding: "10px 12px",
    border: "1px solid rgba(208,215,222,0.22)",
    borderRadius: "12px",
    backgroundColor: "rgba(246,248,250,0.45)",
  },
  chartNote: {
    margin: "8px 0 0",
    fontSize: 11,
    color: "#57606a",
    lineHeight: 1.4,
  },
  sectionTitle: {
    margin: "0 0 10px",
    fontSize: 13,
    fontWeight: 600,
    color: "#4b5563",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  sectionKicker: {
    margin: "-4px 0 10px",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#1a1a1a",
  },
  sectionBody: {
    margin: "0 0 16px",
    fontSize: 15,
    lineHeight: 1.6,
    color: "#24292f",
  },
  riskBox: {
    backgroundColor: "#f6f8fa",
    border: "1px solid rgba(208,215,222,0.9)",
    borderRadius: "12px",
    padding: "16px 18px",
    marginTop: 10,
    boxShadow: "0 10px 26px rgba(27,31,36,0.05)",
  },
  riskRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  riskIndexValue: {
    fontSize: 28,
    fontWeight: 850,
    color: "#1a1a1a",
    lineHeight: 1,
  },
  riskSubline: {
    margin: "10px 0 0",
    fontSize: 15,
    lineHeight: 1.4,
    color: "#1a1a1a",
    fontWeight: 700,
  },
  riskCaution: {
    margin: "6px 0 0",
    fontSize: 15,
    lineHeight: 1.5,
    color: "#1a1a1a",
  },
  riskBarWrap: {
    marginTop: 10,
  },
  riskBar: {
    position: "relative",
    width: "100%",
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
    background:
      "linear-gradient(90deg, rgba(35,134,54,0.85) 0%, rgba(210,153,34,0.85) 50%, rgba(218,54,51,0.85) 100%)",
    boxShadow: "inset 0 0 0 1px rgba(27,31,36,0.10), inset 0 1px 2px rgba(27,31,36,0.12)",
  },
  riskMarker: {
    position: "absolute",
    top: "50%",
    transform: "translate(-50%, -50%)",
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#0b1320",
    boxShadow: "0 0 0 2px #ffffff, 0 0 0 3px rgba(11,19,32,0.06)",
  },
  riskBarLabels: {
    marginTop: 8,
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    color: "#57606a",
  },
  riskTrend: {
    fontSize: 12,
    color: "#57606a",
  },
  riskTrendUp: { color: "#cf222e" },
  riskTrendDown: { color: "#1a7f37" },
  riskRatioBar: {
    marginTop: 8,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    display: "flex",
    width: "100%",
    maxWidth: 200,
  },
  riskRatioSegment: {
    flexShrink: 0,
    minWidth: 4,
  },
  riskCounts: {
    marginTop: 6,
    fontSize: 11,
    color: "#57606a",
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  riskIndexBasedOn: {
    marginTop: 8,
    fontSize: 11,
    color: "#6e7681",
    lineHeight: 1.35,
  },
  prefraudSummary: {
    marginTop: 8,
    fontSize: 15,
    cursor: "pointer",
    color: "#0969da",
    fontWeight: 600,
    listStyle: "none",
    paddingLeft: 0,
  },
  prefraudDetailsContent: {
    marginTop: 6,
    paddingLeft: 16,
    borderLeft: "2px solid #d0d7de",
  },
  fraudLabel: {
    margin: "4px 0 0",
    fontSize: 16,
    color: "#0969da",
    fontWeight: 600,
  },
  ctaBox: {
    backgroundColor: "#f0f6fc",
    border: "1px solid #b6d4fe",
    borderRadius: "8px",
    padding: "14px 16px",
  },
  ctaLead: {
    margin: 0,
    fontSize: 14,
    fontWeight: 600,
    color: "#1a1a1a",
  },
  ctaSupport: {
    margin: "6px 0 0",
    fontSize: 15,
    lineHeight: 1.5,
    color: "#24292f",
  },
  ctaLink: {
    display: "inline-block",
    marginTop: 10,
    fontSize: 14,
    color: "#0969da",
    fontWeight: 500,
    textDecoration: "none",
  },
  ctaButton: {
    display: "inline-block",
    marginTop: 10,
    padding: "10px 18px",
    fontSize: 14,
    fontWeight: 600,
    color: "#fff",
    backgroundColor: "#0969da",
    border: "none",
    borderRadius: "6px",
    textDecoration: "none",
    cursor: "pointer",
  },
  ctaLinkHover: { textDecoration: "underline" },
  prefraudList: {
    margin: "8px 0 0",
    paddingLeft: 20,
  },
  prefraudListItem: {
    marginBottom: 4,
    fontSize: 15,
    lineHeight: 1.5,
    color: "#24292f",
  },
  prefraudContact: {
    marginTop: 10,
    fontSize: 15,
    color: "#24292f",
  },
  prefraudContactLink: {
    color: "#0969da",
    textDecoration: "none",
  },
  simpleList: {
    margin: "10px 0 14px 18px",
    padding: 0,
  },
  simpleListItem: {
    marginBottom: 10,
    fontSize: 16,
    lineHeight: 1.65,
    color: "#24292f",
  },
  checkList: {
    margin: "10px 0 14px",
    padding: 0,
    listStyle: "none",
  },
  checkListItem: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 10,
    fontSize: 15,
    lineHeight: 1.6,
    color: "#24292f",
    fontWeight: 600,
  },
  checkMark: {
    flex: "0 0 auto",
    marginTop: 1,
    color: "#238636",
    fontWeight: 900,
  },
  prefraudLead: {
    margin: "0 0 12px",
    fontSize: 15,
    lineHeight: 1.6,
    color: "#24292f",
    fontWeight: 600,
  },
  divider: {
    margin: "20px 0 22px",
    height: 1,
    backgroundColor: "#e0e0e0",
    opacity: 0.7,
  },
  footer: {
    marginTop: 24,
    paddingTop: 12,
    borderTop: "1px solid #e0e0e0",
    fontSize: 11,
    color: "#57606a",
    lineHeight: 1.4,
  },
  loading: {
    padding: 48,
    textAlign: "center",
    color: "#57606a",
    fontSize: 14,
  },
  error: {
    padding: 48,
    textAlign: "center",
    color: "#cf222e",
    fontSize: 14,
  },
};

const MOBILE_BREAKPOINT = "640px";

const PRINT_CSS = `
@media print {
  body * { visibility: hidden; }
  .brief-weekly-print-root,
  .brief-weekly-print-root * { visibility: visible; }
  .brief-weekly-print-root {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    padding: 12px 16px !important;
    margin: 0 !important;
    max-width: none !important;
  }
  .brief-weekly-print-root .brief-weekly-header { margin-bottom: 10px; padding-bottom: 8px; }
  .brief-weekly-print-root .brief-weekly-section { margin-bottom: 12px; break-inside: avoid; }
  .brief-weekly-print-root .brief-weekly-risk-box { break-inside: avoid; }
  .brief-weekly-print-root .brief-weekly-cta-box { break-inside: avoid; }
  .brief-weekly-print-root .brief-weekly-cta-button { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .brief-weekly-print-root .brief-weekly-charts { break-inside: avoid; }
  .brief-weekly-print-root .brief-weekly-footer { margin-top: 16px; padding-top: 10px; }
  .brief-weekly-print-root details.brief-weekly-prefraud-details .brief-weekly-prefraud-details-content { display: block !important; }
}
@media (max-width: ${MOBILE_BREAKPOINT}) {
  .brief-weekly-print-root { padding-left: 12px !important; padding-right: 12px !important; }
  .brief-weekly-print-root .brief-weekly-risk-row { flex-direction: column; align-items: flex-start; gap: 6px; }
  .brief-weekly-print-root .brief-weekly-charts { min-width: 0; overflow-x: auto; }
  .brief-weekly-print-root .brief-weekly-cta-button { display: block; width: 100%; text-align: center; box-sizing: border-box; }
}
`;

type Lang = "en" | "fr";

export default function BriefWeeklyContent({ lang }: { lang: Lang }) {
  const t = COPY[lang];

  const [data, setData] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/brief/weekly", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg =
            typeof json?.error === "string"
              ? json.error
              : res.status === 502
                ? "Service temporarily unavailable"
                : "Failed to load brief";
          throw new Error(msg);
        }
        return json as BriefData;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? "Failed to load weekly brief");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div style={styles.loading}>{t.loading}</div>;
  }
  if (error) {
    return <div style={styles.error}>{error}</div>;
  }
  if (!data) {
    return <div style={styles.error}>{t.noData}</div>;
  }

  const weekLabel = data.week_start ? `${t.weekOf} ${formatWeek(data.week_start, lang)}` : "";
  const generatedLabel = data.generated_at ? `${t.generated} ${formatGeneratedAt(data.generated_at, lang)}` : "";
  /** Backend sends "Mixed fraud signals" when no usable narrative data; only then show no-dominant copy. */
  const noDominantLabel = "Mixed fraud signals";
  const hasDominant =
    hasValue(data.fraud_label) && data.fraud_label !== noDominantLabel;
  const fraudExplanationTemplate =
    hasDominant && data.fraud_label
      ? data.signals_limited
        ? t.signalsLimited
        : t.mostFrequent
      : null;
  const fraudLabelDisplay =
    lang === "fr"
      ? (FRAUD_LABEL_FR[data.fraud_label] ?? data.fraud_label)
      : data.fraud_label;

  /** For French sentence context: use "l'" + lowercase when label starts with a vowel (elision). */
  const fraudLabelInSentence =
    lang === "fr" && fraudLabelDisplay
      ? /^[aeiouàâäæéèêëîïôùûüœ]/i.test(fraudLabelDisplay.trim())
        ? "l'" + fraudLabelDisplay.trim().charAt(0).toLowerCase() + fraudLabelDisplay.trim().slice(1)
        : fraudLabelDisplay
      : fraudLabelDisplay;

  const chartItems =
    lang === "fr" && Array.isArray(data.narratives)
      ? data.narratives.map((n) => ({
          ...n,
          label: FRAUD_LABEL_FR[formatLandscapeLabel(n.value)] ?? formatLandscapeLabel(n.value),
        }))
      : data.narratives;

  const fraudExplanationContent =
    fraudExplanationTemplate != null && data.fraud_label
      ? (() => {
          const parts = fraudExplanationTemplate.split("{fraud_label}");
          const labelToBold = lang === "fr" ? fraudLabelInSentence : fraudLabelDisplay;
          return (
            <>
              {parts[0]}
              <strong>{labelToBold}</strong>
              {parts[1]}
            </>
          );
        })()
      : t.noDominant;

  const riskIndex = data.risk_index ?? 0;
  const riskCounts = data.risk_counts;
  const delta = data.risk_index_delta ?? null;
  const trend = data.risk_index_trend ?? null;
  /** Show Risk Index when we have a numeric risk_index or when we have counts (so block is always visible when backend sends risk data). */
  const showRiskSection =
    typeof data.risk_index === "number" ||
    (riskCounts != null && riskCounts.total > 0);

  const trendLabel =
    trend === "up"
      ? t.trendUp
      : trend === "down"
        ? t.trendDown
        : trend === "flat"
          ? t.trendFlat
          : null;

  const headTitle = t.titleLead;

  const trendArrow = trend === "up" ? "↑" : trend === "down" ? "↓" : trend === "flat" ? "→" : "";
  const riskIndexNum = typeof data.risk_index === "number" ? data.risk_index : null;
  const riskArrow = trendArrow;
  const riskBand =
    riskIndexNum == null ? null : riskIndexNum <= 33 ? "low" : riskIndexNum <= 66 ? "medium" : "high";
  const riskBandLabel =
    riskBand == null
      ? "—"
      : riskBand === "low"
        ? lang === "fr"
          ? "Risque faible"
          : "Low risk"
        : riskBand === "medium"
          ? lang === "fr"
            ? "Risque modéré"
            : "Moderate risk"
          : lang === "fr"
            ? "Risque élevé"
            : "High risk";

  const riskBandLabelWithTrend =
    riskBandLabel !== "—" && trendLabel
      ? `${riskBandLabel} (${trendLabel})`
      : riskBandLabel;

  const formatPredominantFraudEn = (label: string): string => {
    const t = String(label ?? "").trim();
    if (!t) return "—";
    // Avoid \"Prize Scam scams\" -> \"Prize scams\"
    if (/\bscam\b$/i.test(t)) {
      const base = t.replace(/\bscam\b/i, "").trim();
      return base ? `${base} scams` : "Scams";
    }
    // Avoid \"Phishing\" -> \"Phishing scams\" (still reads naturally)
    return `${t} scams`;
  };

  const formatPredominantFraudFr = (label: string): string => {
    const raw = String(label ?? "").trim();
    if (!raw) return "—";
    // Convert labels like "Arnaque au faux gain" into "de faux gains" for natural phrasing:
    // "Les arnaques de faux gains sont les plus fréquentes cette semaine."
    const stripped = raw
      .replace(/^Arnaque\s+au\s+/i, "")
      .replace(/^Arnaque\s+à\s+la\s+/i, "")
      .replace(/^Arnaque\s+aux\s+/i, "")
      .replace(/^Arnaque\s+à\s+l[’']/i, "");
    const base = stripped.trim();
    if (!base) return raw;
    const lower = base.charAt(0).toLowerCase() + base.slice(1);
    const needsElision = /^[aeiouàâäæéèêëîïôùûüœ]/i.test(lower);
    return needsElision ? `d’${lower}` : `de ${lower}`;
  };

  const formatScamTitleFr = (label: string): string => {
    const raw = String(label ?? "").trim();
    if (!raw) return "—";
    // "Arnaque au faux gain" -> "Faux gain"
    const stripped = raw
      .replace(/^Arnaque\s+au\s+/i, "")
      .replace(/^Arnaque\s+à\s+la\s+/i, "")
      .replace(/^Arnaque\s+aux\s+/i, "")
      .replace(/^Arnaque\s+à\s+l[’']/i, "");
    const out = stripped.trim();
    return out || raw;
  };

  const scamKey = String(data.top_narrative_raw ?? "").toLowerCase().trim();
  const scamTitle =
    lang === "fr"
      ? formatScamTitleFr(fraudLabelDisplay || t.noDominant)
      : fraudLabelDisplay || t.noDominant;

  const howWorksContent = (() => {
    // Lightweight branching, same structure.
    if (scamKey === "government_impersonation") {
      return lang === "fr"
        ? {
            line1: "Les fraudeurs se font passer pour une agence gouvernementale ou fiscale.",
            bullets: ["payer des frais ou une amende", "confirmer votre identité", "cliquer sur un lien ou appeler un numéro"],
            line2: "Ils utilisent la menace ou l’urgence pour pousser à agir vite.",
          }
        : {
            line1: "Scammers impersonate a government or tax agency.",
            bullets: ["pay a fee or fine", "confirm your identity", "click a link or call a number"],
            line2: "They use pressure or urgency to force quick action.",
          };
    }
    if (scamKey === "delivery_scam") {
      return lang === "fr"
        ? {
            line1: "Les fraudeurs prétendent qu’un colis est en attente ou qu’une livraison a échoué.",
            bullets: ["payer de petits frais", "cliquer sur un lien de suivi", "entrer des informations personnelles ou de paiement"],
            line2: "Ils créent un sentiment d’urgence (redelivery, délai court).",
          }
        : {
            line1: "Scammers claim a package is waiting or delivery failed.",
            bullets: ["pay a small fee", "click a tracking link", "enter personal or payment details"],
            line2: "They create urgency (redelivery, short deadlines).",
          };
    }
    // Default (prize scam / general)
    return {
      line1: t.howWorksLine1,
      bullets: [t.howWorksBullet1, t.howWorksBullet2, t.howWorksBullet3],
      line2: t.howWorksLine2,
    };
  })();

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div style={styles.wrap} className="brief-weekly brief-weekly-print-root">
        <header style={styles.header} className="brief-weekly-header">
          <h1 style={styles.title}>{headTitle}</h1>
          <p style={styles.titleSub}>{t.titleSub}</p>
          <p style={styles.titleProvenance}>{t.titleProvenance}</p>
          {(weekLabel || generatedLabel) && (
            <p style={styles.meta}>
              {weekLabel}
              {weekLabel && generatedLabel ? ". " : ""}
              {generatedLabel}
            </p>
          )}
        </header>

        {/* 2) Risk Index (with visual bar) */}
        {showRiskSection && (
          <section style={styles.section} className="brief-weekly-section">
            <h2 style={styles.sectionTitle}>{t.sectionRiskIndex}</h2>
            <p style={styles.smallSupport}>{t.riskIndexContext}</p>
            <div style={styles.riskBox} className="brief-weekly-risk-box">
              <div style={styles.riskRow} className="brief-weekly-risk-row">
                <span style={styles.riskIndexValue}>
                  {riskIndexNum != null ? `${riskIndexNum} ${riskArrow}`.trim() : "—"}
                </span>
              </div>
              <p style={styles.riskSubline}>{riskBandLabelWithTrend}</p>
              <div style={styles.riskBarWrap} aria-hidden>
                <div style={styles.riskBar}>
                  <span
                    style={{
                      ...styles.riskMarker,
                      left: `${riskIndexNum ?? 0}%`,
                    }}
                  />
                </div>
                <div style={styles.riskBarLabels}>
                  <span>{lang === "fr" ? "Faible" : "Low"}</span>
                  <span>{lang === "fr" ? "Moyen" : "Medium"}</span>
                  <span>{lang === "fr" ? "Élevé" : "High"}</span>
                </div>
              </div>
              <p style={styles.riskCaution}>{t.riskCaution}</p>
            </div>
          </section>
        )}

        {/* 3) What we’re seeing */}
        <section style={{ ...styles.section, marginTop: 52 }} className="brief-weekly-section">
          <h2 style={styles.sectionTitle}>{t.sectionWhatSeeing}</h2>
          <p style={styles.sectionBody}>
            <strong>
              {lang === "fr"
                ? t.seeingLine1.replace("{fraud_label}", formatPredominantFraudFr(fraudLabelDisplay || "—"))
                : t.seeingLine1.replace("{fraud_label}", formatPredominantFraudEn(fraudLabelDisplay || "—"))}
            </strong>
          </p>
          <p style={styles.sectionBody}>{t.seeingLine2}</p>
        </section>

        {/* 4) Signals distribution (graph) */}
        {Array.isArray(data.narratives) && data.narratives.length > 0 && (
          <section style={styles.section} className="brief-weekly-section">
            <h2 style={styles.sectionTitle}>{t.chartNarratives}</h2>
            <p style={styles.sectionBody}>{t.chartSub}</p>
            <div style={styles.chartNarrow}>
              <div className="brief-weekly-charts" style={styles.chartWrap}>
                <FraudLandscapeCard
                  theme="light"
                  title=""
                  items={chartItems ?? []}
                  hideNumericScale
                  selectedValue={data.top_narrative_raw ?? null}
                  staticMode
                />
              </div>
            </div>
          </section>
        )}

        {/* 5) Divider */}
        <div style={styles.divider} aria-hidden />

        {/* 6) Predominant scam section (dynamic) */}
        <section style={{ ...styles.section, marginTop: 56 }} className="brief-weekly-section">
          <h2 style={styles.sectionTitle}>
            {`${scamTitle} — ${lang === "fr" ? "cette semaine" : "this week"}`.toUpperCase()}
          </h2>
          <div style={styles.sectionKicker}>{t.howItWorksSubhead}</div>
          <p style={styles.sectionBody}>{howWorksContent.line1}</p>
          <p style={styles.sectionBody}>{t.howWorksLead}</p>
          <ul style={styles.simpleList}>
            {howWorksContent.bullets.map((b: string, i: number) => (
              <li key={i} style={styles.simpleListItem}>{b}</li>
            ))}
          </ul>
          <p style={styles.sectionBody}>
            {lang === "en" && howWorksContent.line2 === COPY.en.howWorksLine2 ? (
              <strong>{howWorksContent.line2}</strong>
            ) : (
              howWorksContent.line2
            )}
          </p>
        </section>

        {/* 8) What to know */}
        <section style={styles.section} className="brief-weekly-section">
          <h2 style={styles.sectionTitle}>{t.sectionWhatKnow}</h2>
          <ul style={styles.checkList}>
            <li style={styles.checkListItem}>
              <span style={styles.checkMark} aria-hidden>✔</span>
              <span>{t.whatKnowBullet1}</span>
            </li>
            <li style={styles.checkListItem}>
              <span style={styles.checkMark} aria-hidden>✔</span>
              <span>{t.whatKnowBullet2}</span>
            </li>
            <li style={styles.checkListItem}>
              <span style={styles.checkMark} aria-hidden>✔</span>
              <span>{t.whatKnowBullet3.replace("→", "—")}</span>
            </li>
          </ul>
        </section>

        {/* 7) CTA */}
        <section style={{ ...styles.section, marginTop: 56 }} className="brief-weekly-section">
          <h2 style={styles.sectionTitle}>{t.sectionCta}</h2>
          <div style={styles.ctaBox} className="brief-weekly-cta-box">
            <a
              href={`https://scanscam.ca/?lang=${lang}`}
              style={styles.ctaButton}
              className="brief-weekly-cta-button"
            >
              {t.ctaButton}
            </a>
            <p style={styles.ctaSupport}>{t.ctaSupport}</p>
          </div>
        </section>

        {/* 8) For institutions (collapsible) */}
        <section style={{ ...styles.section, marginTop: 56 }} className="brief-weekly-section">
          <h2 style={styles.sectionTitle}>{t.prefraudTitle}</h2>
          <p style={styles.prefraudLead}>
            {lang === "fr"
              ? "Accédez à une intelligence fraude plus approfondie et à une analyse des schémas."
              : "Access deeper fraud intelligence and pattern analysis."}
          </p>
          <details className="brief-weekly-prefraud-details">
            <summary style={styles.prefraudSummary}>{t.prefraudSummary}</summary>
            <div className="brief-weekly-prefraud-details-content" style={styles.prefraudDetailsContent}>
              <ul style={styles.prefraudList}>
                <li style={styles.prefraudListItem}>{t.prefraudBullet1}</li>
                <li style={styles.prefraudListItem}>{t.prefraudBullet2}</li>
                <li style={styles.prefraudListItem}>{t.prefraudBullet3}</li>
                <li style={styles.prefraudListItem}>{t.prefraudBullet4}</li>
                <li style={styles.prefraudListItem}>{t.prefraudBullet5}</li>
              </ul>
            </div>
          </details>
          <p style={styles.prefraudContact}>
            {t.prefraudContact}:{" "}
            <a href="mailto:hello@scanscam.ca" style={styles.prefraudContactLink}>
              hello@scanscam.ca
            </a>
          </p>
        </section>

        {hasValue(t.methodology) && (
          <footer style={styles.footer} className="brief-weekly-footer">
            {t.methodology}
          </footer>
        )}
      </div>
    </>
  );
}
