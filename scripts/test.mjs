import { spawnSync } from "node:child_process";

const testTargets = process.env.KNOWLEDGE_FOUNDRY_QA_MODE === "1"
  ? ["services/api/server.test.mjs"]
  : ["scripts/orchestrator.test.ts", "services/api/server.test.mjs"];

const result = spawnSync("node", ["--import", "tsx", "--test", ...testTargets], {
  cwd: process.cwd(),
  encoding: "utf8",
  shell: true,
});

if (result.status !== 0) {
  throw new Error(result.stderr || result.stdout || "test suite failed");
}

process.stdout.write(result.stdout);
