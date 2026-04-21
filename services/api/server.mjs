import { readFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import path from "node:path";
import { Router, HttpError, parseJsonBody, sendJson, toHttpError } from "./router.mjs";
import { getNanobotStatus, startNanobot } from "./daemon.mjs";

import {
  createJob,
  ensureWorkspace,
  getConceptStrategyConfig,
  getConceptArtifact,
  getJob,
  getKnowledgeFile,
  getVectorSearchConfig,
  getOutputDetail,
  getParsedArtifact,
  getParsedBlocksArtifact,
  getSourceDetail,
  getWorkspacePaths,
  getWikiDetail,
  handleAgentChat,
  ingestSource,
  listJobs,
  listConceptArtifacts,
  listKnowledgeFiles,
  searchWorkspace,
  systemEvents,
  deleteSource,
  clearWorkspace
} from "./workspace.mjs";

const defaultPort = 3210;
const reportPath = path.join(process.cwd(), "specs", "orchestration-report.md");

function readSection(markdown, heading) {
  const match = markdown.match(new RegExp(`## ${heading}\\s+([\\s\\S]*?)(?=\\n## |$)`));
  return match?.[1]?.trim() ?? "";
}

function firstBullet(section) {
  const match = section.match(/^- (.+)$/m);
  return match?.[1]?.trim() ?? "";
}

async function readReportSummary() {
  try {
    const markdown = await readFile(reportPath, "utf8");
    return {
      result: firstBullet(readSection(markdown, "Result")) || "Unknown",
      mode: firstBullet(readSection(markdown, "Mode")) || "Unknown",
      finalQaCycle: Number.parseInt(firstBullet(readSection(markdown, "Final QA Cycle")) || "1", 10),
      qaSummary: firstBullet(readSection(markdown, "QA Summary")) || "Unavailable",
    };
  } catch {
    return {
      result: "Unavailable",
      mode: process.env.CODEX_RUNTIME_MODE ?? "local-fallback",
      finalQaCycle: Number.parseInt(process.env.QA_CYCLE ?? "1", 10),
      qaSummary: "Orchestration report not found yet.",
    };
  }
}

async function buildHealthPayload() {
  const report = await readReportSummary();
  const [sources, wikiPages, outputs, jobs, concepts] = await Promise.all([
    listKnowledgeFiles("source"),
    listKnowledgeFiles("wiki"),
    listKnowledgeFiles("output"),
    listJobs(),
    listConceptArtifacts(),
  ]);
  const conceptStrategy = getConceptStrategyConfig();
  const vectorSearch = getVectorSearchConfig();
  const maintenance = getNanobotStatus();
  const counts = {
    rawSourceCount: sources.length,
    wikiPageCount: wikiPages.length,
    conceptCount: concepts.length,
    outputCount: outputs.length,
    jobCount: jobs.length,
  };

  return {
    status: "ok",
    mode: report.mode,
    qaCycle: report.finalQaCycle,
    report,
    retrieval: {
      conceptStrategy: conceptStrategy.strategy,
      llmAvailable: conceptStrategy.llmAvailable,
      vectorSearchEnabled: vectorSearch.enabled,
      vectorRerankCandidates: vectorSearch.rerankCandidates,
    },
    maintenance,
    workspace: {
      rawCount: counts.rawSourceCount,
      wikiCount: counts.wikiPageCount,
      conceptCount: counts.conceptCount,
      outputCount: counts.outputCount,
      jobCount: counts.jobCount,
      counts,
      paths: getWorkspacePaths(),
    },
  };
}

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `${fieldName} is required.`);
  }
  return value.trim();
}

function isAsyncIterable(value) {
  return value && typeof value[Symbol.asyncIterator] === "function";
}

async function streamJsonEvents(response, iterable) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  try {
    for await (const event of iterable) {
      response.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    response.write("data: [DONE]\n\n");
  } catch (error) {
    response.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n\n`);
  } finally {
    response.end();
  }
}

function validateCreateSourceRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Request body must be a JSON object.");
  return {
    ...body,
    title: requireNonEmptyString(body.title, "title"),
    sourceType: requireNonEmptyString(body.sourceType, "sourceType"),
  };
}

function validateQueryJobRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Request body must be a JSON object.");
  const question = requireNonEmptyString(body.question, "question");
  const outputKind = body.outputKind ?? "report";
  if (!["report", "slides"].includes(outputKind)) throw new HttpError(400, "outputKind must be one of: report, slides.");
  return { ...body, question, outputKind };
}

const router = new Router();

router.get("/health", async (req, res) => sendJson(res, 200, await buildHealthPayload()));
router.get("/events", async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });
  const listener = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  systemEvents.on('sys-log', listener);
  req.on('close', () => systemEvents.off('sys-log', listener));
});

router.get("/sources", async (req, res) => sendJson(res, 200, { items: await listKnowledgeFiles("source") }));
router.get("/sources/:id", async (req, res) => sendJson(res, 200, await getSourceDetail(req.params.id)));
router.post("/sources", async (req, res) => {
  const body = validateCreateSourceRequest(await parseJsonBody(req));
  sendJson(res, 202, await ingestSource(body));
});

router.get("/parsed/:id", async (req, res) => sendJson(res, 200, await getParsedArtifact(req.params.id)));
router.get("/parsed-blocks/:id", async (req, res) => sendJson(res, 200, await getParsedBlocksArtifact(req.params.id)));
router.get("/concepts/:id", async (req, res) => sendJson(res, 200, await getConceptArtifact(req.params.id)));

router.get("/concepts", async (req, res) => {
  const { buildKnowledgeGraph } = await import('./workspace.mjs');
  sendJson(res, 200, { items: await buildKnowledgeGraph() || [] });
});

router.get("/wiki/pages", async (req, res) => sendJson(res, 200, { items: await listKnowledgeFiles("wiki") }));
router.get("/wiki/pages/:id", async (req, res) => sendJson(res, 200, await getWikiDetail(req.params.id)));

router.get("/outputs", async (req, res) => sendJson(res, 200, { items: await listKnowledgeFiles("output") }));
router.get("/outputs/:id", async (req, res) => sendJson(res, 200, await getOutputDetail(req.params.id)));

router.delete("/sources/:id", async (req, res) => {
  await deleteSource(req.params.id);
  sendJson(res, 200, { success: true });
});

router.delete("/workspace/clear", async (req, res) => {
  await clearWorkspace();
  sendJson(res, 200, { success: true });
});

router.get("/sys/events", (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const onLog = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  systemEvents.on('sys-log', onLog);
  req.on('close', () => {
    systemEvents.off('sys-log', onLog);
  });
});

router.get("/jobs", async (req, res) => sendJson(res, 200, { items: await listJobs() }));
router.get("/jobs/:id", async (req, res) => {
  if (['compile', 'query', 'health-check', 'research', 'brainstorm', 'reconcile'].includes(req.params.id)) return; // not handled here
  sendJson(res, 200, await getJob(req.params.id));
});

router.get("/search", async (req, res) => {
  const query = req.query.get("q") ?? "";
  const items = query ? await searchWorkspace(query) : [];
  sendJson(res, 200, { query, total: items.length, items });
});

router.post("/jobs/chat", async (req, res) => {
  const body = await parseJsonBody(req);
  const text = requireNonEmptyString(body.text, "text");
  const command = typeof body.command === "string" && body.command.trim() ? body.command.trim() : null;
  const result = await handleAgentChat(text, command);
  if (isAsyncIterable(result)) {
    await streamJsonEvents(res, result);
    return;
  }
  sendJson(res, 200, result);
});

router.post("/jobs/compile", async (req, res) => sendJson(res, 202, await createJob("compile")));
router.post("/jobs/health-check", async (req, res) => sendJson(res, 202, await createJob("health-check")));
router.post("/jobs/query", async (req, res) => sendJson(res, 202, await createJob("query", validateQueryJobRequest(await parseJsonBody(req)))));
router.post("/jobs/research", async (req, res) => sendJson(res, 202, await createJob("research", await parseJsonBody(req))));
router.post("/jobs/brainstorm", async (req, res) => sendJson(res, 202, await createJob("brainstorm")));
router.post("/jobs/reconcile", async (req, res) => sendJson(res, 202, await createJob("reconcile")));

export function createServer() {
  return createHttpServer(async (request, response) => {
    await ensureWorkspace();
    try {
      const handled = await router.handle(request, response);
      if (!handled && !response.writableEnded) {
        sendJson(response, 404, { error: "Not Found" });
      }
    } catch (error) {
      const httpError = toHttpError(error);
      sendJson(response, httpError.statusCode, { error: httpError.message });
    }
  });
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href) {
  const port = Number.parseInt(process.env.PORT ?? `${defaultPort}`, 10);
  const server = createServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`knowledge api listening on http://127.0.0.1:${port}`);
    startNanobot();
  });
}
