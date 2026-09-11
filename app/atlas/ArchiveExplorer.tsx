"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { archivePatterns, facetCopy, lensCopy, type ArchiveLang, type ArchiveLens, type Pair } from "./archiveData";
import { facetExplanation } from "./learningContent";
import ScamGuide from "./ScamGuide";
import { useArchiveMetrics } from "./useArchiveMetrics";
import styles from "./archiveExplorer.module.css";

type Lens = ArchiveLens | "authority";
const lenses: Lens[] = ["patterns", "goals", "pressure", "requests", "authority", "breaks"];
const field: Record<Exclude<Lens, "patterns">, "goal" | "pressure" | "requests" | "breaks" | "authority"> = { goals: "goal", pressure: "pressure", requests: "requests", breaks: "breaks", authority: "authority" };
const authorityLabels = { government: { en: "Government & police", fr: "Gouvernement et police" }, financial_institution: { en: "Banks", fr: "Banques" }, corporate: { en: "Companies & employers", fr: "Entreprises et employeurs" }, tech_company: { en: "Technology support", fr: "Soutien technologique" } };
const allLabels: Record<string, Pair> = { ...facetCopy, ...authorityLabels };

export default function ArchiveExplorer({ initialLang = "en", initialPattern = "" }: { initialLang?: ArchiveLang; initialPattern?: string }) {
  const [lang, setLang] = useState(initialLang);
  const tr = (en: string, fr: string) => lang === "fr" ? fr : en;
  const { metrics } = useArchiveMetrics();
  const [lens, setLens] = useState<Lens>("patterns");
  const initialMatch = archivePatterns.find(p => p.id === initialPattern || p.aliases.includes(initialPattern));
  const [showExplorer, setShowExplorer] = useState(Boolean(initialMatch));
  const [patternId, setPatternId] = useState(initialMatch?.id ?? "account_verification");
  const [facet, setFacet] = useState<string | null>(null);
  const [immersive, setImmersive] = useState(false);
  const [motion, setMotion] = useState(true);
  const exploration = useRef<HTMLElement>(null);
  const reading = useRef<HTMLElement>(null);
  useEffect(() => {
    if (showExplorer) {
      exploration.current?.scrollIntoView({ block: "start", behavior: "instant" });
      reading.current?.focus({ preventScroll: true });
    }
  }, [showExplorer]);
  const pattern = archivePatterns.find(p => p.id === patternId) ?? archivePatterns[0];
  const label = (id: string) => allLabels[id]?.[lang] ?? id;
  const lensLabel = (value: Lens) => value === "authority" ? tr("Claimed identity", "Identité revendiquée") : lensCopy[value].label[lang];
  const facetList = lens === "patterns" ? [] : [...new Set(archivePatterns.flatMap(p => p[field[lens]]))];
  const related = lens !== "patterns" && facet ? archivePatterns.filter(p => p[field[lens]].includes(facet)) : [];
  const changeLens = (next: Lens) => {
    setLens(next);
    setFacet(next === "patterns" ? null : archivePatterns.flatMap(p => p[field[next]])[0] ?? null);
  };
  const openPattern = (id: string) => { setPatternId(id); setLens("patterns"); setFacet(null); reading.current?.focus({ preventScroll: true }); };
  const openFacet = (next: Exclude<Lens, "patterns">, id: string) => { setLens(next); setFacet(id); reading.current?.focus({ preventScroll: true }); };
  const facetCount = metrics && facet ? lens === "pressure" ? metrics.pressure[facet] : lens === "requests" ? metrics.requests[facet === "reply" ? "reply_sms" : facet] : lens === "authority" ? metrics.authorities[facet] : undefined : undefined;
  const number = (n: number) => n.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA");
  const familyHref = lang === "fr" ? "/fr/protect-family" : "/protect-family";
  return <div className={styles.page} lang={lang}>
    <a href="#learn" className={styles.skip}>{tr("Skip to lesson", "Aller à la leçon")}</a>
    <header className={styles.header}>
      <Link className={styles.brand} href={`/atlas?lang=${lang}`}>ScanScam<span>{tr("The Archive", "Les Archives")}</span></Link>
      <nav aria-label={tr("Ways we can help", "Comment nous pouvons aider")}>
        <Link href={`/atlas?lang=${lang}`}>{tr("Back to welcome", "Retour à l’accueil")}</Link>
        <Link href={`/scan?lang=${lang}`}>{tr("Scan a message", "Analyser un message")}</Link>
        <Link href={`/atlas/report?lang=${lang}&mode=lived`}>{tr("Tell us what happened", "Racontez-nous")}</Link>
        <Link href={familyHref}>{tr("Protect my family", "Protéger ma famille")}</Link>
      </nav>
      <div className={styles.languages}><button aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button><button aria-pressed={lang === "fr"} onClick={() => setLang("fr")}>FR</button></div>
    </header>
    <main>
      <div className={`${styles.intro} ${styles.guideIntro}`}>
        <p className={styles.eyebrow}>{tr("Learn to recognise manipulation", "Apprendre à reconnaître la manipulation")}</p>
        <h1>{tr("See how a scam unfolds.", "Voyez comment une fraude se déroule.")}</h1>
        <p>{tr("Follow the contact, the request, the pressure and the goal. Then see where you can take back control.", "Suivez le contact, la demande, la pression et l’objectif. Puis voyez où vous pouvez reprendre le contrôle.")}</p>
      </div>
      <div id="learn" className={styles.learn}>
        <ScamGuide lang={lang} onExplore={() => { if (showExplorer) exploration.current?.scrollIntoView({ block: "start", behavior: "instant" }); else setShowExplorer(true); }} />
        {!showExplorer && <button className={styles.browseDirect} onClick={() => setShowExplorer(true)}>{tr("Already familiar? Browse the patterns", "Vous connaissez déjà les bases? Parcourir les stratagèmes")} →</button>}
      </div>
      {showExplorer && <>
      <section ref={exploration} id="explore" className={styles.explore} data-immersive={immersive} data-motion={motion} style={{ "--level": lenses.indexOf(lens) } as CSSProperties}>
        {immersive && <div className={styles.cathedral} aria-hidden="true"><Image src="/atlas/vigil-brutalist-spectrum.webp" alt="" fill sizes="100vw" /><div /></div>}
        <div className={styles.exploreInner}>
          <header className={styles.exploreHeader}><div><p className={styles.eyebrow}>{tr("Keep learning", "Poursuivre la découverte")}</p><h2>{tr("Different stories. Connected patterns.", "Des histoires différentes. Des mécanismes communs.")}</h2><p>{tr("Choose an example, or follow a connection to understand the method behind it.", "Choisissez un exemple ou suivez un lien pour comprendre la méthode derrière l’histoire.")}</p></div>
            <div className={styles.viewControls}><button aria-pressed={immersive} onClick={() => setImmersive(v => !v)}>{immersive ? tr("Return to light view", "Revenir à la vue claire") : tr("Explore in the cathedral", "Explorer dans la cathédrale")}</button>{immersive && <button aria-pressed={!motion} onClick={() => setMotion(v => !v)}>{motion ? tr("Pause motion", "Arrêter l’animation") : tr("Resume motion", "Reprendre l’animation")}</button>}</div>
          </header>
          <div className={styles.explorerSurface}>
            <nav className={styles.lenses} aria-label={tr("Explore by", "Explorer par")}>
              {lenses.map(value => <button key={value} aria-pressed={lens === value} onClick={() => changeLens(value)}>{lensLabel(value)}</button>)}
            </nav>
            <div className={styles.explorerGrid}>
              <nav className={styles.index} aria-label={lensLabel(lens)}>{lens === "patterns" ? archivePatterns.map(p => <button key={p.id} aria-pressed={patternId === p.id} onClick={() => openPattern(p.id)}><span>{p.name[lang]}</span><span aria-hidden="true">↗</span></button>) : facetList.map(id => <button key={id} aria-pressed={facet === id} onClick={() => { setFacet(id); reading.current?.focus({ preventScroll: true }); }}><span>{label(id)}</span><span aria-hidden="true">↗</span></button>)}</nav>
              <article ref={reading} tabIndex={-1} className={styles.reading} aria-label={tr("Explanation", "Explication")}>
                {lens === "patterns" ? <>
                  <p className={styles.eyebrow}>{pattern.name[lang]}</p><h3>{pattern.title[lang]}</h3><p>{pattern.opening[lang]}</p>
                  <blockquote><span>{tr("Illustrative example", "Exemple fictif")}</span>{pattern.example[lang]}</blockquote>
                  <h4>{tr("What they want", "Ce qu’on cherche à obtenir")}</h4><div className={styles.connections}>{pattern.goal.map(id => <button key={id} onClick={() => openFacet("goals", id)}>{label(id)} <span aria-hidden="true">↗</span></button>)}</div>
                  <h4>{tr("How the story works", "Comment l’histoire fonctionne")}</h4><p>{pattern.mechanism[lang]}</p>
                  {(["pressure", "requests", "authority", "breaks"] as const).map(group => <div key={group} className={styles.connectionRow}><h4>{lensLabel(group)}</h4><div className={styles.connections}>{pattern[group].map(id => <button key={id} onClick={() => openFacet(group, id)}>{label(id)} <span aria-hidden="true">↗</span></button>)}{!pattern[group].length && <span>{tr("Trust may come from the relationship itself.", "La confiance peut venir de la relation elle-même.")}</span>}</div></div>)}
                  <details className={styles.more}><summary>{tr("How this appears beyond the internet", "Comment cela se manifeste hors d’Internet")}</summary><p>{pattern.realWorld[lang]}</p></details>
                  {metrics && <p className={styles.countCaption}>{tr(`${number(metrics.families[pattern.id] ?? 0)} scans carry this exact type label. Related types are counted separately.`, `${number(metrics.families[pattern.id] ?? 0)} analyses portent exactement ce type. Les types voisins sont comptés séparément.`)}</p>}
                </> : facet ? <>
                  <p className={styles.eyebrow}>{lensLabel(lens)}</p><h3>{label(facet)}</h3><p className={styles.facetLead}>{facetExplanation[facet]?.[lang]}</p>
                  <h4>{tr("See this method in different situations", "Voir cette méthode dans différentes situations")}</h4>
                  <p>{tr("These are learning connections: examples of how the same method can appear in different scams.", "Ces liens pédagogiques montrent comment une même méthode peut apparaître dans différentes fraudes.")}</p>
                  <div className={styles.related}>{related.map(p => <button key={p.id} onClick={() => openPattern(p.id)}><b>{p.name[lang]}</b><span>{p.example[lang]}</span><em>{tr("Open example", "Ouvrir l’exemple")} ↗</em></button>)}</div>
                  {typeof facetCount === "number" && <p className={styles.countCaption}>{tr(`${number(facetCount)} scan records have this detected feature. Each scan is counted once for this feature; this is not a count of victims.`, `${number(facetCount)} analyses contiennent ce signal détecté. Chaque analyse compte une fois pour ce signal; ce n’est pas un nombre de victimes.`)}</p>}
                </> : null}
              </article>
            </div>
          </div>
          <p className={styles.catalogueNote}>{tr("Six introductory examples. The Archive’s scan data includes additional and unclassified types. These lessons do not cover every scam.", "Six exemples pour commencer. Les données comprennent d’autres types et des analyses non classées. Ces leçons ne couvrent pas toutes les fraudes.")}</p>
        </div>
      </section>
      <section className={styles.support}>
        <div><p className={styles.eyebrow}>{tr("Something feels familiar?", "Cela vous rappelle quelque chose?")}</p><h2>{tr("You can make sense of what happened.", "Vous pouvez comprendre ce qui s’est passé.")}</h2><p>{tr("Walk through it at your own pace and create an incident ledger you can copy or share with your bank or a reporting service.", "Reprenez les faits à votre rythme et créez un registre que vous pourrez copier ou transmettre à votre banque ou à un service de signalement.")}</p><Link className={styles.primary} href={`/atlas/report?lang=${lang}&mode=lived`}>{tr("Tell us what happened", "Racontez-nous ce qui s’est passé")} <span aria-hidden="true">→</span></Link><Link className={styles.helpLink} href={`/atlas/report?lang=${lang}&mode=helping`}>{tr("I’m helping someone else", "J’aide quelqu’un d’autre")}</Link></div>
        <aside><h3>{tr("We learn more when we compare notes.", "Ensemble, nous pouvons mieux comprendre.")}</h3><p>{tr("Help shape a community that shares knowledge and supports people facing manipulation.", "Aidez à façonner une communauté qui partage ses connaissances et soutient les personnes confrontées à la manipulation.")}</p><a href={`mailto:hello@scanscam.ca?subject=${encodeURIComponent(tr("Join the Watch", "Rejoindre la Vigie"))}`}>{tr("Join the Watch — get in touch", "Rejoindre la Vigie — nous écrire")} ↗</a></aside>
      </section>
      </>}
    </main>
    <footer className={styles.footer}><span>ScanScam · {tr("Learning together makes the pattern clearer.", "Apprendre ensemble rend les stratagèmes plus visibles.")}</span><Link href={familyHref}>{tr("Protect someone you love", "Protéger une personne que vous aimez")}</Link></footer>
  </div>;
}
