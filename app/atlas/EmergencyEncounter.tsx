"use client";

import { useState } from "react";
import styles from "./encounter.module.css";

type Choice = { label: string; effect: "open" | "pause" | "narrow"; reply: string; lesson: string };
type Scene = { place: string; title: string; message: string; context: string; choices: Choice[] };

const scenes: Scene[] = [
  {
    place: "The Familiar Voice", title: "A call arrives", context: "The voice sounds like someone you love. It is frightened and speaks quickly.",
    message: "Grandpa, I had an accident. Please don’t tell Mom yet. I need help right now.",
    choices: [
      { label: "Call them back using the number I already have", effect: "open", reply: "You leave the caller’s story and return to a channel you already trust.", lesson: "A familiar voice can be imitated. Independent contact is stronger evidence." },
      { label: "Keep listening and ask what happened", effect: "pause", reply: "Questions create time, but the caller still controls the conversation.", lesson: "Pausing helps. Verification through a separate channel helps more." },
      { label: "Promise I will help immediately", effect: "narrow", reply: "The promise creates commitment before the identity is verified.", lesson: "Care does not require immediate compliance." },
    ],
  },
  {
    place: "The Narrowing Clock", title: "The emergency grows", context: "A second person joins, claiming to be a lawyer. The caller ID looks official.",
    message: "There is no time. If the payment is not made today, your grandchild may remain in custody.",
    choices: [
      { label: "End the call and find the institution independently", effect: "open", reply: "The artificial clock loses its power when you choose your own source.", lesson: "Caller ID, titles and case numbers can be borrowed. Real authority survives a callback." },
      { label: "Ask for a case number before continuing", effect: "pause", reply: "You collect a detail, but a convincing detail can still belong to the performance.", lesson: "Information supplied by the caller is not independent verification." },
      { label: "Follow the lawyer’s instructions", effect: "narrow", reply: "Borrowed authority turns fear into obedience.", lesson: "You may stop at any moment—even after saying yes." },
    ],
  },
  {
    place: "The Closed Room", title: "Secrecy is requested", context: "The caller says disclosure could embarrass your loved one or damage the case.",
    message: "Please keep this between us. Calling anyone else could make everything worse.",
    choices: [
      { label: "Bring another trusted person into the room", effect: "open", reply: "A second mind widens the world and gives the story somewhere to be tested.", lesson: "Legitimate help survives another person’s attention." },
      { label: "Write down the request before deciding", effect: "pause", reply: "Recording the facts slows the emotional current and preserves evidence.", lesson: "Writing creates distance. Sharing the record creates protection." },
      { label: "Keep the secret to protect my loved one", effect: "narrow", reply: "Isolation gives the caller control over both the story and the clock.", lesson: "Secrecy protects manipulation more often than it protects family." },
    ],
  },
  {
    place: "The Verification Gate", title: "Choose the next action", context: "You do not need to prove that the call is fraudulent. You only need a safe next step.",
    message: "What would help you recover your judgment now?",
    choices: [
      { label: "Use our family codeword and call known numbers", effect: "open", reply: "The identity can now be tested using knowledge and channels the caller does not control.", lesson: "Create a family codeword before a crisis. Never include it in public posts or unexpected messages." },
      { label: "Pause all payment and contact my bank", effect: "open", reply: "Irreversible action stops while trusted systems help assess the situation.", lesson: "You can refuse payment without first proving fraud." },
      { label: "Send a small amount to be safe", effect: "narrow", reply: "A small first payment can confirm that pressure works and lead to another request.", lesson: "Do not use payment as a test of truth." },
    ],
  },
];

export default function EmergencyEncounter() {
  const [scene, setScene] = useState(0);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [clarity, setClarity] = useState(0);
  const current = scenes[scene];
  const complete = scene === scenes.length - 1 && choice !== null;

  const choose = (next: Choice) => {
    setChoice(next);
    if (next.effect === "open") setClarity((value) => value + 1);
  };

  const advance = () => { setScene((value) => value + 1); setChoice(null); };
  const restart = () => { setScene(0); setChoice(null); setClarity(0); };

  return <section className={`${styles.encounter} ${choice?.effect === "narrow" ? styles.encounterNarrow : ""}`} id="encounter">
    <div className={styles.encounterSky} aria-hidden="true"><i/><i/><i/><i/><span/></div>
    <div className={styles.encounterHeading}>
      <p className={styles.kicker}>First encounter · about five minutes</p>
      <h2>The Voice in the Night</h2>
      <p>A loved one seems to be in danger. You do not need perfect judgment—only one safe next step.</p>
    </div>

    <div className={styles.encounterProgress} aria-label={`Scene ${scene + 1} of ${scenes.length}`}>
      {scenes.map((item, index) => <span key={item.place} className={index <= scene ? styles.progressSeen : ""}>{index + 1}</span>)}
    </div>

    <article className={styles.encounterCard}>
      <div className={styles.place}><span>{String(scene + 1).padStart(2,"0")}</span><p>{current.place}</p></div>
      <div className={styles.encounterStory}>
        <p className={styles.kicker}>{current.title}</p>
        <p>{current.context}</p>
        <blockquote>“{current.message}”</blockquote>
      </div>
      {!complete ? <div className={styles.choices}>
        <p>What do you do?</p>
        {current.choices.map((item) => <button type="button" key={item.label} disabled={choice !== null} className={choice === item ? styles.choiceMade : ""} onClick={() => choose(item)}>{item.label}</button>)}
      </div> : null}
    </article>

    {choice && !complete ? <div className={styles.reflection} aria-live="polite">
      <div><p className={styles.kicker}>{choice.effect === "open" ? "The landscape opens" : choice.effect === "pause" ? "A little space appears" : "The world narrows"}</p><h3>{choice.reply}</h3><p>{choice.lesson}</p></div>
      <button type="button" onClick={advance}>Continue the encounter →</button>
    </div> : null}

    {complete ? <div className={styles.refuge} aria-live="polite">
      <p className={styles.kicker}>You reached the clearing</p>
      <h3>You were never required to solve the whole story alone.</h3>
      <p>You opened {clarity} paths toward clarity. There is no score to defend: every moment offers another exit.</p>
      <div className={styles.refugeGrid}><div><b>Make a family codeword</b><span>Choose it together, keep it private, and verify emergencies through known numbers.</span></div><div><b>Offer a second voice</b><span>Agree that anyone can request a pause without shame or argument.</span></div><div><b>Remember the rule</b><span>Love can survive verification. An emergency does not remove your right to stop.</span></div></div>
      <div className={styles.refugeActions}><button type="button" onClick={restart}>Walk it again</button><a href="#journey">Explore the full constellation</a></div>
    </div> : null}
  </section>;
}
