"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "./atlas.module.css";

type Step = { title: string; signal: string; purpose: string; state: string; next: string; response: string };

const families = [
  ["Impersonation", "Bank · government · delivery · family", 50, 46, "open"],
  ["Romance", "Affection becomes leverage", 20, 26, "soon"],
  ["Investment", "A promised future suspends doubt", 78, 23, "soon"],
  ["Marketplace", "A transaction leaves the platform", 82, 69, "soon"],
  ["Employment", "Opportunity conceals extraction", 24, 74, "soon"],
  ["Tickets & tolls", "A small penalty creates haste", 51, 87, "soon"],
] as const;

const events = ["They claim to be my bank or government", "They created an emergency", "They want secrecy", "They want money or account access", "They moved me to another channel"];

const steps: Step[] = [
  { title: "The unexpected contact", signal: "A message, call, invoice or alert appears without context.", purpose: "Create a believable opening before you have time to orient yourself.", state: "Surprise · curiosity", next: "The sender introduces a familiar institution, person or procedure.", response: "Do not use links or numbers in the message. Find the real organization yourself." },
  { title: "Borrowed authority", signal: "Logos, caller ID, case numbers or private details make the claim feel official.", purpose: "Replace verification with the appearance of legitimacy.", state: "Deference · uncertainty", next: "Authority is paired with a consequence that demands immediate attention.", response: "A symbol is not proof. End the contact and verify through an independently found channel." },
  { title: "The narrowing clock", signal: "Act now: a charge, arrest, lost package, frozen account or endangered relative cannot wait.", purpose: "Narrow attention so speed feels safer than checking.", state: "Fear · urgency", next: "You may be told that involving someone else will make the situation worse.", response: "Real institutions permit verification. Pause for ten minutes; urgency is evidence to check, not obey." },
  { title: "The closed room", signal: "Do not hang up, tell anyone, contact the bank, or discuss the investigation.", purpose: "Remove the outside perspectives most likely to break the story.", state: "Isolation · shame", next: "With resistance reduced, the request becomes concrete.", response: "Tell one trusted person exactly what was requested. Legitimate help survives a second opinion." },
  { title: "The irreversible action", signal: "Send a code, install software, move funds, buy gift cards, pay crypto, or surrender credentials.", purpose: "Convert emotional control into access or money.", state: "Compliance · tunnel vision", next: "A first action often produces another fee, problem or demand.", response: "Stop before the next step. Contact your bank using the number on your card and secure affected accounts." },
  { title: "The moving finish line", signal: "New complications, recovery fees, threats or promises appear after you comply.", purpose: "Use sunk cost, fear or shame to continue extraction and prevent disclosure.", state: "Confusion · shame · hope", next: "Pressure may continue until access is blocked or another person intervenes.", response: "Preserve the evidence. Stop contact, protect accounts, tell someone, and report what happened." },
];

const questions = [
  "Did they claim to represent a person or institution you already trust?",
  "Did they create urgency, danger, punishment or a limited window?",
  "Did they ask you to keep the situation private or stay on the line?",
  "Did they request money, credentials, codes, software installation or account access?",
];

export default function AtlasExperience() {
  const [active, setActive] = useState(0);
  const [event, setEvent] = useState("");
  const [diagnostic, setDiagnostic] = useState(false);
  const [answers, setAnswers] = useState<(boolean | null)[]>([null, null, null, null]);
  const [copied, setCopied] = useState(false);
  const selected = steps[active];
  const yes = answers.filter(Boolean).length;
  const report = useMemo(() => `SCANSCAM — PRIVATE INCIDENT LEDGER\n\nPattern explored: Impersonation fraud\nSuspicious event: ${event || "Not selected"}\nCurrent stage: ${selected.title}\n\nObservations\n${questions.map((q, i) => answers[i] === null ? null : `- ${q} ${answers[i] ? "Yes" : "No"}`).filter(Boolean).join("\n") || "- No observations recorded yet"}\n\nImmediate defensive step\n${selected.response}\n\nThis is a personal record, not a determination that fraud occurred. Preserve original messages, receipts, phone numbers, URLs and transaction records separately.`, [answers, event, selected]);

  const chooseEvent = (value: string) => {
    setEvent(value);
    setActive(value.includes("money") ? 4 : value.includes("secrecy") ? 3 : value.includes("emergency") ? 2 : 1);
  };

  return <main className={styles.page}>
    <header className={styles.header}><Link href="/">ScanScam</Link><div><b>Atlas of Deception</b><span>Cognitive defence</span></div><Link href="/scan">Scan a message</Link></header>
    <section className={styles.sky}>
      <div className={styles.intro}><p className={styles.kicker}>A living map of deception</p><h1>Learn the pattern.<br/>Find your way back.</h1><p>Explore by fraud family or begin with something that felt wrong.</p></div>
      <div className={styles.constellation}>
        <svg viewBox="0 0 1000 650" aria-hidden="true"><path d="M205 175C350 260 370 285 500 310S705 255 778 165M500 310C655 370 720 420 825 455M500 310C390 430 330 485 250 500M500 310C510 420 505 500 510 570"/></svg>
        {families.map(([name, note, x, y, status], i) => <button key={name} className={i === 0 ? styles.open : ""} style={{left:`${x}%`,top:`${y}%`}} onClick={() => status === "open" && document.getElementById("journey")?.scrollIntoView({behavior:"smooth"})}><span>{name}</span><small>{status === "open" ? note : "Constellation forming"}</small></button>)}
      </div>
      <div className={styles.event}><label htmlFor="event">Something felt wrong…</label><select id="event" value={event} onChange={e => chooseEvent(e.target.value)}><option value="">Choose a suspicious event</option>{events.map(e => <option key={e}>{e}</option>)}</select>{event && <a href="#journey">See where this appears ↓</a>}</div>
    </section>

    <section className={styles.journey} id="journey">
      <div className={styles.journeyIntro}><p className={styles.kicker}>Open constellation · impersonation</p><h2>The borrowed face</h2><p>An impersonation scam borrows trust, compresses time, closes the room, and converts pressure into action. Select a stage to see what may happen next.</p></div>
      <div className={styles.path}>{steps.map((s,i) => <button key={s.title} className={active===i ? styles.selected : ""} onClick={() => setActive(i)}><span>{String(i+1).padStart(2,"0")}</span>{s.title}</button>)}</div>
      <article className={styles.stage}><div className={styles.number}>{String(active+1).padStart(2,"0")}</div><div><p className={styles.kicker}>What you may notice</p><h3>{selected.title}</h3><p>{selected.signal}</p><blockquote>{selected.state}</blockquote></div><dl><div><dt>What the pressure is doing</dt><dd>{selected.purpose}</dd></div><div><dt>Possible escalation</dt><dd>{selected.next}</dd></div><div className={styles.clarity}><dt>Your path toward clarity</dt><dd>{selected.response}</dd></div></dl></article>
      <div className={styles.actions}><button onClick={() => setDiagnostic(true)}>Where am I in this pattern?</button><Link href="/scan">Examine the message instead</Link></div>
    </section>

    {diagnostic && <section className={styles.diagnostic}><button className={styles.close} onClick={() => setDiagnostic(false)} aria-label="Close">×</button><div className={styles.journeyIntro}><p className={styles.kicker}>A guided return to clarity</p><h2>Record what happened—without deciding alone.</h2><p>This stays in your browser unless you choose to copy, print or report it.</p></div><div className={styles.questions}>{questions.map((q,i) => <fieldset key={q}><legend><span>{i+1}</span>{q}</legend><div>{[true,false].map(v => <button key={String(v)} className={answers[i]===v ? styles.answer : ""} onClick={() => setAnswers(a => a.map((old,j) => j===i ? v : old))}>{v ? "Yes" : "No"}</button>)}</div></fieldset>)}</div><div className={styles.ledger}><p className={styles.kicker}>Private incident ledger · {answers.filter(a => a!==null).length}/4 observations</p><h3>{yes>=2 ? "Pause. Independent verification would help now." : "Keep the record. Verify before acting."}</h3><p>{selected.response}</p><pre>{report}</pre><div className={styles.ledgerActions}><button onClick={async()=>{await navigator.clipboard.writeText(report);setCopied(true)}}>{copied ? "Copied" : "Copy ledger"}</button><button onClick={() => window.print()}>Print / save PDF</button><a href="https://antifraudcentre-centreantifraude.ca/report-signalez-eng.htm" target="_blank" rel="noreferrer">Report in Canada ↗</a></div><small>If money or account access may be at risk, contact your financial institution using a number you independently verify.</small></div></section>}
  </main>;
}
