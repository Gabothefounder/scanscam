import { spawn } from "node:child_process";

const forwarded = process.argv.slice(2).flatMap((argument) => {
  if (argument === "--host") return ["--hostname"];
  if (argument === "--strictPort") return [];
  return [argument];
});

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", ...forwarded], {
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code) => process.exit(code ?? 0));
