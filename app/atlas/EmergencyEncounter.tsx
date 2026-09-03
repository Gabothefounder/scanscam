"use client";

import { FormEvent, useState } from "react";
import styles from "./encounter.module.css";

const landmarks = [
  { name: "The Familiar Voice", state: "Love", line: "A frightened voice sounds like someone you know.", help: "A familiar voice can be imitated. Call them using a number you already have.", x: 12, y: 57 },
  { name: "The Narrowing Clock", state: "Fear", line: "The emergency supposedly cannot wait.", help: "You are allowed to pause. Urgency is a reason to verify, not obey.", x: 29, y: 31 },
  { name: "The Borrowed Seal", state: "Deference", line: "A lawyer, police officer or institution appears.", help: "Titles and caller ID are not proof. Find the institution independently.", x: 48, y: 55 },
  { name: "The Closed Room", state: "Isolation", line: "You are asked not to tell anyone.", help: "Bring in one trusted person. Real help survives another person’s attention.", x: 66, y: 27 },
  { name: "The Payment Gate", state: "Compliance", line: "Care is converted into an irreversible request.", help: "Stop payment. Contact your bank using the number on your card.", x: 80, y: 58 },
  { name: "The Lantern Clearing", state: "Agency", line: "Another light appears. The story can be tested together.", help: "Use a family codeword, known phone numbers, and a promise that anyone may request a pause.", x: 91, y: 30 },
];

export default function EmergencyEncounter() {
  const [active, setActive] = useState(0);
  const [lantern, setLantern] = useState(false);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(false);
  const selected = landmarks[active];

  const share = async () => {
    const data = { title: "The Voice in the Night", text: "A short ScanScam journey about recognizing a family-emergency scam without shame.", url: `${window.location.origin}/atlas#encounter` };
    if (navigator.share) await navigator.share(data).catch(() => undefined);
    else await navigator.clipboard.writeText(data.url);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSubmitting(true); setError(false);
    try {
      const response = await fetch("/api/family-protect/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ first_name: "Atlas visitor", email, who_protect: "family", concern_text: "Interested in the Atlas Family Protection Kit.", lang: "en", contact_consent: true, landing_path: "/atlas#family-kit", utm_source: "atlas", utm_medium: "interest", utm_campaign: "family_protection_kit" }) });
      if (!response.ok) throw new Error("signup failed");
      setSubmitted(true);
    } catch { setError(true); }
    finally { setSubmitting(false); }
  };

  return <section className={styles.encounter} id="encounter">
    <header><p className={styles.kicker}>A freely explorable encounter</p><h2>The Voice in the Night</h2><p>Touch the landmarks. Watch how love and urgency can narrow a world—and how one trusted light opens it again.</p></header>
    <div className={styles.world}>
      <svg viewBox="0 0 1000 420" preserveAspectRatio="none" aria-hidden="true"><path d="M30 286C137 317 190 126 305 154S403 301 493 255 590 94 680 142 750 318 829 264 892 134 979 116"/><path className={styles.returnPath} d="M30 350C260 380 400 340 550 365S810 350 979 370"/></svg>
      <div className={styles.moon} aria-hidden="true" />
      {landmarks.map((item, index) => <button key={item.name} onClick={() => setActive(index)} className={`${styles.landmark} ${active === index ? styles.active : ""} ${index === landmarks.length - 1 ? styles.clearing : ""}`} style={{left:`${item.x}%`,top:`${item.y}%`}} aria-pressed={active === index}><i/><span>{item.name}</span></button>)}
      <div className={styles.silhouette} aria-hidden="true"><i/><i/></div>
    </div>
    <article className={styles.reveal} aria-live="polite"><div><span>{selected.state}</span><h3>{selected.name}</h3><p>{selected.line}</p></div><blockquote>{selected.help}</blockquote></article>

    <section className={styles.lanternClearing}>
      <div className={styles.lanterns} aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/>{lantern && <i className={styles.yourLantern}/>}</div>
      <div><p className={styles.kicker}>The Lantern Clearing</p><h3>You are not the only person who has stood here.</h3><p>Scams grow in silence. A small light can mean: “I saw this pattern too, and I chose to tell someone.”</p><div className={styles.clearingActions}><button onClick={() => setLantern(true)} disabled={lantern}>{lantern ? "Your light is here" : "Light a private lantern"}</button><button onClick={share}>Share this journey</button></div><small>Your lantern stays on this device. Nothing is published or submitted.</small></div>
    </section>

    <section className={styles.kit} id="family-kit"><div><p className={styles.kicker}>An idea we are testing</p><h3>The Family Protection Kit</h3><p>A shared codeword, trusted callback plan, pause-before-payment pact, printable grandparent card, and a gentle family practice.</p><ul><li>No emergency guidance will be paywalled.</li><li>No codewords, banking details or family secrets collected.</li><li>We will ask interested families what would actually help.</li></ul></div><div className={styles.kitCard}>{submitted ? <p className={styles.success}>Your interest is recorded. Thank you for helping shape it.</p> : <form onSubmit={submit}><label htmlFor="kit-email">Tell me when the kit is ready</label><input id="kit-email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"/><button disabled={submitting}>{submitting ? "Joining…" : "Join the early list"}</button>{error && <p role="alert">That did not work. Please try again.</p>}<small>Interest only—nothing to buy today. By joining, you agree that ScanScam may email you about this kit.</small></form>}</div></section>
  </section>;
}
