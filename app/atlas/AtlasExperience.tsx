"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { allSuspiciousEvents, families, type FamilyId } from "./atlasData";
import EmergencyEncounter from "./EmergencyEncounter";
import encounterStyles from "./encounter.module.css";
import styles from "./atlas.module.css";

const questions = [
  "Did they claim an identity, relationship or opportunity you could not independently verify?",
  "Did they create urgency, scarcity, danger, punishment or a limited window?",
  "Did they discourage outside advice or move you away from a protected channel?",
  "Did they request money, credentials, codes, software, identity documents or account access?",
];

export default function AtlasExperience() {
  const [familyId, setFamilyId] = useState<FamilyId>("impersonation");
  const [active, setActive] = useState(0);
  const [event, setEvent] = useState("");
  const [diagnostic, setDiagnostic] = useState(false);
  const [answers, setAnswers] = useState<(boolean | null)[]>([null, null, null, null]);
  const [copied, setCopied] = useState(false);
  const family = families.find((item) => item.id === familyId) ?? families[0];
  const selected = family.steps[active] ?? family.steps[0];
  const yes = answers.filter(Boolean).length;
  const report = useMemo(() => `SCANSCAM — PRIVATE INCIDENT LEDGER\n\nPattern explored: ${family.name} fraud\nSuspicious event: ${event || "Not selected"}\nCurrent stage: ${selected.title}\n\nObservations\n${questions.map((q, i) => answers[i] === null ? null : `- ${q} ${answers[i] ? "Yes" : "No"}`).filter(Boolean).join("\n") || "- No observations recorded yet"}\n\nImmediate defensive step\n${selected.response}\n\nThis is a personal record, not a determination that fraud occurred. Preserve original messages, receipts, phone numbers, URLs and transaction records separately.`, [answers, event, family.name, selected]);

  const openFamily = (id: FamilyId) => {
    setFamilyId(id); setActive(0); setEvent(""); setAnswers([null, null, null, null]);
    document.getElementById("journey")?.scrollIntoView({ behavior: "smooth" });
  };

  const chooseEvent = (value: string) => {
    const match = allSuspiciousEvents.find((item) => item.event === value);
    if (match) setFamilyId(match.familyId);
    setEvent(value);
    setActive(value.includes("money") || value.includes("card") || value.includes("cheque") ? 4 : value.includes("secrecy") || value.includes("private") ? 3 : value.includes("emergency") || value.includes("urgent") ? 2 : 1);
  };

  return <main className={styles.page}>
    <header className={styles.header}><Link href="/">ScanScam</Link><div><b>Atlas of Deception</b><span>Cognitive defence</span></div><Link href="/scan">Scan a message</Link></header>
    <section className={styles.sky}>
      <div className={styles.intro}><p className={styles.kicker}>A living map of deception</p><h1>Learn the pattern.<br/>Find your way back.</h1><p>Explore by fraud family or begin with something that felt wrong.</p><a className={encounterStyles.playLink} href="#encounter">Enter the first encounter ↓</a></div>
      <div className={styles.constellation}>
        <svg viewBox="0 0 1000 650" aria-hidden="true"><path d="M205 175C350 260 370 285 500 310S705 255 778 165M500 310C655 370 720 420 825 455M500 310C390 430 330 485 250 500M500 310C510 420 505 500 510 570"/></svg>
        {families.map((item) => <button key={item.id} className={familyId === item.id ? styles.open : ""} style={{left:`${item.x}%`,top:`${item.y}%`,width:item.size,height:item.size}} onClick={() => openFamily(item.id)} aria-pressed={familyId === item.id}><span>{item.name}</span><small>{item.constellationNote}</small></button>)}
      </div>
      <div className={styles.event}><label htmlFor="event">Something felt wrong…</label><select id="event" value={event} onChange={e => chooseEvent(e.target.value)}><option value="">Choose a suspicious event</option>{families.map(item => <optgroup key={item.id} label={item.name}>{item.events.map(e => <option key={e}>{e}</option>)}</optgroup>)}</select>{event && <a href="#journey">See where this appears ↓</a>}</div>
    </section>

    <EmergencyEncounter />

    <section className={styles.journey} id="journey">
      <div className={styles.journeyIntro}><p className={styles.kicker}>Open constellation · {family.name}</p><h2>{family.title}</h2><p>{family.summary} Select a stage to see what may happen next.</p></div>
      <div className={styles.path} role="tablist" aria-label={`${family.name} escalation stages`}>{family.steps.map((step,i) => <button key={step.title} role="tab" aria-selected={active===i} className={active===i ? styles.selected : ""} onClick={() => setActive(i)}><span>{String(i+1).padStart(2,"0")}</span>{step.title}</button>)}</div>
      <article className={styles.stage}><div className={styles.number}>{String(active+1).padStart(2,"0")}</div><div><p className={styles.kicker}>What you may notice</p><h3>{selected.title}</h3><p>{selected.signal}</p><blockquote>{selected.state}</blockquote></div><dl><div><dt>What the pressure is doing</dt><dd>{selected.purpose}</dd></div><div><dt>Possible escalation</dt><dd>{selected.next}</dd></div><div className={styles.clarity}><dt>Your path toward clarity</dt><dd>{selected.response}</dd></div></dl></article>
      <div className={styles.actions}><button onClick={() => setDiagnostic(true)}>Where am I in this pattern?</button><Link href="/scan">Examine the message instead</Link></div>
    </section>

    {diagnostic && <section className={styles.diagnostic}><button className={styles.close} onClick={() => setDiagnostic(false)} aria-label="Close">×</button><div className={styles.journeyIntro}><p className={styles.kicker}>A guided return to clarity · {family.name}</p><h2>Record what happened—without deciding alone.</h2><p>This stays in your browser unless you choose to copy, print or report it.</p></div><div className={styles.questions}>{questions.map((q,i) => <fieldset key={q}><legend><span>{i+1}</span>{q}</legend><div>{[true,false].map(v => <button type="button" key={String(v)} className={answers[i]===v ? styles.answer : ""} onClick={() => setAnswers(a => a.map((old,j) => j===i ? v : old))}>{v ? "Yes" : "No"}</button>)}</div></fieldset>)}</div><div className={styles.ledger}><p className={styles.kicker}>Private incident ledger · {answers.filter(a => a!==null).length}/4 observations</p><h3>{yes>=2 ? "Pause. Independent verification would help now." : "Keep the record. Verify before acting."}</h3><p>{selected.response}</p><pre>{report}</pre><div className={styles.ledgerActions}><button onClick={async()=>{await navigator.clipboard.writeText(report);setCopied(true);window.setTimeout(()=>setCopied(false),1800)}}>{copied ? "Copied" : "Copy ledger"}</button><button onClick={() => window.print()}>Print / save PDF</button><a href="https://antifraudcentre-centreantifraude.ca/report-signalez-eng.htm" target="_blank" rel="noreferrer">Report in Canada ↗</a></div><small>If money or account access may be at risk, contact your financial institution using a number you independently verify.</small></div></section>}
  </main>;
}
