"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  archivePatterns,
  facetCopy,
  lensCopy,
  pair,
  type ArchiveLang,
  type ArchiveLens,
  type ArchivePattern,
} from "./archiveData";
import styles from "./archiveExplorer.module.css";

type Counts = Record<string, number>;
type Selection = { kind: "pattern"; id: string } | { kind: "facet"; id: string } | null;

const lenses: ArchiveLens[] = ["patterns", "goals", "pressure", "requests", "breaks"];
const learningLevels: Array<Exclude<ArchiveLens, "patterns">> = ["goals", "pressure", "requests", "breaks"];
const levelOrder = ["threshold", ...lenses, "report"] as const;
type ArchiveLevel = typeof levelOrder[number];
const facetField: Record<Exclude<ArchiveLens, "patterns">, keyof ArchivePattern> = {
  goals: "goal",
  pressure: "pressure",
  requests: "requests",
  breaks: "breaks",
};

const copy = {
  en: {
    archive: "The Archive",
    vigil: "The Vigil",
    thesis: "Once you see the pattern, you become harder to fool.",
    lead: "Explore how manipulation works—online, by phone, at work, at your door, or face to face.",
    report: "Tell us what happened",
    helping: "I’m helping someone",
    family: "Protect my family",
    join: "Join the Watch",
    paths: "Choose where you enter",
    descend: "Follow the source",
    archiveLead: "Every story is different. The mechanics repeat.",
    reportLead: "Bring an experience into the Vigil. See how it was constructed and leave with a practical incident ledger.",
    reportAction: "Begin an anonymous report",
    helpingLead: "Walk through the experience with someone you care about.",
    scan: "Scan a suspicious message",
    guide: "Select a strand or change the lens.",
    seen: "Seen in the Archive",
    analyses: "classified analyses",
    observed: "Observed across ScanScam’s structured signal data. Counts describe detected features, not confirmed crimes.",
    pattern: "The pattern",
    setup: "The setup",
    mechanism: "How control is built",
    goal: "Probable end goal",
    pressure: "Pressure and emotion",
    request: "The request",
    break: "Break the pattern",
    realWorld: "Beyond the screen",
    example: "Example",
    connected: "Connected patterns",
    close: "Close",
    source: "Open collective view",
    coreTitle: "What the signals reveal together",
    coreLead: "The source connects different stories that use the same mechanics. A delivery text and an in-person authority threat may look different while borrowing the same trust, urgency and request for action.",
    live: "Live Archive signal",
  },
  fr: {
    archive: "Les Archives",
    vigil: "La Vigie",
    thesis: "Quand vous voyez le motif, il devient plus difficile de vous tromper.",
    lead: "Explorez le fonctionnement de la manipulation — en ligne, au téléphone, au travail, à votre porte ou en personne.",
    report: "Racontez-nous ce qui s’est passé",
    helping: "J’aide quelqu’un",
    family: "Protéger ma famille",
    join: "Rejoindre la Vigie",
    paths: "Choisissez votre point d’entrée",
    descend: "Suivre la source",
    archiveLead: "Chaque histoire est différente. Les mécanismes se répètent.",
    reportLead: "Apportez une expérience à la Vigie. Voyez comment elle a été construite et repartez avec un registre pratique.",
    reportAction: "Commencer un signalement anonyme",
    helpingLead: "Parcourez l’expérience avec une personne qui vous est chère.",
    scan: "Analyser un message suspect",
    guide: "Sélectionnez un fil ou changez de lentille.",
    seen: "Vu dans les Archives",
    analyses: "analyses classées",
    observed: "Observé dans les données structurées de ScanScam. Les comptes décrivent des caractéristiques détectées, pas des crimes confirmés.",
    pattern: "Le motif",
    setup: "La mise en place",
    mechanism: "Comment le contrôle se construit",
    goal: "Objectif probable",
    pressure: "Pression et émotion",
    request: "La demande",
    break: "Briser le motif",
    realWorld: "Au-delà de l’écran",
    example: "Exemple",
    connected: "Motifs liés",
    close: "Fermer",
    source: "Ouvrir la vue collective",
    coreTitle: "Ce que les signaux révèlent ensemble",
    coreLead: "La source relie des histoires différentes qui utilisent les mêmes mécanismes. Un texto de livraison et une menace d’autorité en personne peuvent sembler différents tout en empruntant la même confiance, la même urgence et la même demande d’action.",
    live: "Signal vivant des Archives",
  },
};

function facetsFor(lens: Exclude<ArchiveLens, "patterns">) {
  const values = new Set<string>();
  for (const pattern of archivePatterns) {
    for (const value of pattern[facetField[lens]] as string[]) values.add(value);
  }
  return [...values];
}

function countForPattern(pattern: ArchivePattern, counts: Counts) {
  return pattern.aliases.reduce((sum, alias) => sum + (counts[alias] || 0), counts[pattern.id] || 0);
}

export default function ArchiveExplorer({ initialLang = "en", initialPattern = "" }: { initialLang?: ArchiveLang; initialPattern?: string }) {
  const initialMatch = archivePatterns.find((item) => item.id === initialPattern || item.aliases.includes(initialPattern));
  const [lang, setLang] = useState<ArchiveLang>(initialLang);
  const [lens, setLens] = useState<ArchiveLens>("patterns");
  const [selection, setSelection] = useState<Selection>(initialMatch ? { kind: "pattern", id: initialMatch.id } : null);
  const [counts, setCounts] = useState<Counts>({});
  const [sampleSize, setSampleSize] = useState<number | null>(null);
  const [activeLevel, setActiveLevel] = useState<ArchiveLevel>(initialMatch ? "patterns" : "threshold");
  const t = copy[lang];

  useEffect(() => {
    fetch("/api/atlas/archive")
      .then((response) => response.json())
      .then((data) => {
        if (data?.ok && data.counts) setCounts(data.counts);
        if (typeof data?.sampleSize === "number") setSampleSize(data.sampleSize);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!initialMatch) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById("archive-patterns")?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [initialMatch]);

  const selectedPattern = selection?.kind === "pattern"
    ? archivePatterns.find((item) => item.id === selection.id) || null
    : null;
  const selectedFacet = selection?.kind === "facet" ? selection.id : null;
  const connected = selectedFacet && selectedFacet !== "core" && lens !== "patterns"
    ? archivePatterns.filter((pattern) => (pattern[facetField[lens]] as string[]).includes(selectedFacet))
    : [];

  const moveTo = (level: ArchiveLevel) => {
    setActiveLevel(level);
    if (level !== "threshold" && level !== "report") setLens(level);
    document.getElementById(`archive-${level}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const trackLevel = (event: React.UIEvent<HTMLElement>) => {
    const scroller = event.currentTarget;
    const marker = scroller.scrollTop + scroller.clientHeight * .48;
    let current: ArchiveLevel = "threshold";
    for (const level of levelOrder) {
      const section = document.getElementById(`archive-${level}`);
      if (section && section.offsetTop <= marker) current = level;
    }
    setActiveLevel(current);
  };

  return (
    <>
    <main className={styles.archive} data-level={activeLevel} data-open={Boolean(selection)} onScroll={trackLevel}>
      <div className={styles.fixedWorld} aria-hidden="true">
        <Image className={styles.world} src="/atlas/vigil-brutalist-spectrum.webp" alt="" fill priority sizes="100vw" />
        <div className={styles.shadow} />
        <div className={styles.source}>
          <div className={styles.redBeam} />
          <div className={`${styles.orbit} ${styles.orbitOne}`}><i /><i /></div>
          <div className={`${styles.orbit} ${styles.orbitTwo}`}><i /><i /></div>
          <div className={`${styles.orbit} ${styles.orbitThree}`}><i /><i /></div>
          <div className={styles.crown} />
          <div className={styles.well} />
        </div>
        <div className={styles.grain} />
      </div>

      <header className={styles.nav}>
        <Link href="/">ScanScam</Link><span>{t.archive}</span>
        <div><button onClick={() => setLang("en")} aria-pressed={lang === "en"}>EN</button><button onClick={() => setLang("fr")} aria-pressed={lang === "fr"}>FR</button></div>
      </header>

      <nav className={styles.levelRail} aria-label={lang === "en" ? "Archive levels" : "Niveaux des Archives"}>
        {levelOrder.map((level, index) => <button key={level} aria-current={activeLevel === level ? "step" : undefined} onClick={() => moveTo(level)}>
          <i>{String(index + 1).padStart(2, "0")}</i><span>{level === "threshold" ? t.archive : level === "report" ? t.report : lensCopy[level].label[lang]}</span>
        </button>)}
      </nav>

      <section id="archive-threshold" className={`${styles.level} ${styles.threshold}`} data-archive-level="threshold">
        <div className={styles.thresholdCopy}><p>{t.vigil}</p><h1>{t.thesis}</h1><span>{t.lead}</span></div>
        <div className={styles.entryPaths}>
          <small>{t.paths}</small>
          <Link href={`/scan?lang=${lang}`}><b>{t.scan}</b><span>{lang === "en" ? "Check something suspicious now." : "Vérifiez quelque chose de suspect."}</span></Link>
          <button onClick={() => moveTo("patterns")}><b>{lensCopy.patterns.label[lang]}</b><span>{t.archiveLead}</span></button>
          <Link href={`/atlas/report?lang=${lang}&mode=lived`}><b>{t.report}</b><span>{t.reportLead}</span></Link>
        </div>
        <button className={styles.descend} onClick={() => moveTo("patterns")}>{t.descend}<i>↓</i></button>
      </section>

      <section id="archive-patterns" className={`${styles.level} ${styles.patternLevel}`} data-archive-level="patterns">
        <LevelHeading number="01" title={lensCopy.patterns.label[lang]} prompt={lensCopy.patterns.prompt[lang]} />
        <div className={styles.patternConstellation}>
          {archivePatterns.map((pattern, index) => <button key={pattern.id} data-side={index % 2 ? "right" : "left"} onClick={() => { setLens("patterns"); setSelection({ kind: "pattern", id: pattern.id }); }}>
            <i aria-hidden="true" /><span><b>{pair(pattern.name, lang)}</b><em>{pair(pattern.opening, lang)}</em></span>
            {countForPattern(pattern, counts) >= 5 && <small>{countForPattern(pattern, counts)}</small>}
          </button>)}
        </div>
      </section>

      {learningLevels.map((level, sectionIndex) => {
        const facets = facetsFor(level).map((id) => ({ id, count: counts[id] || 0 })).sort((a, b) => b.count - a.count).slice(0, 8);
        return <section id={`archive-${level}`} key={level} className={`${styles.level} ${styles.facetLevel}`} data-archive-level={level}>
          <LevelHeading number={String(sectionIndex + 2).padStart(2, "0")} title={lensCopy[level].label[lang]} prompt={lensCopy[level].prompt[lang]} />
          <div className={styles.facetField}>
            {facets.map((item, index) => <button key={item.id} style={{ "--order": index } as React.CSSProperties} onClick={() => { setLens(level); setSelection({ kind: "facet", id: item.id }); }}>
              <i aria-hidden="true" /><b>{facetCopy[item.id]?.[lang] || item.id}</b>{item.count >= 5 && <small>{item.count}</small>}
            </button>)}
          </div>
        </section>;
      })}

      <section id="archive-report" className={`${styles.level} ${styles.reportLevel}`} data-archive-level="report">
        <div className={styles.reportInvitation}>
          <p>{lang === "en" ? "A new signal" : "Un nouveau signal"}</p>
          <h2>{t.report}</h2><span>{t.reportLead}</span>
          <div>
            <Link href={`/atlas/report?lang=${lang}&mode=lived`}>{t.reportAction}</Link>
            <Link href={`/atlas/report?lang=${lang}&mode=helping`}>{t.helping}</Link>
          </div>
          <small>{lang === "en" ? "Your answers identify recurring and emerging patterns. Your private words and precise ledger details are not contributed." : "Vos réponses servent à repérer les motifs récurrents et émergents. Vos mots privés et les détails précis du registre ne sont pas partagés."}</small>
        </div>
        <div className={styles.collective}>
          <button onClick={() => setSelection({ kind: "facet", id: "core" })}>{t.source}</button>
          <a href={`mailto:hello@scanscam.ca?subject=${encodeURIComponent(t.join)}`}>{t.join}</a>
          <Link href={lang === "en" ? "/protect-family" : "/fr/protect-family"}>{t.family}</Link>
        </div>
      </section>

      <button className={styles.coreButton} onClick={() => setSelection({ kind: "facet", id: "core" })}><span>{t.source}</span><i /></button>
    </main>

      {selection && <aside className={styles.reading} aria-live="polite">
        <div className={styles.drawnThread} aria-hidden="true" /><button className={styles.close} onClick={() => setSelection(null)} aria-label={t.close}>×</button>
        {selection.id === "core" ? <><p>{t.vigil}</p><h2>{t.coreTitle}</h2><blockquote>{t.coreLead}</blockquote>
          <div className={styles.coreRelations}>{(["false_trust", "urgency", "pay_money", "submit_credentials"] as const).map((id) => <button key={id} onClick={() => { setLens(["pay_money", "submit_credentials"].includes(id) ? "requests" : "pressure"); setSelection({ kind: "facet", id }); }}>{facetCopy[id][lang]}{counts[id] >= 5 && <small>{counts[id]}</small>}</button>)}</div>
          <div className={styles.watchActions}><a href={`mailto:hello@scanscam.ca?subject=${encodeURIComponent(t.join)}`}>{t.join}</a><Link href={lang === "en" ? "/protect-family" : "/fr/protect-family"}>{t.family}</Link></div>
          {sampleSize && <div className={styles.evidence}><b>{sampleSize.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA")} {t.analyses}</b><span>{t.observed}</span></div>}
        </> : selectedPattern ? <PatternReading pattern={selectedPattern} lang={lang} counts={counts} onFacet={(nextLens, id) => { setLens(nextLens); setSelection({ kind: "facet", id }); }} /> : selectedFacet ? <><p>{lensCopy[lens].label[lang]}</p><h2>{facetCopy[selectedFacet]?.[lang] || selectedFacet}</h2><blockquote>{lensCopy[lens].prompt[lang]}</blockquote><h3>{t.connected}</h3>
          <div className={styles.connected}>{connected.map((pattern) => <button key={pattern.id} onClick={() => setSelection({ kind: "pattern", id: pattern.id })}><b>{pair(pattern.name, lang)}</b><span>{pair(pattern.mechanism, lang)}</span></button>)}</div>
          {counts[selectedFacet] >= 5 && <div className={styles.evidence}><b>{t.live}: {counts[selectedFacet].toLocaleString(lang === "fr" ? "fr-CA" : "en-CA")}</b><span>{t.observed}</span></div>}</> : null}
      </aside>}
    </>
  );
}

function LevelHeading({ number, title, prompt }: { number: string; title: string; prompt: string }) {
  return <header className={styles.levelHeading}><small>{number}</small><h2>{title}</h2><p>{prompt}</p></header>;
}

function PatternReading({ pattern, lang, counts, onFacet }: {
  pattern: ArchivePattern;
  lang: ArchiveLang;
  counts: Counts;
  onFacet: (lens: Exclude<ArchiveLens, "patterns">, id: string) => void;
}) {
  const t = copy[lang];
  const count = countForPattern(pattern, counts);
  const group = (title: string, lens: Exclude<ArchiveLens, "patterns">, values: string[]) => <section>
    <h3>{title}</h3>
    <div className={styles.facets}>{values.map((id) => <button key={id} onClick={() => onFacet(lens, id)}>{facetCopy[id][lang]}</button>)}</div>
  </section>;
  return <>
    <p>{t.pattern}</p>
    <h2>{pair(pattern.title, lang)}</h2>
    <blockquote>{pair(pattern.opening, lang)}</blockquote>
    <section><h3>{t.mechanism}</h3><p>{pair(pattern.mechanism, lang)}</p></section>
    {group(t.goal, "goals", pattern.goal)}
    {group(t.pressure, "pressure", pattern.pressure)}
    {group(t.request, "requests", pattern.requests)}
    {group(t.break, "breaks", pattern.breaks)}
    <section><h3>{t.realWorld}</h3><p>{pair(pattern.realWorld, lang)}</p></section>
    <section><h3>{t.example}</h3><q>{pair(pattern.example, lang)}</q></section>
    {count >= 5 && <div className={styles.evidence}><b>{t.seen}: {count.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA")}</b><span>{t.observed}</span></div>}
  </>;
}
