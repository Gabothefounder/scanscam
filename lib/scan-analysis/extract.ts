/**
 * Rule-based feature extraction.
 * Simple, inspectable regex matching. Single-label only.
 */

import type {
  NarrativeFamily,
  ImpersonationEntity,
  RequestedAction,
  ThreatStage,
} from "./taxonomy";

export type ExtractInput = {
  messageText: string;
  contextQuality: string;
  submissionRoute: string;
};

export type ExtractResult = {
  narrativeFamily: NarrativeFamily;
  impersonationEntity: ImpersonationEntity;
  requestedAction: RequestedAction;
  threatStage: ThreatStage;
};

/**
 * Skip extraction when context is fragment/unknown, or when thin and not likely_scam.
 * Allow extraction for thin context when router has flagged likely_scam.
 */
function shouldSkipExtraction(ctx: string, route: string): boolean {
  if (ctx === "fragment" || ctx === "unknown") return true;
  if (ctx === "thin" && route !== "likely_scam") return true;
  return false;
}

// ---------------------------------------------------------------------------
// narrativeFamily: scam story type
// Order matters: first match wins. More specific before generic.
// ---------------------------------------------------------------------------

const NARRATIVE_RULES: { id: NarrativeFamily; test: RegExp }[] = [
  {
    id: "recovery_scam",
    test: /\brecover\b|funds?\s+recover|contact\s+recovery\b|récupér(?:er|ation)\s+(?:de\s+)?fonds|remboursement\s+perdu/i,
  },
  {
    id: "social_engineering_opener",
    test:
      /\bwrong\s+number\b|sorry.*wrong\s+number|texted\s+the\s+wrong\s+number|who\s+is\s+this\b|reconnect\b|long\s+time\s+no\b|long\s+time\s+no\s+talk\b|did\s+you\s+get\s+my\s+last\s+message\b|found\s+your\s+number\s+in\s+my\s+contacts\b|are\s+you\s+still\s+working\s+(in|at)\b|since\s+you'?re\s+here\b|mauvais\s+numéro|désolé.*mauvais\s+numéro|qui\s+êtes-vous|c'est\s+qui|depuis\s+longtemps|tu\s+travailles\s+toujours/i,
  },
  {
    id: "government_impersonation",
    test:
      /\b(cra|arc|irs)\b|tax\s+(return|refund|debt)|revenue\s+canada|government\s+fine|parking\s+(violation|ticket|fine|notice)|unpaid\s+parking|plate\s+denial|permit\s+renewal\s+blocked|\bmto\b|\bdmv\b|service\s+ontario|\bserviceontario\b|\bcontraventions?\b|\bstationnement\b|billets?\s+impay(?:é|e)s?|\bamendes?\b|pénalités?|penalites?|refus\s+de\s+(?:la\s+)?plaque|renouvellement\s+du\s+permis|avis\s+officiel|agence\s+du\s+revenu|impôt\s+fédéral/iu,
  },
  {
    id: "law_enforcement",
    test: /\brcmp\b|royal\s+canadian\s+mounted|\bpolice\b|arrest\b|warrant\b|jail\b|arrestation\b|mandat\b|prison\b/i,
  },
  {
    id: "account_verification",
    test:
      /\bverify\s+(your\s+)?account\b|account\s+suspend|unusual\s+activity|confirm\s+identity\b|confirm\s+your\s+details\b|continue\s+using\s+the\s+service\b|avoid\s+suspension\b|secure\s+your\s+account\b|confirm\s+your\s+account\b|vérifier\s+(votre\s+)?compte|compte\s+(?:sera\s+)?suspendu|activité\s+inhabituelle|confirmer\s+(votre\s+)?identité|confirmer\s+vos\s+coordonnées|éviter\s+(?:la\s+)?suspension|sécuriser\s+votre\s+compte|connexion\s+requise|ouvrir\s+(?:une\s+)?session/i,
  },
  {
    id: "delivery_scam",
    test:
      /\bpackage\b|delivery\b|courier\b|usps\b|fedex\b|ups\b|tracking\s+number\b|redeliver|\bcolis\b|\blivraison\b|transporteur\b|numéro\s+de\s+suivi|suivi\s+(?:de\s+)?(?:votre\s+)?colis|postes\s+canada|canada\s+post|purolator\b/i,
  },
  {
    id: "employment_scam",
    test: /\bjob\b|work\s+from\s+home|easy\s+money|interview\s+position\b|emploi\b|travail\s+à\s+domicile|argent\s+facile|entretien\s+d'?embauche/i,
  },
  {
    id: "reward_claim",
    test:
      /\bprize\b|winner\b|won\b|congratulations.*won|redeem\s+(your\s+)?(gift|prize)\b|félicitations.*gagn|vous\s+avez\s+gagné|\bgagné\b.*\b(prix|lot)\b|\bprix\b.*\b(gagné|réclamer)\b|\bréclamer\b.*\b(prix|cadeau)\b|\bloterie\b/i,
  },
  {
    id: "investment_fraud",
    test: /\binvestment\b|crypto\b|bitcoin\b|forex\b|guaranteed\s+return\b|placement\b|rendement\s+garanti|crypto(?:monnaie)?\b/i,
  },
];

function extractNarrativeFamily(
  text: string,
  contextQuality: string,
  submissionRoute: string
): NarrativeFamily {
  if (shouldSkipExtraction(contextQuality, submissionRoute)) return "unknown";
  const hit = NARRATIVE_RULES.find((r) => r.test.test(text));
  return hit ? hit.id : "unknown";
}

// ---------------------------------------------------------------------------
// impersonationEntity: who is being impersonated
// Canada-specific entities first, then generic.
// ---------------------------------------------------------------------------

const IMPERSONATION_RULES: { id: ImpersonationEntity; test: RegExp }[] = [
  { id: "cra", test: /\b(cra|arc)\b|revenue\s+canada\b/i },
  { id: "service_canada", test: /\bservice\s+canada\b/i },
  { id: "rcmp", test: /\brcmp\b|royal\s+canadian\s+mounted\b/i },
  { id: "canada_post", test: /\bcanada\s*post\b|canadapost\b|postes\s+canada\b/i },
  { id: "wealthsimple", test: /\bwealthsimple\b/i },
  {
    id: "generic_government",
    test:
      /\bgovernment\b|tax\s+agency\b|police\b|court\b|warrant\b|\bmto\b|service\s+ontario\b|serviceontario\b|parking\s+(violation|ticket)\b|\bcontraventions?\b|\bstationnement\b|billets?\s+impay(?:é|e)s?|\bamendes?\b|pénalités?|penalites?|refus\s+de\s+(?:la\s+)?plaque|renouvellement\s+du\s+permis|avis\s+officiel/iu,
  },
  {
    id: "generic_financial",
    test:
      /\bbank\b|\bbanque\b|\brbc\b|\bdesjardins\b|paypal\b|visa\b|mastercard\b|carte\s+de\s+crédit|credit\s+union\b|financial\s+institution\b|institution\s+financière/i,
  },
  { id: "generic_courier", test: /\bfedex\b|ups\b|usps\b|purolator\b|dhl\b|courier\b/i },
];

function extractImpersonationEntity(
  text: string,
  contextQuality: string,
  submissionRoute: string
): ImpersonationEntity {
  if (shouldSkipExtraction(contextQuality, submissionRoute)) return "unknown";
  const hit = IMPERSONATION_RULES.find((r) => r.test.test(text));
  return hit ? hit.id : "unknown";
}

// ---------------------------------------------------------------------------
// requestedAction: what the victim is pushed to do
// ---------------------------------------------------------------------------

const ACTION_RULES: { id: RequestedAction; test: RegExp }[] = [
  {
    id: "submit_credentials",
    test:
      /\b(password|otp|verification\s+code|enter\s+code|verify\s+identity)\b|(verify\s+now|verify\s+your\s+account|confirm\s+identity|confirm\s+your\s+details|log\s*in|login|sign\s*in|secure\s+your\s+account|update\s+account|validate\s+account)\b|mot\s+de\s+passe|code\s+de\s+vérification|confirmer\s+(votre\s+)?identité|connexion|ouvrir\s+(?:une\s+)?session|valider\s+votre\s+compte/i,
  },
  {
    id: "pay_money",
    test:
      /\bpay\b|send\s+money\b|wire\b|transfer\b|gift\s*card\b|bitcoin\b|etransfer\b|zelle\b|venmo\b|\bpayer\b|envoyer\s+(?:de\s+)?l'argent|virement|carte(?:-|\s)cadeau|frais\b|\bamende\b|interac\b/i,
  },
  {
    id: "click_link",
    test:
      /\b(click|tap|open\s+link|visit\s+link|follow\s+link|use\s+the\s+link|click\s+here|access\s+the\s+secure\s+portal)\b|https?:\/\/|\bat\s+link\b|cliquez|cliquer|appuyez\s+sur|ouvrez\s+le\s+lien|suivez\s+le\s+lien/i,
  },
  {
    id: "call_number",
    test:
      /\b(call|phone|dial|ring\s+us|reach\s+us\s+at|contact\s+us\s+immediately|call\s+immediately|phone\s+us\s+now|call\s+to\s+resolve|contact\s+recovery\s+team|contact\s+us\s+to\s+recover|begin\s+your\s+claim)\b|\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|appelez|appelez-nous|composez|téléphonez|contactez-nous\s+(?:immédiatement|vite)/i,
  },
  {
    id: "reply_sms",
    test: /\breply\b|text\s+back\b|respond\b|message\s+us\b|répondez|répondez\s+par\s+sms|envoyez\s+un\s+sms/i,
  },
  { id: "download_app", test: /\bdownload\b|install\s+(the\s+)?app\b|téléchargez|installer\s+l'application/i },
];

function extractRequestedAction(
  text: string,
  contextQuality: string,
  submissionRoute: string
): RequestedAction {
  if (shouldSkipExtraction(contextQuality, submissionRoute)) return "unknown";
  const hit = ACTION_RULES.find((r) => r.test.test(text));
  return hit ? hit.id : "none";
}

// ---------------------------------------------------------------------------
// threatStage: phase of the scam lifecycle
// ---------------------------------------------------------------------------

const THREAT_RULES: { id: ThreatStage; test: RegExp }[] = [
  {
    id: "post_loss_recovery",
    test: /\brecover\s+funds\b|contact\s+recovery\b|get\s+your\s+money\s+back\b|récupér(?:er|ation)\s+(?:l'|le\s+)?argent/i,
  },
  {
    id: "credential_capture",
    test:
      /\botp\b|verification\s+code\b|password\b|login\b|verify\s+account\b|confirm\s+identity\b|mot\s+de\s+passe|code\s+de\s+vérification|connexion|vérifier\s+(votre\s+)?compte/i,
  },
  {
    id: "payment_extraction",
    test: /\bpay\b|send\s+money\b|wire\b|transfer\b|gift\s*card\b|fee\b|fine\b|\bpayer\b|virement|frais\b|\bamende\b|carte(?:-|\s)cadeau/i,
  },
  {
    id: "initial_lure",
    test:
      /\bwrong\s+number\b|sorry.*wrong|who\s+is\s+this\b|reconnect\b|long\s+time\s+no(\s+talk)?\b|did\s+you\s+get\s+my\s+last\s+message\b|found\s+your\s+number\s+in\s+my\s+contacts\b|are\s+you\s+still\s+working\s+(in|at)\b|since\s+you'?re\s+here\b|hey\b|hi\b|prize\b|winner\b|you('ve|\s+have)\s+won\b|salut\b|bonjour\b|félicitations|vous\s+avez\s+gagné/i,
  },
];

function extractThreatStage(
  text: string,
  contextQuality: string,
  submissionRoute: string
): ThreatStage {
  if (shouldSkipExtraction(contextQuality, submissionRoute)) return "unclear";
  const hit = THREAT_RULES.find((r) => r.test.test(text));
  return hit ? hit.id : "unclear";
}

// ---------------------------------------------------------------------------
// Main extract function
// ---------------------------------------------------------------------------

export function extract(input: ExtractInput): ExtractResult {
  const text = input.messageText.toLowerCase();
  const ctx = input.contextQuality;
  const route = input.submissionRoute;

  const narrative = extractNarrativeFamily(text, ctx, route);
  const entity = extractImpersonationEntity(text, ctx, route);
  const action = extractRequestedAction(text, ctx, route);
  let threat = extractThreatStage(text, ctx, route);

  if (
    narrative === "social_engineering_opener" &&
    threat === "unclear" &&
    action !== "pay_money" &&
    action !== "submit_credentials"
  ) {
    threat = "initial_lure";
  }

  return {
    narrativeFamily: narrative,
    impersonationEntity: entity,
    requestedAction: action,
    threatStage: threat,
  };
}
