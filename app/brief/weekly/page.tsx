"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
    intro: "Each week, ScanScam analyzes suspicious messages submitted by the public in Canada to identify emerging fraud patterns.",
    titleLead: "Fraud observed this week in Canada",
    weekOf: "Week of",
    generated: "Generated",
    riskIndexLabel: "Risk Index",
    riskLow: "Low",
    riskMedium: "Medium",
    riskHigh: "High",
    riskIndexBasedOn: "Based on {count} suspicious messages analyzed this week.",
    trendUp: "up",
    trendDown: "down",
    trendFlat: "unchanged",
    noDominant: "No single dominant pattern identified this week.",
    mostFrequent: "{fraud_label} appeared most frequently among messages analyzed this week.",
    signalsLimited: "Signals were limited this week, but {fraud_label} appeared most frequently among scanned messages.",
    chartNarratives: "Fraud signals observed this week",
    chartNote: "The weekly fraud signal is selected using severity weighting, not message count.",
    fraudSignalThisWeek: "Predominant fraud this week",
    sectionHow: "How the fraud works",
    sectionProtect: "How to protect yourself",
    sectionCta: "Analyze a suspicious message",
    ctaLead: "Use ScanScam to analyze suspicious messages for free.",
    ctaSupport: "Every message analyzed helps improve fraud detection and protect others from scams.",
    ctaLink: "Scan a message at scanscam.ca",
    ctaButton: "Scan a suspicious message",
    prefraudTitle: "Prefraud intelligence access",
    prefraudAudience: "Researchers, institutions, journalists, and fraud professionals can access deeper intelligence products.",
    prefraudSummary: "For researchers, media, and institutions",
    prefraudBullet1: "Professional intelligence brief",
    prefraudBullet2: "Fraud radar dashboard",
    prefraudBullet3: "Emerging scam signals",
    prefraudBullet4: "Regional and hyperlocal fraud views",
    prefraudBullet5: "Pilot collaborations for public and private partners",
    prefraudContact: "Contact",
    methodology: "This brief is generated from ScanScam scan data for the stated week. Narratives and risk are classified from message content; counts are aggregated. No personal data is included.",
    loading: "Loading weekly brief…",
    noData: "No data available.",
  },
  fr: {
    intro: "Chaque semaine, ScanScam analyse des messages suspects soumis par le public au Canada afin d'identifier les tendances émergentes de fraude.",
    titleLead: "Fraude observée cette semaine au Canada",
    weekOf: "Semaine du",
    generated: "Généré le",
    riskIndexLabel: "Indice de risque",
    riskLow: "Faible",
    riskMedium: "Moyen",
    riskHigh: "Élevé",
    riskIndexBasedOn: "D'après {count} messages suspects analysés cette semaine.",
    trendUp: "à la hausse",
    trendDown: "à la baisse",
    trendFlat: "inchangé",
    noDominant: "Aucun schéma dominant identifié cette semaine.",
    mostFrequent: "{fraud_label} est apparue le plus souvent parmi les messages analysés cette semaine.",
    signalsLimited: "Les signaux étaient limités cette semaine, mais {fraud_label} est apparue le plus souvent parmi les messages analysés.",
    chartNarratives: "Fraudes observées cette semaine",
    chartNote: "Le signal de fraude de la semaine est déterminé selon une pondération de sévérité, et non uniquement selon le nombre de messages.",
    fraudSignalThisWeek: "Signal de fraude cette semaine",
    sectionHow: "Comment fonctionne la fraude",
    sectionProtect: "Comment vous protéger",
    sectionCta: "Analyser un message suspect",
    ctaLead: "Utilisez ScanScam pour analyser gratuitement les messages suspects.",
    ctaSupport: "Chaque message analysé contribue à améliorer la détection des fraudes et à protéger les autres contre les arnaques.",
    ctaLink: "Analyser un message sur scanscam.ca",
    ctaButton: "Analyser un message suspect",
    prefraudTitle: "Accès à l'intelligence pré-fraude",
    prefraudAudience: "Les chercheurs, institutions, journalistes et professionnels de la fraude peuvent accéder à des produits d'intelligence plus détaillés.",
    prefraudSummary: "Pour les chercheurs, les médias et les institutions",
    prefraudBullet1: "Bulletin d'intelligence professionnel",
    prefraudBullet2: "Tableau de bord radar fraude",
    prefraudBullet3: "Signaux de fraude émergents",
    prefraudBullet4: "Vues régionales et hyperlocales sur la fraude",
    prefraudBullet5: "Collaborations pilotes avec partenaires publics et privés",
    prefraudContact: "Contacter",
    methodology: "Ce bulletin est généré à partir des données d'analyse ScanScam pour la semaine indiquée. Les récits et le risque sont classés à partir du contenu des messages ; les totaux sont agrégés. Aucune donnée personnelle n'est incluse.",
    loading: "Chargement du bulletin…",
    noData: "Aucune donnée disponible.",
  },
} as const;

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    maxWidth: 600,
    margin: "0 auto",
    padding: "24px 16px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#1a1a1a",
    backgroundColor: "#fff",
  },
  intro: {
    margin: "0 0 8px",
    fontSize: 13,
    lineHeight: 1.45,
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
  meta: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "#57606a",
  },
  section: {
    marginBottom: 16,
    breakInside: "avoid",
  },
  chartWrap: {
    marginTop: 4,
  },
  chartNote: {
    margin: "8px 0 0",
    fontSize: 11,
    color: "#57606a",
    lineHeight: 1.4,
  },
  sectionTitle: {
    margin: "0 0 6px",
    fontSize: 11,
    fontWeight: 600,
    color: "#57606a",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  sectionBody: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.5,
    color: "#24292f",
  },
  riskBox: {
    backgroundColor: "#f6f8fa",
    border: "1px solid #d0d7de",
    borderRadius: "8px",
    padding: "12px 14px",
    marginTop: 8,
  },
  riskRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  riskIndexValue: {
    fontSize: 24,
    fontWeight: 700,
    color: "#1a1a1a",
    lineHeight: 1,
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
    fontSize: 13,
    cursor: "pointer",
    color: "#0969da",
    fontWeight: 500,
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
    fontSize: 13,
    lineHeight: 1.45,
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
    fontSize: 14,
    lineHeight: 1.5,
    color: "#24292f",
  },
  prefraudContact: {
    marginTop: 10,
    fontSize: 14,
    color: "#24292f",
  },
  prefraudContactLink: {
    color: "#0969da",
    textDecoration: "none",
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

export default function BriefWeeklyPage() {
  const searchParams = useSearchParams();
  const lang = searchParams.get("lang") === "fr" ? "fr" : "en";
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

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div style={styles.wrap} className="brief-weekly brief-weekly-print-root">
        <p style={styles.intro}>{t.intro}</p>
        <header style={styles.header} className="brief-weekly-header">
          <h1 style={styles.title}>{t.titleLead}</h1>
          {(weekLabel || generatedLabel) && (
            <p style={styles.meta}>
              {weekLabel}
              {weekLabel && generatedLabel ? ". " : ""}
              {generatedLabel}
            </p>
          )}
        </header>

        {/* Risk Index — compact: index, trend, mini ratio bar, counts */}
        {showRiskSection && (
          <section style={styles.section} className="brief-weekly-section">
            <h2 style={styles.sectionTitle}>{t.riskIndexLabel}</h2>
            <div style={styles.riskBox} className="brief-weekly-risk-box">
              <div style={styles.riskRow} className="brief-weekly-risk-row">
                <span style={styles.riskIndexValue}>{riskIndex}</span>
                {trendLabel != null && delta != null && (
                  <span
                    style={{
                      ...styles.riskTrend,
                      ...(trend === "up" ? styles.riskTrendUp : trend === "down" ? styles.riskTrendDown : {}),
                    }}
                  >
                    {delta > 0 ? "+" : ""}
                    {delta} {trendLabel}
                  </span>
                )}
              </div>
              {riskCounts != null && riskCounts.total > 0 && (
                <>
                  <div style={styles.riskRatioBar} aria-hidden>
                    <span
                      style={{
                        ...styles.riskRatioSegment,
                        width: `${(riskCounts.low / riskCounts.total) * 100}%`,
                        backgroundColor: "#9be9a8",
                      }}
                    />
                    <span
                      style={{
                        ...styles.riskRatioSegment,
                        width: `${(riskCounts.medium / riskCounts.total) * 100}%`,
                        backgroundColor: "#f0e68c",
                      }}
                    />
                    <span
                      style={{
                        ...styles.riskRatioSegment,
                        width: `${(riskCounts.high / riskCounts.total) * 100}%`,
                        backgroundColor: "#ff7b72",
                      }}
                    />
                  </div>
                  <div style={styles.riskCounts}>
                    <span>{t.riskLow}: {Math.round((riskCounts.low / riskCounts.total) * 100)}% · {t.riskMedium}: {Math.round((riskCounts.medium / riskCounts.total) * 100)}% · {t.riskHigh}: {Math.round((riskCounts.high / riskCounts.total) * 100)}%</span>
                  </div>
                  <p style={styles.riskIndexBasedOn}>
                    {t.riskIndexBasedOn.replace("{count}", String(riskCounts.total))}
                  </p>
                </>
              )}
            </div>
          </section>
        )}

        {/* Fraud signals observed this week — chart first, then interpretation */}
        {Array.isArray(data.narratives) && data.narratives.length > 0 && (
          <section style={styles.section} className="brief-weekly-section">
            <div className="brief-weekly-charts" style={styles.chartWrap}>
              <FraudLandscapeCard
                theme="light"
                title={t.chartNarratives}
                items={chartItems ?? []}
                hideNumericScale
                selectedValue={data.top_narrative_raw ?? null}
                staticMode
              />
            </div>
            <p style={styles.chartNote}>{t.chartNote}</p>
          </section>
        )}

        {/* Fraud signal this week — selected fraud label and explanation */}
        <section style={styles.section} className="brief-weekly-section">
          <h2 style={styles.sectionTitle}>{t.fraudSignalThisWeek}</h2>
          {hasDominant && <p style={styles.fraudLabel}>{fraudLabelDisplay}</p>}
          <p style={styles.sectionBody}>{fraudExplanationContent}</p>
        </section>

        {/* How the fraud works — use French when locale is fr */}
        {(() => {
          const howText = lang === "fr" && data.how_it_works_fr ? data.how_it_works_fr : data.how_it_works;
          return hasValue(howText) ? (
            <section style={styles.section} className="brief-weekly-section">
              <h2 style={styles.sectionTitle}>{t.sectionHow}</h2>
              <p style={styles.sectionBody}>{howText}</p>
            </section>
          ) : null;
        })()}

        {/* How to protect yourself — use French when locale is fr; first sentence emphasized */}
        {(() => {
          const protectText =
            lang === "fr" && data.protection_tip_fr ? data.protection_tip_fr : data.protection_tip;
          return hasValue(protectText) ? (
            <section style={styles.section} className="brief-weekly-section">
              <h2 style={styles.sectionTitle}>{t.sectionProtect}</h2>
              <p style={styles.sectionBody}>
                {(() => {
                  const idx = protectText.indexOf(".");
                  const firstSentence = idx >= 0 ? protectText.slice(0, idx + 1) : protectText;
                  const rest = idx >= 0 ? protectText.slice(idx + 1).trim() : "";
                  return (
                    <>
                      <strong>{firstSentence}</strong>
                      {rest ? ` ${rest}` : ""}
                    </>
                  );
                })()}
              </p>
            </section>
          ) : null;
        })()}

        {/* CTA: Analyze a suspicious message — title, body, link, then support line */}
        <section style={styles.section} className="brief-weekly-section">
          <h2 style={styles.sectionTitle}>{t.sectionCta}</h2>
          <div style={styles.ctaBox} className="brief-weekly-cta-box">
            <p style={styles.ctaLead}>{t.ctaLead}</p>
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

        {/* Prefraud intelligence access — collapsible details, contact always visible */}
        <section style={styles.section} className="brief-weekly-section">
          <h2 style={styles.sectionTitle}>{t.prefraudTitle}</h2>
          <p style={styles.sectionBody}>{t.prefraudAudience}</p>
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
            {t.prefraudContact}{" "}
            <a href="mailto:hello@scanscam.ca" style={styles.prefraudContactLink}>
              hello@scanscam.ca
            </a>
          </p>
        </section>

        <footer style={styles.footer} className="brief-weekly-footer">
          {t.methodology}
        </footer>
      </div>
    </>
  );
}
