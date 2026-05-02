import { createClient } from "@supabase/supabase-js";
import {
  parseAbuseInterpretationForSurface,
  type InterpretationSurfaceConcept,
} from "@/lib/scan-analysis/interpretationSurface";

export const dynamic = "force-dynamic";

const SUBMISSION_IMAGES_BUCKET = "submission-images";

function normalizeBucketObjectPath(stored: string, bucketId: string): string {
  let p = String(stored).trim().replace(/^\/+/, "");
  const prefix = `${bucketId}/`;
  if (p.startsWith(prefix)) {
    p = p.slice(prefix.length);
  }
  return p.replace(/^\/+/, "");
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Lang = "en" | "fr";

const copy = {
  en: {
    submission: "Submission",
    privateLink: "ScanScam — partner escalation (private review link)",
    riskTier: "Risk tier",
    submittedBy: "Submitted by",
    nameLabel: "Name",
    companyLabel: "Company",
    roleLabel: "Role",
    summary: "Summary",
    noteForIt: "Note for IT provider",
    addedContext: "Added context",
    rawMessage: "Original message",
    whyFlagged: "Why this was flagged",
    whatNext: "What to do next",
    linkIntel: "Link details",
    submittedHost: "Submitted link host",
    resolvedDest: "Resolved destination",
    webRiskLineUnsafe: "Flagged by external threat intelligence",
    webRiskLineClean: "External threat check completed: no known threats listed",
    webRiskLineError: "External threat database check failed or timed out",
    webRiskLineUnknown: "No known threats detected in external database",
    webRiskLineSkipped: "Link not checked by external database",
    confidence: "System confidence",
    image: "Image",
    submittedImageAlt: "Submitted image",
    imageLoadError: "Image could not be loaded.",
    none: "(none)",
    notStored: "Original submission text was not retained for this scan.",
    notProvided: "(not provided)",
    invalidLink: "Link expired or invalid",
    reviewTitle: "Escalation review",
    reviewSubtitle: "Use this page as the primary triage surface — full context below.",
  },
  fr: {
    submission: "Soumission",
    privateLink: "ScanScam — escalation partenaire (lien d'examen privé)",
    riskTier: "Niveau de risque",
    submittedBy: "Soumis par",
    nameLabel: "Nom",
    companyLabel: "Entreprise",
    roleLabel: "Rôle",
    summary: "Résumé",
    noteForIt: "Note pour le fournisseur TI",
    addedContext: "Contexte ajouté",
    rawMessage: "Message d'origine",
    whyFlagged: "Pourquoi cela a été signalé",
    whatNext: "Que faire ensuite",
    linkIntel: "Détails du lien",
    submittedHost: "Hôte du lien soumis",
    resolvedDest: "Destination résolue",
    webRiskLineUnsafe: "Signalé par une base de menaces externe",
    webRiskLineClean: "Vérification externe terminée : aucune menace répertoriée",
    webRiskLineError: "Échec ou délai dépassé pour la base de menaces externe",
    webRiskLineUnknown: "Aucune menace connue détectée dans la base externe",
    webRiskLineSkipped: "Lien non vérifié par la base externe",
    confidence: "Confiance du système",
    image: "Image",
    submittedImageAlt: "Image soumise",
    imageLoadError: "Impossible de charger l'image.",
    none: "(aucun)",
    notStored: "Le texte de la soumission d'origine n'a pas été conservé pour cette analyse.",
    notProvided: "(non fourni)",
    invalidLink: "Lien expiré ou invalide",
    reviewTitle: "Revue d'escalade",
    reviewSubtitle: "Utilisez cette page comme surface principale d'examen — contexte complet ci-dessous.",
  },
} as const;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

type InterpretationLine = {
  concept: InterpretationSurfaceConcept;
  text: string;
};

function buildMspInterpretationLines(
  intel: Record<string, unknown>,
  lang: Lang
): { whyLines: InterpretationLine[]; nextLines: InterpretationLine[] } {
  const parsed = parseAbuseInterpretationForSurface(intel);
  if (!parsed) return { whyLines: [], nextLines: [] };
  const whyLines: InterpretationLine[] = [];
  const nextLines: InterpretationLine[] = [];
  const line = (en: string, fr: string) => (lang === "fr" ? fr : en);
  const brand = parsed.brandClaim ? parsed.brandClaim.toUpperCase() : "claimed brand";

  for (const concept of parsed.concepts) {
    if (concept === "behaviorInfraCombo") {
      whyLines.push({
        concept,
        text: line(
          "Combines urgency with an obfuscated link — consistent with phishing delivery patterns.",
          "Combine l'urgence avec un lien obscurci — cohérent avec des schémas de distribution d'hameçonnage."
        ),
      });
    } else if (concept === "brandMismatch") {
      whyLines.push({
        concept,
        text: line(
          `Brand/domain mismatch detected: claim references ${brand} while destination is outside official domains.`,
          `Incohérence marque/domaine détectée : la revendication mentionne ${brand} alors que la destination est hors des domaines officiels.`
        ),
      });
    } else if (concept === "hiddenDestination") {
      whyLines.push({
        concept,
        text: line(
          "Destination is obscured via shortener/wrapper behavior.",
          "La destination est masquée via un lien raccourci/enveloppé."
        ),
      });
    } else if (concept === "freeHosting") {
      whyLines.push({
        concept,
        text: line(
          "Linked infrastructure uses free-hosting patterns frequently seen in disposable phishing pages.",
          "L'infrastructure liée utilise des schémas d'hébergement gratuit souvent observés dans des pages d'hameçonnage jetables."
        ),
      });
    } else if (concept === "suspiciousTld") {
      whyLines.push({
        concept,
        text: line(
          "Destination uses a high-risk domain ending atypical for official service flows.",
          "La destination utilise une terminaison de domaine à risque, atypique pour des flux de service officiels."
        ),
      });
    }
  }

  if (parsed.concepts.includes("behaviorInfraCombo") || parsed.concepts.includes("brandMismatch")) {
    nextLines.push({
      concept: "verifyOfficialChannel",
      text: line(
        "Validate through official channel and block credential/payment entry from this path.",
        "Validez via un canal officiel et bloquez toute saisie d'identifiants/paiement depuis ce chemin."
      ),
    });
  } else if (
    parsed.concepts.includes("hiddenDestination") ||
    parsed.concepts.includes("freeHosting") ||
    parsed.concepts.includes("suspiciousTld")
  ) {
    nextLines.push({
      concept: "verifyOfficialChannel",
      text: line(
        "Open official service manually and verify request provenance before any user action.",
        "Ouvrez le service officiel manuellement et vérifiez la provenance de la demande avant toute action utilisateur."
      ),
    });
  }

  return { whyLines, nextLines };
}

function userAddedContextFromIntel(intel: unknown): string | null {
  const o = asRecord(intel);
  if (!o) return null;
  const s = o.user_context_text;
  return typeof s === "string" && s.trim() ? s.trim() : null;
}

type LinkMsp = {
  primaryHost: string;
  resolvedDest: string | null;
  shortened: boolean;
  webRiskStatus: "unsafe" | "clean" | "error" | "skipped" | "unknown" | null;
};

function linkIntelForMsp(intel: unknown): LinkMsp | null {
  try {
    const o = asRecord(intel);
    if (!o) return null;
    const raw = o.link_intel;
    if (!raw || typeof raw !== "object" || (raw as { version?: unknown }).version !== 1) return null;
    const li = raw as Record<string, unknown>;
    const p = li.primary;
    if (!p || typeof p !== "object") return null;
    const pr = p as Record<string, unknown>;
    const flags =
      pr.flags && typeof pr.flags === "object" ? (pr.flags as Record<string, unknown>) : {};
    const root = typeof pr.root_domain === "string" ? pr.root_domain.trim() : "";
    const dom = typeof pr.domain === "string" ? pr.domain.trim() : "";
    const primaryHost = root || dom;
    if (!primaryHost) return null;
    const shortened = Boolean(flags.shortened);
    let resolvedDest: string | null = null;
    const exp = li.expansion;
    if (exp && typeof exp === "object" && (exp as { status?: unknown }).status === "expanded") {
      const e = exp as Record<string, unknown>;
      const fr = typeof e.final_root_domain === "string" ? e.final_root_domain.trim() : "";
      const fd = typeof e.final_domain === "string" ? e.final_domain.trim() : "";
      resolvedDest = fr || fd || null;
    }
    const wr = li.web_risk;
    let webRiskStatus: LinkMsp["webRiskStatus"] = null;
    if (wr && typeof wr === "object") {
      const st = String((wr as { status?: unknown }).status);
      if (
        st === "unsafe" ||
        st === "clean" ||
        st === "error" ||
        st === "skipped" ||
        st === "unknown"
      ) {
        webRiskStatus = st;
      }
    }
    return { primaryHost, resolvedDest, shortened, webRiskStatus };
  } catch {
    return null;
  }
}

const NARR_EN: Record<string, string> = {
  delivery_scam: "Delivery or parcel scam pattern",
  government_impersonation: "Government or tax impersonation",
  account_verification: "Account verification request",
  recovery_scam: "Funds recovery offer",
  reward_claim: "Prize or reward claim",
  law_enforcement: "Law enforcement impersonation",
  employment_scam: "Employment scam pattern",
  social_engineering_opener: "Unexpected contact or trust-building opener",
  investment_fraud: "Investment fraud pattern",
  financial_phishing: "Financial phishing pattern",
  romance_scam: "Romance scam pattern",
  tech_support: "Tech support scam pattern",
  prize_scam: "Prize scam pattern",
};

const NARR_FR: Record<string, string> = {
  delivery_scam: "Schéma d'arnaque aux colis",
  government_impersonation: "Usurpation gouvernementale ou fiscale",
  account_verification: "Demande de vérification de compte",
  recovery_scam: "Offre de récupération de fonds",
  reward_claim: "Promesse de gain ou de prix",
  law_enforcement: "Usurpation des forces de l'ordre",
  employment_scam: "Schéma d'arnaque à l'emploi",
  social_engineering_opener: "Contact inattendu ou accroche de confiance",
  investment_fraud: "Schéma de fraude à l'investissement",
  financial_phishing: "Schéma de phishing financier",
  romance_scam: "Schéma d'arnaque sentimentale",
  tech_support: "Schéma d'assistance technique",
  prize_scam: "Schéma de loterie frauduleuse",
};

const ACTION_EN: Record<string, string> = {
  pay_money: "Asks you to pay",
  click_link: "Asks you to tap or click a link",
  submit_credentials: "Asks you to log in or verify",
  call_number: "Asks you to call a number",
  reply_sms: "Asks you to reply",
  download_app: "Asks you to download an app",
};

const ACTION_FR: Record<string, string> = {
  pay_money: "Demande de paiement",
  click_link: "Demande d'ouvrir ou de cliquer un lien",
  submit_credentials: "Demande de connexion ou de vérification",
  call_number: "Demande d'appeler un numéro",
  reply_sms: "Demande de répondre",
  download_app: "Demande de télécharger une application",
};

const THREAT_EN: Record<string, string> = {
  credential_capture: "Tries to obtain login details",
  payment_extraction: "Tries to obtain a payment or fee",
  post_loss_recovery: "Sounds like a recovery scam",
  initial_lure: "Looks like an opening message or lure",
};

const THREAT_FR: Record<string, string> = {
  credential_capture: "Tente d'obtenir des identifiants",
  payment_extraction: "Tente d'obtenir un paiement ou des frais",
  post_loss_recovery: "Ressemble à une arnaque de récupération",
  initial_lure: "Ressemble à un premier contact ou une accroche",
};

const ENTITY_EN: Record<string, string> = {
  cra: "Impersonates CRA",
  service_canada: "Impersonates Service Canada",
  rcmp: "Impersonates RCMP",
  canada_post: "Impersonates Canada Post",
  wealthsimple: "Impersonates Wealthsimple",
  generic_government: "Impersonates a government agency",
  generic_financial: "Impersonates a financial institution",
  generic_courier: "Impersonates a courier or delivery service",
};

const ENTITY_FR: Record<string, string> = {
  cra: "Usurpe l'ARC",
  service_canada: "Usurpe Service Canada",
  rcmp: "Usurpe la GRC",
  canada_post: "Usurpe Postes Canada",
  wealthsimple: "Usurpe Wealthsimple",
  generic_government: "Usurpe un organisme gouvernemental",
  generic_financial: "Usurpe une institution financière",
  generic_courier: "Usurpe un service de messagerie",
};

const GUIDE_EN: Record<string, string> = {
  delivery_scam: "Verify tracking through the official carrier; do not pay through links in the message.",
  government_impersonation: "Government agencies do not demand payment or your SIN by text or email.",
  account_verification: "Do not use the link in the message — log in only through the app or site you already use.",
  recovery_scam: "Anyone promising to recover lost money for a fee is usually another scam.",
  financial_phishing: "Use the official site or app you trust instead of links in the message.",
  prize_scam: "Real prizes do not ask you to pay first.",
  reward_claim: "Real prizes do not ask you to pay first.",
  tech_support: "Real tech support will not cold-call or pop up unexpectedly.",
  romance_scam: "Be careful sending money to someone you have only met online.",
  investment_fraud: "Watch out for guaranteed returns and pressure to move fast.",
  law_enforcement: "Police do not collect fines or personal info by random text or email.",
  social_engineering_opener: "This can be a casual opener before a later ask for money or information.",
  employment_scam: "Check job offers on the company's official site.",
  unknown: "If it feels off, pause and verify through an official channel.",
};

const GUIDE_FR: Record<string, string> = {
  delivery_scam: "Vérifiez le suivi via le transporteur officiel; ne payez pas via les liens du message.",
  government_impersonation: "Les organismes publics ne demandent pas votre NAS ni un paiement par texto.",
  account_verification: "N'utilisez pas le lien du message — connectez-vous via l'appli ou le site habituel.",
  recovery_scam: "Qui promet de récupérer votre argent contre des frais est souvent une autre arnaque.",
  financial_phishing: "Utilisez le site ou l'appli officiel plutôt que les liens du message.",
  prize_scam: "Les vrais gains ne demandent pas d'avancer de l'argent.",
  reward_claim: "Les vrais gains ne demandent pas d'avancer de l'argent.",
  tech_support: "Le vrai support ne vous appelle pas au hasard.",
  romance_scam: "Méfiez-vous des demandes d'argent en ligne.",
  investment_fraud: "Méfiez-vous des rendements garantis et de la pression.",
  law_enforcement: "La police ne réclame pas d'argent par texto.",
  social_engineering_opener: "Peut être une accroche avant une demande d'argent ou d'informations.",
  employment_scam: "Vérifiez les offres sur le site officiel de l'entreprise.",
  unknown: "En cas de doute, faites une pause et vérifiez par un canal officiel.",
};

function whyFlaggedLines(intel: unknown, lang: Lang): string[] {
  const o = asRecord(intel);
  if (!o) return [];
  const narr = String(o.narrative_family ?? "");
  const entity = String(o.impersonation_entity ?? "");
  const action = String(o.requested_action ?? "");
  const threat = String(o.threat_stage ?? "");
  const narrMap = lang === "fr" ? NARR_FR : NARR_EN;
  const entMap = lang === "fr" ? ENTITY_FR : ENTITY_EN;
  const actMap = lang === "fr" ? ACTION_FR : ACTION_EN;
  const thrMap = lang === "fr" ? THREAT_FR : THREAT_EN;
  const out: string[] = [];
  if (narr && narr !== "unknown" && narrMap[narr]) out.push(narrMap[narr]);
  if (entity && entity !== "unknown" && entMap[entity]) out.push(entMap[entity]);
  if (action && action !== "unknown" && action !== "none" && actMap[action]) out.push(actMap[action]);
  if (threat && threat !== "unclear" && thrMap[threat]) out.push(thrMap[threat]);
  return out.slice(0, 5);
}

function nextStepLine(intel: unknown, lang: Lang): string | null {
  const o = asRecord(intel);
  if (!o) return null;
  const narr = String(o.narrative_family ?? "unknown");
  const g = lang === "fr" ? GUIDE_FR : GUIDE_EN;
  return g[narr] ?? g.unknown ?? null;
}

function normalizeMspSummary(
  summary: string,
  riskTier: string,
  lang: Lang,
  intel: Record<string, unknown>,
  linkMsp: LinkMsp | null
): string {
  const s = summary.trim();
  if (!s) return summary;
  const low = s.toLowerCase();
  const parsed = parseAbuseInterpretationForSurface(intel);
  const concepts = new Set(parsed?.concepts ?? []);
  const action = String(intel.requested_action ?? "");
  const threat = String(intel.threat_stage ?? "");
  const strongAction = action === "pay_money" || action === "submit_credentials";
  const urgencyOrThreat = threat === "payment_extraction" || threat === "credential_capture";
  const riskyLinkPattern =
    concepts.has("behaviorInfraCombo") ||
    concepts.has("hiddenDestination") ||
    concepts.has("brandMismatch") ||
    concepts.has("freeHosting") ||
    concepts.has("suspiciousTld") ||
    Boolean(linkMsp?.shortened);

  if (riskTier === "high" && riskyLinkPattern && (strongAction || urgencyOrThreat)) {
    return lang === "fr"
      ? "Combine l'urgence avec une demande de paiement ou d'identifiants et un modèle de lien risqué — cohérent avec des tactiques d'hameçonnage."
      : "Combines urgency with a payment or credential request and a risky link pattern — consistent with phishing delivery tactics.";
  }

  if (riskTier === "medium") {
    if (
      /potential phishing|manipulation tactics|may indicate/i.test(s) ||
      /peut indiquer|tactiques de manipulation/i.test(s)
    ) {
      return lang === "fr"
        ? "Contient un lien avec une destination non vérifiée — souvent utilisé lors des premières étapes d'hameçonnage."
        : "Contains a link with an unverified destination — often used in early-stage phishing attempts.";
    }
    if (low.includes("untrusted link pattern") || low.includes("risky link pattern")) {
      return lang === "fr"
        ? "Contient un lien avec une destination non vérifiée — souvent utilisé lors des premières étapes d'hameçonnage."
        : "Contains a link with an unverified destination — often used in early-stage phishing attempts.";
    }
  }
  return summary;
}

function confidenceLabel(intel: unknown, lang: Lang): string | null {
  const o = asRecord(intel);
  if (!o) return null;
  const c = String(o.confidence_level ?? "");
  if (!["low", "medium", "high"].includes(c)) return null;
  const labels =
    lang === "fr"
      ? { low: "faible", medium: "moyenne", high: "élevée" }
      : { low: "low", medium: "medium", high: "high" };
  return labels[c as keyof typeof labels] ?? c;
}

type PageProps = {
  params: Promise<{ token: string }> | { token: string };
  searchParams?: Promise<{ lang?: string }> | { lang?: string };
};

export default async function MspViewPage({ params, searchParams }: PageProps) {
  const tokenParams = params instanceof Promise ? await params : params;
  const query = searchParams instanceof Promise ? await searchParams : searchParams ?? {};
  const lang: Lang = query.lang === "fr" ? "fr" : "en";
  const t = copy[lang];
  const { token } = tokenParams;
  if (!token?.trim() || !UUID_RE.test(token.trim())) return renderInvalidPage(t);

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return renderInvalidPage(t);

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: access, error: accessError } = await supabase
    .from("partner_escalation_access")
    .select(
      "scan_id, client_note, raw_text, image_path, expires_at, submitted_by_name, submitted_by_company, submitted_by_role"
    )
    .eq("access_token", token.trim())
    .maybeSingle();

  if (accessError || !access) return renderInvalidPage(t);
  if (new Date(access.expires_at as string).getTime() < Date.now()) return renderInvalidPage(t);

  const { data: scan, error: scanError } = await supabase
    .from("scans")
    .select("risk_tier, summary_sentence, intel_features")
    .eq("id", access.scan_id as string)
    .maybeSingle();

  if (scanError || !scan) return renderInvalidPage(t);

  const intel = (scan as { intel_features?: unknown }).intel_features;
  const intelObj = asRecord(intel) ?? {};
  const addedContext = userAddedContextFromIntel(intel);
  const linkMsp = linkIntelForMsp(intel);
  const whyLines = whyFlaggedLines(intel, lang);
  const nextLine = nextStepLine(intel, lang);
  const interpretation = buildMspInterpretationLines(intelObj, lang);
  const usedConcepts = new Set<InterpretationSurfaceConcept>();
  const takeInterpretation = (lines: InterpretationLine[], limit: number): string[] => {
    const out: string[] = [];
    for (const l of lines) {
      if (out.length >= limit) break;
      if (usedConcepts.has(l.concept)) continue;
      usedConcepts.add(l.concept);
      out.push(l.text);
    }
    return out;
  };
  const whyInterpretationLines = takeInterpretation(interpretation.whyLines, 2);
  const nextInterpretationLines = takeInterpretation(interpretation.nextLines, 1);
  const conf = confidenceLabel(intel, lang);

  let signedImageUrl: string | null = null;
  let signErrorMessage: string | null = null;
  const imagePathRaw =
    access.image_path != null && String(access.image_path).trim() !== ""
      ? String(access.image_path).trim()
      : null;

  if (imagePathRaw) {
    const objectPath = normalizeBucketObjectPath(imagePathRaw, SUBMISSION_IMAGES_BUCKET);
    const { data: signed, error: signError } = await supabase.storage
      .from(SUBMISSION_IMAGES_BUCKET)
      .createSignedUrl(objectPath, 3600);

    if (signError) {
      signErrorMessage = signError.message;
    } else {
      signedImageUrl = signed?.signedUrl ?? null;
    }
  }

  const riskTier = String(scan.risk_tier ?? "low");
  const summaryRaw =
    scan.summary_sentence != null ? String(scan.summary_sentence) : t.none;
  const summary = normalizeMspSummary(summaryRaw, riskTier, lang, intelObj, linkMsp);
  const rawText =
    access.raw_text != null && String(access.raw_text).trim()
      ? String(access.raw_text)
      : t.notStored;
  const clientNote =
    access.client_note != null && String(access.client_note).trim()
      ? String(access.client_note)
      : t.notProvided;
  const submittedName =
    access.submitted_by_name != null && String(access.submitted_by_name).trim()
      ? String(access.submitted_by_name).trim()
      : t.notProvided;
  const submittedCompany =
    access.submitted_by_company != null && String(access.submitted_by_company).trim()
      ? String(access.submitted_by_company).trim()
      : t.notProvided;
  const submittedRole =
    access.submitted_by_role != null && String(access.submitted_by_role).trim()
      ? String(access.submitted_by_role).trim()
      : t.notProvided;

  const preStyle = {
    margin: 0,
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    fontSize: 13,
    lineHeight: 1.45,
    overflow: "auto" as const,
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#f3f4f6",
        padding: "24px 16px",
        fontFamily: "system-ui, sans-serif",
        color: "#111827",
      }}
    >
      <article
        style={{
          maxWidth: 720,
          margin: "0 auto",
          backgroundColor: "#fff",
          borderRadius: 12,
          padding: 24,
          border: "1px solid #e5e7eb",
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: "#0f172a" }}>{t.reviewTitle}</h1>
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 6px" }}>{t.privateLink}</p>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 24px", lineHeight: 1.45 }}>{t.reviewSubtitle}</p>

        <section style={{ marginBottom: 22, paddingBottom: 18, borderBottom: "1px solid #e5e7eb" }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 6px" }}>
            {t.submittedBy}
          </h2>
          <p style={{ margin: "0 0 4px", fontSize: 15, lineHeight: 1.5 }}>
            <span style={{ fontWeight: 600 }}>{t.nameLabel}:</span> {submittedName}
          </p>
          <p style={{ margin: "0 0 4px", fontSize: 15, lineHeight: 1.5 }}>
            <span style={{ fontWeight: 600 }}>{t.companyLabel}:</span> {submittedCompany}
          </p>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>
            <span style={{ fontWeight: 600 }}>{t.roleLabel}:</span> {submittedRole}
          </p>
        </section>

        <section style={{ marginBottom: 22, paddingBottom: 18, borderBottom: "1px solid #e5e7eb" }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 6px" }}>
            {t.noteForIt}
          </h2>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{clientNote}</p>
        </section>

        {addedContext ? (
          <section style={{ marginBottom: 22, paddingBottom: 18, borderBottom: "1px solid #e5e7eb" }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 6px" }}>
              {t.addedContext}
            </h2>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{addedContext}</p>
          </section>
        ) : null}

        <section style={{ marginBottom: 22, paddingBottom: 18, borderBottom: "1px solid #e5e7eb" }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 6px" }}>
            {t.rawMessage}
          </h2>
          <pre style={preStyle}>{rawText}</pre>
        </section>

        <section style={{ marginBottom: 22, paddingBottom: 18, borderBottom: "1px solid #e5e7eb" }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 6px" }}>
            {t.riskTier}
          </h2>
          <p style={{ margin: 0, fontSize: 15 }}>{riskTier}</p>
          {conf ? (
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "#4b5563" }}>
              {t.confidence}: {conf}
            </p>
          ) : null}
        </section>

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 6px" }}>
            {t.summary}
          </h2>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{summary}</p>
        </section>

        {whyLines.length > 0 || whyInterpretationLines.length > 0 ? (
          <section style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 6px" }}>
              {t.whyFlagged}
            </h2>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.45 }}>
              {whyLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
              {whyInterpretationLines.map((line, i) => (
                <li key={`interp-${i}`}>{line}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {nextLine || nextInterpretationLines.length > 0 ? (
          <section style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 6px" }}>
              {t.whatNext}
            </h2>
            {nextLine ? (
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "#374151" }}>{nextLine}</p>
            ) : null}
            {nextInterpretationLines.map((line, i) => (
              <p key={`next-interp-${i}`} style={{ margin: nextLine ? "8px 0 0" : 0, fontSize: 14, lineHeight: 1.5, color: "#374151", fontWeight: 500 }}>
                {line}
              </p>
            ))}
          </section>
        ) : null}

        {linkMsp ? (
          <section style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 6px" }}>
              {t.linkIntel}
            </h2>
            <p style={{ margin: "0 0 4px", fontSize: 14 }}>
              <span style={{ fontWeight: 600 }}>{t.submittedHost}:</span> {linkMsp.primaryHost}
            </p>
            {linkMsp.resolvedDest ? (
              <p style={{ margin: "0 0 4px", fontSize: 14 }}>
                <span style={{ fontWeight: 600 }}>{t.resolvedDest}:</span> {linkMsp.resolvedDest}
              </p>
            ) : linkMsp.shortened ? (
              <p style={{ margin: "0 0 4px", fontSize: 14, color: "#6b7280" }}>
                {lang === "fr"
                  ? "Lien raccourci : la destination n'a pas pu être résolue automatiquement."
                  : "Shortened link: destination could not be resolved automatically."}
              </p>
            ) : null}
            {linkMsp.webRiskStatus ? (
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: 14,
                  fontWeight:
                    linkMsp.webRiskStatus === "unsafe" || linkMsp.webRiskStatus === "error"
                      ? 600
                      : 400,
                  color:
                    linkMsp.webRiskStatus === "unsafe"
                      ? "#b91c1c"
                      : linkMsp.webRiskStatus === "error"
                        ? "#92400e"
                        : "#374151",
                }}
              >
                {linkMsp.webRiskStatus === "unsafe"
                  ? t.webRiskLineUnsafe
                  : linkMsp.webRiskStatus === "clean"
                    ? t.webRiskLineClean
                    : linkMsp.webRiskStatus === "error"
                      ? t.webRiskLineError
                      : linkMsp.webRiskStatus === "unknown"
                        ? t.webRiskLineUnknown
                        : t.webRiskLineSkipped}
              </p>
            ) : null}
          </section>
        ) : null}

        {signedImageUrl ? (
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 8px" }}>
              {t.image}
            </h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={signedImageUrl}
              alt={t.submittedImageAlt}
              style={{ maxWidth: "100%", height: "auto", borderRadius: 8, border: "1px solid #e5e7eb" }}
            />
          </section>
        ) : imagePathRaw ? (
          <p style={{ fontSize: 13, color: "#b45309" }}>
            {t.imageLoadError}
            {signErrorMessage ? ` (${signErrorMessage})` : ""}
          </p>
        ) : null}
      </article>
    </main>
  );
}

function renderInvalidPage(t: (typeof copy)["en"] | (typeof copy)["fr"]) {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#f3f4f6",
        padding: "24px 16px",
        fontFamily: "system-ui, sans-serif",
        color: "#111827",
      }}
    >
      <article
        style={{
          maxWidth: 720,
          margin: "0 auto",
          backgroundColor: "#fff",
          borderRadius: 12,
          padding: 24,
          border: "1px solid #e5e7eb",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>{t.invalidLink}</h1>
      </article>
    </main>
  );
}
