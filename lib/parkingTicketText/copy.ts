import type { ChecklistBranch, ConcernNoteId } from "./types";

export const hero = {
  title: "Got a parking ticket text?",
  sub1: "Get the right next-step checklist before you click or pay.",
  sub2: "Free. No email required.",
};

export const privacyNote =
  "Privacy note: We use your answers to show the right checklist and improve ScanScam. Please don’t enter passwords, card numbers, SINs, or other sensitive information.";

export const checklistDisclaimer =
  "This checklist is general safety guidance, not legal, financial, or cybersecurity advice.";

export const validationMessage = "Please choose an answer before continuing.";

export const openTextWarning =
  "Don’t include passwords, card numbers, SINs, or private account details.";

export const reportingNoteBody =
  "If you want to report the message, you can contact the Canadian Anti-Fraud Centre. You may also be able to forward suspicious texts to 7726, depending on your mobile provider.";

export const helpfulReportingLabel = "Reporting:";

export const helpfulGuidanceLabel = "General guidance:";

export const helpfulNotesTitle = "Helpful notes";

export const needAnotherMessageLead = "Need to check another message?";

/** Full reporting block for legacy / plain-text parity */
export const reportingNote = `${helpfulReportingLabel}\n${reportingNoteBody}`;

export const postChecklistLine =
  "You can also check suspicious texts, emails, or links at ScanScam.ca.";

export const contactQuestionsPrefix = "Questions or comments?";

export const contactEmail = "hello@scanscam.ca";

export const contactLine = `${contactQuestionsPrefix} ${contactEmail}`;

/** Q1 option id → label + branch key for routing */
export const q1Options: { id: string; label: string; branchKey: string }[] = [
  { id: "did_not_click", label: "I did not click.", branchKey: "did_not_click" },
  {
    id: "clicked_no_input",
    label: "I clicked, but did not enter anything.",
    branchKey: "clicked_no_input",
  },
  { id: "personal_info", label: "I entered personal information.", branchKey: "personal_info" },
  {
    id: "card_or_payment",
    label: "I entered my card or made a payment.",
    branchKey: "card_or_payment",
  },
  { id: "unsure", label: "I’m not sure.", branchKey: "unsure" },
  { id: "other", label: "Other.", branchKey: "other" },
];

export const q2Options: { id: string; label: string }[] = [
  { id: "real_fine", label: "Is this a real parking fine?" },
  { id: "card_compromised", label: "Is my card compromised?" },
  { id: "personal_details", label: "Are my personal details at risk?" },
  { id: "device_risk", label: "Is my phone or computer at risk?" },
  {
    id: "right_order",
    label: "I just want to know what to do in the right order.",
  },
  { id: "other", label: "Other." },
];

export const q3Options: { id: string; label: string }[] = [
  { id: "clearer_plan", label: "A clearer step-by-step action plan." },
  { id: "other_types", label: "A checklist for other scam types." },
  {
    id: "message_to_share",
    label: "A message I can send to my bank, city, workplace, or someone I trust.",
  },
  {
    id: "report_package",
    label: "A report package I can save, share, or give to an institution.",
  },
  {
    id: "protect_family",
    label: "Help me protect my family, my business, or someone I care about.",
  },
  {
    id: "real_person",
    label: "A real person to help me understand where I stand and what to do next.",
  },
  { id: "video", label: "A video explaining what to watch for." },
  { id: "checklist_first", label: "I just want to see my checklist first." },
];

export const checklistUsefulQuestion = "Was this checklist useful?";

export const checklistUsefulOptions: { id: string; label: string }[] = [
  { id: "yes", label: "Yes" },
  { id: "somewhat", label: "Somewhat" },
  { id: "no", label: "No" },
];

export const checklistMissingLabel = "What was missing?";

export const checklistMissingPlaceholder =
  "Example: clearer steps, who to contact, what to say, or what to do if I already paid.";

export const concernNotes: Record<ConcernNoteId, { note: string }> = {
  real_fine_concern_v1: {
    note: "A text message alone is not the safest way to verify a parking fine. Use your city’s official website, payment portal, or contact number instead of the link in the message.",
  },
  card_compromise_concern_v1: {
    note: "Card risk depends on whether you entered card details or made a payment. If you did not enter card information, avoid entering anything now and verify through official channels.",
  },
  personal_details_concern_v1: {
    note: "Personal detail risk depends on what you shared. Write down what you entered and avoid giving more information through the text link.",
  },
  device_risk_concern_v1: {
    note: "Device risk is higher if you downloaded something, granted permissions, or installed an app. If you only opened a page, stop using the link and watch for unusual behavior.",
  },
  right_order_concern_v1: {
    note: "The safest order is to stop using the text link, identify what you already did, save evidence, and contact the right organization only if needed.",
  },
  other_concern_v1: {
    note: "Because your concern is specific, use the checklist below as a safe starting point and avoid taking action through the text link.",
  },
};

export type ChecklistSections = {
  whatToDoNow: string[];
  whatToKeep: string[];
  whatToKnow: string[];
  whoToContact?: string[];
};

export const branchSections: Record<ChecklistBranch, ChecklistSections> = {
  prevention: {
    whatToDoNow: [
      "Don’t tap the link in the text.",
      "Don’t pay from the message or reply.",
      "To check a fine, use your city’s official website, payment line, or phone number—not the link in the text.",
      "Don’t enter card or personal details on anything that opened from that text.",
    ],
    whatToKeep: [
      "Screenshot the message if you want a record.",
      "Delete or report it with your phone’s built-in options.",
    ],
    whatToKnow: [
      "Follow-up texts often push urgency (“pay now,” late fees). Slow down and verify only through official channels.",
      "A text alone can’t prove a fine like your city’s real site or office can.",
    ],
  },
  clicked_no_input: {
    whatToDoNow: [
      "Close the tab or screen you opened from the link.",
      "Don’t type anything there or download anything from that page.",
      "Don’t open the text link again.",
      "To check a fine, use your city’s official website or phone number—not the message link.",
    ],
    whatToKeep: ["Save the web address, time, and screenshots if you can."],
    whatToKnow: [
      "Watch for odd pop-ups, downloads, or permission prompts.",
      "If you remember entering a card, password, or personal info later, follow the stronger steps for that situation.",
    ],
  },
  personal_info: {
    whatToDoNow: [
      "Don’t use the text link again.",
      "Write down exactly what you typed (name, address, codes, passwords, etc.).",
      "Watch accounts that match what you shared.",
    ],
    whatToKeep: [
      "Keep the text thread, links, screenshots, and roughly when it happened.",
    ],
    whatToKnow: [
      "Calls, texts, or emails that repeat details you typed are high risk—don’t trust them.",
      "A real fine is verified through your city’s official channels—not that link.",
    ],
    whoToContact: [
      "If you shared banking or government ID details, call the number on your real card or statement—not from the text.",
      "To report: see the Canadian Anti-Fraud Centre in the reporting note below.",
    ],
  },
  card_or_payment: {
    whatToDoNow: [
      "Call your bank or card issuer now—use the number on your card or their official website.",
      "Ask to lock, replace, or monitor the card, and how to dispute a charge you don’t recognize.",
      "Scan recent and pending transactions for anything odd.",
      "Don’t go back to the link in the text.",
    ],
    whatToKeep: [
      "Save the text, link, amount, time, and any confirmation or receipt screens.",
    ],
    whatToKnow: [
      "Acting fast limits how far a bad charge can go.",
      "Check any real parking ticket on your city’s official website or phone line only.",
    ],
    whoToContact: [
      "Call your bank or card issuer using the number on your card or official website.",
      "To report: see the Canadian Anti-Fraud Centre in the reporting note below.",
    ],
  },
  unsure: {
    whatToDoNow: [
      "Don’t open the link again or pay from the text.",
      "Think: did you enter a card, password, code, or personal info anywhere?",
      "If a card or payment might be involved, call your bank using the number on your card.",
      "If personal info might be involved, write down what you remember, then contact that place through official channels.",
    ],
    whatToKeep: ["Screenshot the message and note when you got it."],
    whatToKnow: [
      "When you’re unsure, pause and verify outside the text thread.",
      "Check any real fine only through official city channels.",
    ],
    whoToContact: [
      "Your bank if a card or payment might be involved.",
      "City parking or the right office for what you might have shared—look up numbers yourself, not from the text.",
      "To report: see the Canadian Anti-Fraud Centre in the reporting note below.",
    ],
  },
};

/** Merge Q2 optional bullet into “What to know” when present. */
export function getChecklistSections(
  branch: ChecklistBranch,
  extraBullet: string | null
): ChecklistSections {
  const base = branchSections[branch];
  const whatToKnow = extraBullet ? [...base.whatToKnow, extraBullet] : [...base.whatToKnow];
  return {
    whatToDoNow: [...base.whatToDoNow],
    whatToKeep: [...base.whatToKeep],
    whatToKnow,
    ...(base.whoToContact ? { whoToContact: [...base.whoToContact] } : {}),
  };
}

export type BranchMeta = {
  whyMatters: string;
};

export const branchMeta: Record<ChecklistBranch, BranchMeta> = {
  prevention: {
    whyMatters:
      "You’re in the safest position before you enter information, so keep everything on official channels.",
  },
  clicked_no_input: {
    whyMatters:
      "Opening a link is different from typing payment or personal info—stop there and verify elsewhere.",
  },
  personal_info: {
    whyMatters:
      "What happens next depends on what you shared, so document it and reach out through official contacts if needed.",
  },
  card_or_payment: {
    whyMatters:
      "Payment details can move fast, so your bank or card issuer should be in the loop right away.",
  },
  unsure: {
    whyMatters:
      "When the story is fuzzy, the safest move is to stop using the text and figure out if payment or personal data was involved.",
  },
};

/** Human-readable Q1 phrase for result intro. */
export function q1AnswerPhrase(q1Status: string, q1Other: string): string {
  const opt = q1Options.find((o) => o.id === q1Status);
  if (q1Status === "other" && q1Other.trim()) return "described a different situation";
  if (opt) {
    const map: Record<string, string> = {
      did_not_click: "did not click the link",
      clicked_no_input: "clicked but did not enter anything",
      personal_info: "entered personal information",
      card_or_payment: "entered your card or made a payment",
      unsure: "are not sure what happened",
      other: "are not sure what happened",
    };
    return map[q1Status] ?? "are not sure what happened";
  }
  return "are not sure what happened";
}

function pushSection(lines: string[], title: string, items: string[]) {
  if (items.length === 0) return;
  lines.push(title);
  for (const b of items) lines.push(`• ${b}`);
  lines.push("");
}

export function buildPlainTextChecklist(params: {
  q1Status: string;
  q1Other: string;
  concernNoteId: ConcernNoteId;
  branch: ChecklistBranch;
  extraBullet: string | null;
}): string {
  const meta = branchMeta[params.branch];
  const cn = concernNotes[params.concernNoteId];
  const sections = getChecklistSections(params.branch, params.extraBullet);
  const phrase = q1AnswerPhrase(params.q1Status, params.q1Other);
  const lines: string[] = [
    "Your next-step checklist",
    "",
    `Since you ${phrase}, here are the safest next steps.`,
    "",
    "About your concern:",
    cn.note,
    "",
  ];
  pushSection(lines, "What to do now", sections.whatToDoNow);
  pushSection(lines, "What to keep", sections.whatToKeep);
  pushSection(lines, "What to know", sections.whatToKnow);
  if (sections.whoToContact?.length) {
    pushSection(lines, "Who to contact", sections.whoToContact);
  }
  lines.push("Why this matters:", meta.whyMatters);
  lines.push("", helpfulNotesTitle);
  lines.push(`${helpfulReportingLabel} ${reportingNoteBody}`);
  lines.push(`${helpfulGuidanceLabel} ${checklistDisclaimer}`);
  lines.push("", needAnotherMessageLead);
  lines.push(postChecklistLine);
  lines.push(contactLine);
  lines.push("", privacyNote);
  return lines.join("\n").trim();
}
