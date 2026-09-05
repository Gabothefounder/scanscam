import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { buildScanEnrichment } from "../lib/scan-analysis";
import { EVAL_EXTRACTION_INSTRUCTIONS } from "./prompt";
import type { EvalCase, EvalOutput, EvalScore, ModelExtraction } from "./schema";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODELS = (process.env.EVAL_MODELS || "gpt-4o-mini,gpt-5.6-luna")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

const CONCURRENCY = Math.max(1, Math.min(30, Number(process.env.EVAL_CONCURRENCY || 8)));
const LIMIT = Math.max(1, Number(process.env.EVAL_LIMIT || 1000));
const INPUT = process.env.EVAL_INPUT || "evals/cases/stress-1000.jsonl";

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    context_sufficiency: { type: "string", enum: ["enough", "insufficient"] },
    language: { type: "string", enum: ["en", "fr", "mixed", "unknown"] },
    claimed_identity_type: {
      type: "string",
      enum: ["government","financial_institution","courier","employer","law_enforcement","platform","person","other","unknown"]
    },
    scam_family: {
      type: "string",
      enum: ["delivery_scam","government_impersonation","law_enforcement","account_verification","employment_scam","recovery_scam","reward_claim","social_engineering_opener","investment_fraud","romance_scam","financial_phishing","tech_support","unknown"]
    },
    requested_actions: {
      type: "array",
      items: { type: "string", enum: ["click_link","call_number","submit_credentials","pay_money","reply","download_app","remote_access","move_channel","none","unknown"] }
    },
    requested_assets: {
      type: "array",
      items: { type: "string", enum: ["money","password","otp_or_mfa_code","bank_login","card_data","identity_data","crypto","gift_card","remote_device_access","conversation_engagement","unknown"] }
    },
    tactics: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: {
            type: "string",
            enum: ["urgency","authority","fear","threat","false_trust","helpfulness","secrecy","isolation","scarcity","reward","verification_suppression","channel_migration","credential_request","financial_pressure"]
          },
          confidence: { type: "number", minimum: 0, maximum: 1 }
        },
        required: ["type","confidence"]
      }
    },
    attack_stage: {
      type: "string",
      enum: ["initial_contact","lure","trust_building","authority_establishment","pressure_escalation","credential_capture","payment_extraction","isolation","repeat_extraction","recovery","unclear"]
    },
    confidence: { type: "number", minimum: 0, maximum: 1 }
  },
  required: [
    "context_sufficiency","language","claimed_identity_type","scam_family",
    "requested_actions","requested_assets","tactics","attack_stage","confidence"
  ]
} as const;

function readCases(filePath: string): EvalCase[] {
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as EvalCase)
    .slice(0, LIMIT);
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a,b) => a-b);
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[i];
}

function toComparableRisk(rules: Record<string, unknown>): string {
  const route = String(rules.submissionRoute || "");
  if (route === "insufficient_context") return "insufficient_context";
  return String(rules.riskTier || "unknown");
}

function score(engine: string, cases: EvalCase[], outputs: EvalOutput[]): EvalScore {
  const byId = new Map(outputs.filter((o) => o.engine === engine).map((o) => [o.case_id, o]));
  let riskN=0, riskHit=0, familyN=0, familyHit=0, actionN=0, actionHit=0;
  let frN=0, frHit=0, enN=0, enHit=0;
  const latencies:number[]=[]; const inputs:number[]=[]; const outputsTok:number[]=[];
  let errors=0;

  for (const c of cases) {
    const o=byId.get(c.id);
    if (!o) continue;
    latencies.push(o.latency_ms);
    if (typeof o.input_tokens === "number") inputs.push(o.input_tokens);
    if (typeof o.output_tokens === "number") outputsTok.push(o.output_tokens);
    if (o.error) { errors += 1; continue; }

    if (c.expected.risk) {
      riskN += 1;
      if (o.rules && toComparableRisk(o.rules) === c.expected.risk) riskHit += 1;
    }
    if (c.expected.family) {
      familyN += 1;
      const family = o.extraction?.scam_family ?? String(o.rules?.narrativeFamily || "unknown");
      if (family === c.expected.family) familyHit += 1;
      if (c.language === "fr") { frN += 1; if (family === c.expected.family) frHit += 1; }
      if (c.language === "en") { enN += 1; if (family === c.expected.family) enHit += 1; }
    }
    if (c.expected.requested_action) {
      actionN += 1;
      const actions = o.extraction?.requested_actions ?? [String(o.rules?.requestedAction || "unknown")];
      if (actions.includes(c.expected.requested_action as never)) actionHit += 1;
    }
  }

  const avg=(v:number[])=>v.length ? v.reduce((a,b)=>a+b,0)/v.length : 0;
  return {
    engine,
    cases: cases.length,
    errors,
    risk_accuracy: riskN ? riskHit/riskN : undefined,
    family_accuracy: familyN ? familyHit/familyN : undefined,
    action_accuracy: actionN ? actionHit/actionN : undefined,
    french_family_accuracy: frN ? frHit/frN : undefined,
    english_family_accuracy: enN ? enHit/enN : undefined,
    avg_latency_ms: Math.round(avg(latencies)),
    p50_latency_ms: percentile(latencies,.5),
    p90_latency_ms: percentile(latencies,.9),
    avg_input_tokens: inputs.length ? Math.round(avg(inputs)) : undefined,
    avg_output_tokens: outputsTok.length ? Math.round(avg(outputsTok)) : undefined,
  };
}

async function runModel(model: string, c: EvalCase): Promise<EvalOutput> {
  const started=performance.now();
  try {
    const params: Parameters<typeof client.responses.create>[0] = {
      model,
      instructions: EVAL_EXTRACTION_INSTRUCTIONS,
      input: c.text,
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "scanscam_semantic_extraction",
          strict: true,
          schema: EXTRACTION_SCHEMA,
        },
        verbosity: "low",
      },
      max_output_tokens: 700,
    };
    if (model.startsWith("gpt-5.6") || model.startsWith("gpt-5.5") || model.startsWith("gpt-5.4") || model.startsWith("gpt-5")) {
      (params as any).reasoning = { effort: "none" };
    }
    const response: any = await client.responses.create({ ...params, stream: false });
    const extraction = JSON.parse(response.output_text) as ModelExtraction;
    return {
      case_id:c.id, engine:model,
      latency_ms:Math.round(performance.now()-started),
      input_tokens:response.usage?.input_tokens,
      output_tokens:response.usage?.output_tokens,
      extraction,
    };
  } catch (error) {
    return {
      case_id:c.id, engine:model,
      latency_ms:Math.round(performance.now()-started),
      error:error instanceof Error ? error.message.slice(0,500) : String(error).slice(0,500),
    };
  }
}

async function pool<T,R>(items:T[], fn:(item:T)=>Promise<R>, concurrency:number):Promise<R[]> {
  const results:R[] = new Array(items.length);
  let next=0;
  async function worker() {
    while (true) {
      const i=next++;
      if (i>=items.length) return;
      results[i]=await fn(items[i]);
    }
  }
  await Promise.all(Array.from({length:Math.min(concurrency,items.length)},()=>worker()));
  return results;
}

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for model evals");
  const cases=readCases(INPUT);
  const all:EvalOutput[]=[];

  for (const c of cases) {
    const started=performance.now();
    const r=buildScanEnrichment({ messageText:c.text, language:c.language, source:"user_text" });
    all.push({
      case_id:c.id,
      engine:"rules-current",
      latency_ms:Math.round(performance.now()-started),
      rules:r as unknown as Record<string,unknown>,
    });
  }

  for (const model of MODELS) {
    const modelOutputs=await pool(cases,(c)=>runModel(model,c),CONCURRENCY);
    all.push(...modelOutputs);
  }

  const stamp=new Date().toISOString().replace(/[:.]/g,"-");
  const dir=path.resolve("evals/results");
  fs.mkdirSync(dir,{recursive:true});
  const resultPath=path.join(dir,`${stamp}.jsonl`);
  fs.writeFileSync(resultPath,all.map((x)=>JSON.stringify(x)).join("\n")+"\n");

  const engines=["rules-current",...MODELS];
  const scores=engines.map((engine)=>score(engine,cases,all));
  const scorePath=path.join(dir,`${stamp}.summary.json`);
  fs.writeFileSync(scorePath,JSON.stringify({input:INPUT,cases:cases.length,scores},null,2)+"\n");
  console.table(scores);
  console.log("\nResults:",resultPath);
  console.log("Summary:",scorePath);
}
main().catch((error)=>{ console.error(error); process.exitCode=1; });
