export type Lang = "en" | "fr";
export type EntryMode = "scan" | "lived" | "helping" | "learn";

export type JourneyScene = {
  key: string;
  image:
    | "pressure"
    | "emotion"
    | "ledger"
    | "community"
    | "ordinary-day"
    | "borrowed-face"
    | "narrowing-world"
    | "mechanism"
    | "second-light";
  eyebrow: [string, string];
  title: [string, string];
  lead: [string, string];
  choices?: Array<[string, string, string]>;
  multi?: boolean;
  ownWords?: boolean;
  reflection?: [string, string];
};

export const tx = (pair: [string, string], lang: Lang) =>
  pair[lang === "en" ? 0 : 1];

export const emotionReflections: Record<string, [string, string]> = {
  shame: [
    "Shame grows in hiding. You are not alone.",
    "La honte grandit dans le silence. Vous n’êtes pas seul·e.",
  ],
  fear: [
    "The threat felt real. Your body was trying to protect you.",
    "La menace semblait réelle. Votre corps essayait de vous protéger.",
  ],
  anger: [
    "A boundary was crossed. Anger can help you act.",
    "Une limite a été franchie. La colère peut vous aider à agir.",
  ],
  hope: [
    "What you wanted was real. Someone used deception to reach it.",
    "Ce que vous désiriez était réel. Quelqu’un s’est servi de la tromperie pour l’atteindre.",
  ],
  confusion: [
    "Confusion was part of the pressure. Clarity can return one piece at a time.",
    "La confusion faisait partie de la pression. La clarté peut revenir, un morceau à la fois.",
  ],
  numbness: [
    "Distance can appear when something is too much. You can return gradually.",
    "Une distance peut apparaître quand tout devient trop lourd. Vous pouvez revenir doucement.",
  ],
};

export const scenes: JourneyScene[] = [
  {
    key: "arrival",
    image: "ordinary-day",
    eyebrow: ["Chapter one · The arrival", "Chapitre un · L’arrivée"],
    title: [
      "Where did it start?",
      "Où est-ce que ça a commencé?",
    ],
    lead: [
      "How did they reach you?",
      "Comment vous ont-ils rejoint?",
    ],
    choices: [
      ["text", "A text", "Un texto"],
      ["call", "A call", "Un appel"],
      ["email", "An email or letter", "Un courriel ou une lettre"],
      ["online", "Online", "En ligne"],
      ["unsure", "I’m not sure", "Je ne sais pas"],
    ],
    ownWords: true,
  },
  {
    key: "identity",
    image: "borrowed-face",
    eyebrow: [
      "Chapter two · The borrowed face",
      "Chapitre deux · Le visage emprunté",
    ],
    title: [
      "Who did you think it was?",
      "Qui pensiez-vous avoir devant vous?",
    ],
    lead: ["Choose the closest match.", "Choisissez ce qui s’en rapproche le plus."],
    choices: [
      ["bank", "My bank", "Ma banque"],
      ["authority", "Government or police", "Le gouvernement ou la police"],
      ["company", "A company", "Une entreprise"],
      ["known", "Someone I knew", "Une personne connue"],
      ["unsure", "I’m not sure", "Je ne sais pas"],
    ],
    reflection: [
      "Familiar does not mean verified.",
      "Familier ne veut pas dire vérifié.",
    ],
  },
  {
    key: "pressure",
    image: "narrowing-world",
    eyebrow: [
      "Chapter three · The narrowing world",
      "Chapitre trois · Le monde qui rétrécit",
    ],
    title: [
      "What created the pressure?",
      "Qu’est-ce qui a créé la pression?",
    ],
    lead: [
      "Choose what was used on you.",
      "Choisissez ce qui a été utilisé contre vous.",
    ],
    choices: [
      [
        "loss",
        "My money or account felt threatened",
        "Mon argent ou mon compte semblait menacé",
      ],
      ["now", "I had to act immediately", "Je devais agir immédiatement"],
      ["line", "They kept me on the line", "On me gardait en ligne"],
      [
        "secret",
        "I was told to keep it secret",
        "On me demandait de garder le secret",
      ],
      [
        "protect",
        "Someone seemed to need protection",
        "Quelqu’un semblait avoir besoin de protection",
      ],
      [
        "opportunity",
        "I feared losing an opportunity",
        "J’avais peur de perdre une occasion",
      ],
    ],
    multi: true,
    reflection: [
      "That pressure was part of the mechanism.",
      "Cette pression faisait partie du mécanisme.",
    ],
  },
  {
    key: "emotion",
    image: "emotion",
    eyebrow: [
      "Chapter four · Inside the person",
      "Chapitre quatre · À l’intérieur de soi",
    ],
    title: [
      "What did it leave you feeling?",
      "Qu’est-ce que ça vous a fait ressentir?",
    ],
    lead: [
      "Choose as many as you need.",
      "Choisissez-en autant qu’il le faut.",
    ],
    choices: [
      ["shame", "Shame", "Honte"],
      ["fear", "Fear", "Peur"],
      ["anger", "Anger", "Colère"],
      ["hope", "Hope", "Espoir"],
      ["confusion", "Confusion", "Confusion"],
      ["numbness", "Numbness", "Engourdissement"],
    ],
    multi: true,
    ownWords: true,
  },
  {
    key: "request",
    image: "mechanism",
    eyebrow: [
      "Chapter five · The ask",
      "Chapitre cinq · La demande",
    ],
    title: [
      "What did they want?",
      "Qu’est-ce qu’ils voulaient?",
    ],
    lead: [
      "Choose the closest answer.",
      "Choisissez la réponse la plus proche.",
    ],
    choices: [
      ["money", "Money", "De l’argent"],
      ["code", "A code or password", "Un code ou mot de passe"],
      ["device", "Access to my device", "L’accès à mon appareil"],
      ["personal", "Personal information", "Des renseignements personnels"],
      ["silence", "My silence", "Mon silence"],
      ["unsure", "I’m not sure", "Je ne sais pas"],
    ],
    multi: true,
    ownWords: true,
    reflection: [
      "This was a technique, not a character flaw.",
      "C’était une technique, pas un défaut chez vous.",
    ],
  },
  {
    key: "interruption",
    image: "second-light",
    eyebrow: [
      "Chapter six · The interruption",
      "Chapitre six · L’interruption",
    ],
    title: ["What is your next move?", "Quel est votre prochain geste?"],
    lead: [
      "Choose one. That is enough for now.",
      "Choisissez-en un. C’est suffisant pour l’instant.",
    ],
    choices: [
      ["tell", "Tell someone I trust", "En parler à une personne de confiance"],
      ["bank", "Contact my bank safely", "Contacter ma banque de façon sûre"],
      ["secure", "Secure an account", "Sécuriser un compte"],
      ["report", "Find official help", "Trouver de l’aide officielle"],
      ["unsure", "I don’t know yet", "Je ne sais pas encore"],
    ],
    multi: false,
    reflection: [
      "You have your time back.",
      "Votre temps vous appartient de nouveau.",
    ],
  },
  {
    key: "return",
    image: "community",
    eyebrow: ["Chapter seven · The return", "Chapitre sept · Le retour"],
    title: [
      "Here is what you know now.",
      "Voici ce que vous savez maintenant.",
    ],
    lead: [
      "Keep your record. Share only the pattern if you want to help others.",
      "Gardez votre registre. Partagez seulement le motif si vous voulez aider les autres.",
    ],
    choices: [
      [
        "share",
        "Light the way for someone else",
        "Éclairer le chemin de quelqu’un d’autre",
      ],
      ["private", "Keep this one private", "Garder ceci privé"],
    ],
  },
];
