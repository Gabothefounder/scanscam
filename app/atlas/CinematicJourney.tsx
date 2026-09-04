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
const tx = {
  en: {
    atlas: "Atlas of Deception",
    entry: "Something happened.",
    entry2: "Let’s find where it began.",
    entryNote: "Choose the event that feels closest. You can change it later.",
    own: "In my own words",
    ownHint: "Write anything you remember—or leave this empty.",
    next: "Continue",
    pass: "I’m not ready to answer",
    chapter: "Chapter",
    help: "Need help now?",
    second: "Second Light",
    copy: "Copy a message",
    copied: "Copied",
    open: "Open my book",
    return: "The Return",
    returnTitle: "You brought the story back into the light.",
    returnSub:
      "What happened is no longer sealed inside the moment. You named it, saw the pressure, and invited another perspective.",
    story: "My story",
    edit: "This is yours. Change any word that does not feel right.",
    facts: "Make it useful",
    factsSub:
      "Add only the precision you want. Your book becomes a clearer ledger as you open these pages.",
    clear: "I remember clearly",
    unsure: "I’m not certain",
    outcome: "What should my experience become?",
    private: "Keep my private book",
    report: "Create a practical report",
    trusted: "Share with someone I trust",
    destination: "Find where to report it",
    light: "Leave an anonymous light",
    redacted: "Offer a redacted story",
    lightExplain:
      "Only fraud family, channel, pressure patterns, approximate country, and month. Never your words, name, evidence, or exact location.",
    print: "Print / save my book",
    copyReport: "Copy practical report",
    reset: "Begin another journey",
    local:
      "Prototype: everything remains in this browser. Nothing is submitted or stored.",
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
    pass: "Je ne suis pas prêt·e à répondre",
    chapter: "Chapitre",
    help: "Besoin d’aide maintenant?",
    second: "Deuxième lumière",
    copy: "Copier un message",
    copied: "Copié",
    open: "Ouvrir mon livre",
    return: "Le retour",
    returnTitle: "Vous avez ramené votre histoire dans la lumière.",
    returnSub:
      "Ce qui est arrivé n’est plus enfermé dans le moment. Vous l’avez nommé, vu la pression et invité un autre regard.",
    story: "Mon histoire",
    edit: "Elle vous appartient. Changez chaque mot qui ne vous ressemble pas.",
    facts: "La rendre utile",
    factsSub:
      "Ajoutez seulement la précision désirée. Votre livre devient un registre plus clair à mesure que vous ouvrez ces pages.",
    clear: "Je m’en souviens clairement",
    unsure: "Je ne suis pas certain·e",
    outcome: "Que voulez-vous faire de votre expérience?",
    private: "Garder mon livre privé",
    report: "Créer un rapport pratique",
    trusted: "Partager avec une personne de confiance",
    destination: "Trouver où le signaler",
    light: "Laisser une lumière anonyme",
    redacted: "Offrir un récit caviardé",
    lightExplain:
      "Seulement la famille de fraude, le canal, les pressions, le pays approximatif et le mois. Jamais vos mots, votre nom, vos preuves ou votre position exacte.",
    print: "Imprimer / sauvegarder mon livre",
    copyReport: "Copier le rapport pratique",
    reset: "Commencer un autre parcours",
    local:
      "Prototype : tout reste dans ce navigateur. Rien n’est transmis ni enregistré.",
    nowTitle: "Vous n’avez pas à décider maintenant.",
    nowText:
      "Coupez le contact. N’envoyez ni argent, ni code, ni accès. Joignez votre banque ou la personne prétendue avec un numéro trouvé indépendamment.",
    official: "Centre antifraude du Canada",
  },
};
const events = {
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
      choices: [
        "A person I know",
        "A bank or company",
        "Police or government",
        "An expert or person in authority",
      ],
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
      choices: [
        "Money or gift cards",
        "A password or code",
        "Identity information",
        "Access to a device or account",
        "Silence or secrecy",
      ],
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
      choices: [
        "Une personne que je connais",
        "Une banque ou entreprise",
        "La police ou le gouvernement",
        "Un expert ou une autorité",
      ],
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
      choices: [
        "Argent ou cartes-cadeaux",
        "Un mot de passe ou code",
        "Des renseignements personnels",
        "L’accès à un appareil ou compte",
        "Le silence ou le secret",
      ],
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
  "06-second-light",
];

export default function CinematicJourney() {
  const [lang, setLang] = useState<Lang>("en"),
    t = tx[lang];
  const [phase, setPhase] = useState<Phase>("entry"),
    [event, setEvent] = useState(""),
    [scene, setScene] = useState(0),
    [moving, setMoving] = useState(false),
    [reaction, setReaction] = useState("");
  const [answers, setAnswers] = useState<string[][]>(
      Array.from({ length: 6 }, () => []),
    ),
    [own, setOwn] = useState<string[]>(Array.from({ length: 6 }, () => "")),
    [companion, setCompanion] = useState(""),
    [copied, setCopied] = useState(false),
    [now, setNow] = useState(false),
    [story, setStory] = useState("");
  const [facts, setFacts] = useState<Record<Fact, string>>({
      when: "",
      contact: "",
      identity: "",
      request: "",
      payment: "",
      evidence: "",
    }),
    [certainty, setCertainty] = useState<Record<Fact, string>>({
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
  const current = scenes[lang][scene],
    family = events[lang].find((x) => x[0] === event)?.[2] || "";
  const choose = (v: string) => {
    setAnswers((old) =>
      old.map((r, i) =>
        i === scene
          ? r.includes(v)
            ? r.filter((x) => x !== v)
            : [...r, v]
          : r,
      ),
    );
    setReaction(v);
  };
  const advance = () => {
    setMoving(true);
    setTimeout(() => {
      setScene((x) => x + 1);
      setReaction("");
      setMoving(false);
    }, 900);
  };
  const helpMessage =
    lang === "en"
      ? "Something happened and I’m having trouble making sense of it. I don’t need you to solve everything. Could you look at this with me?"
      : "Quelque chose s’est passé et j’ai du mal à y voir clair. Je ne te demande pas de tout régler. Peux-tu regarder ça avec moi?";
  const narrative = useMemo(
    () =>
      lang === "en"
        ? `It began as ${family || "an uncertain event"}. ${answers[0][0] ? `The first door was ${answers[0][0].toLowerCase()}.` : ""} ${answers[1][0] ? `It wore the face of ${answers[1][0].toLowerCase()}.` : ""} ${answers[2][0] ? `${answers[2][0]}.` : ""} ${answers[3].length ? `You carried ${answers[3].join(", ").toLowerCase()} through the closed world.` : ""} ${answers[4][0] ? `You were asked for ${answers[4][0].toLowerCase()}.` : ""}\n\nNone of this means you were foolish. These patterns are designed to compress time, borrow trust, and isolate judgment. You slowed the story down, named what happened, and brought in ${companion ? companion.toLowerCase() : "the possibility of another perspective"}. That is how agency begins to return.`
        : `Tout a commencé par ${family ? family.toLowerCase() : "un événement incertain"}. ${answers[0][0] ? `La première porte était ${answers[0][0].toLowerCase()}.` : ""} ${answers[1][0] ? `L’histoire portait le visage de ${answers[1][0].toLowerCase()}.` : ""} ${answers[2][0] ? `${answers[2][0]}.` : ""} ${answers[3].length ? `Vous avez porté ${answers[3].join(", ").toLowerCase()} dans ce monde fermé.` : ""} ${answers[4][0] ? `On vous demandait ${answers[4][0].toLowerCase()}.` : ""}\n\nRien de tout cela ne signifie que vous étiez naïf. Ces mécanismes sont conçus pour comprimer le temps, emprunter la confiance et isoler le jugement. Vous avez ralenti l’histoire, nommé ce qui s’est passé et fait entrer ${companion ? companion.toLowerCase() : "la possibilité d’un autre regard"}. C’est ainsi que l’autonomie revient.`,
    [answers, companion, family, lang],
  );
  const report = useMemo(
    () =>
      `${t.atlas.toUpperCase()} — ${t.report.toUpperCase()}\n\n${family}\n\n${story || narrative}\n\n${factFields[
        lang
      ]
        .map(([k, l]) =>
          facts[k]
            ? `${l}: ${facts[k]}${certainty[k] ? ` (${certainty[k]})` : ""}`
            : null,
        )
        .filter(Boolean)
        .join("\n")}`,
    [certainty, facts, family, lang, narrative, story, t],
  );
  const start = (id: string) => {
    setEvent(id);
    setPhase("journey");
    setScene(0);
  };
  const openBook = () => {
    setStory(narrative);
    setPhase("book");
  };
  const reset = () => {
    setPhase("entry");
    setEvent("");
    setScene(0);
    setAnswers(Array.from({ length: 6 }, () => []));
    setOwn(Array.from({ length: 6 }, () => ""));
    setCompanion("");
    setStory("");
  };
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
                <button key={id} onClick={() => start(id)}>
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
            {Array.from({ length: 14 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
          {scene < 6 && (
            <article className={styles.scene}>
              <header>
                <span>
                  {t.chapter} {scene + 1} / 6 · {family}
                </span>
                <p>{current.title}</p>
                <h1>{current.q}</h1>
                <em>{current.note}</em>
              </header>
              <div className={styles.choices}>
                {current.choices.map((v) => (
                  <button
                    key={v}
                    className={answers[scene].includes(v) ? styles.chosen : ""}
                    onClick={() => choose(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <label>
                <span>{t.own}</span>
                <textarea
                  value={own[scene]}
                  onChange={(e) =>
                    setOwn((o) =>
                      o.map((v, i) => (i === scene ? e.target.value : v)),
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
                {people[lang].map((v) => (
                  <button
                    key={v}
                    className={companion === v ? styles.chosen : ""}
                    onClick={() => setCompanion(v)}
                  >
                    <i />
                    {v}
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
              <button className={styles.primary} onClick={openBook}>
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
        <section className={styles.return}>
          <Image
          src="/atlas/scenes/07-return.webp"
            alt="A communal landscape filled with lights"
            fill
            priority
            sizes="100vw"
          />
          <div className={styles.shade} />
          <article className={styles.book}>
            <header>
              <p>{t.return}</p>
              <h1>{t.returnTitle}</h1>
              <span>{t.returnSub}</span>
            </header>
            <section className={styles.story}>
              <div>
                <p>01 · {t.story}</p>
                <h2>{family}</h2>
                <span>{t.edit}</span>
              </div>
              <textarea
                value={story}
                onChange={(e) => setStory(e.target.value)}
              />
            </section>
            <section className={styles.facts}>
              <header>
                <p>02 · {t.facts}</p>
                <h2>{t.factsSub}</h2>
              </header>
              <div>
                {factFields[lang].map(([k, l, h]) => (
                  <details key={k}>
                    <summary>
                      <i>{facts[k] ? "✦" : "○"}</i>
                      <span>
                        <b>{l}</b>
                        <small>{h}</small>
                      </span>
                    </summary>
                    <textarea
                      value={facts[k]}
                      onChange={(e) =>
                        setFacts((o) => ({ ...o, [k]: e.target.value }))
                      }
                    />
                    <fieldset>
                      <button
                        className={
                          certainty[k] === "clear" ? styles.active : ""
                        }
                        onClick={() =>
                          setCertainty((o) => ({ ...o, [k]: "clear" }))
                        }
                      >
                        {t.clear}
                      </button>
                      <button
                        className={
                          certainty[k] === "uncertain" ? styles.active : ""
                        }
                        onClick={() =>
                          setCertainty((o) => ({ ...o, [k]: "uncertain" }))
                        }
                      >
                        {t.unsure}
                      </button>
                    </fieldset>
                  </details>
                ))}
              </div>
            </section>
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
                }).map(([k, l]) => (
                  <label key={k}>
                    <input
                      type="checkbox"
                      checked={outcomes[k as keyof typeof outcomes]}
                      onChange={(e) =>
                        setOutcomes((o) => ({ ...o, [k]: e.target.checked }))
                      }
                    />
                    <i />
                    {l}
                  </label>
                ))}
              </div>
              {outcomes.light && (
                <aside>
                  <b>{t.light}</b>
                  <p>{t.lightExplain}</p>
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
