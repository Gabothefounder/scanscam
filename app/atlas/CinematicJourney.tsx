"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { emotionReflections, EntryMode, Lang, scenes, tx } from "./journeyData";
import styles from "./cinematicJourney.module.css";

type Answers = Record<string, string[]>;
type Evidence = Record<"when" | "contact" | "organization" | "amount" | "payment" | "reference", string>;
type ContributionStatus = "idle" | "submitting" | "saved" | "error";
const emptyEvidence: Evidence = { when: "", contact: "", organization: "", amount: "", payment: "", reference: "" };

const ui = {
  en: {
    atlas: "The Vigil", prompt: "Once you see the pattern, you become harder to fool.", promise: "Check a suspicious message, report what happened, or learn how scammers use trust, pressure and emotion.", reassurance: "Built from 1,391 real-world checks. Every experience brought into the light helps others see the pattern sooner.", check: "Check a suspicious message", checkLead: "Paste a message or upload a screenshot for an immediate assessment.", lived: "Tell us what happened", helping: "I’m helping someone", learn: "Explore known patterns",
    livedLead: "Reconstruct what happened and see the mechanics behind it.", helpingLead: "Reconstruct the experience with someone you care about.", learnLead: "See how a fictional bank impersonation unfolds.",
    scanContext: "This is the message you brought. Let’s look at what happened around it.", livedContext: "Start with the first thing you remember.", helpingContext: "Begin with what they told you. You do not need every detail.", learnContext: "Follow a fictional example. Nothing you choose creates a report.",
    continue: "Continue", back: "Back", skip: "I’m not ready to answer", own: "Use my own words", ownPlaceholder: "Write anything you remember—or leave this empty.",
    help: "This is happening now", helpTitle: "Pause here.", helpBody: "Stop contact. Don’t send money, codes or access. Reach your bank or the claimed person using a number you find independently.", close: "Return to the journey",
    message: "Suspicious message", messagePlaceholder: "Paste the message here—or continue without it.", example: "A message says your bank account is in danger. Act now or it will be frozen.",
    detailsTitle: "Make the record more useful", detailsLead: "Optional. Never enter passwords, complete card numbers, government ID numbers or intimate material.", addDetails: "Add precise details", hideDetails: "Close details",
    when: "When", contact: "Phone, email or website", organization: "Claimed organization", amount: "Amount and currency", payment: "Payment method", reference: "Transaction reference",
    path: "What happened", pressure: "Pressure used", feelings: "What I felt", asked: "What they asked for", nextStep: "My next step", private: "This ledger organizes your account and ScanScam’s pattern observations. It is not an official police, bank or legal report.",
    exploreResult: "Explore this pattern in the Archive",
    copy: "Copy ledger", copied: "Copied", print: "Print or save PDF", report: "Find where to report it", restart: "Begin again", openLedger: "Open my incident ledger", joinWatch: "Join the Watch", familyPilot: "Protect my family", patternContext: "Others have seen this too", reportJoined: "Your report has joined the Vigil.", reportFailed: "Your ledger is ready, but the anonymous report could not be saved. You can try again later.", collective: "One person reveals the tactic. The whole network becomes harder to fool.",
    disclosureTitle: "Turn what happened into something useful.", disclosureBody: "By continuing, you’re making an anonymous report to ScanScam. Your answers will help identify recurring and emerging scam patterns.", disclosureExchange: "In return, we’ll help reveal how the situation was constructed and create a practical incident ledger you can save, copy or bring to your bank or the appropriate authorities.", disclosureSafety: "Do not include passwords, complete card numbers, government identification numbers or intimate material.", disclosureDetails: "See exactly what will be shared", disclosureShared: "Shared: the choices you make about the contact, claimed identity, pressure, emotions, request and next action. Not shared: your optional written words or precise ledger details.", disclosureAccept: "I understand — begin", disclosureBack: "Go back",
  },
  fr: {
    atlas: "La Vigie", prompt: "Quand vous voyez le motif, il devient plus difficile de vous tromper.", promise: "Vérifiez un message suspect, racontez ce qui s’est passé ou découvrez comment les fraudeurs utilisent la confiance, la pression et les émotions.", reassurance: "Construit à partir de 1 391 analyses réelles. Chaque expérience mise en lumière aide les autres à reconnaître le motif plus tôt.", check: "Vérifier un message suspect", checkLead: "Collez un message ou téléversez une capture d’écran pour une évaluation immédiate.", lived: "Raconter ce qui s’est passé", helping: "J’aide quelqu’un", learn: "Explorer les motifs connus",
    livedLead: "Reconstituez ce qui s’est passé et voyez les mécanismes à l’œuvre.", helpingLead: "Reconstituez l’expérience avec une personne qui vous est chère.", learnLead: "Voyez comment une fausse banque construit sa tromperie.",
    scanContext: "Voici le message que vous avez apporté. Regardons ce qui s’est construit autour.", livedContext: "Commencez par la première chose dont vous vous souvenez.", helpingContext: "Commencez par ce que la personne vous a raconté. Tous les détails ne sont pas nécessaires.", learnContext: "Suivez un exemple fictif. Aucun de vos choix ne crée un signalement.",
    continue: "Continuer", back: "Retour", skip: "Je ne suis pas prêt·e à répondre", own: "Utiliser mes propres mots", ownPlaceholder: "Écrivez ce dont vous vous souvenez—ou laissez vide.",
    help: "Ça se passe maintenant", helpTitle: "Faites une pause ici.", helpBody: "Coupez le contact. N’envoyez ni argent, ni code, ni accès. Joignez votre banque ou la personne prétendue avec un numéro trouvé indépendamment.", close: "Revenir au parcours",
    message: "Message suspect", messagePlaceholder: "Collez le message ici—ou continuez sans le faire.", example: "Un message affirme que votre compte bancaire est en danger. Agissez maintenant ou il sera bloqué.",
    detailsTitle: "Rendre le registre plus utile", detailsLead: "Facultatif. N’inscrivez aucun mot de passe, numéro de carte complet, numéro d’identité gouvernemental ou contenu intime.", addDetails: "Ajouter des détails précis", hideDetails: "Fermer les détails",
    when: "Quand", contact: "Téléphone, courriel ou site", organization: "Organisation prétendue", amount: "Montant et devise", payment: "Mode de paiement", reference: "Référence de transaction",
    path: "Ce qui s’est passé", pressure: "Pression utilisée", feelings: "Ce que j’ai ressenti", asked: "Ce qu’on m’a demandé", nextStep: "Mon prochain pas", private: "Ce registre organise votre récit et les observations de ScanScam. Ce n’est pas un rapport officiel de police, de banque ou un avis juridique.",
    exploreResult: "Explorer ce motif dans les Archives",
    copy: "Copier le registre", copied: "Copié", print: "Imprimer ou sauvegarder en PDF", report: "Trouver où le signaler", restart: "Recommencer", openLedger: "Ouvrir mon registre d’incident", joinWatch: "Rejoindre la Vigie", familyPilot: "Protéger ma famille", patternContext: "D’autres ont vu cela aussi", reportJoined: "Votre signalement a rejoint la Vigie.", reportFailed: "Votre registre est prêt, mais le signalement anonyme n’a pas pu être enregistré. Vous pourrez réessayer plus tard.", collective: "Une personne révèle la tactique. Tout le réseau devient plus difficile à tromper.",
    disclosureTitle: "Transformez ce qui s’est passé en quelque chose d’utile.", disclosureBody: "En continuant, vous faites un signalement anonyme à ScanScam. Vos réponses aideront à repérer les motifs d’arnaque récurrents et émergents.", disclosureExchange: "En retour, nous vous aiderons à comprendre comment la situation a été construite et créerons un registre pratique que vous pourrez conserver, copier ou apporter à votre banque ou aux autorités appropriées.", disclosureSafety: "N’inscrivez aucun mot de passe, numéro de carte complet, numéro d’identité gouvernemental ou contenu intime.", disclosureDetails: "Voir exactement ce qui sera partagé", disclosureShared: "Partagé : vos choix sur le contact, l’identité prétendue, la pression, les émotions, la demande et la prochaine action. Non partagé : vos mots facultatifs et les détails précis du registre.", disclosureAccept: "Je comprends — commencer", disclosureBack: "Retour",
  },
};

export default function CinematicJourney() {
  const [lang, setLang] = useState<Lang>("en");
  const [mode, setMode] = useState<EntryMode | null>(null);
  const [pendingMode, setPendingMode] = useState<Exclude<EntryMode, "learn"> | null>(null);
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
  const [scanId, setScanId] = useState<string | null>(null);
  const [sessionId] = useState(() => typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `local-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const [patternContext, setPatternContext] = useState<string | null>(null);
  const [contributionStatus, setContributionStatus] = useState<ContributionStatus>("idle");
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const t = ui[lang];
  const scene = scenes[step];
  const selected = useMemo(() => answers[scene?.key] || [], [answers, scene?.key]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("lang") === "fr") setLang("fr");
    const incoming = params.get("message");
    if (incoming) setMessage(incoming.slice(0, 4000));
    if (params.get("mode") === "scan") {
      setPendingMode("scan");
      if (!incoming) {
        try {
          const result = JSON.parse(window.sessionStorage.getItem("scanResult") || "{}") as Record<string, unknown>;
          if (typeof result.scan_id === "string") setScanId(result.scan_id);
          const candidate = [result.original_text, result.raw_message, result.message, result.input, result.submitted_text].find((value) => typeof value === "string") as string | undefined;
          if (candidate) setMessage(candidate.slice(0, 4000));
        } catch { /* A missing scan still opens the journey safely. */ }
      }
    } else if (params.get("mode") === "helping") {
      setPendingMode("helping");
    } else if (params.get("mode") === "lived") {
      setPendingMode("lived");
    }
  }, []);

  useEffect(() => {
    const choice = selected[selected.length - 1];
    if (!mode || mode === "learn" || !choice || !scene) { setPatternContext(null); return; }
    const controller = new AbortController();
    fetch(`/api/atlas/context?scene=${encodeURIComponent(scene.key)}&choice=${encodeURIComponent(choice)}&lang=${lang}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => setPatternContext(typeof data.context === "string" ? data.context : null))
      .catch(() => setPatternContext(null));
    return () => controller.abort();
  }, [lang, mode, scene, selected]);

  useEffect(() => {
    window.localStorage.setItem("scanscam-atlas-draft", JSON.stringify({ mode, step, answers, words, evidence, message }));
  }, [answers, evidence, message, mode, step, words]);

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
    const pattern = inferPattern(answers, lang);
    const rows = [
      [t.path, [labelFor("arrival"), labelFor("identity")].flat().join(" · ")],
      [t.pressure, labelFor("pressure").join(" · ")],
      [t.feelings, labelFor("emotion").join(" · ")], [t.asked, labelFor("request").join(" · ")], [t.nextStep, labelFor("interruption").join(" · ")],
    ].filter((row) => row[1]);
    const details = Object.entries(evidence).filter(([, value]) => value.trim()).map(([key, value]) => `${t[key as keyof typeof t]}: ${value}`);
    const privateNotes = Object.entries(words).filter(([, value]) => value.trim()).map(([key, value]) => `${scenes.find((item) => item.key === key)?.eyebrow[lang === "en" ? 0 : 1] || key}: ${value.trim()}`);
    return lang === "en"
      ? `SCANSCAM — PRACTICAL INCIDENT LEDGER\nGenerated: ${new Date().toLocaleString("en-CA")}\n\nWHAT I REPORTED\n${rows.map(([label, value]) => `${label}: ${value}`).join("\n")}${privateNotes.length ? `\n\nMY PRIVATE NOTES\n${privateNotes.join("\n")}` : ""}${details.length ? `\n\nPRECISE DETAILS\n${details.join("\n")}` : ""}\n\nSCANSCAM PATTERN OBSERVATION\n${pattern.title}\n${pattern.explanation}\nProbable objective: ${pattern.goal}\n\nWHAT TO PRESERVE\nKeep original messages, screenshots, receipts, account records and contact details. Do not alter the originals.\n\nIMPORTANT\nThis ledger organizes the visitor’s account and ScanScam’s pattern-based observations. It is not an official police, bank or legal report. Some details may remain uncertain.`
      : `SCANSCAM — REGISTRE PRATIQUE DE L’INCIDENT\nGénéré : ${new Date().toLocaleString("fr-CA")}\n\nCE QUE J’AI SIGNALÉ\n${rows.map(([label, value]) => `${label} : ${value}`).join("\n")}${privateNotes.length ? `\n\nMES NOTES PRIVÉES\n${privateNotes.join("\n")}` : ""}${details.length ? `\n\nDÉTAILS PRÉCIS\n${details.join("\n")}` : ""}\n\nOBSERVATION DE SCANSCAM\n${pattern.title}\n${pattern.explanation}\nObjectif probable : ${pattern.goal}\n\nÉLÉMENTS À CONSERVER\nConservez les messages, captures d’écran, reçus, relevés de compte et coordonnées d’origine. Ne modifiez pas les originaux.\n\nIMPORTANT\nCe registre organise le récit de la personne et les observations de ScanScam fondées sur des motifs. Ce n’est pas un rapport officiel de police, de banque ni un avis juridique. Certains détails peuvent demeurer incertains.`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, evidence, lang, words]);

  const choose = (id: string) => {
    const current = answers[scene.key] || [];
    setAnswers({ ...answers, [scene.key]: scene.multi ? (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]) : [id] });
  };
  const submitContribution = async () => {
    if (!mode || mode === "learn") return "saved" as const;
    setContributionStatus("submitting");
    try {
      const response = await fetch("/api/atlas/contribute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sessionId, scan_id: scanId, lang, entry_mode: mode, selected_signals: answers, action_ids: answers.interruption || [], consent_version: "vigil_report_v1" }) });
      if (!response.ok) throw new Error("report_not_saved");
      setContributionStatus("saved");
      return "saved" as const;
    } catch {
      setContributionStatus("error");
      return "error" as const;
    }
  };
  const advance = async () => {
    if (scene.key === "interruption") await submitContribution();
    setMoving(true);
    window.setTimeout(() => { setStep((value) => Math.min(value + 1, scenes.length - 1)); setShowWords(false); setMoving(false); window.scrollTo({ top: 0, behavior: "smooth" }); }, 420);
  };
  const restart = () => {
    setMode(null); setStep(0); setAnswers({}); setWords({}); setEvidence(emptyEvidence); setMessage(""); setShowDetails(false);
    setPendingMode(null); setContributionStatus("idle"); setLedgerOpen(false); setPatternContext(null);
    window.localStorage.removeItem("scanscam-atlas-draft");
  };
  const begin = (entry: EntryMode) => { if (entry === "learn") { setMode(entry); setMessage(t.example); } else setPendingMode(entry); setStep(0); };
  const contextLine = mode === "scan" ? t.scanContext : mode === "helping" ? t.helpingContext : mode === "learn" ? t.learnContext : t.livedContext;
  const copySummary = async () => { await navigator.clipboard.writeText(summary); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
  const archivePattern = inferArchivePattern(answers);
  const canContinue = selected.length > 0 || Boolean(words[scene?.key]?.trim()) || !scene?.choices || scene.key === "arrival";

  return (
    <main className={`${styles.page} ${moving ? styles.moving : ""}`} data-scene={scene?.key || "entry"} data-emotion={activeEmotion || ""} data-pressure={scene?.key === "pressure" ? Math.min(selected.length, 4) : 0} data-choice={selected[selected.length - 1] || ""}>
      <nav className={styles.nav}><Link href="/">ScanScam</Link><Link href={`/atlas?lang=${lang}`}>{t.atlas}</Link><div><button aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button><button aria-pressed={lang === "fr"} onClick={() => setLang("fr")}>FR</button></div></nav>
      <Image className={styles.art} src="/atlas/vigil-brutalist-spectrum.webp" alt="" fill priority sizes="100vw" />
      <div className={styles.wash} aria-hidden="true" /><div className={styles.paper} aria-hidden="true" /><VigilCore active={Boolean(mode && mode !== "learn")} complete={scene?.key === "return"} /><div className={styles.storyThread} aria-hidden="true"><i /><i /><i /></div>
      {!mode ? (
        <section className={styles.entry}><p>{t.atlas}</p><h1>{t.prompt}</h1><span className={styles.promise}>{t.promise}</span><span className={styles.reassurance}>{t.reassurance}</span><div className={styles.doors}>
          <Link className={styles.doorLink} href={`/scan?lang=${lang}`}><b>{t.check}</b><span>{t.checkLead}</span></Link>
          <button onClick={() => begin("lived")}><b>{t.lived}</b><span>{t.livedLead}</span></button>
          <button onClick={() => begin("helping")}><b>{t.helping}</b><span>{t.helpingLead}</span></button>
        </div><button className={styles.explore} onClick={() => begin("learn")}>{t.learn}<span>{t.learnLead}</span></button></section>
      ) : (
        <section className={styles.experience}>
          <div className={styles.progress} aria-label={`${step + 1} / ${scenes.length}`}><i style={{ width: `${((step + 1) / scenes.length) * 100}%` }} /><span>{step < 2 ? (lang === "en" ? "The story arrives" : "L’histoire arrive") : step < 5 ? (lang === "en" ? "The world narrows" : "Le monde rétrécit") : (lang === "en" ? "The way returns" : "Le chemin revient")}</span></div>
          <ol className={styles.journeyRail} aria-label={lang === "en" ? "Your signal through the Vigil" : "Votre signal dans la Vigie"}>
            {scenes.map((item, index) => <li key={item.key} data-state={index === step ? "current" : index < step ? "complete" : "waiting"}>
              <button disabled={index > step} onClick={() => setStep(index)}><i>{String(index + 1).padStart(2, "0")}</i><span>{tx(item.eyebrow, lang)}</span></button>
            </li>)}
          </ol>
          {step < scenes.length - 1 && <button className={styles.help} onClick={() => setShowHelp(true)}>{t.help}</button>}
          <article className={styles.card}>
            {step === 0 && <div className={styles.contextLine}><i aria-hidden="true" />{contextLine}</div>}
            <header><p>{tx(scene.eyebrow, lang)}</p><h1>{tx(scene.title, lang)}</h1><span>{tx(scene.lead, lang)}</span></header>
            {scene.key === "arrival" && mode === "scan" && <label className={styles.message}><span>{t.message}</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder={t.messagePlaceholder} /></label>}
            {scene.key === "arrival" && mode === "learn" && <blockquote>{message}</blockquote>}
            {scene.key === "return" && !ledgerOpen && <div className={styles.integration}><div className={styles.integrationMark}><i /><i /><i /></div><h2>{contributionStatus === "error" ? t.reportFailed : mode === "learn" ? (lang === "en" ? "The pattern is visible now." : "Le motif est maintenant visible.") : t.reportJoined}</h2><p>{t.collective}</p><button className={styles.next} onClick={() => setLedgerOpen(true)}>{t.openLedger}<span>→</span></button></div>}
            {scene.key === "return" && ledgerOpen && <div className={styles.returnBook}><JourneyPath lang={lang} answers={answers} /><button className={styles.detailToggle} onClick={() => setShowDetails(!showDetails)}>{showDetails ? t.hideDetails : t.addDetails}</button>{showDetails && <EvidenceForm lang={lang} evidence={evidence} setEvidence={setEvidence} />}<Ledger summary={summary} copied={copied} onCopy={copySummary} onPrint={() => window.print()} lang={lang} /><div className={styles.afterLedger}><Link href={`/atlas?lang=${lang}&pattern=${archivePattern}`}>{t.exploreResult}</Link><a href={`mailto:hello@scanscam.ca?subject=${encodeURIComponent(lang === "en" ? "Join the Watch" : "Rejoindre la Vigie")}`}>{t.joinWatch}</a><Link href={lang === "en" ? "/protect-family" : "/fr/protect-family"}>{t.familyPilot}</Link><button onClick={restart}>{t.restart}</button></div></div>}
            {scene.choices && <div className={`${styles.choices} ${scene.key === "emotion" ? styles.emotionChoices : ""}`}>{scene.choices.map(([id, en, fr]) => <button key={id} data-choice={id} aria-pressed={selected.includes(id)} onClick={() => choose(id)}><span>{lang === "en" ? en : fr}</span><i>{selected.includes(id) ? "●" : "○"}</i></button>)}</div>}
            {scene.ownWords && <div className={styles.own}>{!showWords ? <button onClick={() => setShowWords(true)}>＋ {t.own}</button> : <textarea autoFocus value={words[scene.key] || ""} onChange={(event) => setWords({ ...words, [scene.key]: event.target.value })} placeholder={t.ownPlaceholder} />}</div>}
            {emotionLines.length > 0 && <div className={styles.emotionReflections}>{emotionLines.map((item) => <div key={item.id} data-emotion={item.id}><i aria-hidden="true" /><span>{item.text}</span></div>)}</div>}
            {reflection && <div className={styles.reflection}><i aria-hidden="true" />{reflection}</div>}
            {patternContext && <div className={styles.patternContext}><i aria-hidden="true" /><div><b>{t.patternContext}</b><span>{patternContext}</span></div></div>}
            {activeEmotion && <div className={styles.emotionMoment} data-emotion={activeEmotion}><i aria-hidden="true" /><p>{activeEmotionLabel}</p><blockquote>{tx(emotionReflections[activeEmotion], lang)}</blockquote><button onClick={advance}>{lang === "en" ? "Keep going" : "Continuer"}<span>→</span></button></div>}
            {scene.key !== "return" && <footer>{step > 0 && <button onClick={() => setStep(step - 1)}>{t.back}</button>}<button className={styles.skip} onClick={advance}>{t.skip}</button><button className={styles.next} disabled={!canContinue || contributionStatus === "submitting"} onClick={advance}>{contributionStatus === "submitting" ? (lang === "en" ? "Joining the Vigil…" : "Connexion à la Vigie…") : t.continue}<span>→</span></button></footer>}
          </article>
        </section>
      )}
      {showHelp && <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="help-title"><div><p>{t.help}</p><h2 id="help-title">{t.helpTitle}</h2><span>{t.helpBody}</span><a href={lang === "en" ? "https://antifraudcentre-centreantifraude.ca/index-eng.htm" : "https://antifraudcentre-centreantifraude.ca/index-fra.htm"} target="_blank" rel="noreferrer">{lang === "en" ? "Canadian Anti-Fraud Centre" : "Centre antifraude du Canada"}</a><button onClick={() => setShowHelp(false)}>{t.close}</button></div></div>}
      {pendingMode && <div className={styles.disclosure} role="dialog" aria-modal="true"><div><p>{t.atlas} · {lang === "en" ? "Anonymous report" : "Signalement anonyme"}</p><h2>{t.disclosureTitle}</h2><span>{t.disclosureBody}</span><strong>{t.disclosureExchange}</strong><em>{t.disclosureSafety}</em><details><summary>{t.disclosureDetails}</summary><p>{t.disclosureShared}</p></details><div><button onClick={() => setPendingMode(null)}>{t.disclosureBack}</button><button onClick={() => { setMode(pendingMode); setPendingMode(null); }}>{t.disclosureAccept}</button></div></div></div>}
    </main>
  );
}

function inferArchivePattern(answers: Answers) {
  const identity = answers.identity || [];
  const request = answers.request || [];
  if (identity.includes("authority")) return "government_impersonation";
  if (identity.includes("bank") || request.includes("code")) return "account_verification";
  if (identity.includes("romantic")) return "romance_scam";
  if (identity.includes("employer")) return "employment_scam";
  if (request.includes("money")) return "delivery_scam";
  return "government_impersonation";
}

function VigilCore({ active, complete }: { active: boolean; complete: boolean }) {
  return <div className={`${styles.vigilCore} ${active ? styles.coreActive : ""} ${complete ? styles.coreComplete : ""}`} aria-hidden="true">
    <div className={styles.visitorSignal} />
  </div>;
}

function inferPattern(answers: Answers, lang: Lang) {
  const identity = answers.identity || [];
  const pressure = answers.pressure || [];
  const request = answers.request || [];
  const impersonation = identity.some((id) => ["bank", "authority", "company", "known"].includes(id));
  const title = lang === "en"
    ? impersonation ? "Possible impersonation pattern" : "Possible manipulation pattern"
    : impersonation ? "Motif possible d’usurpation d’identité" : "Motif possible de manipulation";
  const tactics = [
    pressure.includes("now") && (lang === "en" ? "urgency" : "l’urgence"),
    pressure.includes("secret") && (lang === "en" ? "secrecy" : "le secret"),
    pressure.includes("line") && (lang === "en" ? "continuous contact" : "le contact continu"),
    pressure.includes("loss") && (lang === "en" ? "financial threat" : "la menace financière"),
    pressure.includes("opportunity") && (lang === "en" ? "fear of missing an opportunity" : "la peur de perdre une occasion"),
  ].filter(Boolean).join(lang === "en" ? ", " : ", ");
  const goal = request.includes("money") ? (lang === "en" ? "obtain money or a payment" : "obtenir de l’argent ou un paiement")
    : request.includes("code") ? (lang === "en" ? "gain account access" : "obtenir l’accès à un compte")
    : request.includes("device") ? (lang === "en" ? "gain control of a device or account" : "prendre le contrôle d’un appareil ou d’un compte")
    : request.includes("personal") ? (lang === "en" ? "collect personal or identity information" : "recueillir des renseignements personnels ou d’identité")
    : request.includes("silence") ? (lang === "en" ? "maintain control and prevent outside verification" : "maintenir le contrôle et empêcher une vérification extérieure")
    : (lang === "en" ? "not yet clear from the information provided" : "pas encore clair selon les renseignements fournis");
  const explanation = lang === "en"
    ? `${impersonation ? "A familiar or authoritative identity may have been used to borrow trust" : "The contact may have used a believable story to gain attention"}${tactics ? `, followed by ${tactics}` : ""}. This is a pattern observation, not a conclusion about the sender’s identity or intent.`
    : `${impersonation ? "Une identité familière ou autoritaire a pu servir à emprunter la confiance" : "Le contact a pu utiliser une histoire crédible pour attirer l’attention"}${tactics ? `, puis ${tactics}` : ""}. Il s’agit d’une observation de motif, et non d’une conclusion sur l’identité ou l’intention de l’expéditeur.`;
  return { title, explanation, goal };
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
