"use client";
import Link from "next/link";
import { useState } from "react";
import { archivePatterns, type ArchiveLang, type Pair } from "./archiveData";
import { useArchiveMetrics } from "./useArchiveMetrics";
import styles from "./archiveExplorer.module.css";

const extraLabels: Record<string, Pair> = {
  investment_fraud: { en: "Investment fraud", fr: "Fraude à l’investissement" },
  prize_scam: { en: "Prize scam", fr: "Faux prix" },
  financial_phishing: { en: "Financial phishing", fr: "Hameçonnage financier" },
  recovery_scam: { en: "Recovery scam", fr: "Fraude au recouvrement" },
  law_enforcement: { en: "Police impersonation", fr: "Faux policiers" },
  tech_support: { en: "Tech support scam", fr: "Faux soutien technique" },
};

export default function ArchiveWelcome({ initialLang = "en" }: { initialLang?: ArchiveLang }) {
  const [lang, setLang] = useState(initialLang);
  const [paused, setPaused] = useState(false);
  const { metrics, failed, retry } = useArchiveMetrics();
  const tr = (en: string, fr: string) => lang === "fr" ? fr : en;
  const number = (n: number) => n.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA");
  const learnHref = `/atlas/learn?lang=${lang}`;
  const familyHref = lang === "fr" ? "/fr/protect-family" : "/protect-family";
  const signals = metrics ? Object.entries(metrics.families).map(([id, count]) => ({
    id, count, label: archivePatterns.find(p => p.id === id)?.name[lang] ?? extraLabels[id]?.[lang] ?? tr("Other classified type", "Autre type classé"),
  })).concat(metrics.unclassified > 0 ? [{ id: "unclassified", count: metrics.unclassified, label: tr("No assigned type", "Sans type attribué") }] : []).sort((a, b) => b.count - a.count) : [];
  const lanes = [signals.filter((_, i) => i % 2 === 0), signals.filter((_, i) => i % 2 === 1)];
  const actions = [
    { title: tr("Scan a message", "Analyser un message"), prompt: tr("Something seems suspicious?", "Quelque chose semble suspect?"), description: tr("Check a message or screenshot for scam warning signs.", "Vérifiez les indices de fraude dans un message ou une capture d’écran."), href: `/scan?lang=${lang}`, note: tr("Open the scanner", "Ouvrir l’analyseur") },
    { title: tr("Tell us what happened", "Racontez-nous ce qui s’est passé"), prompt: tr("Scammed, or someone tried?", "Une fraude ou une tentative?"), description: tr("Share what happened to help the community recognise the patterns.", "Partagez votre expérience pour aider la communauté à reconnaître les stratagèmes."), href: `/atlas/report?lang=${lang}&mode=lived`, note: tr("Create your incident ledger", "Créer votre registre d’incident") },
    { title: tr("Protect my family", "Protéger ma famille"), prompt: tr("For someone you love", "Pour une personne que vous aimez"), description: tr("Help shape a pilot project to protect your loved ones from scams.", "Aidez à créer un projet pilote pour protéger vos proches contre les fraudes."), href: familyHref, note: tr("Join the early-access list", "S’inscrire à l’accès anticipé") },
  ];
  return <div className={styles.page} lang={lang}>
    <a className={styles.skip} href="#choose">{tr("Skip to your options", "Aller aux options")}</a>
    <header className={styles.header}><Link className={styles.brand} href="/">ScanScam<span>{tr("The Archive", "Les Archives")}</span></Link><div className={styles.languages}><button aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button><button aria-pressed={lang === "fr"} onClick={() => setLang("fr")}>FR</button></div></header>
    <main>
      <section className={`${styles.intro} ${styles.welcomeIntro}`}>
        <p className={styles.eyebrow}>{tr("See the pattern. Protect each other.", "Voir les stratagèmes. Se protéger ensemble.")}</p>
        <h1>{tr("Once you see the pattern,", "Quand vous voyez le stratagème,")}<br /><em>{tr("you become harder to fool.", "vous devenez plus difficile à tromper.")}</em></h1>
        <p>{tr("Check a doubt. Share an experience. Help protect someone you love.", "Vérifiez un doute. Partagez une expérience. Aidez à protéger un proche.")}</p>
        <div id="choose" className={styles.welcomeActions}>{actions.map(action => <Link key={action.href} className={styles.welcomeAction} href={action.href}><span className={styles.actionPrompt}>{action.prompt}</span><h2>{action.title}</h2><p>{action.description}</p><span className={styles.actionLink}>{action.note}<span aria-hidden="true">↗</span></span></Link>)}</div>
      </section>
      <section className={styles.signalSection} aria-label={tr("Patterns in the Archive", "Les stratagèmes dans les Archives")}>
        <div className={styles.signalHeading}><div><p className={styles.eyebrow}>{tr("The stories differ. The methods repeat.", "Les histoires changent. Les méthodes se répètent.")}</p><h2>{tr("What people bring to ScanScam", "Ce que les gens apportent à ScanScam")}</h2></div><button className={styles.motionControl} aria-pressed={paused} onClick={() => setPaused(v => !v)}>{paused ? tr("Resume movement", "Reprendre le mouvement") : tr("Pause movement", "Arrêter le mouvement")}</button></div>
        <div className={styles.signalDisplay} data-paused={paused}>
          {metrics && signals.length > 0 ? <>
            <div className={styles.signalLanes} aria-hidden="true">{lanes.map((lane, index) => <div className={styles.signalLane} key={index}><div className={styles.signalTrack}>{[0, 1].map(copy => <div className={styles.signalGroup} key={copy}>{lane.map(signal => <span className={styles.signalChip} key={signal.id}><span>{signal.label}</span><b>{number(signal.count)}</b></span>)}</div>)}</div></div>)}</div>
            <div className={styles.signalTotal}><strong>{number(metrics.sampleSize)}</strong><span>{tr("scan records in the Archive", "analyses dans les Archives")}</span></div>
          </> : <div className={styles.signalEmpty}>{metrics ? tr("No classified patterns to show yet.", "Aucun stratagème classé à afficher pour le moment.") : failed ? tr("The Archive’s numbers are unavailable right now.", "Les nombres des Archives sont indisponibles pour le moment.") : tr("Loading the Archive’s signals…", "Chargement des signaux des Archives…")}{failed && !metrics && <button onClick={retry}>{tr("Try again", "Réessayer")}</button>}</div>}
        </div>
        <div className={styles.signalNotes}><p>{tr("Recorded signals, in motion. Counts refresh every 30 seconds; movement does not represent new reports arriving.", "Des signaux enregistrés, en mouvement. Les nombres sont actualisés toutes les 30 secondes; le mouvement ne représente pas de nouveaux signalements.")}</p>{metrics && <details><summary>{tr("See the numbers behind the view", "Voir les nombres derrière cette vue")}</summary><p>{tr(`${number(metrics.classified)} scans have an assigned type. ${number(metrics.unclassified)} have no assigned type. These are automated classifications, not confirmed crimes or a count of people.`, `${number(metrics.classified)} analyses ont un type attribué. ${number(metrics.unclassified)} n’en ont pas. Il s’agit de classifications automatiques, pas de crimes confirmés ni d’un nombre de personnes.`)}</p><dl>{signals.map(signal => <div key={signal.id}><dt>{signal.label}</dt><dd>{number(signal.count)}</dd></div>)}</dl><p>{tr("Data updated", "Données mises à jour")} <time dateTime={metrics.generatedAt}>{new Date(metrics.generatedAt).toLocaleString(lang === "fr" ? "fr-CA" : "en-CA", { dateStyle: "medium", timeStyle: "short" })}</time>.</p></details>}{failed && metrics && <p role="status">{tr("The latest refresh failed. Showing the last available counts.", "La dernière actualisation a échoué. Les derniers nombres disponibles sont affichés.")}</p>}</div>
        <div className={styles.learnInvitation}><h2>{tr("Want to understand how it works?", "Vous voulez comprendre comment ça fonctionne?")}</h2><p>{tr("Follow one example, from the first contact to a response that puts you back in control.", "Suivez un exemple, du premier contact à une réponse qui vous redonne le contrôle.")}</p><Link className={styles.primary} href={learnHref}>{tr("Learn how scams work", "Comprendre comment les fraudes fonctionnent")}<span aria-hidden="true">→</span></Link><span className={styles.guideNote}>{tr("A short guide · One step at a time", "Un court guide · Une étape à la fois")}</span></div>
      </section>
    </main>
    <footer className={styles.footer}><span>{tr("Knowledge grows when we share it.", "Les connaissances grandissent quand on les partage.")}</span><a href={`mailto:hello@scanscam.ca?subject=${encodeURIComponent(tr("Join the Watch", "Rejoindre la Vigie"))}`}>{tr("Join the Watch — get in touch", "Rejoindre la Vigie — nous écrire")}</a></footer>
  </div>;
}
