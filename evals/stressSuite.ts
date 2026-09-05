import type { EvalCase, EvalRisk } from "./schema";

type Template = {
  id: string;
  language: "en" | "fr";
  family: string;
  action?: string;
  risk: EvalRisk;
  tags: string[];
  texts: string[];
};

const templates: Template[] = [
  { id:"gov-pay-en", language:"en", family:"government_impersonation", action:"pay_money", risk:"high", tags:["government","payment","authority"], texts:[
    "ServiceOntario: an unpaid parking violation is attached to your plate. Pay the outstanding fine today at {link}.",
    "Final notice: your vehicle permit renewal is blocked because of an unpaid ticket. Settle the balance at {link}.",
    "CRA notice: an outstanding balance requires immediate payment to avoid additional penalties. Visit {link}."
  ]},
  { id:"gov-pay-fr", language:"fr", family:"government_impersonation", action:"pay_money", risk:"high", tags:["government","payment","authority","fr"], texts:[
    "Avis ServiceOntario : une contravention de stationnement est impayée. Réglez l'amende aujourd'hui au {link}.",
    "Dernier avis : le renouvellement de votre permis est bloqué à cause d'un billet impayé. Payez au {link}.",
    "ARC : un solde impayé doit être réglé immédiatement pour éviter des pénalités. Visitez {link}."
  ]},
  { id:"delivery-en", language:"en", family:"delivery_scam", action:"click_link", risk:"medium", tags:["delivery","link"], texts:[
    "Canada Post: we could not deliver your parcel. Confirm your address at {link}.",
    "Your package is being held. Update delivery information here: {link}.",
    "A small redelivery fee is required before your parcel can be released: {link}."
  ]},
  { id:"delivery-fr", language:"fr", family:"delivery_scam", action:"click_link", risk:"medium", tags:["delivery","link","fr"], texts:[
    "Postes Canada : nous n'avons pas pu livrer votre colis. Confirmez votre adresse au {link}.",
    "Votre colis est retenu. Mettez à jour les informations de livraison ici : {link}.",
    "De petits frais de relivraison sont requis avant la remise du colis : {link}."
  ]},
  { id:"account-en", language:"en", family:"account_verification", action:"submit_credentials", risk:"high", tags:["account","credentials","urgency"], texts:[
    "Security alert: your bank account will be suspended unless you verify your login now at {link}.",
    "Unusual activity detected. Sign in and enter the verification code to restore access: {link}.",
    "Your account is locked. Confirm your password and one-time code at {link}."
  ]},
  { id:"account-fr", language:"fr", family:"account_verification", action:"submit_credentials", risk:"high", tags:["account","credentials","urgency","fr"], texts:[
    "Alerte de sécurité : votre compte bancaire sera suspendu si vous ne vérifiez pas votre connexion maintenant au {link}.",
    "Activité inhabituelle détectée. Ouvrez une session et entrez le code de vérification : {link}.",
    "Votre compte est verrouillé. Confirmez votre mot de passe et votre code à usage unique au {link}."
  ]},
  { id:"recovery-en", language:"en", family:"recovery_scam", action:"pay_money", risk:"high", tags:["recovery","crypto","payment"], texts:[
    "We recovered the crypto you lost last year. A processing fee of {amount} releases the funds.",
    "Our recovery department located your stolen investment. Send {amount} to begin the claim.",
    "Your lost bitcoin can be recovered. Contact our recovery agent and pay the activation fee."
  ]},
  { id:"wrong-number-en", language:"en", family:"social_engineering_opener", action:"reply", risk:"medium", tags:["opener","engagement"], texts:[
    "Hey, did you get my last message?",
    "Sorry, is this Anna? I found this number in my contacts.",
    "Are you still working downtown? It's been a long time."
  ]},
  { id:"wrong-number-fr", language:"fr", family:"social_engineering_opener", action:"reply", risk:"medium", tags:["opener","engagement","fr"], texts:[
    "Salut, as-tu reçu mon dernier message?",
    "Désolé, est-ce Marie? J'avais ce numéro dans mes contacts.",
    "Tu travailles toujours au centre-ville? Ça fait longtemps."
  ]},
  { id:"benign-en", language:"en", family:"unknown", risk:"low", tags:["benign"], texts:[
    "See you at 3pm for coffee.",
    "Can you send me the revised agenda before tomorrow's meeting?",
    "Dinner is ready. Call me when you're outside.",
    "I sent the invoice we discussed yesterday. No rush, review it when you can."
  ]},
  { id:"benign-fr", language:"fr", family:"unknown", risk:"low", tags:["benign","fr"], texts:[
    "On se voit à 15 h pour un café.",
    "Peux-tu m'envoyer l'ordre du jour révisé avant la réunion de demain?",
    "Le souper est prêt. Appelle-moi quand tu arrives.",
    "Je t'ai envoyé la facture dont on a parlé hier. Pas urgent, regarde-la quand tu peux."
  ]},
  { id:"thin-en", language:"en", family:"unknown", risk:"insufficient_context", tags:["thin","insufficient"], texts:[
    "send me moola","call me","payment?","check this","urgent"
  ]},
  { id:"thin-fr", language:"fr", family:"unknown", risk:"insufficient_context", tags:["thin","insufficient","fr"], texts:[
    "envoie-moi l'argent","appelle-moi","paiement?","regarde ça","urgent"
  ]},
];

const links=["https://bit.ly/X7k2","https://secure-check.example/login","https://tinyurl.com/claim-now"];
const amounts=["$49","$183.72","250 $","$500"];
const prefixes=["","IMPORTANT: ","Notice: ","Reminder: ","⚠️ "];
const suffixes=[""," Reply STOP to unsubscribe."," Thank you."," Do not delay.",""];

function variant(text:string,i:number) {
  let value=text.replaceAll("{link}",links[i%links.length]).replaceAll("{amount}",amounts[i%amounts.length]);
  value=prefixes[(i*3)%prefixes.length]+value+suffixes[(i*7)%suffixes.length];
  if (i%5===0) value=value.replace(/\s+/g,"  ");
  if (i%7===0) value=value.replace(/[.!]$/,"");
  if (i%11===0) value=value.toUpperCase();
  return value;
}

export function generateStressCases(target=1000): EvalCase[] {
  const rows: EvalCase[]=[];
  let i=0;
  while(rows.length<target){
    const t=templates[i%templates.length];
    const text=t.texts[Math.floor(i/templates.length)%t.texts.length];
    rows.push({
      id:"stress-"+String(rows.length+1).padStart(4,"0"),
      source:"stress",
      language:t.language,
      text:variant(text,i),
      tags:[...t.tags,t.id],
      expected:{
        risk:t.risk,
        family:t.family,
        ...(t.action ? { requested_action:t.action } : {}),
      }
    });
    i+=1;
  }
  return rows;
}
