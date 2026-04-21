import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["tsx", "scripts/orchestrator.ts", ...process.argv.slice(2)], {
  cwd: process.cwd(),
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
