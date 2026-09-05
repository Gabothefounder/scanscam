export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import goldCases from "@/evals/cases/gold-v1.json";
import { generateStressCases } from "@/evals/stressSuite";
import type { EvalCase } from "@/evals/schema";
import { analyzeScanStructured } from "@/lib/ai/structuredAnalyzeScan";
import { buildScanEnrichment } from "@/lib/scan-analysis";

type CaseResult = {
  id: string;
  language: "en" | "fr";
  expected: { risk?: string; family?: string; requested_action?: string };
  rules: {
    risk: string;
    family: string;
    action: string;
    latency_ms: number;
  };
  model?: {
    name: string;
    risk: string;
    family: string;
    actions: string[];
    latency_ms: number;
    input_tokens: number | null;
    output_tokens: number | null;
    error?: string;
  };
};

function rulesResult(c: EvalCase) {
  const started=Date.now();
  const out=buildScanEnrichment({messageText:c.text,language:c.language,source:"user_text"});
  return {
    risk: out.submissionRoute==="insufficient_context" ? "insufficient_context" : out.riskTier,
    family: out.narrativeFamily || "unknown",
    action: out.requestedAction || "unknown",
    latency_ms: Date.now()-started,
  };
}

async function modelResult(c: EvalCase, model: string) {
  const started=Date.now();
  try {
    const out=await analyzeScanStructured({
      messageText:c.text,
      language:c.language,
      source:"user_text",
      modelOverride:model,
    });
    return {
      name:model,
      risk: out.result.semantic?.context_sufficiency==="insufficient"
        ? "insufficient_context"
        : out.result.risk_tier,
      family: out.result.semantic?.scam_family || "unknown",
      actions: out.result.semantic?.requested_actions || [],
      latency_ms: Date.now()-started,
      input_tokens: out.input_tokens ?? null,
      output_tokens: out.output_tokens ?? null,
    };
  } catch(error) {
    return {
      name:model,
      risk:"error",
      family:"error",
      actions:[],
      latency_ms:Date.now()-started,
      input_tokens:null,
      output_tokens:null,
      error:error instanceof Error ? error.message.slice(0,240) : "unknown",
    };
  }
}

async function pool<T,R>(items:T[], concurrency:number, fn:(item:T)=>Promise<R>):Promise<R[]>{
  const results:R[]=new Array(items.length);
  let next=0;
  async function worker(){
    while(true){
      const i=next++;
      if(i>=items.length) return;
      results[i]=await fn(items[i]);
    }
  }
  await Promise.all(Array.from({length:Math.min(concurrency,items.length)},()=>worker()));
  return results;
}

function pct(hit:number,total:number){ return total ? Math.round((hit/total)*10000)/100 : null; }

function aggregate(rows:CaseResult[]) {
  const agg:any={
    cases:rows.length,
    rules:{risk_hit:0,family_hit:0,action_hit:0,risk_n:0,family_n:0,action_n:0},
    model:{risk_hit:0,family_hit:0,action_hit:0,risk_n:0,family_n:0,action_n:0,errors:0,latencies:[],input_tokens:0,output_tokens:0,token_rows:0},
    languages:{en:{n:0,model_family_hit:0,model_family_n:0},fr:{n:0,model_family_hit:0,model_family_n:0}},
    failures:[],
  };
  for(const row of rows){
    const e=row.expected;
    const lang=agg.languages[row.language];
    lang.n++;
    if(e.risk){ agg.rules.risk_n++; if(row.rules.risk===e.risk) agg.rules.risk_hit++; }
    if(e.family){ agg.rules.family_n++; if(row.rules.family===e.family) agg.rules.family_hit++; }
    if(e.requested_action){ agg.rules.action_n++; if(row.rules.action===e.requested_action) agg.rules.action_hit++; }

    if(row.model){
      const m=row.model;
      if(m.error) agg.model.errors++;
      if(e.risk){ agg.model.risk_n++; if(m.risk===e.risk) agg.model.risk_hit++; }
      if(e.family){
        agg.model.family_n++; lang.model_family_n++;
        if(m.family===e.family){ agg.model.family_hit++; lang.model_family_hit++; }
      }
      if(e.requested_action){ agg.model.action_n++; if(m.actions.includes(e.requested_action)) agg.model.action_hit++; }
      agg.model.latencies.push(m.latency_ms);
      if(m.input_tokens!==null && m.output_tokens!==null){
        agg.model.input_tokens+=m.input_tokens; agg.model.output_tokens+=m.output_tokens; agg.model.token_rows++;
      }
      const failed =
        (e.risk && m.risk!==e.risk) ||
        (e.family && m.family!==e.family) ||
        (e.requested_action && !m.actions.includes(e.requested_action)) ||
        Boolean(m.error);
      if(failed && agg.failures.length<12){
        agg.failures.push({
          id:row.id,language:row.language,expected:e,
          model:{risk:m.risk,family:m.family,actions:m.actions,error:m.error||null},
          rules:row.rules
        });
      }
    }
  }
  const lat=[...agg.model.latencies].sort((a:number,b:number)=>a-b);
  const q=(p:number)=>lat.length ? lat[Math.min(lat.length-1,Math.ceil(lat.length*p)-1)] : null;
  return {
    cases:agg.cases,
    rules:{
      risk_accuracy:pct(agg.rules.risk_hit,agg.rules.risk_n),
      family_accuracy:pct(agg.rules.family_hit,agg.rules.family_n),
      action_accuracy:pct(agg.rules.action_hit,agg.rules.action_n),
    },
    model:{
      risk_accuracy:pct(agg.model.risk_hit,agg.model.risk_n),
      family_accuracy:pct(agg.model.family_hit,agg.model.family_n),
      action_accuracy:pct(agg.model.action_hit,agg.model.action_n),
      errors:agg.model.errors,
      p50_latency_ms:q(.5),
      p90_latency_ms:q(.9),
      avg_input_tokens:agg.model.token_rows ? Math.round(agg.model.input_tokens/agg.model.token_rows) : null,
      avg_output_tokens:agg.model.token_rows ? Math.round(agg.model.output_tokens/agg.model.token_rows) : null,
    },
    language:{
      en_family_accuracy:pct(agg.languages.en.model_family_hit,agg.languages.en.model_family_n),
      fr_family_accuracy:pct(agg.languages.fr.model_family_hit,agg.languages.fr.model_family_n),
      en_cases:agg.languages.en.n,
      fr_cases:agg.languages.fr.n,
    },
    failures:agg.failures,
  };
}

export async function GET(req:Request){
  if(process.env.VERCEL_ENV!=="preview") return new NextResponse(null,{status:404});
  const url=new URL(req.url);
  const suite=url.searchParams.get("suite")==="gold" ? "gold" : "stress";
  const model=url.searchParams.get("model") || "gpt-5.6-luna";
  if(!["gpt-5.6-luna","gpt-4o-mini"].includes(model)){
    return NextResponse.json({ok:false,error:"unsupported_model"},{status:400});
  }
  const all=(suite==="gold" ? (goldCases as EvalCase[]) : generateStressCases(1000));
  const start=Math.max(0,Number(url.searchParams.get("start")||0));
  const limit=Math.max(1,Math.min(100,Number(url.searchParams.get("limit")||50)));
  const cases=all.slice(start,start+limit);

  const rows=await pool(cases,10,async(c)=>{
    const rules=rulesResult(c);
    const modelOut=await modelResult(c,model);
    return {id:c.id,language:c.language,expected:c.expected,rules,model:modelOut} as CaseResult;
  });

  return NextResponse.json({
    ok:true,
    suite,
    model,
    start,
    limit:cases.length,
    total:all.length,
    summary:aggregate(rows),
  });
}
