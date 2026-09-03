"use client";

import { FormEvent, useState } from "react";
import styles from "./encounter.module.css";

const beats = [
  { name: "A familiar voice", word: "LOVE", hint: "It sounds like someone you know.", action: "Call their known number.", x: 7, y: 55 },
  { name: "The narrowing clock", word: "PAUSE", hint: "The emergency cannot wait.", action: "Take back ten minutes.", x: 22, y: 30 },
  { name: "Borrowed authority", word: "VERIFY", hint: "A title makes the story feel official.", action: "Find the institution yourself.", x: 38, y: 53 },
  { name: "The closed room", word: "TELL SOMEONE", hint: "Other lights begin to disappear.", action: "Invite one trusted person.", x: 54, y: 25 },
  { name: "The payment gate", word: "STOP", hint: "Care becomes an irreversible request.", action: "Do not send or surrender access.", x: 68, y: 57 },
  { name: "A second soul", word: "TOGETHER", hint: "Another person enters the story.", action: "Verify side by side.", x: 82, y: 34 },
  { name: "The lantern clearing", word: "NOT ALONE", hint: "The world becomes wide again.", action: "Preserve. Protect. Share.", x: 94, y: 18 },
];

const offers = [
  { id: "kit", place: "The Family Hearth", title: "Protect your family", text: "A codeword, callback plan and emergency card.", cta: "Join the kit waitlist" },
  { id: "adventures", place: "The Practice Garden", title: "Learn before pressure", text: "Short adventures for clearer decisions.", cta: "Ask for new adventures" },
  { id: "human", place: "The Guide’s House", title: "Talk to a human", text: "Help organizing what happened and what comes next.", cta: "Tell us this would help" },
];

export default function EmergencyEncounter() {
  const [active, setActive] = useState(0);
  const [lantern, setLantern] = useState(false);
  const [offer, setOffer] = useState("kit");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const selected = beats[active];

  const share = async () => {
    const data = { title: "The Voice in the Night", text: "A small journey about finding clarity inside a family emergency scam.", url: `${window.location.origin}/atlas#encounter` };
    if (navigator.share) await navigator.share(data).catch(() => undefined);
    else await navigator.clipboard.writeText(data.url);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSubmitting(true); setError(false);
    const interest = offers.find((item) => item.id === offer)?.title ?? offer;
    try {
      const response = await fetch("/api/family-protect/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ first_name: "Atlas visitor", email, who_protect: "family", concern_text: `Atlas interest: ${interest}`, lang: "en", contact_consent: true, landing_path: "/atlas#paths", utm_source: "atlas", utm_medium: "waitlist", utm_campaign: offer }) });
      if (!response.ok) throw new Error("signup failed");
      setSubmitted(true);
    } catch { setError(true); }
    finally { setSubmitting(false); }
  };

  return <section className={styles.encounter} id="encounter">
    <header><p>THE VOICE IN THE NIGHT</p><h2>Love can survive verification.</h2><span>Explore the path.</span></header>

    <div className={styles.world} aria-label="A visual journey from a familiar voice through pressure and back to community">
      <div className={styles.sun} aria-hidden="true" />
      <svg viewBox="0 0 1200 520" preserveAspectRatio="none" aria-hidden="true"><path d="M40 310C145 325 180 133 280 157S385 335 465 277 550 102 650 137 725 348 810 292 882 153 972 173 1065 194 1095 76 1180 84"/></svg>
      <div className={styles.soul} style={{left:`${beats[active].x}%`,top:`${beats[active].y + 13}%`}} aria-hidden="true"><i/><span/></div>
      {beats.map((beat, index) => <button key={beat.word} className={`${styles.beat} ${active === index ? styles.active : ""} ${index === beats.length - 1 ? styles.finalBeat : ""}`} style={{left:`${beat.x}%`,top:`${beat.y}%`}} onClick={() => setActive(index)} aria-pressed={active === index}><i/><strong>{beat.word}</strong><small>{beat.name}</small></button>)}
      <div className={styles.distantLights} aria-hidden="true">{Array.from({length:18},(_,i)=><i key={i}/>)}</div>
    </div>

    <div className={styles.whisper} aria-live="polite"><span>{selected.hint}</span><b>{selected.action}</b></div>

    <div className={styles.now}><button onClick={() => document.getElementById("now-help")?.toggleAttribute("hidden")}>This is happening now</button><div id="now-help" hidden><b>Stop. You do not need to decide yet.</b><span>Contact your bank or the claimed institution through a number you find independently.</span><a href="https://antifraudcentre-centreantifraude.ca/report-signalez-eng.htm" target="_blank" rel="noreferrer">Official Canadian resources ↗</a></div></div>

    <section className={styles.clearing}>
      <div className={styles.lanterns} aria-hidden="true">{Array.from({length:24},(_,i)=><i key={i}/>)}</div>
      <div><p>THE LANTERN CLEARING</p><h3>You are not alone.</h3><div className={styles.clearingActions}><button onClick={() => setLantern(true)} disabled={lantern}>{lantern ? "Your light is here" : "Light a private lantern"}</button><button onClick={share}>Share the journey</button></div><small>{lantern ? "Your light stays on this device." : "No story or personal information is required."}</small></div>
    </section>

    <section className={styles.paths} id="paths"><header><p>PATHS BEYOND THE CLEARING</p><h3>What would help next?</h3></header><div className={styles.offerGrid}>{offers.map((item) => <article key={item.id} className={offer === item.id ? styles.offerSelected : ""}><span>{item.place}</span><h4>{item.title}</h4><p>{item.text}</p><button onClick={() => {setOffer(item.id);setSubmitted(false);document.getElementById("interest-email")?.focus()}}>{item.cta}</button></article>)}</div><div className={styles.waitlist}>{submitted ? <p className={styles.success}>Your interest is recorded. Thank you.</p> : <form onSubmit={submit}><label htmlFor="interest-email">We’re thinking about making <b>{offers.find(item=>item.id===offer)?.title.toLowerCase()}</b>.</label><div><input id="interest-email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Your email" autoComplete="email"/><button disabled={submitting}>{submitting ? "Joining…" : "Join the waitlist"}</button></div>{error && <p role="alert">That did not work. Please try again.</p>}<small>Interest only. Nothing to buy today. We may email you about this idea.</small></form>}</div></section>
  </section>;
}
