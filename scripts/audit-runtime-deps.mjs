import { spawnSync } from "node:child_process";

const audit = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["audit", "--omit=dev", "--json"],
  { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }
);

let report;
try {
  report = JSON.parse(audit.stdout || "{}");
} catch (error) {
  console.error("Runtime dependency audit returned invalid JSON.");
  if (audit.stderr) console.error(audit.stderr);
  process.exit(2);
}

const counts = report?.metadata?.vulnerabilities ?? {};
const vulnerabilities = report?.vulnerabilities ?? {};

const affected = Object.entries(vulnerabilities)
  .map(([name, value]) => {
    const item = value && typeof value === "object" ? value : {};
    return {
      name,
      severity: item.severity ?? "unknown",
      direct: item.isDirect === true,
      range: item.range ?? null,
      fix_available: item.fixAvailable ?? null,
      via: Array.isArray(item.via)
        ? item.via.map((entry) =>
            typeof entry === "string"
              ? entry
              : {
                  source: entry?.source ?? null,
                  name: entry?.name ?? null,
                  severity: entry?.severity ?? null,
                  title: entry?.title ?? null,
                  range: entry?.range ?? null,
                }
          )
        : [],
    };
  })
  .sort((a, b) => {
    const rank = { critical: 4, high: 3, moderate: 2, low: 1, unknown: 0 };
    return (rank[b.severity] ?? 0) - (rank[a.severity] ?? 0);
  });

const summary = {
  suite: "runtime-dependency-audit",
  production_only: true,
  counts,
  affected,
};

console.log(JSON.stringify(summary, null, 2));

if ((counts.critical ?? 0) > 0) {
  console.error("Critical production dependency vulnerability detected.");
  process.exit(1);
}
