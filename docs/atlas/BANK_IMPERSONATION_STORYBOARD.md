# Atlas of Deception — Bank Impersonation Journey

Status: storyboard for review. This is not an implementation specification or approval to collect data.

## Experience promise

In a few quiet minutes, help a person understand what happened, recognize the pressure used, recover enough agency to act, and leave with a practical record. The experience begins in an ordinary world, passes through a narrowed emotional world, and ends with the person choosing to move toward help and community.

The experience must be understandable from the images and choices alone. Copy supports the journey; it does not carry it.

## Three entrances

| Entrance | What is already known | First moment | Reporting treatment |
|---|---|---|---|
| Scan something | Original message, ScanScam result, suspected family, channel, extracted entities | The message appears inside the first scene: “This arrived.” | Real experience; save only under the product's disclosed privacy rules |
| Something happened | Nothing | “Where did it begin?” | Real experience; choices may contribute only to disclosed anonymous patterns |
| I want to learn | A clearly fictional bank-impersonation example | “Let’s see how the pressure is built.” | Educational session; never counted as a report or Atlas signal |

All three entrances converge at Scene 2. A visitor can leave or switch to immediate help at any point.

## Art and motion grammar

- Primary language: poetic folk woodcut with handmade ink, cream paper, midnight blue, muted rust, ochre and living gold.
- One anonymous, ageless, gender-ambiguous silhouette. No face is needed.
- Maximum three meaningful objects in a scene.
- Pressure changes space gently: the clock grows, the door closes, the path narrows, and rust enters the image.
- Recovery changes posture and atmosphere: breathing space returns, the path curves outward, blue replaces black, and an ember appears inside the silhouette.
- The character is not rescued. They choose to pause, stand, carry their lantern and move toward other people.
- The lantern is one person's recovered agency. The bonfire is what many disclosed experiences can become together.
- Motion should feel tactile: ink blooming, lines loosening, paper breathing, light warming. No explosions, shards, parallax spectacle or game-like rewards.

## Scene-by-scene storyboard

### 0. The three doors

**Purpose:** Establish intent without making the visitor understand the product first.

**On screen**

- EN: “What brought you here?”
- FR: “Qu’est-ce qui vous amène ici?”
- Doors: “Scan something / Something happened / I want to learn”
- FR: “Analyser quelque chose / Quelque chose s’est passé / Je veux comprendre”

**Image and motion:** Three openings in a cream-paper landscape. A message glows faintly behind the first, a solitary chair behind the second, and a small constellation behind the third. Hovering produces one quiet pulse of ink.

**Data:** `entry_mode`. Learning mode sets `is_educational=true` permanently for the session.

---

### 1A. This arrived — scan entrance

**Purpose:** Make the analysis feel like the beginning of the visitor's story, not a detached verdict.

**On screen**

- EN: “This arrived.” / “Let’s see what it was trying to make you do.”
- FR: “Ceci est arrivé.” / “Voyons ce que ce message essayait de vous faire faire.”
- Action: “Enter the story / Entrer dans l’histoire”

**Image and motion:** Ordinary kitchen, quiet phone, small clock, open doorway. A short redacted fragment of the submitted message is already present on the phone. No second input field.

**Data:** Reuse the scan identifier and prefill supported facts. Never infer facts the scan did not establish.

### 1B. Where it began — lived-experience entrance

**Purpose:** Establish the event with recognition rather than a blank form.

**On screen**

- EN: “Where did it begin?”
- FR: “Où est-ce que ça a commencé?”
- Choices: “A text / A call / An email or letter / Online / I’m not sure”
- FR: “Un texto / Un appel / Un courriel ou une lettre / En ligne / Je ne sais pas”
- Persistent secondary action: “Use my own words / Utiliser mes propres mots”

**Image and motion:** The same kitchen. Selecting a channel brings only that object into the pool of light.

**Data:** `channel`, optional `entry_words`.

### 1C. The example — learning entrance

**Purpose:** Let a curious visitor observe the mechanism without pretending to be a victim.

**On screen**

- EN: “A message says your bank account is in danger.”
- FR: “Un message affirme que votre compte bancaire est en danger.”
- Action: “See what happens / Voir ce qui se passe”

**Image and motion:** The phone enters the kitchen like a small paper theatre prop. The figure remains an observer rather than the subject.

**Data:** No incident data; educational progress may remain local.

---

### 2. The borrowed face

**Purpose:** Identify who supplied the apparent trust.

**On screen**

- EN: “Who did it seem to be?”
- FR: “Qui semblait vous contacter?”
- Choices: “My bank / Government or police / A company / Someone I knew / I’m not sure”
- FR: “Ma banque / Le gouvernement ou la police / Une entreprise / Une personne connue / Je ne sais pas”
- Reflection after choice: “A familiar symbol is not a verified identity.”
- FR: “Un symbole familier n’est pas une identité vérifiée.”

**Image and motion:** An envelope-like bank emblem appears as a paper mask between the phone and the figure. When selected, the mask shifts slightly out of alignment; it is borrowed, not destroyed.

**Data:** `claimed_identity`.

---

### 3. The promise or threat

**Purpose:** Reveal the consequence that made attention lock onto the message.

**On screen**

- EN: “What did they say could happen?”
- FR: “Qu’est-ce qui risquait d’arriver?”
- Choices: “My money was at risk / My account would be blocked / I was in legal trouble / Someone needed protection / I could lose an opportunity / Something else”
- FR equivalents should remain equally short.

**Image and motion:** Two simple shapes hover beyond the phone: a closed lock and an open hand. The chosen consequence casts one muted rust shadow; nothing attacks the figure.

**Data:** `claimed_consequence`, optional words.

---

### 4. The stolen clock

**Purpose:** Let the visitor recognize engineered urgency.

**On screen**

- EN: “What happened to time?”
- FR: “Qu’est-il arrivé au temps?”
- Choices: “I had to act now / I feared being too late / They kept me on the line / The chance would disappear / There was no pressure”
- FR: “Je devais agir tout de suite / J’avais peur qu’il soit trop tard / On me gardait en ligne / L’occasion allait disparaître / Il n’y avait pas de pression”
- Reflection: “Urgency can take away the space where judgment lives.”
- FR: “L’urgence peut voler l’espace où vit le jugement.”

**Image and motion:** The clock becomes slightly larger and the table edge narrows. After a choice, the second hand stops and one margin of cream space returns.

**Data:** `pressure_time[]`.

---

### 5. The closed world

**Purpose:** Identify isolation and secrecy as mechanisms, not personal failures.

**On screen**

- EN: “What made your world smaller?”
- FR: “Qu’est-ce qui a rétréci votre monde?”
- Choices: “Keep it secret / Don’t hang up / Don’t contact the bank / Nobody else would understand / I isolated myself / None of these”
- FR equivalents remain short.
- Reflection: “Isolation protects the story from reality.”
- FR: “L’isolement protège l’histoire contre la réalité.”

**Image and motion:** The doorway moves almost closed and a single rust thread loosely circles the chair. On recognition, the thread falls to the floor and the door opens a few centimetres.

**Data:** `pressure_isolation[]`.

---

### 6. What it awakened

**Purpose:** Give emotional recognition its own full scene and begin internal transformation.

**On screen**

- EN: “What did you feel?”
- FR: “Qu’avez-vous ressenti?”
- Choices: “Shame / Fear / Anger / Hope / Confusion / Numbness”
- FR: “Honte / Peur / Colère / Espoir / Confusion / Engourdissement”
- Multiple selections are allowed. “My own words” remains visible.

**Immediate response and visual transformation**

| Emotion | Short response | Image response |
|---|---|---|
| Shame | “Shame grows in hiding. You are not alone.” | A dark knot behind the face loosens; a small warm mark appears at the sternum |
| Fear | “The threat felt real. Your body was trying to protect you.” | A rust halo around the head settles downward into steady ochre rings |
| Anger | “A boundary was crossed. Anger can help you act.” | A sharp rust edge becomes a firm warm line beneath the feet |
| Hope | “What you wanted was real. Someone used deception to reach it.” | A distant false glimmer fades; the inner ember remains |
| Confusion | “Slow down. Clarity can return one piece at a time.” | Overlapping shadows separate into two legible shapes |
| Numbness | “Distance can appear when something is too much. Return gradually.” | A pale gap inside the silhouette receives a faint pulse of warmth |

French responses must be written for emotional naturalness, not translated literally.

**Image and motion:** A close silhouette occupies an otherwise empty cream field. Each choice modifies one restrained shadow layer. With multiple emotions, colors coexist rather than producing a louder effect. The final state always retains a small internal orange-gold ember.

**Data:** `emotions[]`, optional `emotion_words`. Never label or diagnose mental health.

---

### 7. The surrender gate

**Purpose:** Name the requested action and show the point at which influence sought an outcome.

**On screen**

- EN: “What were you asked to give?”
- FR: “Qu’est-ce qu’on vous demandait de donner?”
- Choices: “Money / A code or password / Access to my device / Personal information / Silence / I’m not sure”
- FR: “De l’argent / Un code ou mot de passe / L’accès à mon appareil / Des renseignements personnels / Le silence / Je ne sais pas”
- Reflection: “The request shows where the pressure was leading.”
- FR: “La demande révèle où menait la pression.”

**Image and motion:** A hand pauses above one symbolic object. It does not cross a simple threshold line. If the visitor already complied, the wording changes to “What did they obtain? / Qu’ont-ils obtenu?” without blame.

**Data:** `requested_assets[]`, `action_completed` as yes/no/unsure, optional amount and currency later—not here.

---

### 8. The moving finish line

**Purpose:** Capture escalation and repeat demands without teaching fraud tactics.

**On screen**

- EN: “Did the story change after you responded?”
- FR: “L’histoire a-t-elle changé après votre réponse?”
- Choices: “Another payment / A new emergency / A threat / A promise of recovery / They disappeared / I didn’t respond”
- FR equivalents remain short.
- Reflection: “A moving finish line keeps the pressure alive.”
- FR: “Une ligne d’arrivée qui recule entretient la pression.”

**Image and motion:** One small destination marker quietly moves farther down a path. Recognition stops it. No diagrams of operational scam steps.

**Data:** `escalation[]`.

---

### 9. See the mechanism

**Purpose:** Reframe the experience from personal failure into professionalized coercion.

**On screen**

- EN: “Look at what was built around you.”
- FR: “Regardez ce qu’on a construit autour de vous.”
- A short causal chain assembled from their answers: “Borrowed trust → consequence → urgency → isolation → request.”
- EN: “These techniques are practised and refined. They work because trust, fear, hope and care are human.”
- FR: “Ces techniques sont pratiquées et raffinées. Elles fonctionnent parce que la confiance, la peur, l’espoir et la bienveillance sont humains.”
- Action: “I see it / Je le vois”

**Image and motion:** Their selected symbols appear as five quiet carved marks around the silhouette, then settle into an orderly path beneath its feet. The inner ember becomes stable. This is the cognitive turning point.

**Data:** Derived mechanism labels only; do not infer intent beyond supported patterns.

---

### 10. The pause

**Purpose:** Protect someone who may still be in active danger.

**Persistent option throughout Scenes 1–9:** “This is happening now / Ça se passe maintenant.”

**On screen after activation**

- EN: “Pause here.”
- FR: “Faites une pause ici.”
- “Stop contact. Don’t send money, codes or access.”
- FR: “Coupez le contact. N’envoyez ni argent, ni code, ni accès.”
- Actions: “Call my bank safely / Contact someone I trust / Secure my accounts / Find official help”
- FR equivalents.

**Image and motion:** Phone face-down. Clock still. Large cream space. A second chair receives warm light, but no helper magically appears.

**Behavior:** Official destinations are country-aware where reliably available, with a neutral fallback. External links open only after clear explanation. The visitor can return to the journey later.

**Data:** Safety choices may remain local unless the person explicitly includes them in the ledger.

---

### 11. Stand and choose the next step

**Purpose:** Move from insight to self-directed action.

**On screen**

- EN: “What would help now?”
- FR: “Qu’est-ce qui vous aiderait maintenant?”
- Choices: “Tell someone / Contact my bank / Secure an account / Report it / I don’t know yet”
- FR: “En parler à quelqu’un / Contacter ma banque / Sécuriser un compte / Le signaler / Je ne sais pas encore”
- If unsure: “You don’t need to solve everything. Choose one safe person to look at it with you.”
- FR equivalent.

**Image and motion:** The person stands. A curved path appears beyond the open door. Their ember casts a small pool of orange-gold light from within; the lantern is available but not yet lifted.

**Data:** `desired_next_steps[]`.

---

### 12. Your journey, seen clearly

**Purpose:** Provide the emotional payoff before requesting precision.

**On screen**

- EN: “Here is what you lived.”
- FR: “Voici ce que vous avez vécu.”
- A concise, editable sequence made only from their choices: arrival, claimed identity, consequence, pressure, emotion, request, escalation, chosen next step.
- EN: “You noticed it. You named it. You interrupted it.”
- FR: “Vous l’avez remarqué. Vous l’avez nommé. Vous l’avez interrompu.”

**Image and motion:** The journey becomes a short winding path of their selected symbols—not a literal book yet. The figure sees the path from a small rise. Rust remains in the past segment; ochre and blue surround the present.

**Data:** User-editable narrative. Edits are private text unless explicitly included in a ledger submission under disclosed terms.

---

### 13. Sharpen the signal — optional evidence room

**Purpose:** Invite useful precision only after emotional reconstruction.

**On screen**

- EN: “Want to make the record more useful?”
- FR: “Voulez-vous rendre le registre plus utile?”
- “Skip this / Add details”
- FR: “Passer / Ajouter des détails”
- Optional prompts: date and time, contact method, phone/email/domain, claimed organization, amount requested or sent, payment method, transaction reference, account or wallet, files/screenshots, actions already taken.

**Image and motion:** A calm worktable. Selected fragments settle into labelled visual compartments only after interaction. No police-room aesthetic.

**Safety:** Explain that the visitor should not upload passwords, complete card numbers, government ID numbers or intimate material. Preserve original evidence locally where appropriate; do not promise admissibility or recovery.

**Data:** Structured evidence fields with explicit retention and consent controls. File storage requires a separate security and privacy review before implementation.

---

### 14. Your private ledger

**Purpose:** Deliver tangible value before asking for contribution or email.

**On screen**

- EN: “Your record is ready.”
- FR: “Votre registre est prêt.”
- “Use it to begin a conversation with your bank, an official service or someone you trust.”
- Actions: “Review and edit / Save or print / Copy a short summary / Find where to send it”
- FR equivalents.

**Image and motion:** Only now does the path fold into a handmade ledger. The cover carries no victim label. The lantern rests beside it. The visitor can edit every narrative sentence before export.

**Data:** The ledger clearly separates visitor statements, ScanScam analysis and suggested actions. Export should include date generated and a “not an official police report” note.

---

### 15. Carry the light

**Purpose:** Turn disclosure into agency without withholding the ledger.

**On screen**

- EN: “Your experience can help someone recognize the path sooner.”
- FR: “Votre expérience peut aider quelqu’un à reconnaître le chemin plus tôt.”
- Primary action: “Add an anonymous light / Ajouter une lumière anonyme”
- Secondary: “Not now / Pas maintenant”
- Before confirmation, show the exact fields proposed for contribution and allow each to be switched off.

**Image and motion:** The person lifts the lantern and walks alone through the open doorway. The internal ember remains visible. The act of contribution sends a single warm light along the curved path; no confetti or score.

**Data:** Consent event and only the individually enabled structured fields. Never silently treat completion of the journey as consent to public sharing.

---

### 16. The communal fire

**Purpose:** End with belonging and collective protection.

**On screen**

- EN: “You are not the only light.”
- FR: “Votre lumière n’est pas seule.”
- “Each shared pattern can help another person pause.”
- FR: “Chaque motif partagé peut aider une autre personne à faire une pause.”
- Optional next actions after the emotional ending: “Explore the Atlas / Share the learning journey / Get updates about the family kit.”

**Image and motion:** A spacious poetic-folk landscape. Universal silhouettes of varied heights and bodies gather loosely around a modest bonfire. The visitor approaches rather than being rescued. Their lantern joins other individual lights; the fire remains human-scale. The dark silhouette now contains a small orange-gold warmth.

**Commercial boundary:** The ledger is not email-gated. Any family-kit waitlist appears only here, clearly optional and separate from safety help, reporting and anonymous contribution.

## Interaction rules

1. One question or realization occupies the visual centre at a time; controls never live in a permanent side panel.
2. “Use my own words” is always available inline where narrative input is relevant.
3. Every question can be skipped. Skipping never blocks safety help or the ledger.
4. Selected choices visibly affect the scene before “Continue” appears.
5. Back navigation preserves choices. A visitor can delete all local journey data at any time.
6. Learning-mode choices never enter incident statistics.
7. The experience never says the person was definitely scammed. Use “suspicious,” “pressure pattern,” and evidence-calibrated language.
8. No emotion is diagnosed, scored or gamified.
9. The journey supports both English and French from the same scene model; French is authored, not mechanically translated.
10. Reduced-motion mode replaces movement with gentle crossfades and static state changes.

## Ledger structure

The exported ledger should contain:

1. **What arrived:** channel, date, claimed identity and source identifiers.
2. **What was claimed:** consequence, promise or threat.
3. **How pressure was applied:** urgency, isolation and emotional states selected by the visitor.
4. **What was requested or obtained:** access, information, money and payment details.
5. **How it escalated:** later demands, threats, disappearance or recovery approach.
6. **Evidence inventory:** filenames or descriptions, not exposed secrets.
7. **Actions taken:** contact stopped, bank contacted, accounts secured, report initiated.
8. **Visitor narrative:** editable and clearly identified as their account.
9. **ScanScam observations:** separate, probabilistic and clearly identified as automated analysis.
10. **Possible official destinations:** determined by jurisdiction and incident type, with no claim that submission has occurred.

## Approval gates before implementation

- Approve the sixteen-scene causal journey and identify any scenes to combine.
- Author the complete French copy with a native emotional pass.
- Decide what can remain local in the browser and what, if anything, Supabase may receive.
- Complete privacy, consent, retention and security design before story or evidence persistence.
- Produce low-fidelity motion tests for Scenes 4, 6, 9, 15 and 16 before generating the full art set.
- Test comprehension with a grandparent, a younger adult and a person who has experienced fraud.

