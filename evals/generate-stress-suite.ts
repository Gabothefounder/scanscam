import fs from "node:fs";
import path from "node:path";
import { generateStressCases } from "./stressSuite";

const target=Math.max(100,Number(process.env.EVAL_SIZE||1000));
const rows=generateStressCases(target);
const dir=path.resolve("evals/cases");
fs.mkdirSync(dir,{recursive:true});
const out=path.join(dir,`stress-${target}.jsonl`);
fs.writeFileSync(out,rows.map((x)=>JSON.stringify(x)).join("\n")+"\n");
console.log(`Wrote ${rows.length} eval cases to ${out}`);
