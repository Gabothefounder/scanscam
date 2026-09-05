"use client";

import { useState } from "react";
import { logScanEvent } from "@/lib/telemetry/logScanEvent";

type RecoveryType = "clicked" | "password" | "code" | "paid" | "remote";

const copy = {
  en: {
    title: "Already acted?",
    body: "Clicked, paid, shared a code, or gave someone access?",
    choose: "What happened?",
    back: "Choose something else",
    options: {
      clicked: "I clicked a link",
      password: "I entered a password",
      code: "I shared a verification code",
      paid: "I paid or sent money",
      remote: "I installed something / gave access",
    },
    steps: {
      clicked: [
        "Close the page. Don’t enter anything else.",
        "If you downloaded or installed something, use the access option below.",
        "If you entered a password or code, choose that option too.",
      ],
      password: [
        "Change that password from the official app or website.",
        "If you reused it elsewhere, change those passwords too.",
        "Turn on multi-factor authentication and review recent account activity.",
      ],
      code: [
        "Contact the account provider through its official app, site, or phone number.",
        "Tell them a verification code may have been exposed.",
        "Review recent sign-ins, transactions, and recovery details.",
      ],
      paid: [
        "Contact your bank or payment provider immediately using an official number.",
        "Ask whether the payment can be stopped, recalled, or disputed.",
        "Preserve receipts, messages, phone numbers, and transaction details.",
      ],
      remote: [
        "Disconnect the device from the internet if someone still has access.",
        "Remove the remote-access software and run a trusted security scan.",
        "From another trusted device, change important passwords and contact your bank if financial accounts were exposed.",
      ],
    },
  },
  fr: {
    title: "Vous avez déjà agi?",
    body: "Cliqué, payé, partagé un code ou donné accès à quelqu’un?",
    choose: "Qu’est-ce qui s’est passé?",
    back: "Choisir autre chose",
    options: {
      clicked: "J’ai cliqué sur un lien",
      password: "J’ai entré un mot de passe",
      code: "J’ai partagé un code de vérification",
      paid: "J’ai payé ou envoyé de l’argent",
      remote: "J’ai installé quelque chose / donné accès",
    },
    steps: {
      clicked: [
        "Fermez la page et n’entrez rien d’autre.",
        "Si vous avez téléchargé ou installé quelque chose, choisissez aussi l’option d’accès.",
        "Si vous avez entré un mot de passe ou un code, choisissez cette option.",
      ],
      password: [
        "Changez ce mot de passe dans l’application ou le site officiel.",
        "S’il est réutilisé ailleurs, changez-le aussi sur ces comptes.",
        "Activez l’authentification multifacteur et vérifiez l’activité récente.",
      ],
      code: [
        "Contactez le fournisseur du compte par son application, son site ou son numéro officiel.",
        "Indiquez qu’un code de vérification a pu être compromis.",
        "Vérifiez les connexions, transactions et options de récupération récentes.",
      ],
      paid: [
        "Contactez immédiatement votre banque ou fournisseur de paiement avec un numéro officiel.",
        "Demandez si le paiement peut être bloqué, rappelé ou contesté.",
        "Conservez reçus, messages, numéros de téléphone et détails de transaction.",
      ],
      remote: [
        "Déconnectez l’appareil d’Internet si quelqu’un y a encore accès.",
        "Retirez le logiciel d’accès à distance et lancez une analyse de sécurité fiable.",
        "Depuis un autre appareil fiable, changez vos mots de passe importants et contactez votre banque si des comptes financiers ont été exposés.",
      ],
    },
  },
};

export function PostScanRecoveryGate({
  lang,
  scanId,
  riskTier,
}: {
  lang: "en" | "fr";
  scanId?: string;
  riskTier?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<RecoveryType | null>(null);
  const t = copy[lang];

  const select = (value: RecoveryType) => {
    setSelected(value);
    logScanEvent("post_scan_action_selected", {
      scan_id: scanId,
      props: {
        surface: "result_recovery",
        intent: "recovery",
        action: value,
        risk_tier: riskTier,
        lang,
      },
    });
  };

  return (
    <section style={styles.wrap}>
      {!open ? (
        <button
          type="button"
          style={styles.trigger}
          onClick={() => {
            setOpen(true);
            logScanEvent("post_scan_action_selected", {
              scan_id: scanId,
              props: { surface: "result", intent: "recovery", action: "opened", risk_tier: riskTier, lang },
            });
          }}
        >
          <strong>{t.title}</strong>
          <span>{t.body}</span>
        </button>
      ) : (
        <div style={styles.panel}>
          <strong style={styles.heading}>{selected ? t.options[selected] : t.choose}</strong>
          {!selected ? (
            <div style={styles.grid}>
              {(Object.keys(t.options) as RecoveryType[]).map((key) => (
                <button key={key} type="button" style={styles.option} onClick={() => select(key)}>
                  {t.options[key]}
                </button>
              ))}
            </div>
          ) : (
            <>
              <ol style={styles.steps}>
                {t.steps[selected].map((step, i) => <li key={i}>{step}</li>)}
              </ol>
              <button type="button" style={styles.back} onClick={() => setSelected(null)}>
                {t.back}
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { width: "100%" },
  trigger: {
    width: "100%",
    padding: "14px 16px",
    border: "1px solid #D6C8BE",
    borderRadius: 12,
    background: "#FFFDFC",
    color: "#2B3035",
    textAlign: "left",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 3,
    fontFamily: "inherit",
  },
  panel: {
    padding: 16,
    border: "1px solid #D6C8BE",
    borderRadius: 12,
    background: "#FFFDFC",
  },
  heading: { display: "block", marginBottom: 12, color: "#27272A", fontSize: 15 },
  grid: { display: "grid", gridTemplateColumns: "1fr", gap: 8 },
  option: {
    width: "100%",
    border: "1px solid #D4D4D8",
    borderRadius: 10,
    background: "#FFFFFF",
    color: "#27272A",
    padding: "11px 12px",
    textAlign: "left",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 14,
  },
  steps: {
    margin: "0 0 12px",
    paddingLeft: 21,
    color: "#3F3F46",
    fontSize: 14,
    lineHeight: 1.55,
  },
  back: {
    border: 0,
    background: "transparent",
    padding: 0,
    color: "#5B6470",
    textDecoration: "underline",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 13,
  },
};
