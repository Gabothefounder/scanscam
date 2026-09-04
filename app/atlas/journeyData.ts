export type Lang = "en" | "fr";
export type EntryMode = "scan" | "lived" | "learn";

export type JourneyScene = {
  key: string;
  image: "pressure" | "emotion" | "ledger" | "community";
  eyebrow: [string, string];
  title: [string, string];
  lead: [string, string];
  choices?: Array<[string, string, string]>;
  multi?: boolean;
  ownWords?: boolean;
  reflection?: [string, string];
};

export const tx = (pair: [string, string], lang: Lang) => pair[lang === "en" ? 0 : 1];

export const emotionReflections: Record<string, [string, string]> = {
  shame: ["Shame grows in hiding. You are not alone.", "La honte grandit dans le silence. Vous n’êtes pas seul·e."],
  fear: ["The threat felt real. Your body was trying to protect you.", "La menace semblait réelle. Votre corps essayait de vous protéger."],
  anger: ["A boundary was crossed. Anger can help you act.", "Une limite a été franchie. La colère peut vous aider à agir."],
  hope: ["What you wanted was real. Someone used deception to reach it.", "Ce que vous désiriez était réel. Quelqu’un s’est servi de la tromperie pour l’atteindre."],
  confusion: ["Slow down. Clarity can return one piece at a time.", "Ralentissez. La clarté peut revenir, un morceau à la fois."],
  numbness: ["Distance can appear when something is too much. Return gradually.", "Une distance peut apparaître quand tout devient trop lourd. Revenez-y doucement."],
};

export const scenes: JourneyScene[] = [
  {
    key: "arrival", image: "pressure", eyebrow: ["The arrival", "L’arrivée"],
    title: ["Where did it begin?", "Où est-ce que ça a commencé?"],
    lead: ["Every deception enters through an ordinary door.", "Chaque tromperie entre par une porte ordinaire."],
    choices: [["text", "A text", "Un texto"], ["call", "A call", "Un appel"], ["email", "An email or letter", "Un courriel ou une lettre"], ["online", "Online", "En ligne"], ["unsure", "I’m not sure", "Je ne sais pas"]], ownWords: true,
  },
  {
    key: "identity", image: "pressure", eyebrow: ["The borrowed face", "Le visage emprunté"],
    title: ["Who did it seem to be?", "Qui semblait vous contacter?"],
    lead: ["Trust can be borrowed before it is earned.", "La confiance peut être empruntée avant d’être méritée."],
    choices: [["bank", "My bank", "Ma banque"], ["authority", "Government or police", "Le gouvernement ou la police"], ["company", "A company", "Une entreprise"], ["known", "Someone I knew", "Une personne connue"], ["unsure", "I’m not sure", "Je ne sais pas"]],
    reflection: ["A familiar symbol is not a verified identity.", "Un symbole familier n’est pas une identité vérifiée."],
  },
  {
    key: "consequence", image: "pressure", eyebrow: ["The promise or threat", "La promesse ou la menace"],
    title: ["What did they say could happen?", "Qu’est-ce qui risquait d’arriver?"],
    lead: ["A consequence can hold our attention before we verify the story.", "Une conséquence peut retenir notre attention avant que nous vérifiions l’histoire."],
    choices: [["money", "My money was at risk", "Mon argent était menacé"], ["blocked", "My account would be blocked", "Mon compte serait bloqué"], ["legal", "I was in legal trouble", "J’avais des problèmes juridiques"], ["protect", "Someone needed protection", "Quelqu’un avait besoin de protection"], ["opportunity", "I could lose an opportunity", "Je pouvais perdre une occasion"]], ownWords: true,
  },
  {
    key: "time", image: "pressure", eyebrow: ["The stolen clock", "L’horloge volée"],
    title: ["What happened to time?", "Qu’est-il arrivé au temps?"],
    lead: ["Urgency can steal the space where judgment lives.", "L’urgence peut voler l’espace où vit le jugement."],
    choices: [["now", "I had to act now", "Je devais agir tout de suite"], ["late", "I feared being too late", "J’avais peur qu’il soit trop tard"], ["line", "They kept me on the line", "On me gardait en ligne"], ["vanish", "The chance would disappear", "L’occasion allait disparaître"], ["none", "There was no pressure", "Il n’y avait pas de pression"]],
    reflection: ["The clock belongs to you again.", "L’horloge vous appartient de nouveau."],
  },
  {
    key: "isolation", image: "pressure", eyebrow: ["The closed world", "Le monde fermé"],
    title: ["What made your world smaller?", "Qu’est-ce qui a rétréci votre monde?"],
    lead: ["Isolation protects the story from reality.", "L’isolement protège l’histoire contre la réalité."],
    choices: [["secret", "Keep it secret", "Garder le secret"], ["hangup", "Don’t hang up", "Ne pas raccrocher"], ["nobank", "Don’t contact the bank", "Ne pas contacter la banque"], ["nobody", "Nobody else would understand", "Personne d’autre ne comprendrait"], ["self", "I isolated myself", "Je me suis isolé·e"], ["none", "None of these", "Aucune de ces réponses"]], multi: true,
    reflection: ["Naming the closed room begins to open it.", "Nommer le monde fermé commence à le rouvrir."],
  },
  {
    key: "emotion", image: "emotion", eyebrow: ["What it awakened", "Ce que cela a éveillé"],
    title: ["What did you feel?", "Qu’avez-vous ressenti?"],
    lead: ["Choose only what feels true.", "Choisissez seulement ce qui vous ressemble."],
    choices: [["shame", "Shame", "Honte"], ["fear", "Fear", "Peur"], ["anger", "Anger", "Colère"], ["hope", "Hope", "Espoir"], ["confusion", "Confusion", "Confusion"], ["numbness", "Numbness", "Engourdissement"]], multi: true, ownWords: true,
  },
  {
    key: "request", image: "pressure", eyebrow: ["The surrender gate", "La porte du renoncement"],
    title: ["What were you asked to give?", "Qu’est-ce qu’on vous demandait de donner?"],
    lead: ["The request reveals where the pressure was leading.", "La demande révèle où menait la pression."],
    choices: [["money", "Money", "De l’argent"], ["code", "A code or password", "Un code ou mot de passe"], ["device", "Access to my device", "L’accès à mon appareil"], ["personal", "Personal information", "Des renseignements personnels"], ["silence", "Silence", "Le silence"], ["unsure", "I’m not sure", "Je ne sais pas"]], multi: true, ownWords: true,
  },
  {
    key: "escalation", image: "pressure", eyebrow: ["The moving finish line", "La ligne d’arrivée qui recule"],
    title: ["Did the story change after you responded?", "L’histoire a-t-elle changé après votre réponse?"],
    lead: ["A new demand can keep the pressure alive.", "Une nouvelle demande peut entretenir la pression."],
    choices: [["payment", "Another payment", "Un autre paiement"], ["emergency", "A new emergency", "Une nouvelle urgence"], ["threat", "A threat", "Une menace"], ["recovery", "A promise of recovery", "Une promesse de récupération"], ["gone", "They disappeared", "La personne a disparu"], ["noresponse", "I didn’t respond", "Je n’ai pas répondu"]], multi: true,
  },
  {
    key: "mechanism", image: "emotion", eyebrow: ["See the mechanism", "Voir le mécanisme"],
    title: ["Look at what was built around you.", "Regardez ce qu’on a construit autour de vous."],
    lead: ["These techniques are practised and refined. They work because trust, fear, hope and care are human.", "Ces techniques sont pratiquées et raffinées. Elles fonctionnent parce que la confiance, la peur, l’espoir et la bienveillance sont humains."],
    choices: [["see", "I see it", "Je le vois"]],
  },
  {
    key: "pause", image: "ledger", eyebrow: ["The pause", "La pause"],
    title: ["Pause here.", "Faites une pause ici."],
    lead: ["Stop contact. Don’t send money, codes or access.", "Coupez le contact. N’envoyez ni argent, ni code, ni accès."],
    choices: [["bank", "Call my bank safely", "Contacter ma banque de façon sûre"], ["trusted", "Contact someone I trust", "Contacter une personne de confiance"], ["secure", "Secure my accounts", "Sécuriser mes comptes"], ["official", "Find official help", "Trouver de l’aide officielle"], ["safe", "I’m safe to continue", "Je peux continuer en sécurité"]], multi: true,
  },
  {
    key: "next", image: "ledger", eyebrow: ["Your next step", "Votre prochain pas"],
    title: ["What would help now?", "Qu’est-ce qui vous aiderait maintenant?"],
    lead: ["You don’t need to solve everything today.", "Vous n’avez pas à tout résoudre aujourd’hui."],
    choices: [["tell", "Tell someone", "En parler à quelqu’un"], ["bank", "Contact my bank", "Contacter ma banque"], ["secure", "Secure an account", "Sécuriser un compte"], ["report", "Report it", "Le signaler"], ["unsure", "I don’t know yet", "Je ne sais pas encore"]], multi: true,
  },
  {
    key: "journey", image: "ledger", eyebrow: ["Your journey", "Votre parcours"],
    title: ["Here is what you lived.", "Voici ce que vous avez vécu."],
    lead: ["You noticed it. You named it. You interrupted it.", "Vous l’avez remarqué. Vous l’avez nommé. Vous l’avez interrompu."],
    choices: [["continue", "See my path", "Voir mon parcours"]],
  },
  {
    key: "evidence", image: "ledger", eyebrow: ["Sharpen the signal", "Préciser le signal"],
    title: ["Want to make the record more useful?", "Voulez-vous rendre le registre plus utile?"],
    lead: ["Every detail is optional. Never add passwords or complete card numbers.", "Chaque détail est facultatif. N’ajoutez jamais de mot de passe ni de numéro de carte complet."],
    choices: [["details", "Add details", "Ajouter des détails"], ["skip", "Skip this", "Passer cette étape"]],
  },
  {
    key: "ledger", image: "ledger", eyebrow: ["Your private ledger", "Votre registre privé"],
    title: ["Your record is ready.", "Votre registre est prêt."],
    lead: ["Use it to begin a conversation with your bank, an official service or someone you trust.", "Utilisez-le pour commencer une conversation avec votre banque, un service officiel ou une personne de confiance."],
  },
  {
    key: "light", image: "community", eyebrow: ["Carry the light", "Porter la lumière"],
    title: ["Your experience can help someone recognize the path sooner.", "Votre expérience peut aider quelqu’un à reconnaître le chemin plus tôt."],
    lead: ["Choose whether to add anonymous patterns from this journey. Your words and evidence stay private.", "Choisissez si vous souhaitez ajouter des motifs anonymes de ce parcours. Vos mots et vos preuves restent privés."],
    choices: [["share", "Add an anonymous light", "Ajouter une lumière anonyme"], ["private", "Not now", "Pas maintenant"]],
  },
  {
    key: "community", image: "community", eyebrow: ["The communal fire", "Le feu commun"],
    title: ["You are not the only light.", "Votre lumière n’est pas seule."],
    lead: ["Each shared pattern can help another person pause.", "Chaque motif partagé peut aider une autre personne à faire une pause."],
  },
];

