import path from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { EventEmitter } from "node:events";

export const systemEvents = new EventEmitter();

let pipeline;
let cos_sim;
export const getExtractor = async () => {
  if (!pipeline) {
     const transformers = await import('@xenova/transformers');
     pipeline = transformers.pipeline;
     cos_sim = transformers.cos_sim;
  }
  let p = global.__m3e_pipeline;
  if (!p) {
    systemEvents.emit('sys-log', { kind: 'w', msg: "预热本地 Xenova/bge-small 嵌入引擎..." });
    p = await pipeline('feature-extraction', 'Xenova/bge-small-zh-v1.5', { quantized: true });
    global.__m3e_pipeline = p;
    systemEvents.emit('sys-log', { kind: 'i', msg: "M3E 引擎预热完毕" });
  }
  return { p, cos_sim };
};

const root = process.cwd();
export const workspace = {
  data: path.join(root, "data"),
  raw: path.join(root, "data", "raw"),
  wiki: path.join(root, "data", "wiki"),
  outputs: path.join(root, "data", "outputs"),
  topicWiki: path.join(root, "data", "wiki", "topics"),
  indexes: path.join(root, "data", "indexes"),
  jobs: path.join(root, "data", "indexes", "jobs"),
  health: path.join(root, "data", "indexes", "health"),
  parsed: path.join(root, "data", "indexes", "parsed"),
  parsedBlocks: path.join(root, "data", "indexes", "parsed-blocks"),
  concepts: path.join(root, "data", "indexes", "concepts"),
  sources: path.join(root, "data", "indexes", "sources"),
  nanobotAudit: path.join(root, "data", "indexes", "nanobot-audit.jsonl"),
  conceptAliases: path.join(root, "data", "indexes", "concept-aliases.json"),
  sourceNormalizer: path.join(root, "data", "indexes", "source-normalizer.json"),
};

export const stopwords = new Set([
  "a", "an", "and", "are", "as", "at", "be", "becomes", "by", "for", "from", "in", "into", "is", "it",
  "its", "of", "on", "or", "that", "the", "their", "them", "this", "to", "while", "with", "yet", "your",
  "notes", "source", "sources", "page", "pages", "wiki", "raw", "file", "files", "data", "using", "used",
  "然后", "之后", "这个", "那个", "一下", "建议", "判断", "因为", "所以", "如果", "但是", "作为", "一批", ".md", ".json"
]);

const defaultConceptAliasConfig = {
  replacements: [
    { match: "parsing", replace: "parser" },
    { match: "parsers", replace: "parser" },
    { match: "summaries", replace: "summary" },
    { match: "pages", replace: "page" },
    { match: "quotes", replace: "quote" },
    { match: "evidences", replace: "evidence" },
    { match: "workflows", replace: "workflow" },
    { match: "knowledge base", replace: "knowledge-base" },
    { match: "markdown parser", replace: "markdown parse" },
    { match: "markdown parsing", replace: "markdown parse" },
  ],
  canonicalPhrases: [
    "knowledge-base",
    "knowledge synthesis",
    "markdown parse",
    "quote span",
    "source summary",
  ],
};

const defaultSourceNormalizerConfig = {
  sourceFamilies: {
    repo: {
      detect: ["repo", "repository", "research-note"],
      taxonomyRules: [
        { taxonomy: "repo.readme", patterns: ["readme"] },
        { taxonomy: "repo.overview", patterns: ["overview", "about", "intro"] },
        { taxonomy: "repo.installation", patterns: ["install", "setup"] },
        { taxonomy: "repo.usage", patterns: ["usage", "quickstart", "run", "cli"] },
        { taxonomy: "repo.architecture", patterns: ["architecture", "design", "system"] },
        { taxonomy: "repo.api", patterns: ["api", "endpoint", "contract"] },
        { taxonomy: "repo.limitations", patterns: ["limitation", "limitations", "caveat", "constraint"] },
        { taxonomy: "repo.roadmap", patterns: ["roadmap", "todo", "next step", "next steps"] },
        { taxonomy: "repo.evidence", patterns: ["evidence", "quote", "quotes", "citation", "citations"] },
      ],
      fallbackTaxonomy: "repo.misc",
    },
    article: {
      detect: [],
      taxonomyRules: [
        { taxonomy: "article.title", patterns: ["title", "headline"] },
        { taxonomy: "article.summary", patterns: ["summary", "abstract", "dek"] },
        { taxonomy: "article.background", patterns: ["introduction", "background", "context"] },
        { taxonomy: "article.method", patterns: ["method", "approach", "workflow", "architecture", "design"] },
        { taxonomy: "article.findings", patterns: ["finding", "findings", "result", "results"] },
        { taxonomy: "article.analysis", patterns: ["discussion", "analysis", "implication", "implications"] },
        { taxonomy: "article.references", patterns: ["reference", "references", "citation", "citations", "links"] },
        { taxonomy: "article.evidence", patterns: ["evidence", "quote", "quotes"] },
      ],
      fallbackTaxonomy: "article.body",
    },
  },
  blockKindWeights: {
    heading: 12,
    paragraph: 16,
    list: 10,
    quote: 18,
    table: 14,
    code: 8,
  },
  taxonomyWeights: {
    "repo.readme": 12, "repo.overview": 12, "repo.installation": 6, "repo.usage": 12,
    "repo.architecture": 12, "repo.api": 12, "repo.limitations": 6, "repo.roadmap": 6,
    "repo.evidence": 12, "repo.misc": 2, "article.title": 6, "article.summary": 12,
    "article.background": 6, "article.method": 12, "article.findings": 12,
    "article.analysis": 6, "article.references": 6, "article.evidence": 12, "article.body": 2,
  },
  signalPatterns: {
    evidenceBoost: ["must", "should", "supports", "workflow", "evidence", "compile", "query", "parser", "readme", "rank", "quality"],
    codeBoost: ["http", "curl", "fetch", "const ", "function ", "class "],
    sectionBoost: ["readme", "overview", "summary", "usage", "architecture", "evidence", "findings"],
  },
  qualityWeights: {
    contentDepth: 0.22, structureQuality: 0.18, sourceAuthority: 0.18, freshness: 0.08,
    evidenceDensity: 0.18, repoSignal: 0.16, noisePenalty: 0.1,
  },
  qualityThresholds: {
    contentDepth: {
      high: { minWords: 220, score: 92 }, medium: { minWords: 140, score: 78 },
      light: { minWords: 70, score: 62 }, minimal: { minWords: 30, score: 44 }, fallback: 18,
    },
  },
};

export let conceptAliasConfig = defaultConceptAliasConfig;
export let sourceNormalizerConfig = defaultSourceNormalizerConfig;

function normalizeBoolean(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

export function readBooleanEnv(name, defaultValue = false) {
  const parsed = normalizeBoolean(process.env[name]);
  return parsed === null ? defaultValue : parsed;
}

export function readNumberEnv(name, defaultValue) {
  const raw = process.env[name];
  if (typeof raw !== "string" || !raw.trim()) return defaultValue;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function hasLlmApiKey() {
  return Boolean(process.env.LLM_API_KEY?.trim());
}

export function getConceptStrategyConfig() {
  const requested = (process.env.KNOWLEDGE_CONCEPT_STRATEGY ?? "hybrid").trim().toLowerCase();
  const strategy = ["rules", "llm", "hybrid"].includes(requested) ? requested : "hybrid";
  return {
    strategy,
    llmAvailable: hasLlmApiKey(),
  };
}

export function getVectorSearchConfig() {
  return {
    enabled: readBooleanEnv("ENABLE_VECTOR_SEARCH", false),
    rerankCandidates: Math.max(4, Math.floor(readNumberEnv("VECTOR_SEARCH_RERANK_CANDIDATES", 24))),
  };
}

export function getNanobotConfig() {
  return {
    enabled: readBooleanEnv("NANOBOT_ENABLED", false),
    dryRun: readBooleanEnv("NANOBOT_DRY_RUN", true),
    intervalMs: Math.max(5000, Math.floor(readNumberEnv("NANOBOT_INTERVAL_MS", 30 * 1000))),
    brainstormChance: Math.min(1, Math.max(0, readNumberEnv("NANOBOT_BRAINSTORM_CHANCE", 0.08))),
    reconcileChance: Math.min(1, Math.max(0, readNumberEnv("NANOBOT_RECONCILE_CHANCE", 0.08))),
  };
}

export async function ensureConceptAliasConfig() {
  try {
    const parsed = JSON.parse(await readFile(workspace.conceptAliases, "utf8"));
    conceptAliasConfig = {
      replacements: Array.isArray(parsed?.replacements) ? parsed.replacements : defaultConceptAliasConfig.replacements,
      canonicalPhrases: Array.isArray(parsed?.canonicalPhrases) ? parsed.canonicalPhrases : defaultConceptAliasConfig.canonicalPhrases,
    };
  } catch {
    await writeFile(workspace.conceptAliases, `${JSON.stringify(defaultConceptAliasConfig, null, 2)}\n`, "utf8");
    conceptAliasConfig = defaultConceptAliasConfig;
  }
}

export async function ensureSourceNormalizerConfig() {
  try {
    const parsed = JSON.parse(await readFile(workspace.sourceNormalizer, "utf8"));
    sourceNormalizerConfig = {
      sourceFamilies: parsed?.sourceFamilies ?? defaultSourceNormalizerConfig.sourceFamilies,
      blockKindWeights: parsed?.blockKindWeights ?? defaultSourceNormalizerConfig.blockKindWeights,
      taxonomyWeights: parsed?.taxonomyWeights ?? defaultSourceNormalizerConfig.taxonomyWeights,
      signalPatterns: parsed?.signalPatterns ?? defaultSourceNormalizerConfig.signalPatterns,
      qualityWeights: parsed?.qualityWeights ?? defaultSourceNormalizerConfig.qualityWeights,
      qualityThresholds: parsed?.qualityThresholds ?? defaultSourceNormalizerConfig.qualityThresholds,
    };
  } catch {
    await writeFile(workspace.sourceNormalizer, `${JSON.stringify(defaultSourceNormalizerConfig, null, 2)}\n`, "utf8");
    sourceNormalizerConfig = defaultSourceNormalizerConfig;
  }
}

export async function ensureWorkspace() {
  for (const dir of Object.values(workspace)) {
    if (path.extname(dir)) continue;
    await mkdir(dir, { recursive: true });
  }
  await ensureConceptAliasConfig();
  await ensureSourceNormalizerConfig();
}

export function getWorkspacePaths() {
  return workspace;
}
