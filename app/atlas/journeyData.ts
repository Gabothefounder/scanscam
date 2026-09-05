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
      "Something entered an ordinary day.",
      "Quelque chose est entré dans une journée ordinaire.",
    ],
    lead: [
      "Where did the story first reach you?",
      "Par où l’histoire vous a-t-elle rejoint?",
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
      "It wore the face of trust.",
      "Cela portait le visage de la confiance.",
    ],
    lead: ["Who did it seem to be?", "Qui semblait vous contacter?"],
    choices: [
      ["bank", "My bank", "Ma banque"],
      ["authority", "Government or police", "Le gouvernement ou la police"],
      ["company", "A company", "Une entreprise"],
      ["known", "Someone I knew", "Une personne connue"],
      ["unsure", "I’m not sure", "Je ne sais pas"],
    ],
    reflection: [
      "A familiar symbol can borrow trust. It does not prove identity.",
      "Un symbole familier peut emprunter la confiance. Il ne prouve pas l’identité.",
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
      "Then the room began to close.",
      "Puis la pièce a commencé à se refermer.",
    ],
    lead: [
      "What made it difficult to stop and check? Choose everything that feels true.",
      "Qu’est-ce qui rendait difficile le fait d’arrêter et de vérifier? Choisissez ce qui vous ressemble.",
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
      "Urgency and isolation remove the space where judgment lives. That pressure was built around you.",
      "L’urgence et l’isolement enlèvent l’espace où vit le jugement. Cette pression a été construite autour de vous.",
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
      "The pressure left a feeling behind.",
      "La pression a laissé une émotion derrière elle.",
    ],
    lead: [
      "Touch what you felt. Each one can be held without judgment.",
      "Touchez ce que vous avez ressenti. Chaque émotion peut être accueillie sans jugement.",
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
      "Now we can see what they were trying to get.",
      "Nous pouvons maintenant voir ce qu’on essayait d’obtenir.",
    ],
    lead: [
      "What were they asking from you?",
      "Qu’est-ce qu’on vous demandait?",
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
      "These techniques are practised and refined. They work because trust, fear, hope and care are human—not because you were foolish.",
      "Ces techniques sont pratiquées et raffinées. Elles fonctionnent parce que la confiance, la peur, l’espoir et la bienveillance sont humains—pas parce que vous étiez naïf·ve.",
    ],
  },
  {
    key: "interruption",
    image: "second-light",
    eyebrow: [
      "Chapter six · The interruption",
      "Chapitre six · L’interruption",
    ],
    title: ["The clock stops here.", "L’horloge s’arrête ici."],
    lead: [
      "The room is open again. Choose one small action—nothing more is required today.",
      "La pièce est ouverte de nouveau. Choisissez un petit geste—rien de plus n’est nécessaire aujourd’hui.",
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
      "You have your time back. You can verify through a number or website you find independently.",
      "Votre temps vous appartient de nouveau. Vous pouvez vérifier avec un numéro ou un site trouvé indépendamment.",
    ],
  },
  {
    key: "return",
    image: "community",
    eyebrow: ["Chapter seven · The return", "Chapitre sept · Le retour"],
    title: [
      "Your experience becomes a path.",
      "Votre expérience devient un chemin.",
    ],
    lead: [
      "Keep your private record. If you choose, let its anonymous pattern become a light for someone else.",
      "Gardez votre registre privé. Si vous le souhaitez, laissez son motif anonyme devenir une lumière pour quelqu’un d’autre.",
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
