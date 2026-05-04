export type DecisionReportSalesCopy = {
  headline: string;
  subheadline: string;
  detectedContextLine: string;
  importantLimits: string;
  trustFooter: string;
  ctaLabel: string;
};

const EN: Record<"low" | "medium" | "high", DecisionReportSalesCopy> = {
  low: {
    headline: "Understand this result more clearly",
    subheadline:
      "You already received the free scan. This result appears low risk based on the information submitted. The full report explains what ScanScam checked, what remains unknown, and what to do next if you still feel unsure.",
    detectedContextLine:
      "This result appears low risk. If the scan has limited context, the report avoids overclaiming and makes clear what ScanScam can and cannot verify.",
    importantLimits:
      "ScanScam helps you understand the result and choose a safer next step. It does not guarantee that a message is safe or fraudulent, and it is not legal, financial, or technical remediation advice. When in doubt, verify through the official source.",
    trustFooter:
      "No account required. Secure report link valid for 21 days. Guidance only — not a guarantee.",
    ctaLabel: "Unlock full report — $5",
  },
  medium: {
    headline: "Get a clearer next step",
    subheadline:
      "You already received the free scan. This scan found cautionary signals. The full report turns this result into a clearer recommendation, explains what remains unknown, and shows your next steps.",
    detectedContextLine:
      "Cautionary signals were found. If the scan has limited context, the report avoids overclaiming and makes clear what ScanScam can and cannot verify.",
    importantLimits:
      "ScanScam helps you understand the result and choose a safer next step. It does not guarantee that a message is safe or fraudulent, and it is not legal, financial, or technical remediation advice. When in doubt, verify through the official source.",
    trustFooter:
      "No account required. Secure report link valid for 21 days. Guidance only — not a guarantee.",
    ctaLabel: "Unlock full report — $5",
  },
  high: {
    headline: "Review what to do before you act",
    subheadline:
      "You already received the free scan. This scan found stronger warning signs. The full report explains what triggered the risk, what the message may be trying to get you to do, and what steps to take now.",
    detectedContextLine:
      "Stronger warning signs were found. The report explains the risk clearly while avoiding claims ScanScam cannot verify.",
    importantLimits:
      "ScanScam helps you understand the result and choose a safer next step. It does not guarantee that a message is safe or fraudulent, and it is not legal, financial, or technical remediation advice. When money, accounts, workplace systems, or personal information are involved, verify through the official source or contact the appropriate provider, support team, bank, or authority.",
    trustFooter:
      "No account required. Secure report link valid for 21 days. Guidance only — not a guarantee.",
    ctaLabel: "Unlock full report — $5",
  },
};

const FR: Record<"low" | "medium" | "high", DecisionReportSalesCopy> = {
  low: {
    headline: "Comprendre ce résultat plus clairement",
    subheadline:
      "Vous avez déjà reçu le scan gratuit. Ce résultat semble faible risque selon les informations soumises. Le rapport complet explique ce que ScanScam a vérifié, ce qui reste inconnu, et quoi faire ensuite si vous êtes encore dans le doute.",
    detectedContextLine:
      "Ce résultat semble faible risque. Si le scan repose sur un contexte limité, le rapport évite de suraffirmer et précise ce que ScanScam peut ou ne peut pas vérifier.",
    importantLimits:
      "ScanScam vous aide à comprendre le résultat et à choisir une prochaine étape plus prudente. Il ne garantit pas qu’un message est sûr ou frauduleux, et ne constitue pas un avis juridique, financier ou une intervention technique. En cas de doute, vérifiez par une source officielle.",
    trustFooter:
      "Aucun compte requis. Lien de rapport sécurisé valide pendant 21 jours. Aide à la décision — pas une garantie.",
    ctaLabel: "Débloquer le rapport complet — 5 $",
  },
  medium: {
    headline: "Obtenir une prochaine étape plus claire",
    subheadline:
      "Vous avez déjà reçu le scan gratuit. Ce scan a trouvé des signaux qui méritent prudence. Le rapport complet transforme ce résultat en recommandation plus claire, explique ce qui reste inconnu, et montre les prochaines étapes.",
    detectedContextLine:
      "Des signaux de prudence ont été trouvés. Si le scan repose sur un contexte limité, le rapport évite de suraffirmer et précise ce que ScanScam peut ou ne peut pas vérifier.",
    importantLimits:
      "ScanScam vous aide à comprendre le résultat et à choisir une prochaine étape plus prudente. Il ne garantit pas qu’un message est sûr ou frauduleux, et ne constitue pas un avis juridique, financier ou une intervention technique. En cas de doute, vérifiez par une source officielle.",
    trustFooter:
      "Aucun compte requis. Lien de rapport sécurisé valide pendant 21 jours. Aide à la décision — pas une garantie.",
    ctaLabel: "Débloquer le rapport complet — 5 $",
  },
  high: {
    headline: "Voir quoi faire avant d’agir",
    subheadline:
      "Vous avez déjà reçu le scan gratuit. Ce scan a trouvé des signaux plus sérieux. Le rapport complet explique ce qui a déclenché le risque, ce que le message pourrait chercher à vous faire faire, et quelles étapes suivre maintenant.",
    detectedContextLine:
      "Des signaux plus sérieux ont été trouvés. Le rapport explique le risque clairement tout en évitant les affirmations que ScanScam ne peut pas vérifier.",
    importantLimits:
      "ScanScam vous aide à comprendre le résultat et à choisir une prochaine étape plus prudente. Il ne garantit pas qu’un message est sûr ou frauduleux, et ne constitue pas un avis juridique, financier ou une intervention technique. Lorsque de l’argent, des comptes, des systèmes de travail ou des informations personnelles sont en jeu, vérifiez par une source officielle ou contactez le fournisseur, l’équipe support, la banque ou l’autorité appropriée.",
    trustFooter:
      "Aucun compte requis. Lien de rapport sécurisé valide pendant 21 jours. Aide à la décision — pas une garantie.",
    ctaLabel: "Débloquer le rapport complet — 5 $",
  },
};

export function getDecisionReportSalesCopy(args: {
  lang: "en" | "fr";
  riskTier: "low" | "medium" | "high";
  isLimitedContext: boolean;
  isLinkOnly: boolean;
  linkType: string;
  domainSignal: string;
}): DecisionReportSalesCopy {
  const lang = args.lang === "fr" ? "fr" : "en";
  const pack = lang === "fr" ? FR : EN;
  const tier = args.riskTier;
  const base = pack[tier];
  const limited = args.isLimitedContext || args.isLinkOnly;

  let detectedContextLine = base.detectedContextLine;
  if (tier === "low") {
    detectedContextLine = limited
      ? base.detectedContextLine
      : lang === "fr"
        ? "Ce résultat semble faible risque."
        : "This result appears low risk.";
  } else if (tier === "medium") {
    detectedContextLine = limited
      ? base.detectedContextLine
      : lang === "fr"
        ? "Des signaux de prudence ont été trouvés."
        : "Cautionary signals were found.";
  }

  void args.linkType;
  void args.domainSignal;

  return { ...base, detectedContextLine };
}
