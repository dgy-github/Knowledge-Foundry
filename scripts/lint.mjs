import { spawnSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";

const aliasesCheck = spawnSync("node", ["scripts/aliases-check.mjs"], {
  cwd: process.cwd(),
  encoding: "utf8",
  shell: true,
});

if (aliasesCheck.status !== 0) {
  throw new Error(aliasesCheck.stderr || aliasesCheck.stdout || "concept alias check failed");
}

const normalizerCheck = spawnSync("node", ["scripts/normalizer-check.mjs"], {
  cwd: process.cwd(),
  encoding: "utf8",
  shell: true,
});

if (normalizerCheck.status !== 0) {
  throw new Error(normalizerCheck.stderr || normalizerCheck.stdout || "source normalizer check failed");
}

const config = JSON.parse(await readFile("starter.config.json", "utf8"));
const stack = config.stack === "api-only" ? "api-only" : "web-api";

const required = [
  "README.md",
  "starter.config.json",
  "agents/planner.md",
  "agents/architect.md",
  "agents/backend.md",
  "agents/qa.md",
  "agents/reviewer.md",
  "scripts/orchestrator.ts",
  "scripts/orchestrate.ps1",
  "specs/product_requirement.md",
  "specs/acceptance.md",
  "specs/architecture.md",
  "specs/api-contract.yaml",
  "services/api/server.mjs",
  "data/indexes/source-normalizer.json",
  "data/indexes/source-normalizer.schema.md",
  "data/raw/llm-knowledge-bases.md",
  "data/wiki/knowledge-foundry.md",
  "data/outputs/research-brief.md",
];

if (stack === "web-api") {
  required.push(
    "agents/frontend.md",
    "apps/web/index.html",
    "apps/web/main.js",
    "apps/web/preview.mjs",
    "apps/web/lib/api.js",
    "apps/web/lib/preview.js",
    "apps/web/lib/logs.js",
    "apps/web/features/views.js",
    "apps/web/features/dashboard.js",
    "apps/web/features/graph.js",
    "apps/web/features/chat.js",
    "services/api/workspace.mjs",
    "services/api/core/store.mjs",
    "services/api/core/source-analysis.mjs",
    "services/api/core/knowledge-graph.mjs",
  );
}

for (const file of required) {
  await stat(file);
}

const syntaxChecked = [
  "services/api/server.mjs",
  "services/api/workspace.mjs",
  "services/api/core/config.mjs",
  "services/api/core/utils.mjs",
  "services/api/core/store.mjs",
  "services/api/core/source-analysis.mjs",
  "services/api/core/knowledge-graph.mjs",
];

if (stack === "web-api") {
  syntaxChecked.push(
    "apps/web/main.js",
    "apps/web/preview.mjs",
    "apps/web/lib/api.js",
    "apps/web/lib/preview.js",
    "apps/web/lib/logs.js",
    "apps/web/features/views.js",
    "apps/web/features/dashboard.js",
    "apps/web/features/graph.js",
    "apps/web/features/chat.js",
  );
}

for (const file of syntaxChecked) {
  const result = spawnSync("node", ["--check", file], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: true,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Syntax check failed for ${file}`);
  }
}

for (const file of ["README.md", ...required.filter((file) => file.startsWith("agents/"))]) {
  const content = await readFile(file, "utf8");
  if (content.includes("\uFFFD")) {
    throw new Error(`Possible encoding issue detected in ${file}`);
  }
}

const pkg = JSON.parse(await readFile("package.json", "utf8"));
const scripts = ["api:start", "orchestrate", "aliases:check", "lint", "typecheck", "test"];
if (stack === "web-api") {
  scripts.splice(2, 0, "web:preview");
}
for (const script of scripts) {
  if (!pkg.scripts?.[script]) {
    throw new Error(`Missing script: ${script}`);
  }
}

if (stack === "web-api") {
  const frontend = (await Promise.all([
    "apps/web/main.js",
    "apps/web/lib/api.js",
    "apps/web/lib/preview.js",
    "apps/web/features/views.js",
    "apps/web/features/dashboard.js",
    "apps/web/features/chat.js",
  ].map((file) => readFile(file, "utf8")))).join("\n");
  if (!frontend.includes("/sources") || (!frontend.includes("/jobs/query") && !frontend.includes("/jobs/chat"))) {
    throw new Error("Frontend is not wired to the knowledge-base API");
  }
  if (!frontend.includes("/sources/") || !frontend.includes("/wiki/pages/") || !frontend.includes("/jobs/")) {
    throw new Error("Frontend detail view logic is missing");
  }
}

console.log(aliasesCheck.stdout.trim());
console.log(normalizerCheck.stdout.trim());
console.log(`lint ok: ${required.length} files checked for stack ${stack}`);
