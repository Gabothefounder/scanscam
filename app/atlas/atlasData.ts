export type FamilyId = "impersonation" | "romance" | "investment" | "marketplace" | "employment" | "tickets";

export type JourneyStep = {
  title: string;
  signal: string;
  purpose: string;
  state: string;
  next: string;
  response: string;
};

export type FraudFamily = {
  id: FamilyId;
  name: string;
  constellationNote: string;
  title: string;
  summary: string;
  x: number;
  y: number;
  size: number;
  events: string[];
  steps: JourneyStep[];
};

export const families: FraudFamily[] = [
  {
    id: "impersonation", name: "Impersonation", constellationNote: "Bank · government · delivery · family", title: "The borrowed face",
    summary: "An impersonation scam borrows trust, compresses time, closes the room, and converts pressure into action.", x: 50, y: 46, size: 168,
    events: ["They claim to be my bank or government", "They created an emergency", "They want secrecy", "They want money or account access"],
    steps: [
      { title: "The unexpected contact", signal: "A message, call, invoice or alert appears without context.", purpose: "Create a believable opening before you have time to orient yourself.", state: "Surprise · curiosity", next: "The sender introduces a familiar institution, person or procedure.", response: "Do not use links or numbers in the message. Find the real organization yourself." },
      { title: "Borrowed authority", signal: "Logos, caller ID, case numbers or private details make the claim feel official.", purpose: "Replace verification with the appearance of legitimacy.", state: "Deference · uncertainty", next: "Authority is paired with a consequence that demands immediate attention.", response: "A symbol is not proof. End the contact and verify through an independently found channel." },
      { title: "The narrowing clock", signal: "A charge, arrest, lost package, frozen account or endangered relative supposedly cannot wait.", purpose: "Narrow attention so speed feels safer than checking.", state: "Fear · urgency", next: "You may be told that involving someone else will make the situation worse.", response: "Real institutions permit verification. Pause; urgency is evidence to check, not obey." },
      { title: "The closed room", signal: "Do not hang up, tell anyone, contact the bank, or discuss the investigation.", purpose: "Remove the outside perspectives most likely to break the story.", state: "Isolation · shame", next: "With resistance reduced, the request becomes concrete.", response: "Tell one trusted person exactly what was requested. Legitimate help survives a second opinion." },
      { title: "The irreversible action", signal: "Send a code, install software, move funds, buy gift cards, pay crypto, or surrender credentials.", purpose: "Convert emotional control into access or money.", state: "Compliance · tunnel vision", next: "A first action often produces another fee, problem or demand.", response: "Stop before the next step. Contact your bank using the number on your card and secure affected accounts." },
      { title: "The moving finish line", signal: "New complications, recovery fees, threats or promises appear after you comply.", purpose: "Use sunk cost, fear or shame to continue extraction and prevent disclosure.", state: "Confusion · shame · hope", next: "Pressure may continue until access is blocked or another person intervenes.", response: "Preserve the evidence. Stop contact, protect accounts, tell someone, and report what happened." },
    ],
  },
  {
    id: "romance", name: "Romance", constellationNote: "Affection becomes leverage", title: "The counterfeit bond",
    summary: "Romance fraud builds a relationship strong enough that verification begins to feel like betrayal.", x: 20, y: 26, size: 112,
    events: ["They became close unusually quickly", "They always have a reason not to meet", "A sudden emergency needs money", "They asked me to keep the relationship private"],
    steps: [
      { title: "The perfect arrival", signal: "A flattering stranger appears unusually attentive, compatible, or vulnerable.", purpose: "Create emotional relevance quickly and invite reciprocal disclosure.", state: "Curiosity · recognition", next: "Frequent contact starts to feel like a private world shared by two people.", response: "Keep ordinary routines and relationships intact while the connection develops." },
      { title: "Accelerated intimacy", signal: "Affection, destiny, future plans or exclusivity arrive before shared real-world experience.", purpose: "Create attachment faster than evidence can accumulate.", state: "Hope · belonging", next: "The relationship becomes emotionally important but remains difficult to verify.", response: "Let time and consistent, independently verifiable actions—not declarations—build trust." },
      { title: "The unverified life", signal: "Video calls, meetings and ordinary verification repeatedly fail for plausible reasons.", purpose: "Preserve the identity while converting inconsistencies into tests of loyalty.", state: "Doubt · protectiveness", next: "Isolation or secrecy can make outside concern feel hostile to the relationship.", response: "Reverse-search images and discuss the facts with someone who is outside the emotional bond." },
      { title: "The loyalty test", signal: "Questions are framed as mistrust; friends or family supposedly do not understand.", purpose: "Make critical thinking feel emotionally costly.", state: "Defensiveness · isolation", next: "A crisis creates a reason for financial or practical help.", response: "A real relationship can tolerate verification. Do not hide financial requests from trusted people." },
      { title: "The manufactured crisis", signal: "Travel, medical, legal, customs, business or family trouble suddenly requires money.", purpose: "Turn attachment into an urgent obligation.", state: "Fear · responsibility", next: "Solving one crisis may reveal another obstacle or promised repayment.", response: "Do not send money. Verify the event through independent institutions and people." },
      { title: "The bond as leverage", signal: "Requests repeat; shame, guilt, threats, intimate images or sunk costs keep the story alive.", purpose: "Protect extraction by weaponizing the relationship itself.", state: "Grief · shame · hope", next: "Recovery scammers may later claim they can retrieve the loss for a fee.", response: "Stop payment and contact. Preserve the conversation, tell someone safe, secure accounts, and report." },
    ],
  },
  {
    id: "investment", name: "Investment", constellationNote: "A promised future suspends doubt", title: "The golden horizon",
    summary: "Investment fraud turns aspiration and apparent expertise into escalating commitment before value can be independently verified.", x: 78, y: 23, size: 120,
    events: ["Returns seem unusually consistent or guaranteed", "I was invited into an exclusive group", "The platform shows profits I cannot withdraw", "They want crypto or another payment first"],
    steps: [
      { title: "The credible signal", signal: "An ad, acquaintance, expert, group chat or apparent news story introduces an opportunity.", purpose: "Borrow social proof and familiarity before making a financial claim.", state: "Curiosity · possibility", next: "Expertise and success are displayed in ways that are hard to independently verify.", response: "Identify the legal entity and check registration with the relevant securities regulator." },
      { title: "The privileged circle", signal: "Access feels exclusive, time-sensitive, insider-like, or reserved for a successful community.", purpose: "Make belonging and scarcity substitute for due diligence.", state: "Status · urgency", next: "A small first commitment may appear to work.", response: "Treat exclusivity and secrecy as risk signals. Ask what evidence a skeptical outsider can verify." },
      { title: "The proof of profit", signal: "A dashboard, testimonial, early withdrawal or account manager appears to confirm returns.", purpose: "Create confidence using information controlled by the seller.", state: "Relief · excitement", next: "Success is used to justify a larger deposit.", response: "A displayed balance is not custody. Verify where assets legally sit and whether withdrawal works independently." },
      { title: "Escalating commitment", signal: "Deposits grow because the opportunity, bonus, recovery or market window supposedly cannot wait.", purpose: "Use prior commitment and imagined gains to increase exposure.", state: "Greed · fear of missing out", next: "Withdrawal introduces new requirements.", response: "Do not add funds to solve a withdrawal problem. Pause and seek independent regulated advice." },
      { title: "The withdrawal barrier", signal: "Taxes, insurance, liquidity, verification or unlocking fees appear before funds can be released.", purpose: "Extract more money while preserving the illusion that earlier funds still exist.", state: "Anxiety · sunk cost", next: "Threats, account freezes or recovery offers may follow.", response: "Stop sending money. Contact your financial institutions and preserve wallet addresses and transaction IDs." },
      { title: "Collapse and recovery", signal: "Access disappears, excuses multiply, or a new party offers to recover losses for an advance fee.", purpose: "Delay reporting and extract from the same target again.", state: "Shock · shame · desperation", next: "Personal information may be reused for future approaches.", response: "Report promptly. Secure accounts, monitor identity exposure, and distrust unsolicited recovery services." },
    ],
  },
  {
    id: "marketplace", name: "Marketplace", constellationNote: "A transaction leaves the platform", title: "The vanishing counterparty",
    summary: "Marketplace fraud exploits the moment trust moves from a platform’s safeguards into a private payment or delivery channel.", x: 82, y: 69, size: 105,
    events: ["The price is far better than comparable listings", "They want to leave the marketplace chat", "A buyer sent a payment link", "A courier or overpayment story appeared"],
    steps: [
      { title: "The irresistible listing", signal: "Price, rarity, urgency or convenience makes the transaction feel unusually attractive.", purpose: "Create enough desire to reduce comparison and scrutiny.", state: "Excitement · scarcity", next: "The counterparty pushes for quick contact or commitment.", response: "Compare prices, account history, photos and listing details before engaging." },
      { title: "Leaving the safe ground", signal: "Conversation moves to text, email or another app; platform protections are dismissed.", purpose: "Remove moderation, records and payment safeguards.", state: "Convenience · trust", next: "A payment, verification or delivery procedure is introduced.", response: "Keep communication and payment inside the marketplace whenever possible." },
      { title: "The procedural costume", signal: "A fake payment notice, courier page, escrow service, verification code or business account rule appears.", purpose: "Make a private request look like standard platform procedure.", state: "Confusion · compliance", next: "You are asked to click, pay, refund or disclose information.", response: "Open the marketplace or payment service independently; do not trust screenshots or emailed confirmations." },
      { title: "The urgency pivot", signal: "Another buyer, departing courier, impatient relative or expiring payment creates pressure.", purpose: "Prevent careful verification at the moment of transfer.", state: "Urgency · fear of loss", next: "The requested action becomes difficult to reverse.", response: "Let the transaction go rather than abandon your safety rules." },
      { title: "Transfer without recourse", signal: "Payment moves to e-transfer, wire, gift card, crypto, deposit, refund or a fake login page.", purpose: "Move value or credentials beyond meaningful recourse.", state: "Commitment · uncertainty", next: "The counterparty may disappear or invent another fee.", response: "Do not ship based on an email. Verify cleared funds directly in your real account." },
      { title: "The disappearance", signal: "The listing, account, payment or counterparty vanishes; delivery never occurs.", purpose: "End contact before the victim can recover value or warn others.", state: "Anger · embarrassment", next: "The same photos, accounts or contact details may be reused elsewhere.", response: "Preserve the listing and messages, notify the platform and payment provider, and report the account." },
    ],
  },
  {
    id: "employment", name: "Employment", constellationNote: "Opportunity conceals extraction", title: "The hollow opportunity",
    summary: "Employment fraud borrows the dignity and urgency of work to extract money, identity data, labour, or access.", x: 24, y: 74, size: 104,
    events: ["I was hired without a real interview", "The pay is high for simple remote work", "They sent a cheque to buy equipment", "The job involves moving money or packages"],
    steps: [
      { title: "The welcome opportunity", signal: "An unsolicited recruiter, easy remote role or unusually generous offer arrives.", purpose: "Match a real need for income, status or flexibility.", state: "Hope · relief", next: "A rapid, text-only hiring process creates momentum.", response: "Find the employer independently and verify the recruiter through its published contact information." },
      { title: "The imitation workplace", signal: "Logos, contracts, interview scripts and employee names resemble a real organization.", purpose: "Make borrowed corporate identity feel like due diligence.", state: "Trust · anticipation", next: "The offer arrives before normal checks or meaningful conversation.", response: "Check email domains, job postings and corporate contacts; do not rely on documents sent by the recruiter." },
      { title: "Instant belonging", signal: "You are hired quickly and introduced to managers, tasks or private channels.", purpose: "Turn skepticism into fear of losing a new opportunity.", state: "Pride · obligation", next: "Onboarding requests identity documents, money or account activity.", response: "A real offer still permits verification. Limit identity documents until the employer is confirmed." },
      { title: "The unusual task", signal: "Buy equipment, deposit a cheque, rate products, process payments, receive packages, or recruit others.", purpose: "Disguise extraction or illegal activity as ordinary work.", state: "Compliance · uncertainty", next: "Your own funds, bank account or identity become part of the workflow.", response: "Stop if work requires personal funds or moving money for others. Ask your bank before depositing or forwarding anything." },
      { title: "Personal exposure", signal: "The cheque reverses, task balance becomes negative, or accounts are used for transfers and purchases.", purpose: "Shift loss and legal exposure onto the supposed employee.", state: "Panic · responsibility", next: "Threats, fees or promises of reimbursement encourage continued participation.", response: "Contact your bank and the impersonated employer. Secure identity documents and preserve instructions." },
      { title: "Pressure and silence", signal: "The employer disappears, threatens consequences, or says payment depends on one more task.", purpose: "Delay disclosure and preserve access to the victim or their network.", state: "Shame · fear · disappointment", next: "Stolen identity and contacts may support later fraud.", response: "End contact, report the listing and recruiter, protect identity accounts, and warn affected contacts." },
    ],
  },
  {
    id: "tickets", name: "Tickets & tolls", constellationNote: "A small penalty creates haste", title: "The miniature emergency",
    summary: "Fake ticket, toll, tax and delivery notices use a small plausible debt to make immediate payment feel easier than verification.", x: 51, y: 87, size: 94,
    events: ["A text says I have an unpaid parking ticket", "A toll or delivery fee is overdue", "The amount is small but the penalty is urgent", "The payment page asks for card or identity details"],
    steps: [
      { title: "The plausible notice", signal: "A text or email names a common service, minor debt, ticket, toll, parcel or refund.", purpose: "Use a familiar everyday event that could apply to almost anyone.", state: "Recognition · uncertainty", next: "A modest consequence makes quick resolution feel reasonable.", response: "Do not click. Ask whether that authority normally contacts people this way." },
      { title: "The small consequence", signal: "A late fee, licence problem, returned parcel or collection threat is attached to a small amount.", purpose: "Make verification feel more burdensome than payment.", state: "Annoyance · concern", next: "A deadline compresses the decision.", response: "Small amounts deserve the same verification as large ones; use the official app or website you already know." },
      { title: "The expiring window", signal: "Payment is supposedly required today or within a few hours.", purpose: "Convert mild concern into automatic action.", state: "Urgency · distraction", next: "A link opens a convincing but unrelated payment page.", response: "Ignore the message’s clock. Independently check whether any balance exists." },
      { title: "The mirror page", signal: "Branding, language and form fields imitate a municipality, courier, tax agency or toll operator.", purpose: "Capture trust at the exact moment payment details are entered.", state: "Routine compliance", next: "The form requests more information than the stated payment needs.", response: "Check the domain character by character. Close it and navigate from an official bookmark or search result." },
      { title: "The hidden harvest", signal: "Card, banking, address, birth date, password or verification-code fields appear.", purpose: "Turn a tiny alleged debt into payment-card or identity access.", state: "Task focus · impatience", next: "Charges, account takeover or further impersonation can follow.", response: "Do not submit. If you already did, contact the card issuer and change exposed credentials immediately." },
      { title: "The second use", signal: "More notices, unfamiliar transactions or account alerts follow the original payment.", purpose: "Reuse confirmed contact and financial details across campaigns.", state: "Confusion · alarm", next: "The victim may be approached as a known responsive target.", response: "Preserve the original message, secure accounts, dispute transactions, and report the page and sender." },
    ],
  },
];

export const allSuspiciousEvents = families.flatMap((family) => family.events.map((event) => ({ familyId: family.id, event })));
