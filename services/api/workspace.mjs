export { systemEvents } from "./core/config.mjs";
export * from "./core/config.mjs";
export * from "./core/store.mjs";
export * from "./core/knowledge-graph.mjs";

export * from "./core/ingestion.mjs";
export * from "./core/jobs.mjs";
export * from "./core/agent.mjs";

// Specific facade accessors originally from workspace-runtime
import { loadParsedArtifact, loadParsedBlocksArtifact, loadConceptArtifact, getKnowledgeFile, getSourceManifest } from "./core/store.mjs";

export async function getParsedArtifact(id) {
  const parsed = await loadParsedArtifact(id);
  if (!parsed) throw new Error(`Parsed artifact not found for ${id}`);
  return parsed;
}

export async function getParsedBlocksArtifact(id) {
  const parsedBlocks = await loadParsedBlocksArtifact(id);
  if (!parsedBlocks) throw new Error(`Parsed blocks artifact not found for ${id}`);
  return parsedBlocks;
}

export async function getConceptArtifact(id) {
  const concept = await loadConceptArtifact(id);
  if (!concept) throw new Error(`Concept artifact not found for ${id}`);
  return concept;
}

export async function getOutputDetail(id) {
  return getKnowledgeFile("output", id);
}

export async function getSourceDetail(id) {
  const [source, manifest, parsed, parsedBlocks] = await Promise.all([
    getKnowledgeFile("source", id),
    getSourceManifest(id),
    loadParsedArtifact(id),
    loadParsedBlocksArtifact(id),
  ]);
  return {
    ...source,
    manifest,
    parsed,
    parsedBlocks,
  };
}

export async function getWikiDetail(id) {
  return getKnowledgeFile("wiki", id);
}
