const fs = require('fs');
const file = 'd:\\knowledge-foundry\\services\\api\\workspace.mjs';
let content = fs.readFileSync(file, 'utf8');

const importStatement = `import { extractKnowledgeWithLLM } from "./llm-client.mjs";\n`;
if (!content.includes('extractKnowledgeWithLLM')) {
  content = content.replace('import path from "node:path";', 'import path from "node:path";\n' + importStatement);
}

const adapterCode = `
function adaptLlmToParsed(source, manifest, llmResult, timestamp) {
  const contentHash = hashContent(source.content);
  return {
    id: \`\${source.id}.json\`,
    sourceId: source.id,
    title: llmResult.title || manifest.title || source.title,
    displayTitle: llmResult.title || manifest.title || source.title,
    sourceType: llmResult.sourceType || manifest.sourceType,
    sourcePath: source.path,
    importMode: manifest.importMode,
    originalPath: manifest.originalPath,
    tags: llmResult.tags || [],
    excerpt: llmResult.summary || source.excerpt,
    contentHash,
    parsedAt: typeof timestamp === "string" ? timestamp : new Date().toISOString(),
    sections: [],
    bullets: [],
    paragraphs: [],
    wikiLinks: [],
    concepts: (llmResult.concepts || []).map(c => ({
      label: c.label,
      aliasOf: c.label,
      slug: c.slug || c.label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      kind: c.kind || "concept",
      tokens: (c.label.match(/\\b[a-z][a-z0-9-]{2,}\\b/g) || [])
    })),
    claims: llmResult.claims || [],
    contradictions: llmResult.contradictions || [],
    stats: {
      lineCount: 0, wordCount: 0, sectionCount: 0, bulletCount: 0, paragraphCount: 0,
      conceptCount: (llmResult.concepts || []).length
    }
  };
}
`;

if (!content.includes('adaptLlmToParsed')) {
  content = content.replace('export async function createJob', adapterCode + '\nexport async function createJob');
}

const targetLogic = `const parsed = shouldRebuild ? parseMarkdownSource(source, manifest) : existingParsed;`;
const replacementLogic = `let parsed = existingParsed;
      if (shouldRebuild) {
        if (process.env.LLM_API_KEY) {
           console.log("[LLM_ENGINE] Deep Semantic Extraction active for:", source.title);
           try {
             const llmResult = await extractKnowledgeWithLLM(source.content, source.title || manifest.title);
             parsed = adaptLlmToParsed(source, manifest, llmResult, timestamp);
           } catch (e) {
             console.error("[LLM_ENGINE] Error, falling back to heuristic:", e.message);
             parsed = parseMarkdownSource(source, manifest);
           }
        } else {
           parsed = parseMarkdownSource(source, manifest);
        }
      }`;

content = content.replace(targetLogic, replacementLogic);

// Add contradiction passthrough for bucket creation logic inside createJob('compile')
const aggFindStr = `const conceptArtifact = {`;
const aggReplaceStr = `
      // Inject LLM Contradictions
      const sourceContradictions = [];
      for (const src of aggregatedSources) {
        if (src.contradictions) {
           sourceContradictions.push(...src.contradictions);
        }
      }
      const conceptArtifact = {`;

if (!content.includes('const sourceContradictions = []')) {
  content = content.replace(aggFindStr, aggReplaceStr);
  const aggBodyFindStr = `qualitySummary: bucket.qualitySummary,`;
  const aggBodyReplaceStr = `qualitySummary: bucket.qualitySummary,
        contradictions: sourceContradictions,`;
  content = content.replace(aggBodyFindStr, aggBodyReplaceStr);
}

fs.writeFileSync(file, content, 'utf8');
console.log("LLM pipeline injected to workspace.mjs!");
