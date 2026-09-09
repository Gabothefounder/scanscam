"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

  const nodes = useMemo(() => lens === "patterns" ? archivePatterns.map((pattern) => ({
    id: pattern.id,
    label: pair(pattern.name, lang),
    count: countForPattern(pattern, counts),
  })) : facetsFor(lens).map((id) => ({
    id,
    label: pair(facetCopy[id], lang),
    count: counts[id] || 0,
  })).sort((a, b) => b.count - a.count), [counts, lang, lens]);

  const selectedPattern = selection?.kind === "pattern"
    ? archivePatterns.find((item) => item.id === selection.id) || null
    : null;
  const selectedFacet = selection?.kind === "facet" ? selection.id : null;
  const connected = selectedFacet && selectedFacet !== "core" && lens !== "patterns"
    ? archivePatterns.filter((pattern) => (pattern[facetField[lens]] as string[]).includes(selectedFacet))
    : [];

  const chooseLens = (next: ArchiveLens) => {
    setLens(next);
    setSelection(null);
  };

  return (
    <main className={styles.archive} data-lens={lens} data-open={Boolean(selection)}>
      <Image className={styles.world} src="/atlas/vigil-brutalist-spectrum.png" alt="" fill priority sizes="100vw" />
      <div className={styles.shadow} aria-hidden="true" />
      <div className={styles.grain} aria-hidden="true" />

      <header className={styles.nav}>
        <Link href="/">ScanScam</Link>
        <span>{t.archive}</span>
        <div>
          <Link href={`/scan?lang=${lang}`}>{t.scan}</Link>
          <button onClick={() => setLang("en")} aria-pressed={lang === "en"}>EN</button>
          <button onClick={() => setLang("fr")} aria-pressed={lang === "fr"}>FR</button>
        </div>
      </header>

      <section className={styles.intro}>
        <p>{t.vigil}</p>
        <h1>{t.thesis}</h1>
        <span>{t.lead}</span>
        <div>
          <button onClick={() => chooseLens("patterns")}>{lens === "patterns" ? t.guide : lensCopy.patterns.label[lang]}</button>
          <Link href={`/atlas/report?lang=${lang}`}>{t.report}</Link>
        </div>
      </section>

      <button className={styles.coreButton} onClick={() => setSelection({ kind: "facet", id: "core" })}>
        <span>{t.source}</span>
      </button>

      <div className={styles.nodes} aria-label={lensCopy[lens].label[lang]}>
        {nodes.slice(0, 7).map((node, index) => {
          const pressed = selection?.id === node.id;
          return <button
            key={node.id}
            className={styles.node}
            style={{ "--node-index": index } as React.CSSProperties}
            aria-pressed={pressed}
            onClick={() => setSelection({ kind: lens === "patterns" ? "pattern" : "facet", id: node.id })}
          >
            <i aria-hidden="true" />
            <span>{node.label}</span>
            {node.count >= 5 && <small>{node.count.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA")}</small>}
          </button>;
        })}
      </div>

      <nav className={styles.lenses} aria-label={lang === "en" ? "Ways to explore" : "Façons d’explorer"}>
        {lenses.map((item) => <button key={item} aria-pressed={lens === item} onClick={() => chooseLens(item)}>
          {lensCopy[item].label[lang]}
        </button>)}
        <p>{lensCopy[lens].prompt[lang]}</p>
      </nav>

      {selection && <aside className={styles.reading} aria-live="polite">
        <button className={styles.close} onClick={() => setSelection(null)} aria-label={t.close}>×</button>
        {selection.id === "core" ? <>
          <p>{t.vigil}</p>
          <h2>{t.coreTitle}</h2>
          <blockquote>{t.coreLead}</blockquote>
          <div className={styles.coreRelations}>
            {(["false_trust", "urgency", "pay_money", "submit_credentials"] as const).map((id) =>
              <button key={id} onClick={() => { setLens(["pay_money", "submit_credentials"].includes(id) ? "requests" : "pressure"); setSelection({ kind: "facet", id }); }}>
                {facetCopy[id][lang]}{counts[id] >= 5 && <small>{counts[id]}</small>}
              </button>
            )}
          </div>
          {sampleSize && <div className={styles.evidence}><b>{sampleSize.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA")} {t.analyses}</b><span>{t.observed}</span></div>}
        </> : selectedPattern ? <PatternReading pattern={selectedPattern} lang={lang} counts={counts} onFacet={(nextLens, id) => { setLens(nextLens); setSelection({ kind: "facet", id }); }} /> : selectedFacet ? <>
          <p>{lensCopy[lens].label[lang]}</p>
          <h2>{facetCopy[selectedFacet]?.[lang] || selectedFacet}</h2>
          <blockquote>{lensCopy[lens].prompt[lang]}</blockquote>
          <h3>{t.connected}</h3>
          <div className={styles.connected}>
            {connected.map((pattern) => <button key={pattern.id} onClick={() => setSelection({ kind: "pattern", id: pattern.id })}>
              <b>{pair(pattern.name, lang)}</b><span>{pair(pattern.mechanism, lang)}</span>
            </button>)}
          </div>
          {counts[selectedFacet] >= 5 && <div className={styles.evidence}><b>{t.live}: {counts[selectedFacet].toLocaleString(lang === "fr" ? "fr-CA" : "en-CA")}</b><span>{t.observed}</span></div>}
        </> : null}
      </aside>}
    </main>
  );
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
