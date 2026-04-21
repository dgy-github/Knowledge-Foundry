import path from "node:path";
import { readdir, readFile, stat, writeFile, unlink } from "node:fs/promises";

import { ensureWorkspace, workspace } from "./config.mjs";
import { createFallbackManifest } from "./source-analysis.mjs";
import { relative, titleFromFile } from "./utils.mjs";

function resolveKnowledgeBase(kind) {
  return kind === "source" ? workspace.raw : kind === "wiki" ? workspace.wiki : workspace.outputs;
}

export async function listFiles(directory, recursive = false) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isFile()) files.push(target);
    if (recursive && entry.isDirectory()) files.push(...await listFiles(target, true));
  }
  return files;
}

export async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

export async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function fileExists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

export async function readMarkdownRecord(file, kind) {
  const info = await stat(file);
  const content = await readFile(file, "utf8");
  return {
    id: path.basename(file),
    title: titleFromFile(file),
    kind,
    path: relative(file),
    size: info.size,
    excerpt: content.split(/\r?\n/).slice(0, 6).join(" ").slice(0, 280),
    content,
    updatedAt: info.mtime.toISOString(),
  };
}

export async function writeSourceManifest(id, manifest) {
  await writeJson(path.join(workspace.sources, `${id}.json`), manifest);
}

export async function readSourceManifest(id) {
  try {
    return await readJson(path.join(workspace.sources, `${id}.json`));
  } catch {
    return null;
  }
}

export async function getSourceManifest(id) {
  await ensureWorkspace();
  const existing = await readSourceManifest(id);
  if (existing) return existing;

  const source = await getKnowledgeFile("source", id);
  const fallback = createFallbackManifest(source);
  await writeSourceManifest(id, fallback);
  return fallback;
}

export async function findSourceManifestByPath(relativePath) {
  const files = await listFiles(workspace.sources);
  for (const file of files) {
    const manifest = await readJson(file);
    if (manifest.path === relativePath) return manifest;
  }
  return null;
}

async function loadJsonArtifact(directory, id) {
  try {
    return await readJson(path.join(directory, `${id}.json`));
  } catch {
    return null;
  }
}

export async function loadParsedArtifact(id) {
  return loadJsonArtifact(workspace.parsed, id);
}

export async function loadParsedBlocksArtifact(id) {
  return loadJsonArtifact(workspace.parsedBlocks, id);
}

export async function loadConceptArtifact(id) {
  return loadJsonArtifact(workspace.concepts, id);
}

async function listJsonRecords(directory) {
  const files = await listFiles(directory);
  const items = [];
  for (const file of files) {
    items.push(await readJson(file));
  }
  return items;
}

export async function listParsedArtifacts() {
  await ensureWorkspace();
  const items = await listJsonRecords(workspace.parsed);
  return items.sort((left, right) => left.displayTitle.localeCompare(right.displayTitle));
}

export async function listConceptArtifacts() {
  await ensureWorkspace();
  const items = await listJsonRecords(workspace.concepts);
  return items.sort((left, right) => left.label.localeCompare(right.label));
}

export async function listKnowledgeFiles(kind) {
  await ensureWorkspace();
  const base = resolveKnowledgeBase(kind);
  const files = await listFiles(base, kind === "wiki");
  const items = [];
  for (const file of files) {
    items.push(await readMarkdownRecord(file, kind));
  }
  return items
    .map(({ content, ...item }) => item)
    .sort((left, right) => left.title.localeCompare(right.title));
}

export async function getKnowledgeFile(kind, id) {
  await ensureWorkspace();
  return readMarkdownRecord(path.join(resolveKnowledgeBase(kind), id), kind);
}

export async function listJobs() {
  await ensureWorkspace();
  const files = await listFiles(workspace.jobs);
  const jobs = [];
  for (const file of files) {
    jobs.push(await readJson(file));
  }
  return jobs.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getJob(jobId) {
  await ensureWorkspace();
  return readJson(path.join(workspace.jobs, `${jobId}.json`));
}

export async function deleteSource(id) {
  await ensureWorkspace();
  await unlink(path.join(workspace.raw, id)).catch(() => {});
  await unlink(path.join(workspace.sources, `${id}.json`)).catch(() => {});
  await unlink(path.join(workspace.parsed, `${id}.json`)).catch(() => {});
  await unlink(path.join(workspace.parsedBlocks, `${id}.json`)).catch(() => {});
}

export async function clearWorkspace() {
  await ensureWorkspace();
  const dirs = [workspace.raw, workspace.sources, workspace.parsed, workspace.parsedBlocks, workspace.wiki, workspace.outputs, workspace.jobs, workspace.concepts, workspace.health];
  for (const dir of dirs) {
    const files = await listFiles(dir);
    for (const file of files) await unlink(file).catch(() => {});
  }
  await unlink(workspace.nanobotAudit).catch(() => {});
}
