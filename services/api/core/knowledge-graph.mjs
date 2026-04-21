import { getSourceManifest, listKnowledgeFiles, listParsedArtifacts, loadParsedBlocksArtifact } from "./store.mjs";
import { getExtractor, getVectorSearchConfig, systemEvents } from "./config.mjs";
import { classifyClaimPolarity } from "./source-analysis.mjs";
import { createQuoteSpan, dedupeStrings, hashContent, slugify, tokenize } from "./utils.mjs";

const vectorCache = new Map();

function normalizeEvidence(line, fallbackSectionHeading = null) {
  return {
    text: line.text,
    sectionHeading: line.sectionHeading ?? fallbackSectionHeading,
    sectionSlug: line.sectionSlug ?? (fallbackSectionHeading ? slugify(fallbackSectionHeading) : null),
    quoteSpan: line.quoteSpan,
  };
}

function collectBlockEvidence(parsedBlocks, concept) {
  if (!parsedBlocks?.blocks?.length) return [];
  const tokens = new Set([concept.slug.replace(/-/g, " "), ...(concept.tokens ?? [])]);
  return parsedBlocks.blocks
    .filter((block) => [...tokens].some((token) => block.text.toLowerCase().includes(token)))
    .sort((left, right) => (right.evidenceWeight ?? 0) - (left.evidenceWeight ?? 0) || (right.importance ?? 0) - (left.importance ?? 0) || left.lineStart - right.lineStart)
    .slice(0, 4)
    .map((block) => ({
      text: block.text,
      sectionHeading: block.sectionPath?.at(-1) ?? null,
      sectionSlug: block.sectionPath?.at(-1) ? slugify(block.sectionPath.at(-1)) : null,
      quoteSpan: createQuoteSpan(`block:${block.kind}`, block.lineStart, block.lineEnd),
      evidenceKind: block.kind,
      blockImportance: block.importance ?? 0,
      evidenceWeight: block.evidenceWeight ?? 0,
      taxonomy: block.taxonomy ?? null,
      sectionPath: block.sectionPath ?? [],
    }));
}

function collectConceptEvidence(parsed, concept) {
  const tokens = new Set([concept.slug.replace(/-/g, " "), ...(concept.tokens ?? [])]);
  const evidence = [];

  for (const section of parsed.sections ?? []) {
    const sectionText = `${section.heading} ${section.body}`.toLowerCase();
    if ([...tokens].some((token) => sectionText.includes(token))) {
      evidence.push({
        text: section.body || section.heading,
        sectionHeading: section.heading,
        sectionSlug: section.slug,
        quoteSpan: createQuoteSpan("section", section.startLine, section.endLine),
      });
    }
  }

  for (const bullet of parsed.bullets ?? []) {
    if ([...tokens].some((token) => bullet.text.toLowerCase().includes(token))) {
      evidence.push(normalizeEvidence(bullet));
    }
  }

  for (const paragraph of parsed.paragraphs ?? []) {
    if ([...tokens].some((token) => paragraph.text.toLowerCase().includes(token))) {
      evidence.push(normalizeEvidence(paragraph));
    }
  }

  if (!evidence.length && parsed.paragraphs?.[0]) {
    evidence.push(normalizeEvidence(parsed.paragraphs[0]));
  }

  return evidence.slice(0, 4);
}

function rankEvidence(evidence) {
  return dedupeStrings(evidence.map((item) => JSON.stringify(item)))
    .map((item) => JSON.parse(item))
    .sort((left, right) => (right.sourceQuality ?? 0) - (left.sourceQuality ?? 0)
      || (right.evidenceWeight ?? 0) - (left.evidenceWeight ?? 0)
      || (right.blockImportance ?? 0) - (left.blockImportance ?? 0)
      || left.sourceTitle.localeCompare(right.sourceTitle))
    .slice(0, 8);
}

function summarizeEvidenceQuality(evidence) {
  return {
    maxSourceQuality: evidence.reduce((max, item) => Math.max(max, item.sourceQuality ?? 0), 0),
    averageSourceQuality: evidence.length
      ? Number((evidence.reduce((sum, item) => sum + (item.sourceQuality ?? 0), 0) / evidence.length).toFixed(2))
      : 0,
  };
}

function detectContradictions(bucket) {
  const positives = bucket.evidence.filter((item) => classifyClaimPolarity(item.text) === "positive");
  const negatives = bucket.evidence.filter((item) => classifyClaimPolarity(item.text) === "negative");
  if (!positives.length || !negatives.length) return [];

  return [{
    summary: `${bucket.label} has mixed positive and negative claims across sources.`,
    positiveEvidence: positives.slice(0, 2),
    negativeEvidence: negatives.slice(0, 2),
  }];
}

function pickBestDefinition(definitions) {
  return [...definitions]
    .filter(Boolean)
    .sort((left, right) => right.length - left.length || left.localeCompare(right))
    .at(0) ?? "";
}

function buildConceptRetrievalText(concept) {
  return dedupeStrings([
    concept.label,
    concept.definition,
    ...(concept.tokens ?? []),
    ...(concept.sectionHeadings ?? []).slice(0, 4),
    ...(concept.evidence ?? []).slice(0, 4).map((item) => item.text),
  ]).join(" ");
}

function scoreConceptLexical(questionTokens, concept, questionStr) {
  const exactMatches = questionTokens.filter((token) => concept.tokens.includes(token) || concept.slug.includes(token));
  const fuzzyMatches = questionTokens.filter((token) => concept.label.toLowerCase().includes(token) || concept.definition?.toLowerCase().includes(token));
  const directMatch = concept.label.toLowerCase().length > 1 && questionStr.includes(concept.label.toLowerCase()) ? 15 : 0;
  const lexicalScore = exactMatches.length * 4 + fuzzyMatches.length * 2 + directMatch;
  const qualityScore = Math.round((concept.qualitySummary?.maxSourceQuality ?? 0) / 10);
  const sourceCoverageScore = Math.min(8, concept.sourceCount ?? concept.sourceTitles?.length ?? 0);
  return {
    exactMatches: exactMatches.length,
    fuzzyMatches: fuzzyMatches.length,
    lexicalScore,
    qualityScore,
    sourceCoverageScore,
    totalScore: lexicalScore + qualityScore + sourceCoverageScore,
  };
}

function extractEmbeddingVector(output) {
  if (!output) return [];
  if (output.data && typeof output.data.length === "number") return Array.from(output.data);
  if (typeof output.tolist === "function") {
    const list = output.tolist();
    if (Array.isArray(list) && Array.isArray(list[0])) return list[0];
    if (Array.isArray(list)) return list;
  }
  if (Array.isArray(output)) {
    return output.flat(Infinity).filter((item) => typeof item === "number");
  }
  return [];
}

async function embedText(text) {
  const key = hashContent(text);
  const cached = vectorCache.get(key);
  if (cached) return cached;

  const { p } = await getExtractor();
  const output = await p(text, { pooling: "mean", normalize: true });
  const vector = extractEmbeddingVector(output);
  if (!vector.length) throw new Error("Vector extractor returned an empty embedding.");
  vectorCache.set(key, vector);
  return vector;
}

function cosineSimilarity(left, right) {
  if (!left.length || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (!leftNorm || !rightNorm) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

async function applyVectorRerank(question, ranked) {
  const vectorConfig = getVectorSearchConfig();
  if (!vectorConfig.enabled || !ranked.length) {
    return {
      ranked: ranked.map((item) => ({ ...item, vectorScore: 0, finalScore: item.totalScore })),
      vectorApplied: false,
    };
  }

  try {
    const queryEmbedding = await embedText(question);
    const rerankLimit = Math.min(vectorConfig.rerankCandidates, ranked.length);
    const rerankedHead = await Promise.all(ranked.slice(0, rerankLimit).map(async (item) => {
      const vectorScore = cosineSimilarity(queryEmbedding, await embedText(buildConceptRetrievalText(item.concept)));
      return {
        ...item,
        vectorScore,
        finalScore: item.totalScore + vectorScore * 12,
      };
    }));
    const tail = ranked.slice(rerankLimit).map((item) => ({
      ...item,
      vectorScore: 0,
      finalScore: item.totalScore,
    }));
    return {
      ranked: [...rerankedHead, ...tail]
        .sort((left, right) => right.finalScore - left.finalScore
          || right.totalScore - left.totalScore
          || left.concept.label.localeCompare(right.concept.label)),
      vectorApplied: true,
    };
  } catch (error) {
    systemEvents.emit("sys-log", {
      kind: "w",
      msg: `向量重排已跳过: ${error instanceof Error ? error.message : String(error)}`,
    });
    return {
      ranked: ranked.map((item) => ({ ...item, vectorScore: 0, finalScore: item.totalScore })),
      vectorApplied: false,
    };
  }
}

async function rankConceptsForQuestion(question, concepts, limit = 4) {
  const questionStr = question.toLowerCase();
  const questionTokens = tokenize(question);
  const ranked = concepts
    .map((concept) => {
      const scores = scoreConceptLexical(questionTokens, concept, questionStr);
      return { concept, ...scores };
    })
    .filter((item) => item.totalScore > 0)
    .sort((left, right) => right.totalScore - left.totalScore
      || (right.concept.qualitySummary?.maxSourceQuality ?? 0) - (left.concept.qualitySummary?.maxSourceQuality ?? 0)
      || left.concept.label.localeCompare(right.concept.label));

  const reranked = await applyVectorRerank(question, ranked);
  return {
    ranked: reranked.ranked.slice(0, limit),
    retrieval: {
      mode: reranked.vectorApplied ? "keyword+quality+vector" : "keyword+quality",
      vectorApplied: reranked.vectorApplied,
      candidateCount: ranked.length,
    },
  };
}

function scoreFileHit(queryTokens, queryString, item) {
  const title = item.title.toLowerCase();
  const excerpt = item.excerpt.toLowerCase();
  const exactTitle = title.includes(queryString) ? 10 : 0;
  const titleTokenHits = queryTokens.filter((token) => title.includes(token)).length * 3;
  const excerptTokenHits = queryTokens.filter((token) => excerpt.includes(token)).length;
  return exactTitle + titleTokenHits + excerptTokenHits;
}

export async function buildKnowledgeGraph() {
  const parsedArtifacts = await listParsedArtifacts();
  const manifests = new Map();
  const parsedBlocks = new Map();
  for (const parsed of parsedArtifacts) {
    manifests.set(parsed.sourceId, await getSourceManifest(parsed.sourceId));
    parsedBlocks.set(parsed.sourceId, await loadParsedBlocksArtifact(parsed.sourceId));
  }

  const conceptBuckets = new Map();
  for (const parsed of parsedArtifacts) {
    const manifest = manifests.get(parsed.sourceId);
    const summaryPath = manifest?.summaryPath ?? `data/wiki/source-${slugify(parsed.displayTitle)}.md`;
    const sourceQuality = manifest?.qualityScore ?? 0;

    for (const concept of parsed.concepts ?? []) {
      if (!conceptBuckets.has(concept.slug)) {
        conceptBuckets.set(concept.slug, {
          slug: concept.slug,
          label: concept.label,
          kinds: new Set(),
          sourceTitles: new Set(),
          sourceIds: new Set(),
          sourcePaths: new Set(),
          summaryPaths: new Set(),
          sectionHeadings: new Set(),
          evidence: [],
          tokens: new Set(tokenize(`${concept.label} ${concept.slug.replace(/-/g, " ")}`)),
          definitions: new Set(),
        });
      }

      const bucket = conceptBuckets.get(concept.slug);
      bucket.kinds.add(concept.kind);
      bucket.sourceTitles.add(parsed.displayTitle);
      bucket.sourceIds.add(parsed.sourceId);
      bucket.sourcePaths.add(parsed.sourcePath);
      bucket.summaryPaths.add(summaryPath);
      if (concept.definition) bucket.definitions.add(concept.definition.trim());
      for (const token of concept.tokens ?? []) bucket.tokens.add(token);

      const blockEvidence = collectBlockEvidence(parsedBlocks.get(parsed.sourceId), concept);
      const conceptEvidence = (blockEvidence.length ? blockEvidence : collectConceptEvidence(parsed, concept)).map((item) => ({
        ...item,
        sourceId: parsed.sourceId,
        sourceTitle: parsed.displayTitle,
        sourcePath: parsed.sourcePath,
        sourceQuality,
      }));

      for (const item of conceptEvidence) {
        bucket.evidence.push(item);
        if (item.sectionHeading) bucket.sectionHeadings.add(item.sectionHeading);
      }
    }
  }

  return [...conceptBuckets.values()]
    .sort((left, right) => left.label.localeCompare(right.label))
    .map((bucket) => {
      const evidence = rankEvidence(bucket.evidence);
      const contradictions = detectContradictions(bucket);
      const definition = pickBestDefinition(bucket.definitions);
      const sourceTitles = [...bucket.sourceTitles].sort();
      const sourceIds = [...bucket.sourceIds].sort();
      const sectionHeadings = [...bucket.sectionHeadings].sort();
      return {
        slug: bucket.slug,
        label: bucket.label,
        definition,
        kinds: [...bucket.kinds].sort(),
        sourceTitles,
        sourceIds,
        sourcePaths: [...bucket.sourcePaths].sort(),
        summaryPaths: [...bucket.summaryPaths].sort(),
        sectionHeadings,
        tokens: [...bucket.tokens].sort(),
        evidence,
        evidenceCount: evidence.length,
        sourceCount: sourceTitles.length,
        qualitySummary: summarizeEvidenceQuality(evidence),
        contradictions,
        contradictionCount: contradictions.length,
      };
    });
}

export async function synthesizeQueryFromGraph(question) {
  const concepts = await buildKnowledgeGraph();
  const ranked = await rankConceptsForQuestion(question, concepts, 4);
  const matchedConcepts = ranked.ranked.map((item) => ({
    ...item.concept,
    retrievalScore: Number(item.finalScore.toFixed(2)),
    lexicalScore: item.lexicalScore,
    vectorScore: Number(item.vectorScore.toFixed(4)),
  }));

  const evidence = matchedConcepts
    .flatMap((concept) => concept.evidence.map((item) => ({ ...item, concept: concept.label, conceptQuality: concept.qualitySummary?.maxSourceQuality ?? 0 })))
    .sort((left, right) => (right.sourceQuality ?? 0) - (left.sourceQuality ?? 0)
      || (right.evidenceWeight ?? 0) - (left.evidenceWeight ?? 0)
      || (right.blockImportance ?? 0) - (left.blockImportance ?? 0)
      || (right.conceptQuality ?? 0) - (left.conceptQuality ?? 0)
      || left.sourceTitle.localeCompare(right.sourceTitle))
    .slice(0, 6);

  const answerLines = matchedConcepts.length
    ? matchedConcepts.map((concept) => `${concept.label} is supported by ${concept.sourceCount} source(s), with strongest evidence quality ${concept.qualitySummary?.maxSourceQuality ?? 0}/100, and recurring signals in ${concept.sectionHeadings[0] ?? "parsed notes"}.`)
    : ["No strongly matching concepts were found yet; compile more sources to improve coverage."];

  return {
    matchedConcepts,
    evidence,
    answer: answerLines.join(" "),
    retrieval: ranked.retrieval,
  };
}

export async function searchWorkspace(query) {
  const lowered = query.trim().toLowerCase();
  if (!lowered) return [];

  const queryTokens = tokenize(query);
  const [files, parsedArtifacts, concepts] = await Promise.all([
    Promise.all([listKnowledgeFiles("source"), listKnowledgeFiles("wiki"), listKnowledgeFiles("output")]).then((items) => items.flat()),
    listParsedArtifacts(),
    buildKnowledgeGraph(),
  ]);

  const fileResults = files
    .map((item) => ({
      id: item.id,
      title: item.title,
      kind: item.kind,
      path: item.path,
      excerpt: item.excerpt,
      score: scoreFileHit(queryTokens, lowered, item),
    }))
    .filter((item) => item.score > 0);

  const parsedResults = parsedArtifacts
    .map((item) => ({
      id: item.sourceId,
      title: item.displayTitle,
      kind: "parsed",
      path: `data/indexes/parsed/${item.sourceId}.json`,
      excerpt: `Parsed source with ${item.stats.conceptCount} concepts and ${item.stats.sectionCount} sections.`,
      score: scoreFileHit(queryTokens, lowered, {
        title: item.displayTitle,
        excerpt: item.concepts.map((concept) => concept.label).join(" "),
      }),
    }))
    .filter((item) => item.score > 0);

  const rankedConcepts = await rankConceptsForQuestion(query, concepts, 12);
  const conceptResults = rankedConcepts.ranked.map((item) => ({
    id: item.concept.slug,
    title: item.concept.label,
    kind: "concept",
    path: `data/wiki/topics/${item.concept.slug}/index.md`,
    excerpt: `Concept covered by ${item.concept.sourceCount} source(s) with ${item.concept.evidenceCount} evidence node(s).`,
    score: Number(item.finalScore.toFixed(2)),
  }));

  return [...fileResults, ...parsedResults, ...conceptResults]
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, 16);
}
