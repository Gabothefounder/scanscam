export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
);

const filters: Record<string, { column: string; value: string; label: [string, string] }> = {
  "arrival:text": { column: "channel", value: "sms", label: ["checks involved a text message", "analyses concernaient un texto"] },
  "arrival:call": { column: "channel", value: "phone", label: ["checks involved a phone call", "analyses concernaient un appel"] },
  "arrival:email": { column: "channel", value: "email", label: ["checks involved an email", "analyses concernaient un courriel"] },
  "arrival:online": { column: "channel", value: "web", label: ["checks began on the web", "analyses ont commencé sur le Web"] },
  "identity:bank": { column: "authority_type", value: "financial_institution", label: ["checks involved someone claiming to represent a financial institution", "analyses concernaient une personne prétendant représenter une institution financière"] },
  "identity:authority": { column: "authority_type", value: "government", label: ["checks involved claimed government authority", "analyses concernaient une autorité gouvernementale prétendue"] },
  "identity:company": { column: "authority_type", value: "corporate", label: ["checks involved someone claiming to represent a company", "analyses concernaient une personne prétendant représenter une entreprise"] },
  "pressure:now": { column: "tactic_tags", value: "urgency", label: ["checks contained urgency", "analyses contenaient un signal d’urgence"] },
  "pressure:loss": { column: "tactic_tags", value: "financial", label: ["checks used financial pressure", "analyses utilisaient une pression financière"] },
  "emotion:fear": { column: "emotion_vectors", value: "fear", label: ["classified checks explicitly showed fear pressure", "analyses classées montraient explicitement une pression par la peur"] },
  "emotion:hope": { column: "emotion_vectors", value: "excitement", label: ["checks used excitement or opportunity", "analyses utilisaient l’enthousiasme ou une occasion"] },
  "request:money": { column: "primary_request", value: "pay_money", label: ["checks asked for payment", "analyses demandaient un paiement"] },
  "request:code": { column: "primary_request", value: "submit_credentials", label: ["checks asked for credentials", "analyses demandaient des identifiants"] },
  "request:device": { column: "primary_request", value: "download_app", label: ["checks asked the person to download software", "analyses demandaient de télécharger un logiciel"] },
};

export async function GET(req: NextRequest) {
  const scene = req.nextUrl.searchParams.get("scene") || "";
  const choice = req.nextUrl.searchParams.get("choice") || "";
  const lang = req.nextUrl.searchParams.get("lang") === "fr" ? "fr" : "en";
  const filter = filters[`${scene}:${choice}`];
  if (!filter) return NextResponse.json({ ok: true, context: null });

  let query = supabase.from("atlas_scan_signals").select("id", { count: "exact", head: true });
  query = ["tactic_tags", "emotion_vectors"].includes(filter.column)
    ? query.contains(filter.column, [filter.value])
    : query.eq(filter.column, filter.value);
  const { count, error } = await query;
  if (error || count == null || count < 5) return NextResponse.json({ ok: true, context: null });

  const label = filter.label[lang === "fr" ? 1 : 0];
  return NextResponse.json({
    ok: true,
    context: lang === "fr" ? `${count.toLocaleString("fr-CA")} ${label}.` : `${count.toLocaleString("en-CA")} ${label}.`,
    count,
  });
}

