import type { ChecklistBranch, ConcernNoteId } from "./types";

/** Q1 stored value → sheet `checklist_branch` */
export function checklistBranchFromQ1(q1Status: string): ChecklistBranch {
  switch (q1Status) {
    case "did_not_click":
      return "prevention";
    case "clicked_no_input":
      return "clicked_no_input";
    case "personal_info":
      return "personal_info";
    case "card_or_payment":
      return "card_or_payment";
    case "unsure":
    case "other":
      return "unsure";
    default:
      return "unsure";
  }
}

export function concernNoteIdFromQ2(q2MainConcern: string): ConcernNoteId {
  switch (q2MainConcern) {
    case "real_fine":
      return "real_fine_concern_v1";
    case "card_compromised":
      return "card_compromise_concern_v1";
    case "personal_details":
      return "personal_details_concern_v1";
    case "device_risk":
      return "device_risk_concern_v1";
    case "right_order":
      return "right_order_concern_v1";
    case "other":
    default:
      return "other_concern_v1";
  }
}

/** At most one extra bullet from Q2 when useful (ids match concern notes). */
export function optionalQ2ExtraBullet(
  concernNoteId: ConcernNoteId,
  checklistBranch: ChecklistBranch
): string | null {
  switch (concernNoteId) {
    case "real_fine_concern_v1":
      return "If you are unsure whether a fine exists, search for your city’s official parking payment page yourself instead of using the text link.";
    case "card_compromise_concern_v1":
      if (checklistBranch === "card_or_payment") return null;
      return "If you entered card details at any point, contact your bank or card issuer.";
    case "personal_details_concern_v1":
      if (checklistBranch === "personal_info" || checklistBranch === "card_or_payment") return null;
      return "If you entered sensitive personal information, contact the relevant institution or service provider.";
    case "device_risk_concern_v1":
      return "If you downloaded anything or allowed permissions, review your device settings and consider getting technical help.";
    case "right_order_concern_v1":
      return "Follow the steps in order and avoid taking action from the text message itself.";
    case "other_concern_v1":
      return "If your situation involves payment, personal information, or account access, contact the relevant organization through official channels.";
    default:
      return null;
  }
}
