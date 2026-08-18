export type FamilyProtectLang = "en" | "fr";

export type WhoProtectOption = {
  value: "parent" | "grandparent" | "partner" | "family" | "self" | "other";
  label: string;
};

export type FamilyProtectCopy = {
  metaTitle: string;
  metaDescription: string;
  headline: string;
  heroBody: string[];
  primaryCta: string;
  founderHeading: string;
  founderBody: string[];
  whyNowBody: string;
  thesisHeading: string;
  thesisBody: string[];
  earlyAccessHeading: string;
  earlyAccessBody: string[];
  earlyAccessNote: string;
  whoLabel: string;
  whoOptions: WhoProtectOption[];
  concernLabel: string;
  concernPlaceholder: string;
  firstNameLabel: string;
  firstNamePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  submitCta: string;
  consentText: string;
  successMessage: string;
  errorMessage: string;
  submittingLabel: string;
};

export const FAMILY_PROTECT_COPY: Record<FamilyProtectLang, FamilyProtectCopy> = {
  en: {
    metaTitle: "ScanScam Protect for Families — Early access",
    metaDescription:
      "Help protect someone you care about from scams. Join early access for ScanScam Protect for Families.",
    headline: "Protect the people you care about from scams.",
    heroBody: [
      "You can’t always be there when someone you care about receives a suspicious message, strange call or request for money.",
      "ScanScam Protect for Families is being designed to help them check before they click, pay or share information.",
    ],
    primaryCta: "I want to protect someone →",
    founderHeading: "Scams affect all of us. Me too.",
    founderBody: [
      "A close friend of mine was scammed. That same year, someone tried to impersonate me to a member of my family in an attempt to get money from them.",
      "That’s one of the reasons I created ScanScam.",
    ],
    whyNowBody:
      "Today, with deepfakes, cloned voices, fake profiles and AI that can sometimes be confidently wrong, it is getting harder to know what is real.",
    thesisHeading:
      "What if every attempt to deceive someone could help protect the next person targeted?",
    thesisBody: [
      "That’s the vision behind ScanScam:",
      "A privacy-first fraud protection network that learns from real-world encounters.",
    ],
    earlyAccessHeading: "We’re looking for our first families.",
    earlyAccessBody: [
      "ScanScam Protect is still in development.",
      "If you want to better protect someone you care about and help us build what comes next:",
    ],
    earlyAccessNote: "Early access. No payment required today.",
    whoLabel: "Who do you want to better protect?",
    whoOptions: [
      { value: "parent", label: "A parent" },
      { value: "grandparent", label: "A grandparent" },
      { value: "partner", label: "My partner" },
      { value: "family", label: "My family" },
      { value: "self", label: "Myself" },
      { value: "other", label: "Other" },
    ],
    concernLabel: "What worries you most about scams?",
    concernPlaceholder: "Optional — share what concerns you most",
    firstNameLabel: "First name",
    firstNamePlaceholder: "Your first name",
    emailLabel: "Your email",
    emailPlaceholder: "you@example.com",
    submitCta: "I want to protect someone →",
    consentText:
      "By signing up, you agree that ScanScam may contact you about the pilot and ask for your feedback on what we are building.",
    successMessage:
      "Thank you. You’re on the early-access list — we’ll be in touch.",
    errorMessage: "Something went wrong. Please try again.",
    submittingLabel: "Sending…",
  },
  fr: {
    metaTitle: "ScanScam Protect pour les familles — Accès anticipé",
    metaDescription:
      "Aidez à protéger quelqu’un que vous aimez contre les arnaques. Rejoignez l’accès anticipé de ScanScam Protect pour les familles.",
    headline: "Protégez les gens que vous aimez contre les arnaques.",
    heroBody: [
      "Vous ne pouvez pas toujours être là lorsqu’un proche reçoit un message douteux, un appel étrange ou une demande d’argent.",
      "ScanScam Protect pour les familles veut les aider à vérifier avant de cliquer, payer ou partager de l’information.",
    ],
    primaryCta: "Je veux mieux protéger quelqu’un →",
    founderHeading: "Les arnaques nous touchent tous. Moi aussi.",
    founderBody: [
      "Une amie proche s’est fait arnaquer. La même année, quelqu’un a essayé de se faire passer pour moi auprès d’un membre de ma famille pour lui soutirer de l’argent.",
      "C’est une des raisons pour lesquelles j’ai créé ScanScam.",
    ],
    whyNowBody:
      "Aujourd’hui, avec les deepfakes, les voix clonées, les faux profils et l’IA qui peut parfois se tromper avec assurance, il devient de plus en plus difficile de savoir ce qui est vrai.",
    thesisHeading:
      "Et si chaque tentative de tromperie pouvait aider à mieux protéger la prochaine personne ciblée?",
    thesisBody: [
      "C’est la vision derrière ScanScam:",
      "Un réseau de protection contre la fraude, respectueux de la vie privée, qui apprend de situations réelles.",
    ],
    earlyAccessHeading: "Nous cherchons nos premières familles.",
    earlyAccessBody: [
      "ScanScam Protect est encore en développement.",
      "Si vous voulez mieux protéger un proche et nous aider à construire la suite:",
    ],
    earlyAccessNote: "Accès anticipé. Aucun paiement demandé aujourd’hui.",
    whoLabel: "Qui voulez-vous mieux protéger?",
    whoOptions: [
      { value: "parent", label: "Un parent" },
      { value: "grandparent", label: "Un grand-parent" },
      { value: "partner", label: "Mon conjoint / ma conjointe" },
      { value: "family", label: "Ma famille" },
      { value: "self", label: "Moi-même" },
      { value: "other", label: "Autre" },
    ],
    concernLabel: "Qu’est-ce qui vous inquiète le plus concernant les arnaques?",
    concernPlaceholder: "Facultatif — partagez ce qui vous inquiète le plus",
    firstNameLabel: "Prénom",
    firstNamePlaceholder: "Votre prénom",
    emailLabel: "Votre courriel",
    emailPlaceholder: "vous@exemple.com",
    submitCta: "Je veux mieux protéger quelqu’un →",
    consentText:
      "En vous inscrivant, vous acceptez que ScanScam puisse vous contacter au sujet du projet pilote et vous demander votre avis sur ce que nous construisons.",
    successMessage:
      "Merci. Vous êtes sur la liste d’accès anticipé — nous vous écrirons.",
    errorMessage: "Une erreur s’est produite. Veuillez réessayer.",
    submittingLabel: "Envoi…",
  },
};
