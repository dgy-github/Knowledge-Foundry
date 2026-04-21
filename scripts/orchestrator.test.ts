import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("dry-run orchestrator exits successfully and writes reports", async () => {
  const config = JSON.parse(await readFile("starter.config.json", "utf8"));
  const stack = config.stack === "api-only" ? "api-only" : "web-api";

  const result = spawnSync("npx", ["tsx", "scripts/orchestrator.ts", "--dry-run"], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: true,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Orchestration completed successfully/);

  const acceptance = await readFile("specs/acceptance.md", "utf8");
  const report = await readFile("specs/orchestration-report.md", "utf8");
  const backend = await readFile("services/api/README.md", "utf8");
  const apiServer = await readFile("services/api/server.mjs", "utf8");
  const apiContract = await readFile("specs/api-contract.yaml", "utf8");
  const sampleRaw = await readFile("data/raw/llm-knowledge-bases.md", "utf8");

  assert.match(acceptance, /Acceptance Criteria/);
  assert.match(report, /QA Summary/);
  assert.match(backend, /GET \/sources/);
  assert.match(apiServer, /\/jobs\/query/);
  assert.match(apiContract, /\/jobs\/query/);
  assert.match(apiContract, /sourcePath/);
  assert.match(sampleRaw, /knowledge base/i);

  if (stack === "web-api") {
    const frontend = await readFile("apps/web/README.md", "utf8");
    const frontendPage = await readFile("apps/web/main.js", "utf8");
    assert.match(frontend, /dashboard/);
    assert.match(frontendPage, /loadDashboard/);
    assert.match(report, /Frontend preview server/);
  } else {
    assert.doesNotMatch(report, /Frontend preview server/);
  }
});
