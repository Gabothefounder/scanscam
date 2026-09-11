"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { archivePatterns, facetCopy, lensCopy, type ArchiveLang, type ArchiveLens, type Pair } from "./archiveData";
import { bankLines, facetExplanation, lessonSteps } from "./learningContent";
import type { ArchiveMetrics } from "@/lib/atlasArchiveMetrics";
import styles from "./archiveExplorer.module.css";

type Lens = ArchiveLens | "authority";
type Metrics = ArchiveMetrics & { generatedAt: string };
const lenses: Lens[] = ["patterns", "goals", "pressure", "requests", "authority", "breaks"];
const field: Record<Exclude<Lens, "patterns">, "goal" | "pressure" | "requests" | "breaks" | "authority"> = { goals: "goal", pressure: "pressure", requests: "requests", breaks: "breaks", authority: "authority" };
const authorityLabels = { government: { en: "Government & police", fr: "Gouvernement et police" }, financial_institution: { en: "Banks", fr: "Banques" }, corporate: { en: "Companies & employers", fr: "Entreprises et employeurs" }, tech_company: { en: "Technology support", fr: "Soutien technologique" } };
const allLabels: Record<string, Pair> = { ...facetCopy, ...authorityLabels };

export default function ArchiveExplorer({ initialLang = "en", initialPattern = "" }: { initialLang?: ArchiveLang; initialPattern?: string }) {
  const [lang, setLang] = useState(initialLang);
  const tr = (en: string, fr: string) => lang === "fr" ? fr : en;
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [lens, setLens] = useState<Lens>("patterns");
  const initialMatch = archivePatterns.find(p => p.id === initialPattern || p.aliases.includes(initialPattern));
  const [patternId, setPatternId] = useState(initialMatch?.id ?? "account_verification");
  const [facet, setFacet] = useState<string | null>(null);
  const [immersive, setImmersive] = useState(false);
  const [motion, setMotion] = useState(true);
  const exploration = useRef<HTMLElement>(null);
  const reading = useRef<HTMLElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/atlas/archive", { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("unavailable");
      const data = await response.json();
      if (!data.ok || typeof data.sampleSize !== "number" || !data.families) throw new Error("unavailable");
      setMetrics(data);
    }).catch(error => { if (error.name !== "AbortError") setFailed(true); });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    if (initialMatch) exploration.current?.scrollIntoView({ block: "start" });
  }, [initialMatch]);
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
      <Link className={styles.brand} href="/">ScanScam<span>{tr("The Archive", "Les Archives")}</span></Link>
      <nav aria-label={tr("Ways we can help", "Comment nous pouvons aider")}>
        <Link href={`/scan?lang=${lang}`}>{tr("Scan a message", "Analyser un message")}</Link>
        <Link href={`/atlas/report?lang=${lang}&mode=lived`}>{tr("Tell us what happened", "Racontez-nous")}</Link>
        <Link href={familyHref}>{tr("Protect my family", "Protéger ma famille")}</Link>
      </nav>
      <div className={styles.languages}><button aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button><button aria-pressed={lang === "fr"} onClick={() => setLang("fr")}>FR</button></div>
    </header>
    <main>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>{tr("Understand scams. Recognise manipulation.", "Comprendre les fraudes. Reconnaître la manipulation.")}</p>
        <h1>{tr("Once you see the pattern,", "Quand vous voyez le stratagème,")}<br /><em>{tr("you become harder to fool.", "vous devenez plus difficile à tromper.")}</em></h1>
        <p>{tr("Learn what they want, how they create pressure, and where you can interrupt it. Online, by phone, at work or face to face.", "Découvrez ce qu’on cherche à obtenir, comment la pression se construit et où l’interrompre. En ligne, au téléphone, au travail ou en personne.")}</p>
      </div>
      <section id="learn" className={styles.learn} aria-label={tr("Guided example", "Exemple guidé")}>
        <BankLesson lang={lang} onExplore={() => exploration.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" })} />
      </section>
      <section className={styles.dataNote} aria-label={tr("About the data", "À propos des données")}>
        <div><p className={styles.eyebrow}>{tr("A shared picture, built from real scans", "Une vue collective, issue de vraies analyses")}</p>
          <p>{tr("Different stories can use the same methods. Learning those methods helps you recognise them in another situation.", "Des histoires différentes peuvent utiliser les mêmes méthodes. Les comprendre aide à les reconnaître dans une autre situation.")}</p></div>
        <div className={styles.metric} aria-live="polite">{metrics ? <><strong>{number(metrics.sampleSize)}</strong><span>{tr("scan records in the Archive", "analyses dans les Archives")}</span>
          <details><summary>{tr("What this number means", "Ce que ce nombre signifie")}</summary><p>{tr(`${number(metrics.classified)} have an assigned scam type; ${number(metrics.unclassified)} do not. These are automated classifications, not confirmed crimes or a count of people.`, `${number(metrics.classified)} ont un type de fraude attribué; ${number(metrics.unclassified)} n’en ont pas. Ce sont des classifications automatiques, pas des crimes confirmés ni un nombre de personnes.`)}</p><p>{tr("Updated", "Mis à jour")} <time dateTime={metrics.generatedAt}>{new Date(metrics.generatedAt).toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA")}</time>.</p></details></> : <p>{failed ? tr("Counts are temporarily unavailable. You can still explore every lesson.", "Les nombres sont temporairement indisponibles. Les leçons restent accessibles.") : tr("Loading the Archive count…", "Chargement du nombre d’analyses…")}{failed && <button onClick={() => { setFailed(false); setAttempt(n => n + 1); }}>{tr("Try again", "Réessayer")}</button>}</p>}</div>
      </section>
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
    </main>
    <footer className={styles.footer}><span>ScanScam · {tr("Learning together makes the pattern clearer.", "Apprendre ensemble rend les stratagèmes plus visibles.")}</span><Link href={familyHref}>{tr("Protect someone you love", "Protéger une personne que vous aimez")}</Link></footer>
  </div>;
}

function BankLesson({ lang, onExplore }: { lang: ArchiveLang; onExplore: () => void }) {
  const tr = (en: string, fr: string) => lang === "fr" ? fr : en;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [complete, setComplete] = useState(false);
  const [transfer, setTransfer] = useState<number | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const current = lessonSteps[step];
  const answered = answers[step] !== undefined;
  const change = (next: number) => { setComplete(false); setStep(next); title.current?.focus({ preventScroll: true }); };
  return <div className={styles.lesson}>
    <header className={styles.lessonHeader}><div><span className={styles.eyebrow}>{tr("Start here · A short guided example", "Commencez ici · Un court exemple guidé")}</span><h2>{tr("“This is your bank calling.”", "« Ici votre banque. »")}</h2></div><span className={styles.stepCount}>{tr("Step", "Étape")} {complete ? 4 : step + 1} / 4</span></header>
    <nav className={styles.steps} aria-label={tr("Lesson steps", "Étapes de la leçon")}>{lessonSteps.map((s, index) => <button key={index} onClick={() => change(index)} aria-current={!complete && step === index ? "step" : undefined}><span>{index + 1}</span>{s.label[lang]}</button>)}</nav>
    <div className={styles.lessonGrid}>
      <div className={styles.message}><p className={styles.messageLabel}>{tr("An unexpected phone call", "Un appel inattendu")}</p><div className={styles.transcript}>{bankLines.map((line, index) => <p key={index} data-highlight={answered && current.highlight === index && !complete}>{line[lang]}</p>)}</div><p className={styles.exampleNote}>{tr("A fictional example for learning. No real message or personal information is shown.", "Un exemple fictif pour apprendre. Aucun vrai message ni renseignement personnel n’est affiché.")}</p><span className={styles.messageFoot}>{tr("The claim sounds protective. Look at the action it asks for.", "L’affirmation semble protectrice. Regardez le geste demandé.")}</span></div>
      <div className={styles.exercise}>
        {!complete ? <><h3 ref={title} tabIndex={-1}>{current.question[lang]}</h3><p className={styles.hint}>{tr("Choose an answer to see why it matters.", "Choisissez une réponse pour comprendre pourquoi.")}</p><div className={styles.answers}>{current.options.map((option, index) => <button key={index} aria-pressed={answers[step] === index} onClick={() => setAnswers(a => ({ ...a, [step]: index }))}><span>{String.fromCharCode(65 + index)}</span>{option[lang]}{answers[step] === index && <b aria-hidden="true">●</b>}</button>)}</div>
          {answered && <div className={styles.feedback} role="status"><strong>{answers[step] === current.answer ? tr("Yes — that is the key.", "Oui — c’est le point clé.") : tr("Here is the detail to notice.", "Voici le détail à remarquer.")}</strong><p>{current.why[lang]}</p></div>}
          <div className={styles.lessonActions}>{step > 0 && <button className={styles.back} onClick={() => change(step - 1)}>{tr("Back", "Retour")}</button>}<button className={styles.primary} disabled={!answered} onClick={() => { if (step < 3) change(step + 1); else { setComplete(true); title.current?.focus({ preventScroll: true }); } }}>{step < 3 ? tr("Next connection", "Le lien suivant") : tr("Try it in another situation", "Essayer dans une autre situation")} <span aria-hidden="true">→</span></button></div>
        </> : <><p className={styles.eyebrow}>{tr("Same method. A different story.", "Même méthode. Une autre histoire.")}</p><h3 ref={title} tabIndex={-1}>{tr("Now it is a delivery message.", "Cette fois, c’est un message de livraison.")}</h3><blockquote>{tr("“Your parcel is on hold. Pay $2.17 through this link within an hour.”", "« Votre colis est retenu. Payez 2,17 $ par ce lien dans l’heure. »")}</blockquote><p>{tr("What breaks the sender’s control over verification?", "Qu’est-ce qui retire à l’expéditeur le contrôle de la vérification?")}</p><div className={styles.answers}>{[tr("Open the delivery company’s app myself", "Ouvrir moi-même l’application du transporteur"), tr("Use their link because the fee is small", "Utiliser le lien, car les frais sont minimes")].map((option, i) => <button key={i} aria-pressed={transfer === i} onClick={() => setTransfer(i)}><span>{i === 0 ? "A" : "B"}</span>{option}</button>)}</div>{transfer !== null && <div className={styles.feedback} role="status"><strong>{transfer === 0 ? tr("You found the connection.", "Vous avez trouvé le lien.") : tr("The small fee is part of the story.", "Les petits frais font partie de l’histoire.")}</strong><p>{tr("A different sender, the same urgency. Opening the real app yourself lets you check outside the sender’s link. The amount alone does not establish whether the request is genuine.", "Un autre expéditeur, la même urgence. Ouvrir vous-même la vraie application permet de vérifier hors du lien fourni. Le montant seul ne prouve pas que la demande est légitime.")}</p></div>}<div className={styles.lessonActions}><button className={styles.back} onClick={() => change(0)}>{tr("Revisit the lesson", "Revoir la leçon")}</button><button className={styles.primary} onClick={onExplore}>{tr("Explore related patterns", "Explorer les mécanismes liés")} ↓</button></div></>}
      </div>
    </div>
    <p className={styles.lessonSource}>{tr("For further guidance:", "Pour en savoir plus :")} <a href={lang === "fr" ? "https://antifraudcentre-centreantifraude.ca/scams-fraudes/b-investigator-enqueteur-fra.htm" : "https://antifraudcentre-centreantifraude.ca/scams-fraudes/b-investigator-enqueteur-eng.htm"} target="_blank" rel="noreferrer">{tr("Canadian Anti-Fraud Centre · Bank impersonation", "Centre antifraude du Canada · Faux enquêteurs bancaires")} ↗</a></p>
  </div>;
}
