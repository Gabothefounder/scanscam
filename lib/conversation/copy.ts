export type ConversationLang = "en" | "fr";

export type AudienceItem = {
  title: string;
  body: string;
};

export type ConversationCopy = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  headline: string;
  heroLead: string;
  trustQuestion: string;
  heroAfter: string[];
  researchAskHeading: string;
  researchAskBody: string[];
  exchangeYouTitle: string;
  exchangeYouItems: string[];
  exchangeMeTitle: string;
  exchangeMeItems: string[];
  primaryCta: string;
  ctaSupport: string;
  secondaryLabel: string;
  secondaryEmail: string;
  visionLabel: string;
  visionHeading: string;
  visionBody: string[];
  visionCalloutLead: string;
  visionCalloutFollow: string;
  audienceHeading: string;
  audienceItems: AudienceItem[];
  finalHeading: string;
  finalBody: string;
  finalCta: string;
  finalSecondary: string;
  bookingUrl: string;
  emailHref: string;
};

export const CONVERSATION_COPY: Record<ConversationLang, ConversationCopy> = {
  en: {
    metaTitle: "ScanScam — Conversations on trust and fraud",
    metaDescription:
      "Customer discovery: 30 minutes to compare what you see in fraud with what ScanScam is learning from 1,350+ real-world checks.",
    eyebrow: "SCANSCAM — CUSTOMER DISCOVERY",
    headline: "Scams are breaking trust.",
    heroLead: "I built ScanScam to help people answer one simple question:",
    trustQuestion: "Can I trust this?",
    heroAfter: [
      "After 1,350+ real-world checks, I discovered something I didn't expect.",
      "Those moments of doubt can reveal how scams manipulate people, what they ask them to do, and what happens before money is lost.",
      "And that may be useful far beyond the scanner.",
    ],
    researchAskHeading: "I'm looking for 20 people who see this problem up close.",
    researchAskBody: [
      "If you work in fraud, banking, payments, cybersecurity, managed IT, insurance, telecom, or customer protection, I want to understand how scams show up in your world today.",
      "In 30 minutes, let's compare what you see with what ScanScam is starting to see.",
    ],
    exchangeYouTitle: "You show me your reality.",
    exchangeYouItems: [
      "What wastes your team's time?",
      "What do you discover too late?",
      "What are customers asking you?",
      "What information do you wish you had earlier?",
    ],
    exchangeMeTitle: "I'll show you what we're learning.",
    exchangeMeItems: [
      "Patterns from 1,350+ real-world checks",
      "What people are being asked to click, pay, believe or disclose",
      "The early intelligence thesis behind ScanScam",
      "Where this could become useful to organizations like yours",
    ],
    primaryCta: "Book 30 minutes with me →",
    ctaSupport:
      "No sales pitch. I'm trying to find the problem worth solving before I build more of the solution.",
    secondaryLabel: "Prefer email?",
    secondaryEmail: "hello@scanscam.ca",
    visionLabel: "THE BIGGER IDEA",
    visionHeading:
      "What if every scam we encounter could help protect whoever gets targeted next?",
    visionBody: [
      "That's the thesis behind ScanScam.",
      "A privacy-first fraud network that learns from real-world scam encounters — so useful signals discovered in one situation can help make future decisions safer.",
      "The same trust problem may become even more important as deepfakes, impersonation, cloned voices and AI-generated identities become easier to create — and as AI agents increasingly communicate and act on our behalf.",
    ],
    visionCalloutLead: "The vision is ambitious. The next step is not.",
    visionCalloutFollow: "I first need to understand where this creates real value.",
    audienceHeading: "I'm exploring where ScanScam could help most.",
    audienceItems: [
      {
        title: "Banks & fraud teams",
        body: "See manipulation and scam context earlier.",
      },
      {
        title: "MSPs & security providers",
        body: "Handle scam questions faster and explore new protection services.",
      },
      {
        title: "Organizations protecting customers",
        body: "Identify recurring and emerging scam patterns.",
      },
      {
        title: "Consumers & families",
        body: "Make safer decisions before clicking, paying or sharing information.",
      },
    ],
    finalHeading: "Do you see this problem in your work?",
    finalBody: "I'd like to understand how it works in your organization.",
    finalCta: "Join one of the 20 conversations →",
    finalSecondary: "Email me directly → hello@scanscam.ca",
    bookingUrl: "https://calendar.app.google/jHcoWuZWKB8NTrXz6",
    emailHref: "mailto:hello@scanscam.ca",
  },
  fr: {
    metaTitle: "ScanScam — Conversations sur la confiance et la fraude",
    metaDescription:
      "Découverte client: 30 minutes pour comparer ce que vous voyez en fraude avec ce que ScanScam apprend de plus de 1 350 vérifications réelles.",
    eyebrow: "SCANSCAM — JE CHERCHE À COMPRENDRE VOTRE RÉALITÉ",
    headline: "Les arnaques brisent la confiance.",
    heroLead: "J'ai créé ScanScam pour aider les gens à répondre à une question simple:",
    trustQuestion: "Est-ce que je peux faire confiance à ça?",
    heroAfter: [
      "Après plus de 1 350 vérifications réelles, j'ai découvert quelque chose que je n'avais pas prévu.",
      "Ces moments de doute peuvent nous montrer comment les arnaques manipulent les gens, ce qu'elles leur demandent de faire et ce qui se passe avant que l'argent soit perdu.",
      "Et ça pourrait être utile bien au-delà du scanner.",
    ],
    researchAskHeading:
      "Je cherche 20 personnes qui voient ce problème de près.",
    researchAskBody: [
      "Si vous travaillez en fraude, banque, paiements, cybersécurité, services TI, assurance, télécom ou protection des clients, j'aimerais comprendre comment les arnaques se présentent chez vous aujourd'hui.",
      "En 30 minutes, comparons ce que vous voyez avec ce que ScanScam commence à voir.",
    ],
    exchangeYouTitle: "Vous me montrez votre réalité.",
    exchangeYouItems: [
      "Qu'est-ce qui fait perdre du temps à votre équipe?",
      "Qu'est-ce que vous découvrez trop tard?",
      "Qu'est-ce que vos clients vous demandent?",
      "Quelle information aimeriez-vous avoir plus tôt?",
    ],
    exchangeMeTitle: "Je vous montre ce qu'on commence à apprendre.",
    exchangeMeItems: [
      "Des tendances tirées de plus de 1 350 vérifications réelles",
      "Ce qu'on demande aux gens de cliquer, payer, croire ou partager",
      "La thèse d'intelligence derrière ScanScam",
      "Où ça pourrait devenir vraiment utile pour une organisation comme la vôtre",
    ],
    primaryCta: "Réserver 30 minutes avec moi →",
    ctaSupport:
      "Pas de pitch de vente. Je veux trouver le problème qui mérite vraiment d'être résolu avant de construire la suite.",
    secondaryLabel: "Vous préférez m'écrire?",
    secondaryEmail: "hello@scanscam.ca",
    visionLabel: "L'IDÉE PLUS GRANDE",
    visionHeading:
      "Et si chaque arnaque rencontrée pouvait aider à mieux protéger la prochaine personne ciblée?",
    visionBody: [
      "C'est la thèse derrière ScanScam.",
      "Un réseau contre la fraude, respectueux de la vie privée, qui apprend de situations réelles — pour que les signaux découverts aujourd'hui puissent aider à prendre de meilleures décisions demain.",
      "Cette question de confiance risque de devenir encore plus importante avec les deepfakes, l'usurpation d'identité, les voix clonées et les fausses identités générées par IA — et bientôt avec des agents d'IA qui communiqueront et agiront en notre nom.",
    ],
    visionCalloutLead: "La vision est ambitieuse. La prochaine étape est simple.",
    visionCalloutFollow:
      "Je dois d'abord comprendre où ScanScam peut créer une vraie valeur.",
    audienceHeading:
      "J'essaie de comprendre où ScanScam pourrait être le plus utile.",
    audienceItems: [
      {
        title: "Banques et équipes fraude",
        body: "Voir plus tôt la manipulation et le contexte entourant une arnaque.",
      },
      {
        title: "MSP et équipes TI/sécurité",
        body: "Traiter plus rapidement les questions liées aux arnaques et explorer de nouveaux services de protection.",
      },
      {
        title: "Organisations qui protègent leurs clients",
        body: "Mieux repérer les tendances et les nouvelles formes d'arnaques.",
      },
      {
        title: "Consommateurs et familles",
        body: "Prendre de meilleures décisions avant de cliquer, payer ou partager de l'information.",
      },
    ],
    finalHeading: "Vous voyez ce problème dans votre travail?",
    finalBody: "J'aimerais comprendre comment ça fonctionne chez vous.",
    finalCta: "Participer à l'une des 20 conversations →",
    finalSecondary: "Écrivez-moi directement → hello@scanscam.ca",
    bookingUrl: "https://calendar.app.google/jHcoWuZWKB8NTrXz6",
    emailHref: "mailto:hello@scanscam.ca",
  },
};
