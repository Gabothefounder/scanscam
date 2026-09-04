"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./cinematicJourney.module.css";

type Lang = "en" | "fr";
type Phase = "entry" | "journey" | "book";
type Fact =
  | "when"
  | "contact"
  | "identity"
  | "request"
  | "payment"
  | "evidence";

const copy = {
  en: {
    atlas: "Atlas of Deception",
    entry: "Something happened.",
    entry2: "Let’s find where it began.",
    entryNote: "Choose the event that feels closest. You can change it later.",
    own: "In my own words",
    ownHint: "Write anything you remember—or leave this empty.",
    next: "Continue",
    back: "Back",
    pass: "I’m not ready to answer",
    chapter: "Chapter",
    help: "Need help now?",
    second: "Second Light",
    copy: "Copy a message",
    copied: "Copied",
    open: "Open my book",
    return: "The Return",
    returnTitle: "You brought the story back into the light.",
    returnSub: "What happened is no longer sealed inside the moment.",
    story: "What I lived",
    edit: "This is yours. Change any word that does not feel right.",
    facts: "What I remember",
    factsSub: "Add only the precision you want. Every field is optional.",
    outcome: "What I choose",
    private: "Keep my private book",
    report: "Create a practical report",
    trusted: "Share with someone I trust",
    destination: "Find where to report it",
    light: "Leave an anonymous light",
    redacted: "Offer a redacted story",
    lightExplain:
      "Only the fraud family, channel, pressure patterns, approximate country, and month. Never your words, name, evidence, or exact location.",
    sendLight: "Send my anonymous light",
    sent: "Your light joined the landscape.",
    print: "Print / save my book",
    copyReport: "Copy practical report",
    reset: "Begin another journey",
    local:
      "Prototype: everything remains in this browser. Nothing is submitted or stored.",
    clear: "I remember clearly",
    unsure: "I’m not certain",
    nowTitle: "You do not need to decide yet.",
    nowText:
      "Stop contact. Do not send money, codes, or access. Reach your bank or the claimed person using a number you find independently.",
    official: "Canadian Anti-Fraud Centre",
  },
  fr: {
    atlas: "Atlas de la tromperie",
    entry: "Quelque chose s’est passé.",
    entry2: "Retrouvons le point de départ.",
    entryNote:
      "Choisissez l’événement qui s’en rapproche. Vous pourrez le changer.",
    own: "Dans mes propres mots",
    ownHint: "Écrivez ce dont vous vous souvenez—ou laissez vide.",
    next: "Continuer",
    back: "Retour",
    pass: "Je ne suis pas prêt·e à répondre",
    chapter: "Chapitre",
    help: "Besoin d’aide maintenant?",
    second: "Deuxième lumière",
    copy: "Copier un message",
    copied: "Copié",
    open: "Ouvrir mon livre",
    return: "Le retour",
    returnTitle: "Vous avez ramené votre histoire dans la lumière.",
    returnSub: "Ce qui est arrivé n’est plus enfermé dans le moment.",
    story: "Ce que j’ai vécu",
    edit: "Elle vous appartient. Changez chaque mot qui ne vous ressemble pas.",
    facts: "Ce dont je me souviens",
    factsSub:
      "Ajoutez seulement la précision désirée. Chaque champ est facultatif.",
    outcome: "Ce que je choisis",
    private: "Garder mon livre privé",
    report: "Créer un rapport pratique",
    trusted: "Partager avec une personne de confiance",
    destination: "Trouver où le signaler",
    light: "Laisser une lumière anonyme",
    redacted: "Offrir un récit caviardé",
    lightExplain:
      "Seulement la famille de fraude, le canal, les pressions, le pays approximatif et le mois. Jamais vos mots, votre nom, vos preuves ou votre position exacte.",
    sendLight: "Envoyer ma lumière anonyme",
    sent: "Votre lumière a rejoint le paysage.",
    print: "Imprimer / sauvegarder mon livre",
    copyReport: "Copier le rapport pratique",
    reset: "Commencer un autre parcours",
    local:
      "Prototype : tout reste dans ce navigateur. Rien n’est transmis ni enregistré.",
    clear: "Je m’en souviens clairement",
    unsure: "Je ne suis pas certain·e",
    nowTitle: "Vous n’avez pas à décider maintenant.",
    nowText:
      "Coupez le contact. N’envoyez ni argent, ni code, ni accès. Joignez votre banque ou la personne prétendue avec un numéro trouvé indépendamment.",
    official: "Centre antifraude du Canada",
  },
};

const events: Record<Lang, string[][]> = {
  en: [
    [
      "bank",
      "Someone claimed to be my bank or an institution",
      "Bank or institution",
    ],
    [
      "authority",
      "Someone claimed to be police or government",
      "Authority impersonation",
    ],
    ["loved", "Someone I love seemed to be in danger", "Family emergency"],
    [
      "company",
      "A company, employer, or delivery service contacted me",
      "Company impersonation",
    ],
    ["other", "Something else happened", "Unclear event"],
    ["learn", "I want to understand how this works", "Learning journey"],
  ],
  fr: [
    [
      "bank",
      "Quelqu’un prétendait être ma banque ou une institution",
      "Banque ou institution",
    ],
    [
      "authority",
      "Quelqu’un prétendait être la police ou le gouvernement",
      "Usurpation d’autorité",
    ],
    [
      "loved",
      "Une personne que j’aime semblait en danger",
      "Urgence familiale",
    ],
    [
      "company",
      "Une entreprise, un employeur ou une livraison m’a contacté",
      "Usurpation d’entreprise",
    ],
    ["other", "Quelque chose d’autre s’est passé", "Événement incertain"],
    ["learn", "Je veux comprendre comment ça fonctionne", "Parcours éducatif"],
  ],
};

const scenes = {
  en: [
    {
      title: "The arrival",
      q: "Where did it begin?",
      note: "Every deception enters through an ordinary door.",
      choices: [
        "A text or chat",
        "A phone call",
        "An email or letter",
        "A social profile or advertisement",
      ],
      result: "You noticed the entrance.",
    },
    {
      title: "The borrowed face",
      q: "Who did they appear to be?",
      note: "Trust can be borrowed before it is earned.",
      choices: [],
      result: "A familiar face is not a verified identity.",
    },
    {
      title: "The stolen clock",
      q: "What happened to time?",
      note: "Pressure steals the space where judgment lives.",
      choices: [
        "Everything became urgent",
        "I feared being too late",
        "They would not let me pause",
        "The opportunity could disappear",
      ],
      result: "The clock belongs to you again.",
    },
    {
      title: "The closed world",
      q: "What were you carrying alone?",
      note: "Naming a feeling begins to reopen the world.",
      choices: ["Shame", "Fear", "Anger", "Confusion", "Hope", "I felt numb"],
      result: "A feeling is information—not a verdict about you.",
    },
    {
      title: "The surrender gate",
      q: "What were you asked to give?",
      note: "The request reveals where the story was taking you.",
      choices: [],
      result: "Nothing must cross this gate today.",
    },
    {
      title: "The interruption",
      q: "What can you see now?",
      note: "Once the mechanism has a name, it loses some power.",
      choices: [
        "The urgency was manufactured",
        "Their identity was never verified",
        "I was separated from other opinions",
        "My care or fear was used against me",
      ],
      result: "You interrupted the pattern by looking at it.",
    },
  ],
  fr: [
    {
      title: "L’arrivée",
      q: "Où est-ce que ça a commencé?",
      note: "Chaque tromperie entre par une porte ordinaire.",
      choices: [
        "Un texto ou clavardage",
        "Un appel",
        "Un courriel ou une lettre",
        "Un profil social ou une publicité",
      ],
      result: "Vous avez reconnu l’entrée.",
    },
    {
      title: "Le visage emprunté",
      q: "Qui cette personne semblait-elle être?",
      note: "La confiance peut être empruntée avant d’être méritée.",
      choices: [],
      result: "Un visage familier n’est pas une identité vérifiée.",
    },
    {
      title: "L’horloge volée",
      q: "Qu’est-il arrivé au temps?",
      note: "La pression vole l’espace où vit le jugement.",
      choices: [
        "Tout est devenu urgent",
        "J’avais peur qu’il soit trop tard",
        "On ne me laissait pas faire une pause",
        "L’occasion pouvait disparaître",
      ],
      result: "L’horloge vous appartient de nouveau.",
    },
    {
      title: "Le monde fermé",
      q: "Qu’est-ce que vous portiez seul·e?",
      note: "Nommer une émotion commence à rouvrir le monde.",
      choices: [
        "Honte",
        "Peur",
        "Colère",
        "Confusion",
        "Espoir",
        "Je ne ressentais plus rien",
      ],
      result: "Une émotion est une information—pas un verdict sur vous.",
    },
    {
      title: "La porte du renoncement",
      q: "Qu’est-ce qu’on vous demandait de donner?",
      note: "La demande révèle où l’histoire voulait vous mener.",
      choices: [],
      result: "Rien ne doit franchir cette porte aujourd’hui.",
    },
    {
      title: "L’interruption",
      q: "Qu’est-ce que vous voyez maintenant?",
      note: "Quand le mécanisme porte un nom, il perd de son pouvoir.",
      choices: [
        "L’urgence était fabriquée",
        "L’identité n’a jamais été vérifiée",
        "J’étais séparé·e des autres opinions",
        "On a utilisé ma peur ou ma bienveillance",
      ],
      result: "Vous avez interrompu le mécanisme en le regardant.",
    },
  ],
};

const branch: Record<
  Lang,
  Record<string, { face: string[]; gate: string[] }>
> = {
  en: {
    bank: {
      face: [
        "My bank",
        "A fraud department",
        "A payment company",
        "A bank employee",
      ],
      gate: [
        "A verification code",
        "Account access",
        "A transfer",
        "Identity information",
      ],
    },
    authority: {
      face: ["Police", "Tax or government", "A court or lawyer", "A regulator"],
      gate: [
        "A fine or payment",
        "Identity information",
        "Secrecy",
        "Remote access",
      ],
    },
    loved: {
      face: [
        "A child or grandchild",
        "A partner or friend",
        "A familiar voice",
        "Someone offering help",
      ],
      gate: [
        "Money or gift cards",
        "An immediate transfer",
        "Secrecy",
        "Personal information",
      ],
    },
    company: {
      face: [
        "An employer",
        "A delivery service",
        "A marketplace seller",
        "Technical support",
      ],
      gate: [
        "A fee or payment",
        "A password or code",
        "Identity information",
        "Device access",
      ],
    },
    other: {
      face: ["A person I know", "A company", "An authority", "An expert"],
      gate: [
        "Money",
        "A password or code",
        "Identity information",
        "Access or secrecy",
      ],
    },
    learn: {
      face: [
        "A loved one",
        "A trusted institution",
        "An authority",
        "An expert",
      ],
      gate: [
        "Money",
        "A password or code",
        "Identity information",
        "Access or secrecy",
      ],
    },
  },
  fr: {
    bank: {
      face: [
        "Ma banque",
        "Un service antifraude",
        "Une société de paiement",
        "Un employé de banque",
      ],
      gate: [
        "Un code de vérification",
        "L’accès au compte",
        "Un virement",
        "Des renseignements personnels",
      ],
    },
    authority: {
      face: [
        "La police",
        "L’impôt ou le gouvernement",
        "Un tribunal ou avocat",
        "Un régulateur",
      ],
      gate: [
        "Une amende ou un paiement",
        "Des renseignements personnels",
        "Le secret",
        "Un accès à distance",
      ],
    },
    loved: {
      face: [
        "Un enfant ou petit-enfant",
        "Un partenaire ou ami",
        "Une voix familière",
        "Quelqu’un offrant son aide",
      ],
      gate: [
        "De l’argent ou des cartes-cadeaux",
        "Un virement immédiat",
        "Le secret",
        "Des renseignements personnels",
      ],
    },
    company: {
      face: [
        "Un employeur",
        "Un service de livraison",
        "Un vendeur en ligne",
        "Le soutien technique",
      ],
      gate: [
        "Des frais ou un paiement",
        "Un mot de passe ou code",
        "Des renseignements personnels",
        "L’accès à l’appareil",
      ],
    },
    other: {
      face: [
        "Une personne connue",
        "Une entreprise",
        "Une autorité",
        "Un expert",
      ],
      gate: [
        "De l’argent",
        "Un mot de passe ou code",
        "Des renseignements personnels",
        "Un accès ou le secret",
      ],
    },
    learn: {
      face: [
        "Un proche",
        "Une institution de confiance",
        "Une autorité",
        "Un expert",
      ],
      gate: [
        "De l’argent",
        "Un mot de passe ou code",
        "Des renseignements personnels",
        "Un accès ou le secret",
      ],
    },
  },
};

const learningQuestions = {
  en: [
    "Where can it arrive?",
    "Which identity might be borrowed?",
    "How is time compressed?",
    "What feelings can make the world smaller?",
    "What can be requested?",
    "What breaks the spell?",
  ],
  fr: [
    "Par où peut-elle arriver?",
    "Quelle identité peut être empruntée?",
    "Comment le temps est-il comprimé?",
    "Quelles émotions peuvent rétrécir le monde?",
    "Que peut-on demander?",
    "Qu’est-ce qui brise le charme?",
  ],
};
const people = {
  en: [
    "A friend",
    "Family",
    "A colleague",
    "A professional",
    "My bank or institution",
    "I don’t know yet",
  ],
  fr: [
    "Un·e ami·e",
    "Ma famille",
    "Un·e collègue",
    "Un professionnel",
    "Ma banque ou institution",
    "Je ne sais pas encore",
  ],
};
const factFields: Record<Lang, Array<[Fact, string, string]>> = {
  en: [
    ["when", "When", "Dates or approximate times"],
    ["contact", "Contact", "Phone, email, profile, or website"],
    ["identity", "Claimed identity", "Who they said they were"],
    ["request", "Exact request", "Their words or instructions"],
    [
      "payment",
      "Money or access",
      "Amount, method, account, or transaction reference",
    ],
    [
      "evidence",
      "Evidence preserved",
      "Messages, receipts, voicemail, or screenshots",
    ],
  ],
  fr: [
    ["when", "Quand", "Dates ou heures approximatives"],
    ["contact", "Coordonnées", "Téléphone, courriel, profil ou site"],
    ["identity", "Identité prétendue", "Qui la personne disait être"],
    ["request", "Demande exacte", "Ses mots ou instructions"],
    ["payment", "Argent ou accès", "Montant, méthode, compte ou référence"],
    [
      "evidence",
      "Traces conservées",
      "Messages, reçus, boîte vocale ou captures",
    ],
  ],
};
const sceneFiles = [
  "01-arrival",
  "02-borrowed-face",
  "03-stolen-clock",
  "04-closed-world",
  "05-surrender-gate",
  "06-interruption",
];
const glyphs = ["✉", "◐", "◷", "◎", "◇", "✦"];

export default function CinematicJourney() {
  const [lang, setLang] = useState<Lang>("en");
  const t = copy[lang];
  const [phase, setPhase] = useState<Phase>("entry");
  const [event, setEvent] = useState("");
  const [scene, setScene] = useState(0);
  const [moving, setMoving] = useState(false);
  const [reaction, setReaction] = useState("");
  const [answers, setAnswers] = useState<string[][]>(
    Array.from({ length: 6 }, () => []),
  );
  const [own, setOwn] = useState<string[]>(Array.from({ length: 6 }, () => ""));
  const [companion, setCompanion] = useState("");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(false);
  const [story, setStory] = useState("");
  const [bookPage, setBookPage] = useState(0);
  const [lightSent, setLightSent] = useState(false);
  const [facts, setFacts] = useState<Record<Fact, string>>({
    when: "",
    contact: "",
    identity: "",
    request: "",
    payment: "",
    evidence: "",
  });
  const [certainty, setCertainty] = useState<Record<Fact, string>>({
    when: "",
    contact: "",
    identity: "",
    request: "",
    payment: "",
    evidence: "",
  });
  const [outcomes, setOutcomes] = useState({
    private: true,
    report: false,
    trusted: false,
    destination: false,
    light: false,
    redacted: false,
  });

  const family = events[lang].find((x) => x[0] === event)?.[2] || "";
  const current = scenes[lang][Math.min(scene, 5)];
  const choices =
    scene === 1
      ? branch[lang][event]?.face || branch[lang].other.face
      : scene === 4
        ? branch[lang][event]?.gate || branch[lang].other.gate
        : current.choices;
  const question =
    event === "learn" ? learningQuestions[lang][scene] : current.q;
  const choose = (value: string) => {
    setAnswers((old) =>
      old.map((row, index) =>
        index === scene
          ? row.includes(value)
            ? row.filter((item) => item !== value)
            : [...row, value]
          : row,
      ),
    );
    setReaction(value);
  };
  const advance = () => {
    setMoving(true);
    window.setTimeout(() => {
      setScene((value) => value + 1);
      setReaction("");
      setMoving(false);
    }, 950);
  };
  const helpMessage =
    lang === "en"
      ? "Something happened and I’m having trouble making sense of it. I don’t need you to solve everything. Could you look at this with me?"
      : "Quelque chose s’est passé et j’ai du mal à y voir clair. Je ne te demande pas de tout régler. Peux-tu regarder ça avec moi?";
  const narrative = useMemo(() => {
    const personal = own.filter(Boolean).join(" ");
    if (lang === "en")
      return `It began as ${family || "an uncertain event"}. ${answers[0][0] ? `The first door was ${answers[0][0].toLowerCase()}.` : ""} ${answers[1][0] ? `It wore the face of ${answers[1][0].toLowerCase()}.` : ""} ${answers[2][0] ? `${answers[2][0]}.` : ""} ${answers[3].length ? `I carried ${answers[3].join(", ").toLowerCase()} through the closed world.` : ""} ${answers[4][0] ? `I was asked for ${answers[4][0].toLowerCase()}.` : ""}${personal ? `\n\nIn my own words: ${personal}` : ""}\n\nNone of this means I was foolish. The pattern was designed to compress time, borrow trust, and isolate judgment. I slowed the story down. I can pause, verify independently, and invite ${companion ? companion.toLowerCase() : "another perspective"}. My care was human. My next decision belongs to me.`;
    return `Tout a commencé par ${family ? family.toLowerCase() : "un événement incertain"}. ${answers[0][0] ? `La première porte était ${answers[0][0].toLowerCase()}.` : ""} ${answers[1][0] ? `L’histoire portait le visage de ${answers[1][0].toLowerCase()}.` : ""} ${answers[2][0] ? `${answers[2][0]}.` : ""} ${answers[3].length ? `J’ai porté ${answers[3].join(", ").toLowerCase()} dans ce monde fermé.` : ""} ${answers[4][0] ? `On me demandait ${answers[4][0].toLowerCase()}.` : ""}${personal ? `\n\nDans mes mots : ${personal}` : ""}\n\nRien de tout cela ne signifie que j’étais naïf. Le mécanisme était conçu pour comprimer le temps, emprunter la confiance et isoler le jugement. J’ai ralenti l’histoire. Je peux faire une pause, vérifier ailleurs et inviter ${companion ? companion.toLowerCase() : "un autre regard"}. Ma bienveillance était humaine. Ma prochaine décision m’appartient.`;
  }, [answers, companion, family, lang, own]);
  const report = useMemo(
    () =>
      `${t.atlas.toUpperCase()} — ${t.report.toUpperCase()}\n\n${family}\n\n${story || narrative}\n\n${factFields[
        lang
      ]
        .map(([key, label]) =>
          facts[key]
            ? `${label}: ${facts[key]}${certainty[key] ? ` (${certainty[key]})` : ""}`
            : null,
        )
        .filter(Boolean)
        .join("\n")}`,
    [certainty, facts, family, lang, narrative, story, t],
  );
  const reset = () => {
    setPhase("entry");
    setEvent("");
    setScene(0);
    setAnswers(Array.from({ length: 6 }, () => []));
    setOwn(Array.from({ length: 6 }, () => ""));
    setCompanion("");
    setStory("");
    setLightSent(false);
  };
  const pageNames = [t.story, t.facts, t.outcome];

  return (
    <main className={styles.page} data-reaction={reaction.toLowerCase()}>
      <nav>
        <Link href="/">ScanScam</Link>
        <span>{t.atlas}</span>
        <div>
          <button aria-pressed={lang === "en"} onClick={() => setLang("en")}>
            EN
          </button>
          <button aria-pressed={lang === "fr"} onClick={() => setLang("fr")}>
            FR
          </button>
        </div>
      </nav>
      {phase === "entry" && (
        <section className={styles.entry}>
          <Image
            src="/atlas/scenes/01-arrival.webp"
            alt="A luminous person at the beginning of an uncertain encounter"
            fill
            priority
            sizes="100vw"
          />
          <div className={styles.shade} />
          <article>
            <p>{t.atlas}</p>
            <h1>
              {t.entry}
              <em>{t.entry2}</em>
            </h1>
            <span>{t.entryNote}</span>
            <div>
              {events[lang].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => {
                    setEvent(id);
                    setPhase("journey");
                    setScene(0);
                  }}
                >
                  {label}
                  <i>→</i>
                </button>
              ))}
            </div>
          </article>
        </section>
      )}
      {phase === "journey" && (
        <section
          className={`${styles.stage} ${styles[`stage${scene}`]} ${moving ? styles.moving : ""}`}
        >
          <Image
            key={scene}
            src={`/atlas/scenes/${scene < 6 ? sceneFiles[scene] : "06-second-light"}.webp`}
            alt=""
            fill
            priority
            sizes="100vw"
          />
          <div className={styles.shade} />
          <div className={styles.particles}>
            {Array.from({ length: 14 }, (_, index) => (
              <i key={index} />
            ))}
          </div>
          {reaction && scene < 6 && (
            <div className={styles.reactionArt} aria-hidden="true">
              <i />
              <i />
              <span>{reaction}</span>
            </div>
          )}
          {moving && (
            <div className={styles.transitionGlyph} aria-hidden="true">
              {glyphs[scene]}
            </div>
          )}
          {scene < 6 && (
            <article className={styles.scene}>
              <header>
                <span>
                  {t.chapter} {scene + 1} / 6 · {family}
                </span>
                <p>{current.title}</p>
                <h1>{question}</h1>
                <em>{current.note}</em>
              </header>
              <div className={styles.choices}>
                {choices.map((value) => (
                  <button
                    key={value}
                    className={
                      answers[scene].includes(value) ? styles.chosen : ""
                    }
                    onClick={() => choose(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <label>
                <span>{t.own}</span>
                <textarea
                  value={own[scene]}
                  onChange={(event) =>
                    setOwn((old) =>
                      old.map((value, index) =>
                        index === scene ? event.target.value : value,
                      ),
                    )
                  }
                  placeholder={t.ownHint}
                />
              </label>
              <footer>
                <p>{reaction ? current.result : ""}</p>
                <button className={styles.quiet} onClick={advance}>
                  {t.pass}
                </button>
                <button className={styles.primary} onClick={advance}>
                  {t.next} →
                </button>
              </footer>
            </article>
          )}
          {scene === 6 && (
            <article className={`${styles.scene} ${styles.second}`}>
              <header>
                <span>{t.second}</span>
                <p>{lang === "en" ? "The world opens" : "Le monde s’ouvre"}</p>
                <h1>
                  {lang === "en"
                    ? "Who could stand beside you?"
                    : "Qui pourrait se tenir à vos côtés?"}
                </h1>
                <em>
                  {lang === "en"
                    ? "They do not need to solve everything. A second person can help you see."
                    : "Cette personne n’a pas à tout régler. Un deuxième regard peut vous aider à voir."}
                </em>
              </header>
              <div className={styles.people}>
                {people[lang].map((value) => (
                  <button
                    key={value}
                    className={companion === value ? styles.chosen : ""}
                    onClick={() => setCompanion(value)}
                  >
                    <i />
                    {value}
                  </button>
                ))}
              </div>
              {companion && (
                <blockquote>
                  “{helpMessage}”{" "}
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(helpMessage);
                      setCopied(true);
                    }}
                  >
                    {copied ? t.copied : t.copy}
                  </button>
                </blockquote>
              )}
              <button
                className={styles.primary}
                onClick={() => {
                  setStory(narrative);
                  setBookPage(0);
                  setPhase("book");
                }}
              >
                {t.open} →
              </button>
            </article>
          )}
          <button className={styles.help} onClick={() => setNow(true)}>
            {t.help}
          </button>
        </section>
      )}
      {phase === "book" && (
        <section
          className={`${styles.return} ${lightSent ? styles.lightSent : ""}`}
        >
          <Image
            src="/atlas/scenes/07-return.webp"
            alt="A communal landscape filled with lights"
            fill
            priority
            sizes="100vw"
          />
          <div className={styles.shade} />
          {lightSent && (
            <div className={styles.lightFlight}>
              <i />
              <span>{t.sent}</span>
            </div>
          )}
          <article className={styles.book}>
            <header>
              <p>{t.return}</p>
              <h1>{t.returnTitle}</h1>
              <span>{t.returnSub}</span>
              <div className={styles.bookNav}>
                {pageNames.map((name, index) => (
                  <button
                    key={name}
                    className={bookPage === index ? styles.active : ""}
                    onClick={() => setBookPage(index)}
                  >
                    <i>{index + 1}</i>
                    {name}
                  </button>
                ))}
              </div>
            </header>
            {bookPage === 0 && (
              <section className={styles.story}>
                <div>
                  <p>01 · {t.story}</p>
                  <h2>{family}</h2>
                  <span>{t.edit}</span>
                </div>
                <textarea
                  value={story}
                  onChange={(event) => setStory(event.target.value)}
                />
              </section>
            )}
            {bookPage === 1 && (
              <section className={styles.facts}>
                <header>
                  <p>02 · {t.facts}</p>
                  <h2>{t.factsSub}</h2>
                </header>
                <div>
                  {factFields[lang].map(([key, label, hint]) => (
                    <details key={key}>
                      <summary>
                        <i>{facts[key] ? "✦" : "○"}</i>
                        <span>
                          <b>{label}</b>
                          <small>{hint}</small>
                        </span>
                      </summary>
                      <textarea
                        value={facts[key]}
                        onChange={(event) =>
                          setFacts((old) => ({
                            ...old,
                            [key]: event.target.value,
                          }))
                        }
                      />
                      <fieldset>
                        <button
                          className={
                            certainty[key] === "clear" ? styles.active : ""
                          }
                          onClick={() =>
                            setCertainty((old) => ({ ...old, [key]: "clear" }))
                          }
                        >
                          {t.clear}
                        </button>
                        <button
                          className={
                            certainty[key] === "uncertain" ? styles.active : ""
                          }
                          onClick={() =>
                            setCertainty((old) => ({
                              ...old,
                              [key]: "uncertain",
                            }))
                          }
                        >
                          {t.unsure}
                        </button>
                      </fieldset>
                    </details>
                  ))}
                </div>
              </section>
            )}
            {bookPage === 2 && (
              <>
                <section className={styles.outcomes}>
                  <p>03 · {t.outcome}</p>
                  <div>
                    {Object.entries({
                      private: t.private,
                      report: t.report,
                      trusted: t.trusted,
                      destination: t.destination,
                      light: t.light,
                      redacted: t.redacted,
                    }).map(([key, label]) => (
                      <label key={key}>
                        <input
                          type="checkbox"
                          checked={outcomes[key as keyof typeof outcomes]}
                          onChange={(event) =>
                            setOutcomes((old) => ({
                              ...old,
                              [key]: event.target.checked,
                            }))
                          }
                        />
                        <i />
                        {label}
                      </label>
                    ))}
                  </div>
                  {outcomes.light && (
                    <aside>
                      <b>{t.light}</b>
                      <p>{t.lightExplain}</p>
                      <button
                        disabled={lightSent}
                        onClick={() => setLightSent(true)}
                      >
                        {lightSent ? t.sent : t.sendLight}
                      </button>
                    </aside>
                  )}
                </section>
                <section className={styles.actions}>
                  <button onClick={() => window.print()}>{t.print}</button>
                  <button onClick={() => navigator.clipboard.writeText(report)}>
                    {t.copyReport}
                  </button>
                  <button onClick={reset}>{t.reset}</button>
                </section>
                <footer>{t.local}</footer>
              </>
            )}
            <div className={styles.pageTurn}>
              <button
                disabled={bookPage === 0}
                onClick={() => setBookPage((page) => page - 1)}
              >
                ← {t.back}
              </button>
              <span>{bookPage + 1} / 3</span>
              <button
                disabled={bookPage === 2}
                onClick={() => setBookPage((page) => page + 1)}
              >
                {t.next} →
              </button>
            </div>
          </article>
          <button className={styles.help} onClick={() => setNow(true)}>
            {t.help}
          </button>
        </section>
      )}
      {now && (
        <aside className={styles.now}>
          <button onClick={() => setNow(false)} aria-label="Close">
            ×
          </button>
          <h2>{t.nowTitle}</h2>
          <p>{t.nowText}</p>
          <a
            href="https://antifraudcentre-centreantifraude.ca/report-signalez-eng.htm"
            target="_blank"
            rel="noreferrer"
          >
            {t.official} ↗
          </a>
        </aside>
      )}
    </main>
  );
}
