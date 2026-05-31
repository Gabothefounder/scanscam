export type PostResultReportRiskTier = "low" | "medium" | "high";

export type PostResultReportTierCopy = {
  title: string;
  body: string;
};

export type PostResultReportSharedCopy = {
  buttonLabel: string;
  emailLabel: string;
  emailPlaceholder: string;
  privacyNote: string;
  panelIntro: string;
  submittingLabel: string;
  redirectingLabel: string;
  errEmail: string;
  errSubmit: string;
};

export type PostResultReportCTACopy = PostResultReportTierCopy & PostResultReportSharedCopy;

export const GUIDE_REPORT_CTA_VARIANT = "guide_report_v1" as const;

const SHARED_EN: PostResultReportSharedCopy = {
  buttonLabel: "Send me the report",
  emailLabel: "Email",
  emailPlaceholder: "Enter your email",
  privacyNote:
    "We\u2019ll send the report link and useful ScanScam updates. Don\u2019t send passwords, codes, card numbers, or private financial information.",
  panelIntro: "Enter your email to open your private next-step report.",
  submittingLabel: "Sending\u2026",
  redirectingLabel: "Opening your report\u2026",
  errEmail: "Please enter a valid email address.",
  errSubmit: "Something went wrong. Please try again.",
};

const SHARED_FR: PostResultReportSharedCopy = {
  buttonLabel: "Envoyez-moi le rapport",
  emailLabel: "Courriel",
  emailPlaceholder: "Entrez votre courriel",
  privacyNote:
    "Nous enverrons le lien du rapport et des mises \u00E0 jour utiles de ScanScam. N\u2019envoyez pas de mots de passe, codes, num\u00E9ros de carte ou renseignements financiers priv\u00E9s.",
  panelIntro: "Entrez votre courriel pour ouvrir votre rapport priv\u00E9 de prochaines \u00E9tapes.",
  submittingLabel: "Envoi en cours\u2026",
  redirectingLabel: "Ouverture de votre rapport\u2026",
  errEmail: "Veuillez entrer une adresse courriel valide.",
  errSubmit: "Une erreur s\u2019est produite. Veuillez r\u00E9essayer.",
};

const TIERS_EN: Record<PostResultReportRiskTier, PostResultReportTierCopy> = {
  high: {
    title: "This looks risky \u2014 get your free next-step report",
    body: "Get a private report with your risk summary, warning signs, and what to do next.",
  },
  medium: {
    title: "Get your free next-step report",
    body: "See what ScanScam found, what to verify, and what to do before you click, pay, or reply.",
  },
  low: {
    title: "Want a private copy of this result?",
    body: "Get a shareable Decision Report with what ScanScam checked and what could change the risk.",
  },
};

const TIERS_FR: Record<PostResultReportRiskTier, PostResultReportTierCopy> = {
  high: {
    title: "Cela semble risqu\u00E9 \u2014 obtenez votre rapport gratuit de prochaines \u00E9tapes",
    body: "Recevez un rapport priv\u00E9 avec votre r\u00E9sum\u00E9 de risque, les signaux d\u2019alerte et quoi faire ensuite.",
  },
  medium: {
    title: "Obtenez votre rapport gratuit de prochaines \u00E9tapes",
    body: "Voyez ce que ScanScam a trouv\u00E9, quoi v\u00E9rifier et quoi faire avant de cliquer, payer ou r\u00E9pondre.",
  },
  low: {
    title: "Vous voulez une copie priv\u00E9e de ce r\u00E9sultat?",
    body: "Obtenez un rapport de d\u00E9cision partageable avec ce que ScanScam a v\u00E9rifi\u00E9 et ce qui pourrait changer le risque.",
  },
};

export function getPostResultReportCTACopy(args: {
  lang: "en" | "fr";
  riskTier: PostResultReportRiskTier;
}): PostResultReportCTACopy {
  const lang = args.lang === "fr" ? "fr" : "en";
  const tier = args.riskTier;
  return {
    ...(lang === "fr" ? TIERS_FR : TIERS_EN)[tier],
    ...(lang === "fr" ? SHARED_FR : SHARED_EN),
  };
}
