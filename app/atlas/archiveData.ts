export type ArchiveLang = "en" | "fr";
export type ArchiveLens = "patterns" | "goals" | "pressure" | "requests" | "breaks";
export type Pair = { en: string; fr: string };

export type ArchivePattern = {
  id: string;
  aliases: string[];
  name: Pair;
  title: Pair;
  opening: Pair;
  mechanism: Pair;
  goal: string[];
  pressure: string[];
  requests: string[];
  breaks: string[];
  authority: string[];
  realWorld: Pair;
  example: Pair;
};

export const lensCopy: Record<ArchiveLens, { label: Pair; prompt: Pair }> = {
  patterns: {
    label: { en: "Patterns", fr: "Motifs" },
    prompt: { en: "Recognizable stories used to carry manipulation.", fr: "Des histoires reconnaissables utilisées pour transporter la manipulation." },
  },
  goals: {
    label: { en: "End goals", fr: "Objectifs" },
    prompt: { en: "What are they ultimately trying to obtain?", fr: "Qu’essaient-ils réellement d’obtenir?" },
  },
  pressure: {
    label: { en: "Pressure & emotion", fr: "Pression et émotions" },
    prompt: { en: "What are they trying to make you feel—and why?", fr: "Que veulent-ils vous faire ressentir — et pourquoi?" },
  },
  requests: {
    label: { en: "Requests", fr: "Demandes" },
    prompt: { en: "Where the story turns into an action.", fr: "Le moment où l’histoire devient une action." },
  },
  breaks: {
    label: { en: "Break the pattern", fr: "Briser le motif" },
    prompt: { en: "Actions that return time, perspective and control.", fr: "Des gestes qui rendent le temps, la perspective et le contrôle." },
  },
};

export const facetCopy: Record<string, Pair> = {
  money: { en: "Take money", fr: "Prendre de l’argent" },
  access: { en: "Gain account access", fr: "Accéder à un compte" },
  identity: { en: "Collect identity data", fr: "Recueillir des données d’identité" },
  control: { en: "Gain control or compliance", fr: "Obtenir le contrôle ou l’obéissance" },
  labour: { en: "Exploit labour or access", fr: "Exploiter le travail ou l’accès" },
  urgency: { en: "Urgency", fr: "Urgence" },
  threat: { en: "Threats and consequences", fr: "Menaces et conséquences" },
  false_trust: { en: "Borrowed trust", fr: "Confiance empruntée" },
  helpfulness: { en: "Helpfulness and obligation", fr: "Entraide et obligation" },
  excitement: { en: "Hope and excitement", fr: "Espoir et enthousiasme" },
  isolation: { en: "Isolation and secrecy", fr: "Isolement et secret" },
  shame: { en: "Shame and sunk cost", fr: "Honte et coûts irrécupérables" },
  click_link: { en: "Click a link", fr: "Cliquer sur un lien" },
  pay_money: { en: "Send money", fr: "Envoyer de l’argent" },
  submit_credentials: { en: "Share codes or credentials", fr: "Partager des codes ou identifiants" },
  call_number: { en: "Call their number", fr: "Appeler leur numéro" },
  download_app: { en: "Install software", fr: "Installer un logiciel" },
  reply: { en: "Continue the conversation", fr: "Poursuivre la conversation" },
  independent_channel: { en: "Verify through your own channel", fr: "Vérifier par votre propre canal" },
  pause: { en: "Create a cooling-off period", fr: "Créer une période de recul" },
  outside_person: { en: "Bring in another person", fr: "Faire intervenir une autre personne" },
  preserve: { en: "Preserve evidence", fr: "Conserver les preuves" },
  refuse_transfer: { en: "Refuse irreversible transfers", fr: "Refuser les transferts irréversibles" },
};

export const archivePatterns: ArchivePattern[] = [
  {
    id: "delivery_scam", aliases: ["delivery", "parcel"],
    name: { en: "Delivery scam", fr: "Arnaque de livraison" },
    title: { en: "The missing parcel", fr: "Le colis manquant" },
    opening: { en: "A routine delivery problem appears to need a small, immediate correction.", fr: "Un problème de livraison banal semble exiger une petite correction immédiate." },
    mechanism: { en: "Familiar procedure and a modest fee lower suspicion, then move you to a link controlled by the sender.", fr: "Une procédure familière et de petits frais réduisent la méfiance, puis vous déplacent vers un lien contrôlé par l’expéditeur." },
    goal: ["money", "access", "identity"], pressure: ["urgency", "false_trust", "helpfulness"], requests: ["click_link", "pay_money", "submit_credentials"], breaks: ["independent_channel", "pause", "preserve"], authority: ["corporate"],
    realWorld: { en: "The same structure can arrive by text, phone, mail, a fake courier at the door, or someone claiming a package is being held.", fr: "La même structure peut arriver par texto, téléphone, courrier, faux livreur à la porte ou personne prétendant retenir un colis." },
    example: { en: "“Your parcel cannot be delivered until a $2.17 customs fee is paid.”", fr: "« Votre colis ne peut pas être livré avant le paiement de frais de douane de 2,17 $. »" },
  },
  {
    id: "government_impersonation", aliases: ["law_enforcement", "government"],
    name: { en: "Government impersonation", fr: "Usurpation gouvernementale" },
    title: { en: "Borrowed authority", fr: "L’autorité empruntée" },
    opening: { en: "Someone invokes taxes, police, immigration, benefits or another institution that can affect your life.", fr: "Une personne invoque l’impôt, la police, l’immigration, les prestations ou une autre institution qui peut affecter votre vie." },
    mechanism: { en: "Authority and threatened consequences compress time until obedience feels safer than verification.", fr: "L’autorité et les conséquences menaçantes compriment le temps jusqu’à ce qu’obéir semble plus sûr que vérifier." },
    goal: ["money", "identity", "control"], pressure: ["threat", "urgency", "false_trust", "isolation"], requests: ["pay_money", "call_number", "submit_credentials"], breaks: ["independent_channel", "outside_person", "pause", "preserve"], authority: ["government"],
    realWorld: { en: "It can happen in a call, letter, office, doorstep visit or conversation with someone displaying convincing documents.", fr: "Cela peut se produire par appel, lettre, visite à domicile, au bureau ou avec quelqu’un présentant des documents convaincants." },
    example: { en: "“A warrant will be issued today unless you settle this balance immediately.”", fr: "« Un mandat sera émis aujourd’hui si vous ne réglez pas ce solde immédiatement. »" },
  },
  {
    id: "account_verification", aliases: ["financial_phishing", "account"],
    name: { en: "Account verification", fr: "Vérification de compte" },
    title: { en: "The false checkpoint", fr: "Le faux point de contrôle" },
    opening: { en: "A bank, service or employer appears to need confirmation before something bad happens.", fr: "Une banque, un service ou un employeur semble exiger une confirmation avant qu’un problème survienne." },
    mechanism: { en: "A familiar security ritual is copied so that surrendering access feels like protecting the account.", fr: "Un rituel de sécurité familier est copié pour que céder l’accès ressemble à une protection du compte." },
    goal: ["access", "identity", "control"], pressure: ["urgency", "threat", "false_trust", "helpfulness"], requests: ["click_link", "submit_credentials", "download_app", "call_number"], breaks: ["independent_channel", "pause", "outside_person"], authority: ["financial_institution", "corporate", "tech_company"],
    realWorld: { en: "The request may come through a message, call, help desk, workplace conversation or person standing beside an ATM.", fr: "La demande peut venir d’un message, d’un appel, d’un service d’aide, d’une conversation au travail ou d’une personne près d’un guichet." },
    example: { en: "“Read me the six-digit code so I can stop the unauthorized transaction.”", fr: "« Donnez-moi le code à six chiffres pour que je bloque la transaction non autorisée. »" },
  },
  {
    id: "reward_claim", aliases: ["prize_scam", "reward"],
    name: { en: "Prize or reward claim", fr: "Prix ou récompense" },
    title: { en: "The promised reward", fr: "La récompense promise" },
    opening: { en: "Unexpected good news creates momentum before the claim can be examined.", fr: "Une bonne nouvelle inattendue crée un élan avant que la promesse puisse être examinée." },
    mechanism: { en: "Excitement and imagined ownership make a fee or disclosure feel minor compared with what is supposedly waiting.", fr: "L’enthousiasme et l’impression de déjà posséder le prix rendent les frais ou la divulgation mineurs face à la récompense promise." },
    goal: ["money", "identity"], pressure: ["excitement", "urgency", "false_trust"], requests: ["pay_money", "click_link", "submit_credentials", "reply"], breaks: ["pause", "independent_channel", "refuse_transfer", "outside_person"], authority: ["corporate"],
    realWorld: { en: "The lure can be online, by mail, at an event, through a sales presentation or delivered personally.", fr: "L’appât peut arriver en ligne, par courrier, lors d’un événement, dans une présentation de vente ou en personne." },
    example: { en: "“Your prize is confirmed. Pay the processing fee before today’s deadline.”", fr: "« Votre prix est confirmé. Payez les frais de traitement avant l’échéance d’aujourd’hui. »" },
  },
  {
    id: "romance_scam", aliases: ["romance", "relationship"],
    name: { en: "Romance and relationship fraud", fr: "Fraude amoureuse et relationnelle" },
    title: { en: "The counterfeit bond", fr: "Le lien contrefait" },
    opening: { en: "Attention, intimacy or belonging develops unusually quickly.", fr: "L’attention, l’intimité ou l’appartenance se développent anormalement vite." },
    mechanism: { en: "The relationship becomes important enough that verification feels disloyal and outside concern feels hostile.", fr: "La relation devient assez importante pour que vérifier semble déloyal et que l’inquiétude extérieure paraisse hostile." },
    goal: ["money", "control", "identity"], pressure: ["false_trust", "helpfulness", "isolation", "shame", "urgency"], requests: ["pay_money", "reply", "submit_credentials"], breaks: ["outside_person", "pause", "independent_channel", "preserve"], authority: [],
    realWorld: { en: "This is not limited to dating apps; similar attachment and loyalty tactics appear in friendships, groups, workplaces and face-to-face relationships.", fr: "Ce n’est pas limité aux applications de rencontre; les mêmes tactiques d’attachement et de loyauté apparaissent dans les amitiés, groupes, milieux de travail et relations en personne." },
    example: { en: "“If you trusted me, you would help me solve this emergency without involving your family.”", fr: "« Si vous me faisiez confiance, vous m’aideriez sans mêler votre famille à cette urgence. »" },
  },
  {
    id: "employment_scam", aliases: ["employment", "job"],
    name: { en: "Employment fraud", fr: "Fraude à l’emploi" },
    title: { en: "The hollow opportunity", fr: "L’occasion creuse" },
    opening: { en: "A job, contract or business opportunity appears to answer a real need.", fr: "Un emploi, un contrat ou une occasion d’affaires semble répondre à un besoin réel." },
    mechanism: { en: "Rapid belonging and professional-looking procedure turn unusual requests into apparent duties.", fr: "Une appartenance rapide et des procédures professionnelles transforment des demandes inhabituelles en devoirs apparents." },
    goal: ["money", "identity", "labour", "access"], pressure: ["excitement", "false_trust", "helpfulness", "urgency"], requests: ["pay_money", "submit_credentials", "download_app", "reply"], breaks: ["independent_channel", "pause", "outside_person", "refuse_transfer", "preserve"], authority: ["corporate"],
    realWorld: { en: "The same pattern appears in remote hiring, offices, modelling calls, contracting, door-to-door work and informal cash jobs.", fr: "Le même motif apparaît dans l’embauche à distance, les bureaux, le mannequinat, la sous-traitance, le porte-à-porte et les emplois informels." },
    example: { en: "“You are hired. Deposit this cheque and use part of it to purchase your equipment today.”", fr: "« Vous êtes embauché. Déposez ce chèque et utilisez-en une partie pour acheter votre équipement aujourd’hui. »" },
  },
];

export function pair(value: Pair, lang: ArchiveLang) {
  return value[lang];
}
