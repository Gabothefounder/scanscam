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
    atlas: "Atlas of Deception", prompt: "Something happened. Let’s make it clear.", promise: "In about two minutes, leave with a private record and a clear next-step plan.", reassurance: "Choose only what feels true.", lived: "It happened to me", helping: "I’m helping someone", learn: "I’m just exploring",
    livedLead: "Walk gently through something you experienced.", helpingLead: "Help someone you care about make sense of what happened.", learnLead: "See how a fictional bank impersonation unfolds.",
    scanContext: "This is the message you brought. Let’s look at what happened around it.", livedContext: "Start with the first thing you remember.", helpingContext: "Begin with what they told you. You do not need every detail.", learnContext: "Follow a fictional example. Nothing you choose creates a report.",
    continue: "Continue", back: "Back", skip: "I’m not ready to answer", own: "Anything else? (optional)", ownPlaceholder: "Write it here.", yourWords: "Your own words",
    help: "This is happening now", helpTitle: "Pause here.", helpBody: "Stop contact. Don’t send money, codes or access. Reach your bank or the claimed person using a number you find independently.", close: "Return to the journey",
    message: "Suspicious message", messagePlaceholder: "Paste the message here—or continue without it.", example: "A message says your bank account is in danger. Act now or it will be frozen.",
    detailsTitle: "Make the record more useful", detailsLead: "Optional. Never enter passwords, complete card numbers, government ID numbers or intimate material.", addDetails: "Add precise details", hideDetails: "Close details",
    when: "When", contact: "Phone, email or website", organization: "Claimed organization", amount: "Amount and currency", payment: "Payment method", reference: "Transaction reference",
    path: "What happened", pressure: "Pressure used", feelings: "What I felt", asked: "What they asked for", nextStep: "My next step", private: "This record stays in this browser unless you copy, print or save it.",
    copy: "Copy summary", copied: "Copied", print: "Print or save", report: "Find where to report it", restart: "Begin again", actionPlan: "Your action plan", actionLead: "Start with the first step.", shareConsent: "Share only the anonymous pattern with the Atlas. Your pasted message, private notes and ledger details are not included.", shareNow: "Add my anonymous pattern", sharing: "Adding your light…", shared: "Your light joined the Atlas.", shareError: "We could not add the pattern right now. Your private record is unchanged.", done: "You’re done.", doneBody: "You have a record and a next step. That is enough for now.", protectPrompt: "Who would you hate to see go through this?", protectCta: "Protect someone you love", exploreAtlas: "Explore the Atlas",
  },
  fr: {
    atlas: "Atlas de la tromperie", prompt: "Quelque chose s’est passé. Clarifions-le ensemble.", promise: "En environ deux minutes, repartez avec un registre privé et un plan clair pour la suite.", reassurance: "Choisissez seulement ce qui semble vrai.", lived: "Ça m’est arrivé", helping: "J’aide quelqu’un", learn: "Je veux simplement explorer",
    livedLead: "Parcourez doucement une expérience vécue.", helpingLead: "Aidez une personne qui vous est chère à comprendre ce qui s’est passé.", learnLead: "Voyez comment une fausse banque construit sa tromperie.",
    scanContext: "Voici le message que vous avez apporté. Regardons ce qui s’est construit autour.", livedContext: "Commencez par la première chose dont vous vous souvenez.", helpingContext: "Commencez par ce que la personne vous a raconté. Tous les détails ne sont pas nécessaires.", learnContext: "Suivez un exemple fictif. Aucun de vos choix ne crée un signalement.",
    continue: "Continuer", back: "Retour", skip: "Je ne suis pas prêt·e à répondre", own: "Autre chose? (facultatif)", ownPlaceholder: "Écrivez-le ici.", yourWords: "Vos propres mots",
    help: "Ça se passe maintenant", helpTitle: "Faites une pause ici.", helpBody: "Coupez le contact. N’envoyez ni argent, ni code, ni accès. Joignez votre banque ou la personne prétendue avec un numéro trouvé indépendamment.", close: "Revenir au parcours",
    message: "Message suspect", messagePlaceholder: "Collez le message ici—ou continuez sans le faire.", example: "Un message affirme que votre compte bancaire est en danger. Agissez maintenant ou il sera bloqué.",
    detailsTitle: "Rendre le registre plus utile", detailsLead: "Facultatif. N’inscrivez aucun mot de passe, numéro de carte complet, numéro d’identité gouvernemental ou contenu intime.", addDetails: "Ajouter des détails précis", hideDetails: "Fermer les détails",
    when: "Quand", contact: "Téléphone, courriel ou site", organization: "Organisation prétendue", amount: "Montant et devise", payment: "Mode de paiement", reference: "Référence de transaction",
    path: "Ce qui s’est passé", pressure: "Pression utilisée", feelings: "Ce que j’ai ressenti", asked: "Ce qu’on m’a demandé", nextStep: "Mon prochain pas", private: "Ce registre reste dans ce navigateur à moins que vous le copiiez, l’imprimiez ou le sauvegardiez.",
    copy: "Copier le résumé", copied: "Copié", print: "Imprimer ou sauvegarder", report: "Trouver où le signaler", restart: "Recommencer", actionPlan: "Votre plan d’action", actionLead: "Commencez par la première étape.", shareConsent: "Partagez uniquement le motif anonyme avec l’Atlas. Votre message collé, vos notes privées et les détails du registre ne sont pas inclus.", shareNow: "Ajouter mon motif anonyme", sharing: "Votre lumière rejoint l’Atlas…", shared: "Votre lumière a rejoint l’Atlas.", shareError: "Impossible d’ajouter le motif pour le moment. Votre registre privé demeure inchangé.", done: "C’est terminé.", doneBody: "Vous avez un registre et une prochaine étape. C’est suffisant pour aujourd’hui.", protectPrompt: "Qui voudriez-vous protéger d’une expérience comme celle-ci?", protectCta: "Protéger une personne que vous aimez", exploreAtlas: "Explorer l’Atlas",
  },
};


type ActionItem = { id: string; title: string; detail?: string };

function buildActionPlan(answers: Answers, lang: Lang): ActionItem[] {
  const requested = new Set(answers.request || []);
  const next = new Set(answers.interruption || []);
  const en = lang === "en";
  const items: ActionItem[] = [
    {
      id: "stop_contact",
      title: en ? "Stop contact and slow the situation down." : "Coupez le contact et ralentissez la situation.",
      detail: en ? "No more money, codes, information or device access." : "N’envoyez plus d’argent, de codes, d’informations ni d’accès.",
    },
  ];

  if (requested.has("money")) items.push({
    id: "contact_financial_institution",
    title: en ? "Contact your bank or payment provider using a number you find independently." : "Communiquez avec votre institution financière ou votre fournisseur de paiement avec un numéro trouvé indépendamment.",
    detail: en ? "Ask what can still be stopped or disputed." : "Demandez ce qui peut encore être arrêté ou contesté.",
  });

  if (requested.has("code") || requested.has("personal")) items.push({
    id: "secure_accounts",
    title: en ? "Secure the affected accounts." : "Sécurisez les comptes touchés.",
    detail: en ? "Change affected passwords and sign out other sessions." : "Changez les mots de passe concernés et déconnectez les autres sessions.",
  });

  if (requested.has("device")) items.push({
    id: "disconnect_device_access",
    title: en ? "Remove remote access and secure the device." : "Retirez l’accès à distance et sécurisez l’appareil.",
    detail: en ? "Remove remote access and change important credentials." : "Retirez l’accès à distance et changez les identifiants importants.",
  });

  items.push({
    id: "preserve_evidence",
    title: en ? "Keep the evidence." : "Conservez les preuves.",
    detail: en ? "Keep messages, numbers, receipts and transaction references." : "Conservez les messages, numéros, reçus et références de transaction.",
  });

  if (next.has("tell")) items.push({
    id: "tell_trusted_person",
    title: en ? "Tell the person you chose to trust." : "Parlez-en à la personne de confiance que vous avez choisie.",
  });

  items.push({
    id: "report_officially",
    title: en ? "Report it when you are ready." : "Signalez la situation lorsque vous serez prêt·e.",
    detail: en ? "Use your ledger when you report it." : "Utilisez votre registre pour le signalement.",
  });

  return items.slice(0, 6);
}

export default function CinematicJourney() {
  const [lang, setLang] = useState<Lang>("en");
  const [mode, setMode] = useState<EntryMode | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [words, setWords] = useState<Record<string, string>>({});
  const [evidence, setEvidence] = useState<Evidence>(emptyEvidence);
  const [message, setMessage] = useState("");
  const [emotionPulse, setEmotionPulse] = useState<string | null>(null);
  const [writingOpen, setWritingOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const [moving, setMoving] = useState(false);
  const [atlasConsent, setAtlasConsent] = useState(false);
  const [atlasStatus, setAtlasStatus] = useState<"idle" | "sending" | "shared" | "error">("idle");
  const [journeySessionId, setJourneySessionId] = useState<string | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const t = ui[lang];
  const scene = scenes[step];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const existingJourneyId = window.sessionStorage.getItem("scanscam-atlas-session-id");
    const journeyId = existingJourneyId || crypto.randomUUID();
    if (!existingJourneyId) window.sessionStorage.setItem("scanscam-atlas-session-id", journeyId);
    setJourneySessionId(journeyId);
    const incoming = params.get("message");
    if (incoming) setMessage(incoming.slice(0, 4000));
    if (params.get("mode") === "scan") {
      setMode("scan");
      if (!incoming) {
        try {
          const result = JSON.parse(window.sessionStorage.getItem("scanResult") || "{}") as Record<string, unknown>;
          const candidate = [result.original_text, result.raw_message, result.message, result.input, result.submitted_text].find((value) => typeof value === "string") as string | undefined;
          const candidateScanId = [result.id, result.scan_id].find((value) => typeof value === "string") as string | undefined;
          if (candidate) setMessage(candidate.slice(0, 4000));
          if (candidateScanId) setScanId(candidateScanId);
        } catch { /* A missing scan still opens the journey safely. */ }
      }
    }
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem("scanscam-atlas-draft", JSON.stringify({ mode, step, answers, words, evidence, message }));
  }, [answers, evidence, message, mode, step, words]);

  const selected = answers[scene?.key] || [];
  const labelFor = (key: string) => {
    const source = scenes.find((item) => item.key === key)?.choices || [];
    return (answers[key] || []).map((id) => source.find((choice) => choice[0] === id)?.[lang === "en" ? 1 : 2] || id);
  };
  const activeEmotion = scene?.key === "emotion" ? (emotionPulse || selected[selected.length - 1]) : undefined;
  const activeEmotionLabel = activeEmotion ? scene.choices?.find((choice) => choice[0] === activeEmotion)?.[lang === "en" ? 1 : 2] : undefined;
  const reflection = scene?.key !== "emotion" && scene?.reflection ? tx(scene.reflection, lang) : "";

  const actionPlan = useMemo(() => buildActionPlan(answers, lang), [answers, lang]);

  const summary = useMemo(() => {
    const rows = [
      [t.path, [labelFor("arrival"), labelFor("identity")].flat().join(" · ")],
      [t.pressure, labelFor("pressure").join(" · ")],
      [t.feelings, labelFor("emotion").join(" · ")], [t.asked, labelFor("request").join(" · ")], [t.nextStep, labelFor("interruption").join(" · ")],
    ].filter((row) => row[1]);
    const details = Object.entries(evidence).filter(([, value]) => value.trim()).map(([key, value]) => `${t[key as keyof typeof t]}: ${value}`);
    const notes = scenes.map((item) => {
      const value = words[item.key]?.trim();
      return value ? `${tx(item.eyebrow, lang)}: ${value}` : null;
    }).filter(Boolean);
    return `${t.atlas}\n\n${rows.map(([label, value]) => `${label}: ${value}`).join("\n")}${notes.length ? `\n\n${t.yourWords}:\n${notes.join("\n")}` : ""}${details.length ? `\n\n${details.join("\n")}` : ""}\n\n${lang === "en" ? "Visitor account. Not an official police report." : "Récit de la personne. Ceci n’est pas un rapport de police officiel."}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, evidence, lang, words]);

  const choose = (id: string) => {
    if (scene.key === "return" && atlasStatus === "shared") return;
    const current = answers[scene.key] || [];
    const removing = current.includes(id);
    const next = scene.multi ? (removing ? current.filter((x) => x !== id) : [...current, id]) : [id];
    if (scene.key === "return" && id !== "share") {
      setAtlasConsent(false);
      setAtlasStatus("idle");
    }
    setAnswers({ ...answers, [scene.key]: next });
    if (scene.key === "emotion" && !removing) {
      setEmotionPulse(id);
      window.setTimeout(() => setEmotionPulse((value) => value === id ? null : value), 1800);
    }
  };
  const advance = () => {
    setMoving(true);
    window.setTimeout(() => { setStep((value) => Math.min(value + 1, scenes.length - 1)); setEmotionPulse(null); setWritingOpen(false); setMoving(false); window.scrollTo({ top: 0, behavior: "smooth" }); }, 420);
  };
  const restart = () => {
    setMode(null); setStep(0); setAnswers({}); setWords({}); setEvidence(emptyEvidence); setMessage(""); setShowDetails(false); setEmotionPulse(null); setWritingOpen(false);
    window.sessionStorage.removeItem("scanscam-atlas-draft");
    window.sessionStorage.removeItem("scanscam-atlas-session-id");
    setAtlasConsent(false); setAtlasStatus("idle"); setJourneySessionId(null); setScanId(null);
  };
  const begin = (entry: EntryMode) => { setMode(entry); setStep(0); if (entry === "learn") setMessage(t.example); };
  const contextLine = mode === "scan" ? t.scanContext : mode === "helping" ? t.helpingContext : mode === "learn" ? t.learnContext : t.livedContext;
  const copySummary = async () => { await navigator.clipboard.writeText(summary); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
  const contributeToAtlas = async () => {
    if (!atlasConsent || !journeySessionId || !mode || mode === "learn") return;
    setAtlasStatus("sending");
    try {
      const response = await fetch("/api/atlas/contribute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          session_id: journeySessionId,
          scan_id: scanId,
          lang,
          entry_mode: mode,
          selected_signals: {
            arrival: answers.arrival || [],
            identity: answers.identity || [],
            pressure: answers.pressure || [],
            emotion: answers.emotion || [],
            request: answers.request || [],
            interruption: answers.interruption || [],
          },
          action_ids: actionPlan.map((item) => item.id),
          consent: true,
          consent_version: "atlas_pattern_v1",
        }),
      });
      if (!response.ok) throw new Error("atlas_contribution_failed");
      setAtlasStatus("shared");
    } catch {
      setAtlasStatus("error");
    }
  };
  const image = !mode ? "entrance" : scene.image;
  const canContinue = selected.length > 0 || Boolean(words[scene?.key]?.trim()) || !scene?.choices || scene.key === "arrival";

  return (
    <main className={`${styles.page} ${moving ? styles.moving : ""}`} data-scene={scene?.key || "entry"} data-emotion={activeEmotion || ""} data-pressure={scene?.key === "pressure" ? Math.min(selected.length, 4) : 0} data-choice={selected[selected.length - 1] || ""}>
      <nav className={styles.nav}><Link href="/">ScanScam</Link><span>{t.atlas}</span><div><button aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button><button aria-pressed={lang === "fr"} onClick={() => setLang("fr")}>FR</button></div></nav>
      <Image className={styles.art} src={imageFor(image)} alt="" fill priority sizes="100vw" />
      <div className={styles.wash} aria-hidden="true" /><div className={styles.paper} aria-hidden="true" /><div className={styles.storyThread} aria-hidden="true"><i /><i /><i />{scene?.key === "return" && atlasStatus === "shared" && <i className={styles.joinedLight} />}</div>{scene?.key === "return" && atlasStatus === "shared" && <div className={styles.lightJoin} aria-hidden="true"><i /></div>}
      {!mode ? (
        <section className={styles.entry}><p>{t.atlas}</p><h1>{t.prompt}</h1><span className={styles.promise}>{t.promise}</span><span className={styles.reassurance}>{t.reassurance}</span><div className={styles.doors}>
          <button onClick={() => begin("lived")}><b>{t.lived}</b><span>{t.livedLead}</span></button>
          <button onClick={() => begin("helping")}><b>{t.helping}</b><span>{t.helpingLead}</span></button>
        </div><button className={styles.explore} onClick={() => begin("learn")}>{t.learn}<span>{t.learnLead}</span></button></section>
      ) : (
        <section className={styles.experience}>
          <div className={styles.progress} aria-label={`${step + 1} / ${scenes.length}`}><i style={{ width: `${((step + 1) / scenes.length) * 100}%` }} /><span>{step < 2 ? (lang === "en" ? "The story arrives" : "L’histoire arrive") : step < 5 ? (lang === "en" ? "The world narrows" : "Le monde rétrécit") : (lang === "en" ? "The way returns" : "Le chemin revient")}</span></div>
          {step < scenes.length - 1 && <button className={styles.help} onClick={() => setShowHelp(true)}>{t.help}</button>}
          <article className={styles.card}>
            {step === 0 && <div className={styles.contextLine}><i aria-hidden="true" />{contextLine}</div>}
            <header><p>{tx(scene.eyebrow, lang)}</p><h1>{tx(scene.title, lang)}</h1><span>{tx(scene.lead, lang)}</span></header>
            {scene.key === "arrival" && mode === "scan" && <label className={styles.message}><span>{t.message}</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder={t.messagePlaceholder} /></label>}
            {scene.key === "arrival" && mode === "learn" && <blockquote>{message}</blockquote>}
            {scene.key === "return" && <div className={styles.returnBook}><div className={styles.openBook}><section className={styles.bookPage}><p className={styles.bookKicker}>{lang === "en" ? "The path you traced" : "Le chemin retracé"}</p><JourneyPath lang={lang} answers={answers} /></section><section className={styles.bookPage}><p className={styles.bookKicker}>{lang === "en" ? "Your private record" : "Votre registre privé"}</p><Ledger summary={summary} copied={copied} onCopy={copySummary} onPrint={() => window.print()} lang={lang} /></section></div><ActionPlan lang={lang} items={actionPlan} /><button className={styles.detailToggle} onClick={() => setShowDetails(!showDetails)}>{showDetails ? t.hideDetails : t.addDetails}</button>{showDetails && <EvidenceForm lang={lang} evidence={evidence} setEvidence={setEvidence} />}</div>}
            {scene.choices && <div className={`${styles.choices} ${scene.key === "emotion" ? styles.emotionChoices : ""}`}>{scene.choices.map(([id, en, fr]) => <button key={id} data-choice={id} aria-pressed={selected.includes(id)} onClick={() => choose(id)}><span>{lang === "en" ? en : fr}</span></button>)}</div>}
            <div className={styles.own}>{!writingOpen ? <button type="button" onClick={() => setWritingOpen(true)}>＋ {t.own}</button> : <textarea autoFocus value={words[scene.key] || ""} onChange={(event) => setWords({ ...words, [scene.key]: event.target.value })} placeholder={t.ownPlaceholder} rows={2} />}</div>
            {reflection && selected.length > 0 && <div className={styles.reflection}><i aria-hidden="true" />{reflection}</div>}
            {scene.key === "emotion" && emotionPulse && <div className={styles.emotionFlash} data-emotion={emotionPulse} aria-live="polite"><i aria-hidden="true" /><p>{activeEmotionLabel}</p><blockquote>{tx(emotionReflections[emotionPulse], lang)}</blockquote></div>}
            {scene.key === "return" && selected.includes("share") && mode !== "learn" && atlasStatus !== "shared" && <div className={styles.shareConsent}><label><input type="checkbox" checked={atlasConsent} onChange={(event) => setAtlasConsent(event.target.checked)} /><span>{t.shareConsent}</span></label><button type="button" disabled={!atlasConsent || atlasStatus === "sending"} onClick={contributeToAtlas}>{atlasStatus === "sending" ? t.sharing : t.shareNow}</button>{atlasStatus === "error" && <p>{t.shareError}</p>}</div>}
            {scene.key === "return" && selected.length ? <div className={styles.ending}><div className={styles.doneMoment}><b>{t.done}</b><span>{selected.includes("share") && atlasStatus === "shared" ? t.shared : t.doneBody}</span></div><div className={styles.endingActions}><Link href="/atlas">{t.exploreAtlas}</Link><button onClick={restart}>{t.restart}</button></div><div className={styles.protectBridge}><span>{t.protectPrompt}</span><Link href={lang === "fr" ? "/fr/protect-family?source=atlas_journey" : "/protect-family?source=atlas_journey"}>{t.protectCta}<b>→</b></Link></div></div> : scene.key !== "return" &&
              <footer>{step > 0 && <button onClick={() => setStep(step - 1)}>{t.back}</button>}<button className={styles.skip} onClick={advance}>{t.skip}</button><button className={styles.next} disabled={!canContinue} onClick={advance}>{t.continue}<span>→</span></button></footer>}
          </article>
        </section>
      )}
      {showHelp && <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="help-title"><div><p>{t.help}</p><h2 id="help-title">{t.helpTitle}</h2><span>{t.helpBody}</span><a href={lang === "en" ? "https://antifraudcentre-centreantifraude.ca/index-eng.htm" : "https://antifraudcentre-centreantifraude.ca/index-fra.htm"} target="_blank" rel="noreferrer">{lang === "en" ? "Canadian Anti-Fraud Centre" : "Centre antifraude du Canada"}</a><button onClick={() => setShowHelp(false)}>{t.close}</button></div></div>}
    </main>
  );
}

function ActionPlan({ lang, items }: { lang: Lang; items: ActionItem[] }) {
  const t = ui[lang];
  return <section className={styles.actionPlan}><p>{t.actionPlan}</p><span>{t.actionLead}</span><ol>{items.map((item, index) => <li key={item.id}><i>{index + 1}</i><div><b>{item.title}</b>{item.detail && <span>{item.detail}</span>}</div></li>)}</ol></section>;
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
