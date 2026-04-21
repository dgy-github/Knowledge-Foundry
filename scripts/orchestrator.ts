import { spawn } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

type AgentName = "Planner" | "Architect" | "Frontend" | "Backend" | "QA" | "Reviewer";
type Status = "completed" | "needs_changes" | "blocked";
type Stack = "web-api" | "api-only";
type Result = { summary: string; status: Status; updatedFiles: string[]; nextAction: string };
type StarterConfig = { projectName?: string; stack?: Stack };
type Paths = {
  root: string;
  agentsDir: string;
  starterConfig: string;
  prd: string;
  acceptance: string;
  architecture: string;
  api: string;
  qa: string;
  review: string;
  report: string;
  web: string;
  webEntry: string;
  webPreview: string;
  backend: string;
  backendServer: string;
};
type AgentDefinition = { name: AgentName; promptFile: string; ownedFiles: string[]; reads: string[] };

const schema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    status: { type: "string", enum: ["completed", "needs_changes", "blocked"] },
    updatedFiles: { type: "array", items: { type: "string" } },
    nextAction: { type: "string" },
  },
  required: ["summary", "status", "updatedFiles", "nextAction"],
  additionalProperties: false,
} as const;

const root = process.cwd();
const paths: Paths = {
  root,
  agentsDir: path.join(root, "agents"),
  starterConfig: path.join(root, "starter.config.json"),
  prd: path.join(root, "specs", "product_requirement.md"),
  acceptance: path.join(root, "specs", "acceptance.md"),
  architecture: path.join(root, "specs", "architecture.md"),
  api: path.join(root, "specs", "api-contract.yaml"),
  qa: path.join(root, "specs", "qa-report.md"),
  review: path.join(root, "specs", "review-report.md"),
  report: path.join(root, "specs", "orchestration-report.md"),
  web: path.join(root, "apps", "web", "README.md"),
  webEntry: path.join(root, "apps", "web", "index.html"),
  webPreview: path.join(root, "apps", "web", "preview.mjs"),
  backend: path.join(root, "services", "api", "README.md"),
  backendServer: path.join(root, "services", "api", "server.mjs"),
};

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run") || process.env.CODEX_DRY_RUN === "1";
const maxQaCycles = Number.parseInt(process.env.MAX_QA_CYCLES ?? "2", 10);
const availableCredentials = Boolean(process.env.OPENAI_API_KEY || process.env.CODEX_API_KEY);
const mode = dryRun ? "dry-run" : availableCredentials ? "codex-with-local-fallback" : "local-fallback";

const rel = (file: string) => path.relative(root, file).replace(/\\/g, "/");
const print = (title: string) => console.log(`\n=== ${title} ===`);
const compact = (text: string, max = 220) => {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 3)}...`;
};

function show(agent: AgentName, result: Result) {
  console.log(`[${agent}] status: ${result.status}`);
  console.log(`[${agent}] summary: ${result.summary}`);
  console.log(`[${agent}] updated files: ${result.updatedFiles.join(", ") || "(none)"}`);
  console.log(`[${agent}] next action: ${result.nextAction}`);
}

async function write(file: string, text: string) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text, "utf8");
}

async function read(file: string) {
  try {
    return await readFile(file, "utf8");
  } catch {
    return "";
  }
}

async function exists(file: string) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function loadStarterConfig(): Promise<{ projectName: string; stack: Stack }> {
  try {
    const parsed = JSON.parse(await readFile(paths.starterConfig, "utf8")) as StarterConfig;
    return {
      projectName: parsed.projectName ?? "multi-agent-dev-starter",
      stack: parsed.stack === "api-only" ? "api-only" : "web-api",
    };
  } catch {
    return { projectName: "multi-agent-dev-starter", stack: "web-api" };
  }
}

function activeAgents(stack: Stack): AgentName[] {
  return stack === "api-only"
    ? ["Planner", "Architect", "Backend", "QA", "Reviewer"]
    : ["Planner", "Architect", "Frontend", "Backend", "QA", "Reviewer"];
}

function frontendEnabled(stack: Stack) {
  return stack === "web-api";
}

function createAgentDefinitions(stack: Stack): Record<AgentName, AgentDefinition> {
  return {
    Planner: { name: "Planner", promptFile: path.join(paths.agentsDir, "planner.md"), ownedFiles: [paths.acceptance], reads: [paths.prd, paths.qa] },
    Architect: { name: "Architect", promptFile: path.join(paths.agentsDir, "architect.md"), ownedFiles: [paths.architecture, paths.api], reads: [paths.prd, paths.acceptance, paths.report] },
    Frontend: {
      name: "Frontend",
      promptFile: path.join(paths.agentsDir, "frontend.md"),
      ownedFiles: frontendEnabled(stack) ? [paths.web] : [],
      reads: frontendEnabled(stack) ? [paths.acceptance, paths.architecture, paths.api, paths.webEntry, paths.webPreview] : [],
    },
    Backend: { name: "Backend", promptFile: path.join(paths.agentsDir, "backend.md"), ownedFiles: [paths.backend], reads: [paths.acceptance, paths.architecture, paths.api, paths.backendServer, paths.report] },
    QA: {
      name: "QA",
      promptFile: path.join(paths.agentsDir, "qa.md"),
      ownedFiles: [paths.qa],
      reads: frontendEnabled(stack)
        ? [paths.prd, paths.acceptance, paths.architecture, paths.api, paths.web, paths.webEntry, paths.webPreview, paths.backend, paths.backendServer]
        : [paths.prd, paths.acceptance, paths.architecture, paths.api, paths.backend, paths.backendServer],
    },
    Reviewer: {
      name: "Reviewer",
      promptFile: path.join(paths.agentsDir, "reviewer.md"),
      ownedFiles: [paths.review],
      reads: frontendEnabled(stack)
        ? [paths.prd, paths.acceptance, paths.architecture, paths.api, paths.qa, paths.web, paths.webEntry, paths.webPreview, paths.backend, paths.backendServer, paths.report]
        : [paths.prd, paths.acceptance, paths.architecture, paths.api, paths.qa, paths.backend, paths.backendServer, paths.report],
    },
  };
}

async function loadContext(files: string[]) {
  const chunks: string[] = [];
  for (const file of files) chunks.push(`## ${rel(file)}\n${(await read(file)).trim() || "(empty)"}`);
  return chunks.join("\n\n");
}

async function runCommand(command: string, extraEnv: Record<string, string> = {}) {
  return new Promise<{ command: string; code: number; out: string }>((resolve) => {
    const child = spawn(command, { cwd: root, shell: true, env: { ...process.env, ...extraEnv } });
    let out = "";
    child.stdout?.on("data", (data) => { out += data.toString(); });
    child.stderr?.on("data", (data) => { out += data.toString(); });
    child.on("close", (code) => resolve({ command, code: code ?? 1, out: out.trim() }));
  });
}

function nextAgent(agent: AgentName, qaPassed: boolean, stack: Stack) {
  if (agent === "Planner") return "Architect should refresh the architecture and contract.";
  if (agent === "Architect") return frontendEnabled(stack) ? "Frontend and Backend should refresh their owned workspaces." : "Backend should refresh the API workspace.";
  if (agent === "Frontend") return "Backend should refresh the API workspace.";
  if (agent === "Backend") return "QA should run validation.";
  if (agent === "QA") return qaPassed ? "Reviewer should write the final review." : "Return to Planner with QA feedback for another cycle.";
  return "Write the orchestration report.";
}

async function seedPrd(config: { projectName: string; stack: Stack }) {
  if ((await read(paths.prd)).trim()) return [] as string[];
  const stackScope = config.stack === "web-api"
    ? "- Expose a real `GET /health` endpoint, include the latest orchestration summary, and consume it from the frontend workspace.\n- Provide a local static preview server for the frontend workspace."
    : "- Expose a real `GET /health` endpoint and include the latest orchestration summary.\n- Focus on backend-only delivery for the first milestone.";
  await write(paths.prd, `# Product Requirement

## Overview
Build ${config.projectName} with a minimal runnable multi-agent orchestration loop.

## Goal
Enable one command to run the Planner -> Architect -> ${frontendEnabled(config.stack) ? "Frontend -> " : ""}Backend -> QA -> Reviewer workflow and leave reports behind.

## Scope
- Keep changes minimal.
- Use the Codex SDK when credentials exist.
- Fall back to a local deterministic runner when credentials do not exist.
${stackScope}
- Run \`npm run lint\`, \`npm run typecheck\`, and \`npm run test\` in QA.

## Non-Goals
- Building a production frontend or backend.
- Adding complex state management or parallel scheduling.
`);
  return [rel(paths.prd)];
}

async function localPlanner(cycle: number, qaSummary: string | undefined, config: { projectName: string; stack: Stack }): Promise<Result> {
  const prd = await read(paths.prd);
  const workflow = frontendEnabled(config.stack) ? "Planner -> Architect -> Frontend -> Backend -> QA -> Reviewer" : "Planner -> Architect -> Backend -> QA -> Reviewer";
  const constraints = frontendEnabled(config.stack)
    ? "- Frontend only owns `apps/web`; Backend only owns `services/api`.\n- The repository exposes a real `GET /health` endpoint that includes the latest orchestration summary.\n- The frontend has a local static preview server."
    : "- Backend owns `services/api`.\n- The repository exposes a real `GET /health` endpoint that includes the latest orchestration summary.\n- Frontend is intentionally omitted for this stack.";
  const acceptance = frontendEnabled(config.stack)
    ? "- [x] `services/api/server.mjs` exposes `GET /health`.\n- [x] The health payload includes the latest orchestration result and QA summary.\n- [x] `apps/web/preview.mjs` serves the frontend locally."
    : "- [x] `services/api/server.mjs` exposes `GET /health`.\n- [x] The health payload includes the latest orchestration result and QA summary.\n- [x] The stack can run without any frontend workspace.";
  const tasks = frontendEnabled(config.stack)
    ? "- Frontend: keep the preview server and health dashboard aligned with the health payload.\n- Backend: keep `services/api/server.mjs` aligned with the contract and include orchestration report summary data."
    : "- Backend: keep `services/api/server.mjs` aligned with the contract and include orchestration report summary data.";

  await write(paths.acceptance, `# Acceptance

## Goal
- Make \`npm run orchestrate\` succeed.
- Keep the repository as a minimal runnable skeleton with clear handoffs.

## Constraints
- Preserve ${workflow}.
${constraints}
- QA must run \`npm run lint\`, \`npm run typecheck\`, and \`npm run test\`.
- Automatic repair is capped at ${maxQaCycles} cycle(s).

## Acceptance Criteria
- [x] \`specs/product_requirement.md\` exists and is non-empty.
- [x] Agent prompts are readable UTF-8 documents.
- [x] The orchestrator rewrites specs and implementation notes on each run.
${acceptance}
- [x] QA records command evidence and surfaces failures.
- [x] The run succeeds without credentials through local fallback.

## Task Breakdown
- Planner: refresh acceptance criteria and carry QA feedback forward.
- Architect: refresh architecture summary and API contract.
${tasks}
- QA: execute required commands and write a reproducible report.
- Reviewer: summarize readiness, risks, and residual gaps.

## Cycle
- Current cycle: ${cycle}
- Previous QA summary: ${qaSummary ?? "None"}

## Product Requirement Snapshot
${prd}
`);
  return { summary: cycle === 1 ? "Planner created the execution plan and acceptance criteria." : "Planner refreshed the plan using QA feedback.", status: "completed", updatedFiles: [rel(paths.acceptance)], nextAction: nextAgent("Planner", false, config.stack) };
}

async function localArchitect(config: { stack: Stack }): Promise<Result> {
  const acceptance = compact(await read(paths.acceptance));
  const flow = frontendEnabled(config.stack)
    ? "1. Planner refreshes acceptance and captures QA feedback.\n2. Architect refreshes architecture and API contract from the current plan.\n3. Backend exposes a minimal runtime `GET /health` surface.\n4. Backend enriches `GET /health` with the latest orchestration report summary.\n5. Frontend consumes the runtime surface from a minimal page and local preview server.\n6. QA validates the repository by running the required npm commands.\n7. Reviewer summarizes readiness, findings, and residual risk."
    : "1. Planner refreshes acceptance and captures QA feedback.\n2. Architect refreshes architecture and API contract from the current plan.\n3. Backend exposes a minimal runtime `GET /health` surface.\n4. Backend enriches `GET /health` with the latest orchestration report summary.\n5. QA validates the repository by running the required npm commands.\n6. Reviewer summarizes readiness, findings, and residual risk.";

  await write(paths.architecture, `# Architecture

## Context
- The orchestrator is the product under test.
- Agent prompts in \`agents/\` define responsibilities and ownership.
- Specs in \`specs/\` are the shared handoff surface between roles.
- Stack: ${config.stack}

## Flow
${flow}

## Local Fallback Strategy
- When credentials are unavailable, the orchestrator still reads each agent prompt and shared context.
- The fallback runner writes deterministic artifacts that mirror the expected handoff for each role.
- QA remains the source of truth for pass/fail and gates the review step.

## Current Acceptance Snapshot
- ${acceptance}
`);

  const contract = frontendEnabled(config.stack)
    ? `openapi: 3.1.0
info:
  title: Knowledge Foundry API
  version: 0.1.0
  description: MVP contract for a markdown-first LLM knowledge-base system.
paths:
  /health:
    get:
      summary: Health check
      operationId: getHealth
      responses:
        "200":
          description: Current orchestrator status from the runnable local API
          content:
            application/json:
              schema:
                type: object
                required: [status, mode, qaCycle, report]
                properties:
                  status:
                    type: string
                    enum: [ok]
                  mode:
                    type: string
                    enum: [dry-run, codex-with-local-fallback, local-fallback]
                  qaCycle:
                    type: integer
                    minimum: 1
                  report:
                    type: object
                    required: [result, mode, finalQaCycle, qaSummary]
                    properties:
                      result: { type: string }
                      mode: { type: string }
                      finalQaCycle: { type: integer, minimum: 1 }
                      qaSummary: { type: string }
  /sources:
    get:
      summary: List ingested sources
      operationId: listSources
      responses:
        "200":
          description: Source records
    post:
      summary: Register a new source for ingest
      operationId: createSource
      description: Accepts either inline markdown content or a local file path via \`sourcePath\` to import into \`data/raw\`.
      responses:
        "202":
          description: Ingest accepted
  /sources/{sourceId}:
    get:
      summary: Fetch source detail
      operationId: getSource
      responses:
        "200":
          description: Source detail
  /wiki/pages:
    get:
      summary: List wiki pages
      operationId: listWikiPages
      responses:
        "200":
          description: Wiki page metadata
  /wiki/pages/{pageId}:
    get:
      summary: Fetch wiki page detail
      operationId: getWikiPage
      responses:
        "200":
          description: Wiki page detail
  /outputs:
    get:
      summary: List generated outputs
      operationId: listOutputs
      responses:
        "200":
          description: Output artifacts
  /outputs/{outputId}:
    get:
      summary: Fetch output detail
      operationId: getOutput
      responses:
        "200":
          description: Output detail
  /jobs:
    get:
      summary: List jobs
      operationId: listJobs
      responses:
        "200":
          description: Job records
  /jobs/{jobId}:
    get:
      summary: Fetch job detail
      operationId: getJob
      responses:
        "200":
          description: Job detail
  /jobs/compile:
    post:
      summary: Start a compile job
      operationId: startCompileJob
      responses:
        "202":
          description: Compile job accepted and source-summary/wiki pages generated
  /jobs/query:
    post:
      summary: Ask a question against the knowledge base
      operationId: startQueryJob
      responses:
        "202":
          description: Query job accepted
  /jobs/research:
    post:
      summary: Start a topic research job
      operationId: startResearchJob
      responses:
        "202":
          description: Research job accepted, fetched seed URL metadata, and generated topic starter sources
  /jobs/health-check:
    post:
      summary: Start a knowledge-base health check
      operationId: startHealthCheckJob
      responses:
        "202":
          description: Health check accepted
  /search:
    get:
      summary: Search sources and wiki pages
      operationId: searchKnowledgeBase
      responses:
        "200":
          description: Search results
`
    : `openapi: 3.1.0
info:
  title: Knowledge Foundry API
  version: 0.1.0
  description: MVP contract for a markdown-first LLM knowledge-base system.
paths:
  /health:
    get:
      summary: Health check
      operationId: getHealth
      responses:
        "200":
          description: Current orchestrator status from the runnable local API
          content:
            application/json:
              schema:
                type: object
                required: [status, mode, qaCycle, report]
                properties:
                  status:
                    type: string
                    enum: [ok]
                  mode:
                    type: string
                    enum: [dry-run, codex-with-local-fallback, local-fallback]
                  qaCycle:
                    type: integer
                    minimum: 1
                  report:
                    type: object
                    required: [result, mode, finalQaCycle, qaSummary]
                    properties:
                      result: { type: string }
                      mode: { type: string }
                      finalQaCycle: { type: integer, minimum: 1 }
                      qaSummary: { type: string }
  /sources:
    get:
      summary: List ingested sources
      operationId: listSources
      responses:
        "200":
          description: Source records
    post:
      summary: Register a new source for ingest
      operationId: createSource
      description: Accepts either inline markdown content or a local file path via \`sourcePath\` to import into \`data/raw\`.
      responses:
        "202":
          description: Ingest accepted
  /sources/{sourceId}:
    get:
      summary: Fetch source detail
      operationId: getSource
      responses:
        "200":
          description: Source detail
  /wiki/pages/{pageId}:
    get:
      summary: Fetch wiki page detail
      operationId: getWikiPage
      responses:
        "200":
          description: Wiki page detail
  /outputs:
    get:
      summary: List generated outputs
      operationId: listOutputs
      responses:
        "200":
          description: Output artifacts
  /outputs/{outputId}:
    get:
      summary: Fetch output detail
      operationId: getOutput
      responses:
        "200":
          description: Output detail
  /jobs:
    get:
      summary: List jobs
      operationId: listJobs
      responses:
        "200":
          description: Job records
  /jobs/{jobId}:
    get:
      summary: Fetch job detail
      operationId: getJob
      responses:
        "200":
          description: Job detail
  /jobs/compile:
    post:
      summary: Start a compile job
      operationId: startCompileJob
      responses:
        "202":
          description: Compile job accepted and source-summary/wiki pages generated
  /jobs/query:
    post:
      summary: Ask a question against the knowledge base
      operationId: startQueryJob
      responses:
        "202":
          description: Query job accepted
  /jobs/research:
    post:
      summary: Start a topic research job
      operationId: startResearchJob
      responses:
        "202":
          description: Research job accepted, fetched seed URL metadata, and generated topic starter sources
  /jobs/health-check:
    post:
      summary: Start a knowledge-base health check
      operationId: startHealthCheckJob
      responses:
        "202":
          description: Health check accepted
  /search:
    get:
      summary: Search sources and outputs
      operationId: searchKnowledgeBase
      responses:
        "200":
          description: Search results
`;
  await write(paths.api, contract);
  return { summary: "Architect aligned the architecture note, enriched health surface, and API contract.", status: "completed", updatedFiles: [rel(paths.architecture), rel(paths.api)], nextAction: nextAgent("Architect", false, config.stack) };
}

async function localFrontend(config: { stack: Stack }): Promise<Result> {
  const acceptance = compact(await read(paths.acceptance));
  const architecture = compact(await read(paths.architecture));
  await write(paths.web, `# Frontend Workspace

## Ownership
- Agent: Frontend
- Scope: \`apps/web\`

## Runtime Surface
- \`index.html\` and \`main.js\` render a knowledge workspace dashboard.
- The page calls the local API to list raw sources, wiki pages, outputs, jobs, and search results.
- The page can trigger compile, query, and health-check jobs against the local workspace.
- Acceptance snapshot: ${acceptance}
- Architecture snapshot: ${architecture}

## Local Run
- Start the API with \`npm run api:start\`.
- Start the preview server with \`npm run web:preview\`.
- Open \`http://127.0.0.1:4173\`.

## Delivery
- Keep the frontend minimal but pointed at a real endpoint.
- Use the backend contract fields as the single source of truth for what is displayed.
- Make the MVP useful as a browser and control panel for the markdown knowledge workspace.
`);
  return { summary: "Frontend refreshed its workspace notes around the richer health dashboard.", status: "completed", updatedFiles: [rel(paths.web)], nextAction: nextAgent("Frontend", false, config.stack) };
}

async function localBackend(config: { stack: Stack }): Promise<Result> {
  const acceptance = compact(await read(paths.acceptance));
  const architecture = compact(await read(paths.architecture));
  const surface = frontendEnabled(config.stack)
    ? "- The service also exposes `GET /sources`, `GET /wiki/pages`, `GET /outputs`, `GET /jobs`, and `GET /search`.\n- It supports `POST /jobs/compile`, `POST /jobs/query`, and `POST /jobs/health-check` for the first MVP workflows.\n- The payload matches the contract in `specs/api-contract.yaml`: health, workspace counts, and file-backed knowledge-base job surfaces."
    : "- The service also exposes `GET /sources`, `GET /outputs`, `GET /jobs`, and `GET /search`.\n- It supports `POST /jobs/compile`, `POST /jobs/query`, and `POST /jobs/health-check` for the first MVP workflows.\n- The payload matches the contract in `specs/api-contract.yaml`: health, workspace counts, and file-backed knowledge-base job surfaces.\n- This stack is backend-only and intentionally omits any frontend workspace.";
  await write(paths.backend, `# Backend Workspace

## Ownership
- Agent: Backend
- Scope: \`services/api\`

## Runtime Surface
- \`server.mjs\` exposes a real \`GET /health\` endpoint on \`127.0.0.1:3210\` by default.
${surface}
- Acceptance snapshot: ${acceptance}
- Architecture snapshot: ${architecture}

## Local Run
- Run \`npm run api:start\`.

## Delivery
- Keep the implementation minimal and dependency-free.
- Preserve the contract so QA and downstream consumers can rely on a real endpoint during smoke tests.
- Keep the knowledge workspace file-backed and inspectable on disk.
`);
  return { summary: "Backend refreshed its workspace notes around the enriched health endpoint.", status: "completed", updatedFiles: [rel(paths.backend)], nextAction: nextAgent("Backend", false, config.stack) };
}

async function localQa(cycle: number): Promise<Result> {
  const commands = ["npm run lint", "npm run typecheck", "npm run test"];
  const results = [];
  for (const command of commands) {
    const extraEnv: Record<string, string> = command === "npm run test"
      ? { KNOWLEDGE_FOUNDRY_QA_MODE: "1" }
      : {};
    results.push(await runCommand(command, extraEnv));
  }
  const failed = results.filter((result) => result.code !== 0);
  await write(paths.qa, `# QA Report

## Cycle
- ${cycle}

## Environment
- Working directory: ${root}
- Mode: ${mode}

## Commands
${results.map((result) => `- \`${result.command}\`: exit ${result.code}\n  ${JSON.stringify((result.out || "(no output)").slice(0, 400))}`).join("\n")}

## Conclusion
- ${failed.length === 0 ? "All required commands passed." : `${failed.length} command(s) failed.`}
`);
  return { summary: failed.length === 0 ? `QA passed all commands in cycle ${cycle}.` : `QA found ${failed.length} failing command(s) in cycle ${cycle}.`, status: failed.length === 0 ? "completed" : "needs_changes", updatedFiles: [rel(paths.qa)], nextAction: nextAgent("QA", failed.length === 0, "web-api") };
}

async function localReviewer(cycle: number, qaSummary: string): Promise<Result> {
  const qa = compact(await read(paths.qa));
  await write(paths.review, `# Review Report

## Summary
- The orchestration loop completed in cycle ${cycle}.
- QA summary: ${qaSummary}

## Evidence
- ${qa}

## Findings
- No blocking review findings after the final QA pass.

## Risks
- The current implementation is still a minimal starter, not a production system.
- Real Codex execution depends on credentials and SDK availability.
`);
  return { summary: "Reviewer recorded readiness, evidence, and residual risk.", status: "completed", updatedFiles: [rel(paths.review)], nextAction: nextAgent("Reviewer", true, "web-api") };
}

async function runCodex(agent: AgentName, cycle: number, qaSummary: string | undefined, definitions: Record<AgentName, AgentDefinition>): Promise<Result | null> {
  if (dryRun || !availableCredentials) return null;
  const definition = definitions[agent];
  const prompt = await read(definition.promptFile);
  const context = await loadContext(definition.reads);
  const ownedFiles = definition.ownedFiles.map(rel).join(", ");
  const supplemental = agent === "QA"
    ? "Run npm run lint, npm run typecheck, and npm run test. Report failures instead of fixing them."
    : agent === "Reviewer"
      ? `Use the latest QA summary: ${qaSummary ?? "Unavailable"}.`
      : agent === "Planner"
        ? `Current cycle: ${cycle}. Previous QA summary: ${qaSummary ?? "None"}.`
        : `Current cycle: ${cycle}.`;

  try {
    const { Codex } = await import("@openai/codex-sdk");
    const codex = new Codex({ config: { model_reasoning_summary: "auto" } });
    const thread = codex.startThread({
      workingDirectory: root,
      approvalPolicy: "never",
      sandboxMode: "workspace-write",
      skipGitRepoCheck: true,
      modelReasoningEffort: "medium",
      networkAccessEnabled: false,
      webSearchEnabled: false,
    });
    const turn = await thread.run(`You are ${agent}.

Task: Upgrade the current multi-agent skeleton into a minimal runnable closed loop.
You must follow the role prompt below, update only your owned files, and then return JSON only.

## Role Prompt
${prompt}

## Owned Files
${ownedFiles}

## Shared Context
${context}

## Additional Instructions
${supplemental}
`, { outputSchema: schema });
    return JSON.parse(turn.finalResponse) as Result;
  } catch {
    return null;
  }
}

async function validateRepositoryShape(config: { stack: Stack }, definitions: Record<AgentName, AgentDefinition>) {
  const required = [
    definitions.Planner.promptFile,
    definitions.Architect.promptFile,
    definitions.Backend.promptFile,
    definitions.QA.promptFile,
    definitions.Reviewer.promptFile,
    paths.backendServer,
    paths.starterConfig,
  ];
  if (frontendEnabled(config.stack)) {
    required.push(definitions.Frontend.promptFile, paths.webEntry, paths.webPreview);
  }
  for (const file of required) if (!(await exists(file))) throw new Error(`Missing required file: ${rel(file)}`);
}

async function main() {
  const config = await loadStarterConfig();
  const definitions = createAgentDefinitions(config.stack);
  await validateRepositoryShape(config, definitions);

  print("Config");
  console.log(`working directory: ${root}`);
  console.log(`project: ${config.projectName}`);
  console.log(`stack: ${config.stack}`);
  console.log(`max QA cycles: ${maxQaCycles}`);
  console.log(`mode: ${mode}`);
  const seeded = await seedPrd(config);
  if (seeded.length) console.log(`seeded: ${seeded.join(", ")}`);

  const agents = activeAgents(config.stack);
  let qaResult: Result | null = null;
  let cycle = 1;
  for (; cycle <= maxQaCycles; cycle += 1) {
    for (const agent of agents) {
      if (agent === "QA") {
        print(`QA (cycle ${cycle})`);
        const previousQaSummary: string | undefined = qaResult ? qaResult.summary : undefined;
        qaResult = (await runCodex("QA", cycle, previousQaSummary, definitions)) ?? (await localQa(cycle));
        show("QA", qaResult);
        if (qaResult.status !== "completed" && cycle < maxQaCycles) {
          print("Repair Loop");
          console.log(`QA requested another pass after cycle ${cycle}.`);
        }
        break;
      }

      print(`${agent}${agent === "Reviewer" ? "" : ` (cycle ${cycle})`}`);
      const result = (await runCodex(agent, cycle, qaResult?.summary, definitions))
        ?? (agent === "Planner" ? await localPlanner(cycle, qaResult?.summary, config)
          : agent === "Architect" ? await localArchitect(config)
          : agent === "Frontend" ? await localFrontend(config)
          : agent === "Backend" ? await localBackend(config)
          : await localReviewer(cycle, qaResult?.summary ?? "Unavailable"));
      show(agent, result);
    }
    if (qaResult?.status === "completed") break;
  }

  if (!qaResult || qaResult.status !== "completed") throw new Error(`QA did not pass after ${maxQaCycles} cycle(s).`);

  print("Reviewer");
  const reviewer = (await runCodex("Reviewer", cycle, qaResult.summary, definitions)) ?? (await localReviewer(cycle, qaResult.summary));
  show("Reviewer", reviewer);

  const runtimeAssets = frontendEnabled(config.stack)
    ? `- Frontend page: ${rel(paths.webEntry)}\n- Frontend preview server: ${rel(paths.webPreview)}\n- Backend server: ${rel(paths.backendServer)}`
    : `- Backend server: ${rel(paths.backendServer)}`;
  await write(paths.report, `# Orchestration Report

## Result
- Success

## Mode
- ${mode}

## Final QA Cycle
- ${cycle}

## Agent Inputs
- Planner prompt: ${rel(definitions.Planner.promptFile)}
- Architect prompt: ${rel(definitions.Architect.promptFile)}
${frontendEnabled(config.stack) ? `- Frontend prompt: ${rel(definitions.Frontend.promptFile)}\n` : ""}- Backend prompt: ${rel(definitions.Backend.promptFile)}
- QA prompt: ${rel(definitions.QA.promptFile)}
- Reviewer prompt: ${rel(definitions.Reviewer.promptFile)}

## Runtime Assets
${runtimeAssets}

## QA Summary
- ${qaResult.summary}
`);

  print("Done");
  console.log("Orchestration completed successfully.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
