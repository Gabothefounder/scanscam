"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { emotionReflections, EntryMode, Lang, scenes, tx } from "./journeyData";
import styles from "./cinematicJourney.module.css";

type Answers = Record<string, string[]>;
type Evidence = Record<"when" | "contact" | "organization" | "amount" | "payment" | "reference", string>;
const emptyEvidence: Evidence = { when: "", contact: "", organization: "", amount: "", payment: "", reference: "" };
const imageFor = (name: string) => `/atlas/poetic-folk/${name}.webp`;

const ui = {
  en: {
    atlas: "Atlas of Deception", prompt: "What brought you here?", promise: "Follow what happened. See how the pressure worked. Leave with a clear record.", scan: "Scan something", lived: "Something happened", learn: "I want to learn",
    scanLead: "Bring a suspicious message into the story.", livedLead: "Walk gently through something you experienced.", learnLead: "Explore a fictional example without creating a report.",
    continue: "Continue", back: "Back", skip: "I’m not ready to answer", own: "Use my own words", ownPlaceholder: "Write anything you remember—or leave this empty.",
    help: "This is happening now", helpTitle: "Pause here.", helpBody: "Stop contact. Don’t send money, codes or access. Reach your bank or the claimed person using a number you find independently.", close: "Return to the journey",
    message: "Suspicious message", messagePlaceholder: "Paste the message here—or continue without it.", example: "A message says your bank account is in danger. Act now or it will be frozen.",
    detailsTitle: "Make the record more useful", detailsLead: "Optional. Never enter passwords, complete card numbers, government ID numbers or intimate material.", addDetails: "Add precise details", hideDetails: "Close details",
    when: "When", contact: "Phone, email or website", organization: "Claimed organization", amount: "Amount and currency", payment: "Payment method", reference: "Transaction reference",
    path: "What happened", pressure: "Pressure used", feelings: "What I felt", asked: "What they asked for", nextStep: "My next step", private: "This record stays in this browser unless you copy, print or save it.",
    copy: "Copy summary", copied: "Copied", print: "Print or save", report: "Find where to report it", restart: "Begin again", optional: "Optional family protection updates", email: "Email address", notify: "Join the waitlist", noStore: "Prototype only—email is not submitted yet.",
  },
  fr: {
    atlas: "Atlas de la tromperie", prompt: "Qu’est-ce qui vous amène ici?", promise: "Retracez ce qui s’est passé. Voyez comment la pression a agi. Repartez avec un registre clair.", scan: "Analyser quelque chose", lived: "Quelque chose s’est passé", learn: "Je veux comprendre",
    scanLead: "Faites entrer un message suspect dans l’histoire.", livedLead: "Parcourez doucement une expérience vécue.", learnLead: "Explorez un exemple fictif sans créer de signalement.",
    continue: "Continuer", back: "Retour", skip: "Je ne suis pas prêt·e à répondre", own: "Utiliser mes propres mots", ownPlaceholder: "Écrivez ce dont vous vous souvenez—ou laissez vide.",
    help: "Ça se passe maintenant", helpTitle: "Faites une pause ici.", helpBody: "Coupez le contact. N’envoyez ni argent, ni code, ni accès. Joignez votre banque ou la personne prétendue avec un numéro trouvé indépendamment.", close: "Revenir au parcours",
    message: "Message suspect", messagePlaceholder: "Collez le message ici—ou continuez sans le faire.", example: "Un message affirme que votre compte bancaire est en danger. Agissez maintenant ou il sera bloqué.",
    detailsTitle: "Rendre le registre plus utile", detailsLead: "Facultatif. N’inscrivez aucun mot de passe, numéro de carte complet, numéro d’identité gouvernemental ou contenu intime.", addDetails: "Ajouter des détails précis", hideDetails: "Fermer les détails",
    when: "Quand", contact: "Téléphone, courriel ou site", organization: "Organisation prétendue", amount: "Montant et devise", payment: "Mode de paiement", reference: "Référence de transaction",
    path: "Ce qui s’est passé", pressure: "Pression utilisée", feelings: "Ce que j’ai ressenti", asked: "Ce qu’on m’a demandé", nextStep: "Mon prochain pas", private: "Ce registre reste dans ce navigateur à moins que vous le copiiez, l’imprimiez ou le sauvegardiez.",
    copy: "Copier le résumé", copied: "Copié", print: "Imprimer ou sauvegarder", report: "Trouver où le signaler", restart: "Recommencer", optional: "Nouvelles facultatives sur la protection familiale", email: "Adresse courriel", notify: "Joindre la liste d’attente", noStore: "Prototype seulement—le courriel n’est pas encore transmis.",
  },
};

export default function CinematicJourney() {
  const [lang, setLang] = useState<Lang>("en");
  const [mode, setMode] = useState<EntryMode | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [words, setWords] = useState<Record<string, string>>({});
  const [evidence, setEvidence] = useState<Evidence>(emptyEvidence);
  const [message, setMessage] = useState("");
  const [showWords, setShowWords] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const [moving, setMoving] = useState(false);
  const t = ui[lang];
  const scene = scenes[step];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const incoming = params.get("message");
    if (incoming) setMessage(incoming.slice(0, 4000));
    if (params.get("mode") === "scan") {
      setMode("scan");
      if (!incoming) {
        try {
          const result = JSON.parse(window.sessionStorage.getItem("scanResult") || "{}") as Record<string, unknown>;
          const candidate = [result.original_text, result.raw_message, result.message, result.input, result.submitted_text].find((value) => typeof value === "string") as string | undefined;
          if (candidate) setMessage(candidate.slice(0, 4000));
        } catch { /* A missing scan still opens the journey safely. */ }
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("scanscam-atlas-draft", JSON.stringify({ mode, step, answers, words, evidence, message }));
  }, [answers, evidence, message, mode, step, words]);

  const selected = answers[scene?.key] || [];
  const labelFor = (key: string) => {
    const source = scenes.find((item) => item.key === key)?.choices || [];
    return (answers[key] || []).map((id) => source.find((choice) => choice[0] === id)?.[lang === "en" ? 1 : 2] || id);
  };
  const emotionLines = scene?.key === "emotion" && selected.length
    ? selected.map((id) => ({ id, text: tx(emotionReflections[id], lang) })) : [];
  const activeEmotion = scene?.key === "emotion" ? selected[selected.length - 1] : undefined;
  const activeEmotionLabel = activeEmotion ? scene.choices?.find((choice) => choice[0] === activeEmotion)?.[lang === "en" ? 1 : 2] : undefined;
  const reflection = scene?.key !== "emotion" && scene?.reflection ? tx(scene.reflection, lang) : "";

  const summary = useMemo(() => {
    const rows = [
      [t.path, [labelFor("arrival"), labelFor("identity")].flat().join(" · ")],
      [t.pressure, labelFor("pressure").join(" · ")],
      [t.feelings, labelFor("emotion").join(" · ")], [t.asked, labelFor("request").join(" · ")], [t.nextStep, labelFor("interruption").join(" · ")],
    ].filter((row) => row[1]);
    const details = Object.entries(evidence).filter(([, value]) => value.trim()).map(([key, value]) => `${t[key as keyof typeof t]}: ${value}`);
    return `${t.atlas}\n\n${rows.map(([label, value]) => `${label}: ${value}`).join("\n")}${details.length ? `\n\n${details.join("\n")}` : ""}\n\n${lang === "en" ? "Visitor account. Not an official police report." : "Récit de la personne. Ceci n’est pas un rapport de police officiel."}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, evidence, lang]);

  const choose = (id: string) => {
    const current = answers[scene.key] || [];
    setAnswers({ ...answers, [scene.key]: scene.multi ? (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]) : [id] });
  };
  const advance = () => {
    setMoving(true);
    window.setTimeout(() => { setStep((value) => Math.min(value + 1, scenes.length - 1)); setShowWords(false); setMoving(false); window.scrollTo({ top: 0, behavior: "smooth" }); }, 420);
  };
  const restart = () => {
    setMode(null); setStep(0); setAnswers({}); setWords({}); setEvidence(emptyEvidence); setMessage(""); setShowDetails(false);
    window.localStorage.removeItem("scanscam-atlas-draft");
  };
  const begin = (entry: EntryMode) => { setMode(entry); setStep(0); if (entry === "learn") setMessage(t.example); };
  const copySummary = async () => { await navigator.clipboard.writeText(summary); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
  const image = !mode ? "entrance" : scene.image;
  const canContinue = selected.length > 0 || Boolean(words[scene?.key]?.trim()) || !scene?.choices || scene.key === "arrival";

  return (
    <main className={`${styles.page} ${moving ? styles.moving : ""}`} data-scene={scene?.key || "entry"} data-emotion={activeEmotion || ""} data-pressure={scene?.key === "pressure" ? Math.min(selected.length, 4) : 0} data-choice={selected[selected.length - 1] || ""}>
      <nav className={styles.nav}><Link href="/">ScanScam</Link><span>{t.atlas}</span><div><button aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button><button aria-pressed={lang === "fr"} onClick={() => setLang("fr")}>FR</button></div></nav>
      <Image className={styles.art} src={imageFor(image)} alt="" fill priority sizes="100vw" />
      <div className={styles.wash} aria-hidden="true" /><div className={styles.paper} aria-hidden="true" />
      {!mode ? (
        <section className={styles.entry}><p>{t.atlas}</p><h1>{t.prompt}</h1><span className={styles.promise}>{t.promise}</span><div className={styles.doors}>
          <button onClick={() => begin("scan")}><b>{t.scan}</b><span>{t.scanLead}</span></button>
          <button onClick={() => begin("lived")}><b>{t.lived}</b><span>{t.livedLead}</span></button>
          <button onClick={() => begin("learn")}><b>{t.learn}</b><span>{t.learnLead}</span></button>
        </div></section>
      ) : (
        <section className={styles.experience}>
          <div className={styles.progress} aria-label={`${step + 1} / ${scenes.length}`}><i style={{ width: `${((step + 1) / scenes.length) * 100}%` }} /><span>{step < 2 ? (lang === "en" ? "The story arrives" : "L’histoire arrive") : step < 5 ? (lang === "en" ? "The world narrows" : "Le monde rétrécit") : (lang === "en" ? "The way returns" : "Le chemin revient")}</span></div>
          {step < scenes.length - 1 && <button className={styles.help} onClick={() => setShowHelp(true)}>{t.help}</button>}
          <article className={styles.card}>
            <header><p>{tx(scene.eyebrow, lang)}</p><h1>{tx(scene.title, lang)}</h1><span>{tx(scene.lead, lang)}</span></header>
            {scene.key === "arrival" && mode === "scan" && <label className={styles.message}><span>{t.message}</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder={t.messagePlaceholder} /></label>}
            {scene.key === "arrival" && mode === "learn" && <blockquote>{message}</blockquote>}
            {scene.key === "return" && <div className={styles.returnBook}><JourneyPath lang={lang} answers={answers} /><button className={styles.detailToggle} onClick={() => setShowDetails(!showDetails)}>{showDetails ? t.hideDetails : t.addDetails}</button>{showDetails && <EvidenceForm lang={lang} evidence={evidence} setEvidence={setEvidence} />}<Ledger summary={summary} copied={copied} onCopy={copySummary} onPrint={() => window.print()} lang={lang} /></div>}
            {scene.choices && <div className={`${styles.choices} ${scene.key === "emotion" ? styles.emotionChoices : ""}`}>{scene.choices.map(([id, en, fr]) => <button key={id} data-choice={id} aria-pressed={selected.includes(id)} onClick={() => choose(id)}><span>{lang === "en" ? en : fr}</span><i>{selected.includes(id) ? "●" : "○"}</i></button>)}</div>}
            {scene.ownWords && <div className={styles.own}>{!showWords ? <button onClick={() => setShowWords(true)}>＋ {t.own}</button> : <textarea autoFocus value={words[scene.key] || ""} onChange={(event) => setWords({ ...words, [scene.key]: event.target.value })} placeholder={t.ownPlaceholder} />}</div>}
            {emotionLines.length > 0 && <div className={styles.emotionReflections}>{emotionLines.map((item) => <div key={item.id} data-emotion={item.id}><i aria-hidden="true" /><span>{item.text}</span></div>)}</div>}
            {reflection && <div className={styles.reflection}><i aria-hidden="true" />{reflection}</div>}
            {activeEmotion && <div className={styles.emotionMoment} data-emotion={activeEmotion}><i aria-hidden="true" /><p>{activeEmotionLabel}</p><blockquote>{tx(emotionReflections[activeEmotion], lang)}</blockquote><button onClick={advance}>{lang === "en" ? "Keep going" : "Continuer"}<span>→</span></button></div>}
            {scene.key === "return" && selected.length ? <div className={styles.ending}><p>{selected.includes("share") ? (lang === "en" ? "A new light joins the landscape." : "Une nouvelle lumière rejoint le paysage.") : (lang === "en" ? "Your light remains yours." : "Votre lumière demeure la vôtre.")}</p><button onClick={restart}>{t.restart}</button><Link href="/atlas">{lang === "en" ? "Explore the Atlas" : "Explorer l’Atlas"}</Link><label><span>{t.optional}</span><input type="email" placeholder={t.email} /><button type="button" title={t.noStore}>{t.notify}</button></label></div> : scene.key !== "return" &&
              <footer>{step > 0 && <button onClick={() => setStep(step - 1)}>{t.back}</button>}<button className={styles.skip} onClick={advance}>{t.skip}</button><button className={styles.next} disabled={!canContinue} onClick={advance}>{t.continue}<span>→</span></button></footer>}
          </article>
        </section>
      )}
      {showHelp && <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="help-title"><div><p>{t.help}</p><h2 id="help-title">{t.helpTitle}</h2><span>{t.helpBody}</span><a href={lang === "en" ? "https://antifraudcentre-centreantifraude.ca/index-eng.htm" : "https://antifraudcentre-centreantifraude.ca/index-fra.htm"} target="_blank" rel="noreferrer">{lang === "en" ? "Canadian Anti-Fraud Centre" : "Centre antifraude du Canada"}</a><button onClick={() => setShowHelp(false)}>{t.close}</button></div></div>}
    </main>
  );
}

function JourneyPath({ lang, answers }: { lang: Lang; answers: Answers }) {
  const keys = ["arrival", "identity", "pressure", "emotion", "request", "interruption"];
  return <ol className={styles.path}>{keys.map((key, index) => { const item = scenes.find((x) => x.key === key)!; const labels = (answers[key] || []).map((id) => item.choices?.find((choice) => choice[0] === id)?.[lang === "en" ? 1 : 2]).filter(Boolean); return <li key={key}><i>{index + 1}</i><div><b>{tx(item.eyebrow, lang)}</b><span>{labels.join(" · ") || "—"}</span></div></li>; })}</ol>;
}

function EvidenceForm({ lang, evidence, setEvidence }: { lang: Lang; evidence: Evidence; setEvidence: (value: Evidence) => void }) {
  const t = ui[lang]; const fields: Array<keyof Evidence> = ["when", "contact", "organization", "amount", "payment", "reference"];
  return <div className={styles.evidence}><h2>{t.detailsTitle}</h2><p>{t.detailsLead}</p>{fields.map((key) => <label key={key}><span>{t[key]}</span><input value={evidence[key]} onChange={(event) => setEvidence({ ...evidence, [key]: event.target.value })} /></label>)}</div>;
}

function Ledger({ summary, copied, onCopy, onPrint, lang }: { summary: string; copied: boolean; onCopy: () => void; onPrint: () => void; lang: Lang }) {
  const t = ui[lang];
  return <div className={styles.ledger}><pre>{summary}</pre><p>{t.private}</p><div><button onClick={onCopy}>{copied ? t.copied : t.copy}</button><button onClick={onPrint}>{t.print}</button><a href={lang === "en" ? "https://antifraudcentre-centreantifraude.ca/report-signalez-eng.htm" : "https://antifraudcentre-centreantifraude.ca/report-signalez-fra.htm"} target="_blank" rel="noreferrer">{t.report}</a></div></div>;
}
