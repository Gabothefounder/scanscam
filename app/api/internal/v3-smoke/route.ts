export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { analyzeScanStructured } from "@/lib/ai/structuredAnalyzeScan";

const CASES = [
  { id: "thin-en", language: "en" as const, text: "send me moola" },
  { id: "thin-fr", language: "fr" as const, text: "envoie-moi du cash" },
  { id: "benign-en", language: "en" as const, text: "Urgent: the client moved the meeting to 2pm. Please call me when you see this." },
  { id: "benign-fr", language: "fr" as const, text: "Urgent : le client a déplacé la réunion à 14 h. Appelle-moi quand tu vois ce message." },
  { id: "gov-en", language: "en" as const, text: "ServiceOntario: unpaid parking violation. Your plate renewal will be blocked. Pay today at https://bit.ly/pay-tkt" },
  { id: "gov-fr", language: "fr" as const, text: "ServiceOntario : contravention de stationnement impayée. Le renouvellement de votre plaque sera bloqué. Payez aujourd'hui au https://bit.ly/pay-tkt" },
  { id: "bank-en", language: "en" as const, text: "Security alert: your bank account will be suspended in 30 minutes. Sign in now and enter the one-time code: https://secure-account.example" },
  { id: "bank-fr", language: "fr" as const, text: "Alerte sécurité : votre compte bancaire sera suspendu dans 30 minutes. Ouvrez une session maintenant et entrez le code à usage unique : https://secure-account.example" },
];

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return new NextResponse(null, { status: 404 });
  }

  const rows = [];
  for (const c of CASES) {
    const started = Date.now();
    try {
      const out = await analyzeScanStructured({
        messageText: c.text,
        language: c.language,
        source: "user_text",
      });
      rows.push({
        id: c.id,
        model: out.model,
        latency_ms: Date.now() - started,
        risk_tier: out.result.risk_tier,
        language_detected: out.result.language_detected,
        semantic: out.result.semantic
          ? {
              context_sufficiency: out.result.semantic.context_sufficiency,
              scam_family: out.result.semantic.scam_family,
              requested_actions: out.result.semantic.requested_actions,
              requested_assets: out.result.semantic.requested_assets,
              tactics: out.result.semantic.tactics.map((t) => ({ type: t.type, confidence: t.confidence })),
              attack_stage: out.result.semantic.attack_stage,
              confidence: out.result.semantic.confidence,
            }
          : null,
        input_tokens: out.input_tokens ?? null,
        output_tokens: out.output_tokens ?? null,
      });
    } catch (error) {
      rows.push({
        id: c.id,
        error: error instanceof Error ? error.message.slice(0, 300) : "unknown",
        latency_ms: Date.now() - started,
      });
    }
  }

  return NextResponse.json({ ok: true, cases: rows });
}
