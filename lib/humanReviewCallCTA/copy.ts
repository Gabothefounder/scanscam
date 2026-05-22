export type HumanReviewCallRiskTier = "low" | "medium" | "high";

export type HumanReviewCallCTAVariant = {
  headline: string;
  bodyParagraphs: readonly string[];
};

export type HumanReviewCallCTAShared = {
  betaPricing: string;
  noJudgment: string;
  buttonLabel: string;
  contactEmail: string;
  mailtoSubject: string;
  mailtoBody: string;
  safetyNote: string;
};

export const HUMAN_REVIEW_CTA_VARIANT = "human_review_beta_v1" as const;

export type HumanReviewCallCTACopy = HumanReviewCallCTAVariant & HumanReviewCallCTAShared;

const SHARED_EN: HumanReviewCallCTAShared = {
  betaPricing: "Beta: $49 / one situation / short call",
  noJudgment: "No judgment. Just a second read before you act.",
  buttonLabel: "Email hello@scanscam.ca",
  contactEmail: "hello@scanscam.ca",
  mailtoSubject: "Decision Review - ScanScam",
  mailtoBody: "Short description:\n\n\nAction I feel pushed to take:\n\n",
  safetyNote:
    "Please don\u2019t send passwords, banking details, private codes, SIN/NAS, or sensitive personal information.",
};

const SHARED_FR: HumanReviewCallCTAShared = {
  betaPricing: "B\u00eata : 49 $ / une situation / appel court",
  noJudgment: "Sans jugement. Une seconde lecture avant d\u2019agir.",
  buttonLabel: "Courriel hello@scanscam.ca",
  contactEmail: "hello@scanscam.ca",
  mailtoSubject: "Revue de d\u00e9cision - ScanScam",
  mailtoBody:
    "Description courte :\n\n\nAction vers laquelle je me sens pouss\u00e9(e) :\n\n",
  safetyNote:
    "N\u2019envoyez pas de mots de passe, coordonn\u00e9es bancaires, codes priv\u00e9s, NAS ou renseignements personnels sensibles.",
};

const VARIANTS_EN: Record<HumanReviewCallRiskTier, HumanReviewCallCTAVariant> = {
  low: {
    headline: "Still unsure?",
    bodyParagraphs: [
      "This scan doesn\u2019t show strong scam signals, but if something still feels off, you can take a second look before acting.",
      "I\u2019m testing short beta calls to help people slow down, isolate the pressure, read the signals, and choose the next safer step.",
    ],
  },
  medium: {
    headline: "Still in a fog about what to do?",
    bodyParagraphs: [
      "Depending on your situation, the safest next step may be to slow down, verify through another channel, or talk it through before acting.",
      "I\u2019m testing short beta calls to help people isolate the pressure, read the signals, and choose the next safer step.",
    ],
  },
  high: {
    headline: "Before taking the next step",
    bodyParagraphs: [
      "If you already shared money, banking information, passwords, private codes, or sensitive personal information, contact your bank, platform, or the relevant authority first.",
      "If you\u2019re still unsure what to do next, I\u2019m testing short beta calls to help people slow down, isolate the pressure, read the signals, and choose the next safer step.",
    ],
  },
};

const VARIANTS_FR: Record<HumanReviewCallRiskTier, HumanReviewCallCTAVariant> = {
  low: {
    headline: "Toujours dans le doute?",
    bodyParagraphs: [
      "Ce scan ne montre pas de signaux d\u2019arnaque marqu\u00e9s, mais si quelque chose vous semble encore suspect, prenez un moment pour rev\u00e9rifier avant d\u2019agir.",
      "J\u2019essaie des appels b\u00eata courts pour aider les gens \u00e0 ralentir, isoler la pression, lire les signaux et choisir une prochaine \u00e9tape plus s\u00fbre.",
    ],
  },
  medium: {
    headline: "Perdu sur la prochaine \u00e9tape?",
    bodyParagraphs: [
      "Selon votre situation, la prochaine \u00e9tape la plus s\u00fbre peut \u00eatre de ralentir, de v\u00e9rifier par un autre canal ou d\u2019en parler avant d\u2019agir.",
      "J\u2019essaie des appels b\u00eata courts pour aider les gens \u00e0 isoler la pression, lire les signaux et choisir une prochaine \u00e9tape plus s\u00fbre.",
    ],
  },
  high: {
    headline: "Avant la prochaine \u00e9tape",
    bodyParagraphs: [
      "Si vous avez d\u00e9j\u00e0 partag\u00e9 de l\u2019argent, des renseignements bancaires, des mots de passe, des codes priv\u00e9s ou des renseignements personnels sensibles, contactez d\u2019abord votre banque, la plateforme ou l\u2019autorit\u00e9 concern\u00e9e.",
      "Si vous ne savez toujours pas quoi faire ensuite, j\u2019essaie des appels b\u00eata courts pour aider les gens \u00e0 ralentir, isoler la pression, lire les signaux et choisir une prochaine \u00e9tape plus s\u00fbre.",
    ],
  },
};

export const HUMAN_REVIEW_CALL_CTA_VARIANTS = {
  en: VARIANTS_EN,
  fr: VARIANTS_FR,
} as const;

export const HUMAN_REVIEW_CALL_CTA_SHARED = {
  en: SHARED_EN,
  fr: SHARED_FR,
} as const;

export function getHumanReviewCallCTACopy(args: {
  lang: "en" | "fr";
  riskTier: HumanReviewCallRiskTier;
}): HumanReviewCallCTACopy {
  const lang = args.lang === "fr" ? "fr" : "en";
  const tier = args.riskTier;
  return {
    ...HUMAN_REVIEW_CALL_CTA_VARIANTS[lang][tier],
    ...HUMAN_REVIEW_CALL_CTA_SHARED[lang],
  };
}

export function buildHumanReviewCallMailtoHref(copy: HumanReviewCallCTACopy): string {
  const params = new URLSearchParams({
    subject: copy.mailtoSubject,
    body: copy.mailtoBody,
  });
  return `mailto:${copy.contactEmail}?${params.toString()}`;
}
