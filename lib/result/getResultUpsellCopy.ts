export type ResultUpsellCopy = {
  headline: string;
  lead: string;
  body: string;
  note?: string;
  ctaLabel: string;
};

export function getResultUpsellCopy(args: {
  lang: "en" | "fr";
  riskTier: "low" | "medium" | "high";
  isLimitedContext: boolean;
  isLinkOnly: boolean;
}): ResultUpsellCopy {
  const lang = args.lang === "fr" ? "fr" : "en";
  const tier = args.riskTier;

  const en = {
    low: {
      headline: "Not sure what to do next?",
      lead: "This result appears low risk.",
      body: "The decision report explains what was checked, what remains unknown, and what to do next.",
    },
    medium: {
      headline: "Need a clearer next step?",
      lead: "Cautionary signals were found.",
      body: "The decision report gives you a clearer recommendation, explains what remains unknown, and shows what to do next.",
    },
    high: {
      headline: "Before you act, review the next steps",
      lead: "Stronger warning signs were found.",
      body: "The decision report explains what triggered the risk, what the message may be trying to get, and what to do now.",
    },
    cta: "Get full report",
    limitedNote: "Based on limited context. The report avoids overclaiming.",
  };

  const fr = {
    low: {
      headline: "Vous ne savez pas quoi faire ensuite?",
      lead: "Ce résultat semble faible risque.",
      body: "Le rapport de décision explique ce qui a été vérifié, ce qui reste inconnu, et quoi faire ensuite.",
    },
    medium: {
      headline: "Besoin d’une prochaine étape plus claire?",
      lead: "Des signaux de prudence ont été trouvés.",
      body: "Le rapport de décision donne une recommandation plus claire, explique ce qui reste inconnu, et montre quoi faire ensuite.",
    },
    high: {
      headline: "Avant d’agir, consultez les prochaines étapes",
      lead: "Des signaux plus sérieux ont été trouvés.",
      body: "Le rapport de décision explique ce qui a déclenché le risque, ce que le message pourrait chercher à obtenir, et quoi faire maintenant.",
    },
    cta: "Obtenir le rapport complet",
    limitedNote: "Basé sur un contexte limité. Le rapport évite de suraffirmer.",
  };

  const pack = lang === "fr" ? fr : en;
  const core = pack[tier];
  const showNote = args.isLinkOnly || args.isLimitedContext;

  return {
    headline: core.headline,
    lead: core.lead,
    body: core.body,
    ctaLabel: pack.cta,
    ...(showNote ? { note: pack.limitedNote } : {}),
  };
}
