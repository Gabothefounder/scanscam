"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./encounter.module.css";
import cinema from "./cinema.module.css";

type Lang = "en" | "fr";
type View = "journey" | "book" | "ledger" | "evidence";

const text = {
  en: {
    atlas: "Atlas of Deception",
    title: "The voice in the night",
    intro: "Follow what changes. Choose only what feels true.",
    enter: "Enter the landscape",
    now: "This is happening now",
    nowTitle: "You do not need to decide yet.",
    nowText:
      "Stop contact. Do not send money or codes. Call your bank or the claimed person using a number you find yourself.",
    skip: "Skip",
    next: "Follow the path",
    own: "Use my own words",
    placeholder: "A few words, if you want…",
    second: "Who could stand beside you?",
    secondNote:
      "They do not need to solve everything. A second person can help you see.",
    message:
      "Something happened and I’m having trouble making sense of it. I don’t need you to solve everything. Could you look at it with me?",
    copyMessage: "Copy a message",
    copied: "Message copied",
    open: "Open my book",
    returnTitle: "You found your way back.",
    returnNote:
      "What happened can become something useful—first for you, then, only if you choose, for others.",
    private: "My private book",
    privateNote: "A gentle record of the path you recognized.",
    become: "What should your experience become?",
    ledger: "Make my ledger",
    ledgerNote:
      "A clear report for a bank, platform, workplace or someone you trust.",
    sharpen: "Sharpen the signal",
    sharpenNote: "Add precise details. Open only what you want.",
    light: "Leave a light",
    lightNote:
      "Share a small anonymous pattern—not your story, name or evidence.",
    preview: "See exactly what the light contains",
    leave: "Leave my anonymous light",
    left: "Your light joined the landscape",
    back: "Back to my book",
    report: "My practical ledger",
    reportNote:
      "Edit anything. This is your account—not ScanScam’s conclusion.",
    copyLedger: "Copy ledger",
    print: "Print / save PDF",
    room: "The Evidence Room",
    roomNote:
      "Small details can make your ledger more useful. Uncertainty is allowed.",
    done: "Return with what I have",
    footer:
      "This prototype keeps your choices in this browser. Nothing is submitted or stored.",
  },
  fr: {
    atlas: "Atlas de la tromperie",
    title: "La voix dans la nuit",
    intro:
      "Observez ce qui change. Choisissez seulement ce qui vous ressemble.",
    enter: "Entrer dans le paysage",
    now: "Ça se passe maintenant",
    nowTitle: "Vous n’avez pas à décider maintenant.",
    nowText:
      "Coupez le contact. N’envoyez ni argent ni code. Appelez votre banque ou la personne prétendue avec un numéro trouvé par vous-même.",
    skip: "Passer",
    next: "Suivre le chemin",
    own: "Avec mes propres mots",
    placeholder: "Quelques mots, si vous voulez…",
    second: "Qui pourrait se tenir à vos côtés?",
    secondNote:
      "Cette personne n’a pas à tout régler. Un deuxième regard peut vous aider à voir.",
    message:
      "Quelque chose s’est passé et j’ai du mal à y voir clair. Je ne te demande pas de tout régler. Peux-tu regarder ça avec moi?",
    copyMessage: "Copier un message",
    copied: "Message copié",
    open: "Ouvrir mon livre",
    returnTitle: "Vous avez retrouvé votre chemin.",
    returnNote:
      "Ce qui est arrivé peut devenir utile—d’abord pour vous, puis, seulement si vous le choisissez, pour les autres.",
    private: "Mon livre privé",
    privateNote: "Une trace douce du chemin que vous avez reconnu.",
    become: "Que voulez-vous faire de votre expérience?",
    ledger: "Créer mon registre",
    ledgerNote:
      "Un rapport clair pour une banque, une plateforme, le travail ou une personne de confiance.",
    sharpen: "Préciser le signal",
    sharpenNote: "Ajouter des détails. Ouvrez seulement ce que vous voulez.",
    light: "Laisser une lumière",
    lightNote:
      "Partager un petit signal anonyme—jamais votre récit, votre nom ou vos preuves.",
    preview: "Voir exactement ce que contient la lumière",
    leave: "Laisser ma lumière anonyme",
    left: "Votre lumière a rejoint le paysage",
    back: "Retour à mon livre",
    report: "Mon registre pratique",
    reportNote:
      "Modifiez tout. C’est votre récit—pas la conclusion de ScanScam.",
    copyLedger: "Copier le registre",
    print: "Imprimer / PDF",
    room: "La chambre des faits",
    roomNote:
      "De petits détails rendent votre registre plus utile. L’incertitude est permise.",
    done: "Revenir avec ce que j’ai",
    footer:
      "Ce prototype garde vos choix dans ce navigateur. Rien n’est transmis ni enregistré.",
  },
};

const scenes = {
  en: [
    {
      word: "NOTICE",
      title: "A familiar voice",
      ask: "What first drew you in?",
      phrases: [
        "It sounded like someone I knew",
        "It looked official",
        "They knew something about me",
      ],
      action: "Notice without answering yet.",
    },
    {
      word: "PAUSE",
      title: "The narrowing clock",
      ask: "How was time used?",
      phrases: [
        "It felt urgent",
        "I was afraid of being too late",
        "They would not let me pause",
      ],
      action: "Take back ten minutes.",
    },
    {
      word: "VERIFY",
      title: "Borrowed authority",
      ask: "What made it feel true?",
      phrases: [
        "A uniform, title or logo",
        "A believable story",
        "A familiar name or number",
      ],
      action: "Find the real institution yourself.",
    },
    {
      word: "TELL",
      title: "The closed room",
      ask: "What made the world smaller?",
      phrases: [
        "I was told to keep it secret",
        "I felt ashamed",
        "I did not want to worry anyone",
      ],
      action: "Bring in one other person.",
    },
    {
      word: "STOP",
      title: "The irreversible gate",
      ask: "What were you asked to surrender?",
      phrases: [
        "Money or gift cards",
        "A code or password",
        "Control of a device or account",
      ],
      action: "Do not send or surrender access.",
    },
  ],
  fr: [
    {
      word: "VOIR",
      title: "Une voix familière",
      ask: "Qu’est-ce qui vous a attiré?",
      phrases: [
        "Ça semblait être quelqu’un que je connais",
        "Ça avait l’air officiel",
        "La personne savait quelque chose sur moi",
      ],
      action: "Observer sans répondre tout de suite.",
    },
    {
      word: "PAUSE",
      title: "L’horloge se resserre",
      ask: "Comment le temps a-t-il été utilisé?",
      phrases: [
        "Ça semblait urgent",
        "J’avais peur qu’il soit trop tard",
        "On ne me laissait pas faire de pause",
      ],
      action: "Reprendre dix minutes.",
    },
    {
      word: "VÉRIFIER",
      title: "L’autorité empruntée",
      ask: "Qu’est-ce qui rendait l’histoire crédible?",
      phrases: [
        "Un uniforme, un titre ou un logo",
        "Une histoire crédible",
        "Un nom ou numéro familier",
      ],
      action: "Trouver soi-même la vraie institution.",
    },
    {
      word: "PARLER",
      title: "La pièce fermée",
      ask: "Qu’est-ce qui a rapetissé votre monde?",
      phrases: [
        "On m’a demandé de garder le secret",
        "J’avais honte",
        "Je ne voulais inquiéter personne",
      ],
      action: "Faire entrer une autre personne.",
    },
    {
      word: "ARRÊT",
      title: "La porte irréversible",
      ask: "Qu’est-ce qu’on vous demandait de céder?",
      phrases: [
        "De l’argent ou des cartes-cadeaux",
        "Un code ou mot de passe",
        "Le contrôle d’un appareil ou compte",
      ],
      action: "Ne rien envoyer et ne céder aucun accès.",
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
const fields = {
  en: [
    ["When", "Dates or approximate times"],
    ["Contact", "Phone, email, profile or website"],
    ["Identity", "Who they claimed to be"],
    ["Request", "Their exact words or instructions"],
    ["Payment", "Method, amount or transaction reference"],
    ["Artifacts", "Messages, receipts or screenshots"],
  ],
  fr: [
    ["Quand", "Dates ou heures approximatives"],
    ["Contact", "Téléphone, courriel, profil ou site"],
    ["Identité", "Qui la personne prétendait être"],
    ["Demande", "Ses mots ou instructions exactes"],
    ["Paiement", "Méthode, montant ou référence"],
    ["Traces", "Messages, reçus ou captures"],
  ],
};

export default function EmergencyEncounter() {
  const [lang, setLang] = useState<Lang>("en");
  const t = text[lang];
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [view, setView] = useState<View>("journey");
  const [choices, setChoices] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [companion, setCompanion] = useState("");
  const [copied, setCopied] = useState(false);
  const [light, setLight] = useState(false);
  const [now, setNow] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const scene = scenes[lang][step];
  const choose = (p: string) =>
    setChoices((old) =>
      old.includes(p) ? old.filter((x) => x !== p) : [...old, p],
    );
  const advance = () => {
    setTransitioning(true);
    window.setTimeout(() => {
      setStep((x) => x + 1);
      setTransitioning(false);
    }, 620);
  };
  const switchLang = (next: Lang) => {
    setLang(next);
    setStep(0);
    setChoices([]);
    setCustom("");
    setCompanion("");
    setView("journey");
  };
  const ledger = useMemo(() => {
    const obs = choices.length
      ? choices.map((x) => `• ${x}`).join("\n")
      : lang === "en"
        ? "• No observations selected"
        : "• Aucune observation sélectionnée";
    const detail = Object.entries(evidence)
      .filter(([, v]) => v.trim())
      .map(([k, v]) => `• ${k}: ${v}`)
      .join("\n");
    return lang === "en"
      ? `SCANSCAM — MY PRACTICAL LEDGER\n\nWhat I recognized\n${obs}${custom ? `\n• In my words: ${custom}` : ""}\n\nMy second light\n• ${companion || "Not chosen yet"}\n\nPrecise details\n${detail || "• Not added yet"}\n\nThis is my account. Some details may be uncertain. Preserve original messages, receipts and files separately.`
      : `SCANSCAM — MON REGISTRE PRATIQUE\n\nCe que j’ai reconnu\n${obs}${custom ? `\n• Dans mes mots : ${custom}` : ""}\n\nMa deuxième lumière\n• ${companion || "Pas encore choisie"}\n\nDétails précis\n${detail || "• Pas encore ajoutés"}\n\nCeci est mon récit. Certains détails peuvent être incertains. Conservez séparément les messages, reçus et fichiers originaux.`;
  }, [choices, companion, custom, evidence, lang]);
  const progress =
    view !== "journey" ? 100 : started ? Math.min(86, (step + 1) * 15) : 0;
  return (
    <main
      className={`${styles.experience} ${choices.length > 4 ? styles.warming : ""}`}
    >
      <nav className={styles.topbar}>
        <Link href="/">ScanScam</Link>
        <span>{t.atlas}</span>
        <div>
          <button
            className={lang === "en" ? styles.langActive : ""}
            onClick={() => switchLang("en")}
          >
            EN
          </button>
          <button
            className={lang === "fr" ? styles.langActive : ""}
            onClick={() => switchLang("fr")}
          >
            FR
          </button>
        </div>
      </nav>
      <section
        className={`${styles.world} ${cinema.world} ${started && view === "journey" ? cinema[`scene${step}`] : ""} ${transitioning ? cinema.transitioning : ""}`}
      >
        <Image
          src="/atlas/journey-of-return.png"
          alt="A luminous figure crosses a dreamlike landscape from pressure and isolation toward companionship and a village of lights"
          fill
          priority
          sizes="100vw"
        />
        <div className={`${styles.veil} ${cinema.veil}`} />
        <div className={cinema.particles} aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
        {started && view === "journey" && (
          <div className={cinema.traveller} aria-hidden="true">
            <i />
            <span />
          </div>
        )}
        <div className={styles.progress}>
          <i style={{ width: `${progress}%` }} />
        </div>
        {!started && (
          <div className={styles.opening}>
            <p>{t.atlas}</p>
            <h1>{t.title}</h1>
            <span>{t.intro}</span>
            <button className={styles.primary} onClick={() => setStarted(true)}>
              {t.enter}
            </button>
          </div>
        )}
        {started && view === "journey" && step < 5 && (
          <section
            className={`${styles.prompt} ${cinema.prompt}`}
            key={`${lang}-${step}`}
          >
            <header>
              <span>
                {String(step + 1).padStart(2, "0")} / 05 · {scene.title}
              </span>
              <p>{scene.word}</p>
              <h2>{scene.ask}</h2>
            </header>
            <div className={`${styles.phrases} ${cinema.phrases}`}>
              {scene.phrases.map((p) => (
                <button
                  key={p}
                  onClick={() => choose(p)}
                  className={choices.includes(p) ? styles.selected : ""}
                >
                  {p}
                </button>
              ))}
            </div>
            <details className={`${styles.ownWords} ${cinema.ownWords}`}>
              <summary>{t.own}</summary>
              <textarea
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder={t.placeholder}
              />
            </details>
            <div className={`${styles.promptFooter} ${cinema.promptFooter}`}>
              <em>{scene.action}</em>
              <div>
                <button className={styles.textButton} onClick={advance}>
                  {t.skip}
                </button>
                <button className={styles.primary} onClick={advance}>
                  {t.next}
                </button>
              </div>
            </div>
          </section>
        )}
        {started && view === "journey" && step === 5 && (
          <section
            className={`${styles.prompt} ${styles.companion} ${cinema.prompt} ${cinema.companion}`}
          >
            <header>
              <span>06 / 06</span>
              <p>TOGETHER</p>
              <h2>{t.second}</h2>
              <small>{t.secondNote}</small>
            </header>
            <div className={`${styles.companionGrid} ${cinema.companionGrid}`}>
              {people[lang].map((p) => (
                <button
                  key={p}
                  onClick={() => setCompanion(p)}
                  className={companion === p ? styles.selected : ""}
                >
                  <i />
                  {p}
                </button>
              ))}
            </div>
            {companion && (
              <div className={styles.helpMessage}>
                <p>“{t.message}”</p>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(t.message);
                    setCopied(true);
                  }}
                >
                  {copied ? t.copied : t.copyMessage}
                </button>
              </div>
            )}
            <div className={`${styles.promptFooter} ${cinema.promptFooter}`}>
              <em>{companion}</em>
              <button
                className={styles.primary}
                onClick={() => setView("book")}
              >
                {t.open}
              </button>
            </div>
          </section>
        )}
        {view === "book" && (
          <section className={styles.book}>
            <div className={styles.bookHeading}>
              <p>THE RETURN</p>
              <h2>{t.returnTitle}</h2>
              <span>{t.returnNote}</span>
            </div>
            <div className={styles.bookSpread}>
              <article>
                <span>01</span>
                <h3>{t.private}</h3>
                <p>{t.privateNote}</p>
                <div className={styles.memory}>
                  {choices.slice(0, 5).map((x) => (
                    <i key={x}>{x}</i>
                  ))}
                  {!choices.length && <i>—</i>}
                </div>
              </article>
              <article>
                <span>02</span>
                <h3>{t.become}</h3>
                <button onClick={() => setView("ledger")}>
                  <b>{t.ledger}</b>
                  <small>{t.ledgerNote}</small>
                </button>
                <button onClick={() => setView("evidence")}>
                  <b>{t.sharpen}</b>
                  <small>{t.sharpenNote}</small>
                </button>
              </article>
            </div>
            <div className={styles.lightChoice}>
              <div>
                <i className={light ? styles.lit : ""} />
                <span>
                  <b>{t.light}</b>
                  <small>{t.lightNote}</small>
                </span>
              </div>
              {light ? (
                <strong>{t.left}</strong>
              ) : (
                <button onClick={() => setLight(true)}>{t.leave}</button>
              )}
              <details>
                <summary>{t.preview}</summary>
                <p>
                  {lang === "en"
                    ? "Impersonation · digital contact · urgency / authority / isolation · country only"
                    : "Usurpation d’identité · contact numérique · urgence / autorité / isolement · pays seulement"}
                </p>
              </details>
            </div>
          </section>
        )}
        {view === "ledger" && (
          <section className={styles.ledger}>
            <button className={styles.back} onClick={() => setView("book")}>
              ← {t.back}
            </button>
            <p>MY REPORT</p>
            <h2>{t.report}</h2>
            <span>{t.reportNote}</span>
            <pre>{ledger}</pre>
            <div>
              <button
                className={styles.primary}
                onClick={() => navigator.clipboard.writeText(ledger)}
              >
                {t.copyLedger}
              </button>
              <button onClick={() => window.print()}>{t.print}</button>
              <button onClick={() => setView("evidence")}>{t.sharpen}</button>
            </div>
          </section>
        )}
        {view === "evidence" && (
          <section className={styles.evidenceRoom}>
            <button className={styles.back} onClick={() => setView("book")}>
              ← {t.back}
            </button>
            <p>THE EVIDENCE ROOM</p>
            <h2>{t.room}</h2>
            <span>{t.roomNote}</span>
            <div className={styles.artifacts}>
              {fields[lang].map(([name, hint], i) => (
                <details key={name}>
                  <summary>
                    <i>{["◷", "☎", "◐", "✦", "≈", "▣"][i]}</i>
                    <b>{name}</b>
                  </summary>
                  <label>
                    {hint}
                    <textarea
                      value={evidence[name] || ""}
                      onChange={(e) =>
                        setEvidence((old) => ({
                          ...old,
                          [name]: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <div>
                    <button type="button">
                      {lang === "en"
                        ? "I remember clearly"
                        : "Je m’en souviens clairement"}
                    </button>
                    <button type="button">
                      {lang === "en" ? "I’m uncertain" : "Je suis incertain·e"}
                    </button>
                  </div>
                </details>
              ))}
            </div>
            <button
              className={styles.primary}
              onClick={() => setView("ledger")}
            >
              {t.done}
            </button>
          </section>
        )}
        <button className={styles.nowButton} onClick={() => setNow(true)}>
          {t.now}
        </button>
        {now && (
          <aside className={styles.nowPanel}>
            <button aria-label="Close" onClick={() => setNow(false)}>
              ×
            </button>
            <h2>{t.nowTitle}</h2>
            <p>{t.nowText}</p>
            <a
              href="https://antifraudcentre-centreantifraude.ca/report-signalez-eng.htm"
              target="_blank"
              rel="noreferrer"
            >
              {lang === "en"
                ? "Canadian Anti-Fraud Centre ↗"
                : "Centre antifraude du Canada ↗"}
            </a>
          </aside>
        )}
      </section>
      <footer>{t.footer}</footer>
    </main>
  );
}
