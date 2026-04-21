import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import path from "node:path";
import test, { after } from "node:test";

import { createServer } from "./server.mjs";

const fixtureFiles = [
  "data/raw/llm-knowledge-bases.md",
  "data/wiki/knowledge-foundry.md",
  "data/outputs/research-brief.md",
];

const fixtureSnapshots = await Promise.all(fixtureFiles.map(async (file) => {
  try {
    return { file, content: await readFile(file, "utf8") };
  } catch {
    return { file, content: null };
  }
}));

after(async () => {
  for (const fixture of fixtureSnapshots) {
    if (fixture.content === null) continue;
    await mkdir(path.dirname(path.join(process.cwd(), fixture.file)), { recursive: true });
    await writeFile(path.join(process.cwd(), fixture.file), fixture.content, "utf8");
  }
});

async function startServer() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return { server, port: address.port };
}

async function stopServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve(undefined);
    });
  });
}

async function startMetadataServer() {
  const server = createHttpServer((request, response) => {
    if (request.url === "/article") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><title>LLM Wiki Article</title><meta name="description" content="An article about knowledge-base workflows." /></head><body><main><article><h1>LLM Wiki Article</h1><h2>Summary</h2><p>Knowledge bases compiled by language models can turn raw markdown, papers, and notes into navigable wiki pages.</p><h2>Findings</h2><p>The workflow usually starts with ingest, continues through parsing and concept extraction, and then synthesizes topic pages with backlinks and evidence.</p><blockquote>Higher quality sources should rank first when a query needs grounding.</blockquote><p>Teams often ask query agents to prioritize better source material so that answers stay grounded in stronger evidence.</p></article></main></body></html>`);
      return;
    }

    if (request.url === "/acme/research-repo") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><title>acme/research-repo</title><meta property="og:description" content="Repository metadata for a research workflow." /></head><body><main><article><h1>README</h1><h2>Overview</h2><p>acme/research-repo is a starter for research ingestion, markdown parsing, concept graph synthesis, and evidence-first query workflows.</p><h2>Usage</h2><p>It contains adapters for web pages and repositories, keeps source manifests beside parsed artifacts, and encourages wiki page generation with reusable quote spans.</p><h2>Architecture</h2><p>The project is designed to make higher quality sources rank above weak or incomplete notes during compile and query.</p></article></main></body></html>`);
      return;
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return { server, port: address.port };
}

async function resetWorkspace(port) {
  const response = await fetch(`http://127.0.0.1:${port}/workspace/clear`, { method: "DELETE" });
  assert.equal(response.status, 200);
}

async function createSource(port, payload) {
  const response = await fetch(`http://127.0.0.1:${port}/sources`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(response.status, 202);
  return response.json();
}

async function compileWorkspace(port) {
  const response = await fetch(`http://127.0.0.1:${port}/jobs/compile`, { method: "POST" });
  assert.equal(response.status, 202);
  return response.json();
}

test("GET /health returns report summary and workspace counts", async () => {
  await writeFile(
    path.join(process.cwd(), "specs", "orchestration-report.md"),
    `# Orchestration Report

## Result
- Success

## Mode
- local-fallback

## Final QA Cycle
- 2

## QA Summary
- QA passed all commands in cycle 2.
`,
    "utf8",
  );

  const { server, port } = await startServer();
  const response = await fetch(`http://127.0.0.1:${port}/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.report.result, "Success");
  assert.equal(typeof body.workspace.rawCount, "number");
  assert.equal(typeof body.workspace.wikiCount, "number");
  assert.equal(typeof body.workspace.outputCount, "number");

  await stopServer(server);
});

test("knowledge endpoints list files and create jobs", async () => {
  const metadata = await startMetadataServer();
  const { server, port } = await startServer();

  try {
    await resetWorkspace(port);
    await createSource(port, {
      title: "Knowledge Foundry Overview",
      sourceType: "markdown",
      content: "# Knowledge Foundry\n\n## Workflow\nKnowledge Foundry compiles raw markdown into wiki pages.\n\n- compile organizes sources\n- query ranks evidence",
      tags: ["knowledge", "workflow"],
    });
    await createSource(port, {
      title: "Source Ranking Memo",
      sourceType: "markdown",
      content: "# Source Ranking\n\nHigher quality sources should rank above weak or incomplete notes during query.",
      tags: ["ranking", "evidence"],
    });

    const sources = await fetch(`http://127.0.0.1:${port}/sources`).then((result) => result.json());
    const compileJob = await compileWorkspace(port);
    const wiki = await fetch(`http://127.0.0.1:${port}/wiki/pages`).then((result) => result.json());
    const queryJob = await fetch(`http://127.0.0.1:${port}/jobs/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "What is Knowledge Foundry?", outputKind: "report" }),
    }).then((result) => result.json());
    const outputs = await fetch(`http://127.0.0.1:${port}/outputs`).then((result) => result.json());
    const researchJob = await fetch(`http://127.0.0.1:${port}/jobs/research`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topic: "LLM Wiki",
        notes: "Compare wiki-style knowledge workflows.",
        seedSources: [
          `http://127.0.0.1:${metadata.port}/article`,
          `http://127.0.0.1:${metadata.port}/acme/research-repo`,
        ],
      }),
    }).then((result) => result.json());
    const search = await fetch(`http://127.0.0.1:${port}/search?q=knowledge`).then((result) => result.json());
    const jobDetail = await fetch(`http://127.0.0.1:${port}/jobs/${queryJob.id}`).then((result) => result.json());
    const wikiDetail = await fetch(`http://127.0.0.1:${port}/wiki/pages/what-is-knowledge-foundry.md`).then((result) => result.json());
    const researchSource = await fetch(`http://127.0.0.1:${port}/sources/${encodeURIComponent(researchJob.createdSourceId)}`).then((result) => result.json());
    const harvestedArticle = await fetch(`http://127.0.0.1:${port}/sources/${encodeURIComponent(researchJob.harvestedSourceIds[0])}`).then((result) => result.json());
    const harvestedRepo = await fetch(`http://127.0.0.1:${port}/sources/${encodeURIComponent(researchJob.harvestedSourceIds[1])}`).then((result) => result.json());
    const harvestedRepoBlocks = await fetch(`http://127.0.0.1:${port}/parsed-blocks/${encodeURIComponent(researchJob.harvestedSourceIds[1])}`).then((result) => result.json());
    const prioritizedQuery = await fetch(`http://127.0.0.1:${port}/jobs/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "How should a research workflow rank sources?", outputKind: "report" }),
    }).then((result) => result.json());
    const prioritizedOutput = await fetch(`http://127.0.0.1:${port}/outputs/how-should-a-research-workflow-rank-sources.md`).then((result) => result.json());

    assert.equal(sources.items.length, 2);
    assert.ok(wiki.items.length >= 2);
    assert.ok(outputs.items.length >= 1);
    assert.equal(compileJob.type, "compile");
    assert.equal(queryJob.type, "query");
    assert.equal(researchJob.type, "research");
    assert.match(researchJob.createdSourcePath, /data\/raw\/llm-wiki-research\.md/);
    assert.ok(Array.isArray(researchJob.harvestedSourceIds));
    assert.equal(researchJob.harvestedSourceIds.length, 2);
    assert.equal(researchJob.harvestedSeeds[0].title, "LLM Wiki Article");
    assert.equal(researchJob.harvestedSeeds[1].kind, "repo");
    assert.equal(researchJob.harvestedSeeds[1].owner, "acme");
    assert.equal(researchJob.harvestedSeeds[1].repo, "research-repo");
    assert.match(researchJob.harvestedSeeds[0].extractedSummary, /Knowledge bases compiled by language models/i);
    assert.match(researchJob.harvestedSeeds[1].readmeSummary, /starter for research ingestion/i);
    assert.equal(typeof researchJob.harvestedSeeds[0].qualityScore, "number");
    assert.equal(typeof researchJob.harvestedSeeds[1].qualityScore, "number");
    assert.ok(researchJob.harvestedSeeds[1].qualityScore >= researchJob.harvestedSeeds[0].qualityScore);
    assert.match(researchSource.content, /LLM Wiki Article/);
    assert.match(researchSource.content, /acme\/research-repo/);
    assert.equal(typeof harvestedArticle.manifest.qualityScore, "number");
    assert.equal(typeof harvestedRepo.manifest.qualityScore, "number");
    assert.match(harvestedRepo.manifest.sourceSummary, /starter for research ingestion/i);
    assert.ok(harvestedRepo.manifest.qualityScore >= harvestedArticle.manifest.qualityScore);
    assert.equal(typeof harvestedRepo.manifest.qualityBreakdown.contentDepth, "number");
    assert.equal(typeof harvestedRepo.manifest.qualityBreakdown.structureQuality, "number");
    assert.ok(Array.isArray(harvestedRepoBlocks.blocks));
    assert.ok(harvestedRepoBlocks.blocks.some((block) => block.kind === "heading"));
    assert.ok(harvestedRepoBlocks.taxonomy.includes("repo.readme"));
    assert.ok(harvestedRepoBlocks.taxonomy.includes("repo.usage"));
    assert.ok(harvestedRepoBlocks.blocks.some((block) => block.taxonomy === "repo.architecture"));
    assert.ok(harvestedRepoBlocks.blocks.some((block) => /research ingestion/i.test(block.text)));
    assert.ok(harvestedRepoBlocks.blocks.some((block) => typeof block.evidenceWeight === "number" && block.evidenceWeight > 0));
    assert.ok(Array.isArray(queryJob.relatedConcepts));
    assert.ok(typeof queryJob.evidenceCount === "number");
    assert.match(queryJob.retrieval.mode, /keyword\+quality/);
    assert.ok(search.items.length >= 1);
    assert.equal(search.total, search.items.length);
    assert.equal(jobDetail.id, queryJob.id);
    assert.match(wikiDetail.content, /Derived From Query/);
    assert.match(wikiDetail.content, /Matched concepts/i);
    assert.ok(prioritizedQuery.evidenceCount >= 1);
    assert.match(prioritizedOutput.content, /## Evidence\s+- ".*" from acme\/research-repo/si);
  } finally {
    await stopServer(server);
    await stopServer(metadata.server);
  }
});

test("POST /sources ingests a new source and exposes source detail", async () => {
  const { server, port } = await startServer();
  await resetWorkspace(port);

  const created = await fetch(`http://127.0.0.1:${port}/sources`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "Agentic Obsidian Notes",
      sourceType: "markdown",
      content: "A new source about agents maintaining a markdown wiki.",
      tags: ["obsidian", "agents"],
    }),
  }).then((result) => result.json());

  const detail = await fetch(`http://127.0.0.1:${port}/sources/${created.id}`).then((result) => result.json());

  assert.equal(created.title, "Agentic Obsidian Notes");
  assert.equal(detail.manifest.sourceType, "markdown");
  assert.match(detail.content, /markdown wiki/i);

  await stopServer(server);
});

test("POST /jobs/chat returns a chat response for a local query", async () => {
  const { server, port } = await startServer();

  try {
    await resetWorkspace(port);
    await createSource(port, {
      title: "Knowledge Foundry Overview",
      sourceType: "markdown",
      content: "# Knowledge Foundry\n\nKnowledge Foundry is a markdown-first LLM knowledge base.\n\n## Workflow\n- compile turns raw sources into wiki pages\n- query answers from compiled evidence",
      tags: ["knowledge", "compile"],
    });
    await compileWorkspace(port);

    const response = await fetch(`http://127.0.0.1:${port}/jobs/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "What is Knowledge Foundry?" }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.intent, "QUERY");
    assert.equal(body.type, "chat");
    assert.match(body.reply, /knowledge foundry|knowledge/i);
  } finally {
    await stopServer(server);
  }
});

test("POST /sources can import a local file and compile creates per-source wiki artifacts", async () => {
  const aliasesPath = path.join(process.cwd(), "data", "indexes", "concept-aliases.json");
  const originalAliases = await readFile(aliasesPath, "utf8");
  const importPath = path.join(process.cwd(), "data", "indexes", "import-sample.md");
  await writeFile(
    importPath,
    `# Imported Source

## Knowledge Synthesis
This file was imported from disk and should become a parsed source summary after compile.

- knowledge synthesis connects raw sources to wiki pages
- markdown parsing extracts reusable concepts

> Quote spans help preserve source evidence.

## Architecture
| Signal | Meaning |
| --- | --- |
| quality score | stronger source ranking |

\`\`\`js
export function rankSources(items) {
  return items.sort((left, right) => right.qualityScore - left.qualityScore);
}
\`\`\`
`,
    "utf8",
  );

  try {
    const customAliases = JSON.parse(originalAliases);
    customAliases.replacements.push({ match: "note taking", replace: "zettel workflow" });
    customAliases.canonicalPhrases.push("zettel workflow");
    await writeFile(aliasesPath, `${JSON.stringify(customAliases, null, 2)}\n`, "utf8");

    const { server, port } = await startServer();
    try {
      await resetWorkspace(port);
      const created = await fetch(`http://127.0.0.1:${port}/sources`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Imported Disk Source",
          sourceType: "markdown",
          sourcePath: "data/indexes/import-sample.md",
          tags: ["knowledge synthesis", "markdown parsing"],
        }),
      }).then((result) => result.json());

      await fetch(`http://127.0.0.1:${port}/sources`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Synthesis Notes",
          sourceType: "markdown",
          content: "Knowledge synthesis does not require markdown parser workflows in every case.\n\n## Evidence\nReusable quote spans make concept pages more stable.",
          tags: ["knowledge synthesis", "note taking"],
        }),
      }).then((result) => result.json());

      const compileJob = await compileWorkspace(port);
      const secondCompileJob = await compileWorkspace(port);
      const sourceDetail = await fetch(`http://127.0.0.1:${port}/sources/${created.id}`).then((result) => result.json());
      const parsedDetail = await fetch(`http://127.0.0.1:${port}/parsed/${created.id}`).then((result) => result.json());
      const parsedBlocksDetail = await fetch(`http://127.0.0.1:${port}/parsed-blocks/${created.id}`).then((result) => result.json());
      const conceptDetail = await fetch(`http://127.0.0.1:${port}/concepts/knowledge-synthesis`).then((result) => result.json());
      const parserConceptDetail = await fetch(`http://127.0.0.1:${port}/concepts/markdown-parse`).then((result) => result.json());
      const customConceptDetail = await fetch(`http://127.0.0.1:${port}/concepts/zettel-workflow`).then((result) => result.json());
      const sourceSummary = await fetch(`http://127.0.0.1:${port}/wiki/pages/source-imported-disk-source.md`).then((result) => result.json());
      const conceptPage = await fetch(`http://127.0.0.1:${port}/wiki/pages/knowledge-synthesis.md`).then((result) => result.json());
      const topicPage = await fetch(`http://127.0.0.1:${port}/wiki/pages/topics/knowledge-synthesis/index.md`).then((result) => result.json());
      const graphQuery = await fetch(`http://127.0.0.1:${port}/jobs/query`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: "How does knowledge synthesis use markdown parsing?", outputKind: "report" }),
      }).then((result) => result.json());
      const queryWiki = await fetch(`http://127.0.0.1:${port}/wiki/pages/how-does-knowledge-synthesis-use-markdown-parsing.md`).then((result) => result.json());

      assert.equal(created.importMode, "file");
      assert.equal(created.originalPath, "data/indexes/import-sample.md");
      assert.equal(compileJob.type, "compile");
      assert.ok(Array.isArray(compileJob.rebuiltSourceIds));
      assert.ok(Array.isArray(secondCompileJob.reusedSourceIds));
      assert.ok(secondCompileJob.reusedSourceIds.includes(created.id));
      assert.ok(Array.isArray(compileJob.parsedPaths));
      assert.ok(Array.isArray(compileJob.parsedBlockPaths));
      assert.ok(compileJob.parsedPaths.some((item) => item.endsWith("imported-disk-source.md.json")));
      assert.ok(compileJob.parsedBlockPaths.some((item) => item.endsWith("imported-disk-source.md.json")));
      assert.ok(Array.isArray(compileJob.generatedPaths));
      assert.ok(compileJob.generatedPaths.some((item) => item.endsWith("source-imported-disk-source.md")));
      assert.equal(sourceDetail.manifest.parsedPath, "data/indexes/parsed/imported-disk-source.md.json");
      assert.equal(sourceDetail.manifest.parsedBlocksPath, "data/indexes/parsed-blocks/imported-disk-source.md.json");
      assert.equal(sourceDetail.manifest.summaryPath, "data/wiki/source-imported-disk-source.md");
      assert.ok(sourceDetail.manifest.conceptSlugs.includes("knowledge-synthesis"));
      assert.ok(sourceDetail.manifest.conceptSlugs.includes("markdown-parse"));
      assert.ok(/^[a-f0-9]{40}$/.test(sourceDetail.manifest.contentHash));
      assert.equal(typeof sourceDetail.manifest.qualityBreakdown.contentDepth, "number");
      assert.equal(sourceDetail.parsed.sections[0].heading, "Knowledge Synthesis");
      assert.ok(Array.isArray(sourceDetail.parsedBlocks.blocks));
      assert.ok(sourceDetail.parsedBlocks.blocks.some((block) => block.kind === "heading"));
      assert.equal(parsedDetail.sourceId, created.id);
      assert.equal(parsedDetail.contentHash, sourceDetail.manifest.contentHash);
      assert.equal(parsedBlocksDetail.sourceId, created.id);
      assert.ok(parsedBlocksDetail.blocks.some((block) => /knowledge synthesis/i.test(block.text)));
      assert.ok(parsedBlocksDetail.taxonomy.includes("article.method"));
      assert.ok(parsedBlocksDetail.blocks.some((block) => block.kind === "quote"));
      assert.ok(parsedBlocksDetail.blocks.some((block) => block.kind === "table"));
      assert.ok(parsedBlocksDetail.blocks.some((block) => block.kind === "code"));
      assert.ok(parsedBlocksDetail.blocks.some((block) => block.evidenceWeight > 20));
      assert.equal(conceptDetail.slug, "knowledge-synthesis");
      assert.equal(parserConceptDetail.slug, "markdown-parse");
      assert.equal(customConceptDetail.slug, "zettel-workflow");
      assert.ok(parserConceptDetail.sourceTitles.includes("Imported Disk Source"));
      assert.ok(parserConceptDetail.sourceTitles.includes("Synthesis Notes"));
      assert.ok(customConceptDetail.sourceTitles.includes("Synthesis Notes"));
      assert.ok(parserConceptDetail.contradictions.length >= 1);
      assert.ok(conceptDetail.evidence.length >= 2);
      assert.ok(typeof conceptDetail.evidence[0].quoteSpan.startLine === "number");
      assert.match(sourceSummary.content, /^---/);
      assert.match(sourceSummary.content, /kind: "source-summary"/);
      assert.match(sourceSummary.content, /Parsed artifact/);
      assert.match(sourceSummary.content, /Content hash/);
      assert.match(sourceSummary.content, /Knowledge Synthesis/);
      assert.match(topicPage.content, /^---/);
      assert.match(topicPage.content, /kind: "topic"/);
      assert.match(conceptPage.content, /aggregated from 2 source\(s\)/);
      assert.match(conceptPage.content, /Source Evidence/);
      assert.match(conceptPage.content, /<article\./);
      assert.match(conceptPage.content, /Contradictions/);
      assert.match(conceptPage.content, /mixed positive and negative claims/i);
      assert.match(conceptPage.content, /lines \d+-\d+/);
      assert.match(conceptPage.content, /\[\[Source Summary: Imported Disk Source\]\]/);
      assert.match(conceptPage.content, /\[\[Source Summary: Synthesis Notes\]\]/);
      assert.ok(graphQuery.relatedConcepts.includes("knowledge-synthesis"));
      assert.ok(graphQuery.evidenceCount >= 1);
      assert.match(queryWiki.content, /knowledge synthesis/i);
      assert.match(queryWiki.content, /Evidence/);
    } finally {
      await stopServer(server);
    }
  } finally {
    await writeFile(aliasesPath, originalAliases, "utf8");
  }
});
