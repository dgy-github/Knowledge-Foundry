import { extractKnowledgeWithLLM } from "../llm-client.mjs";
import { getConceptStrategyConfig, systemEvents, sourceNormalizerConfig } from "./config.mjs";
import {
  blockKindWeight,
  clampScore,
  createQuoteSpan,
  dedupeStrings,
  detectSourceFamily,
  extractCanonicalPhrases,
  extractKeywordConcepts,
  extractReadmeSummary,
  extractWikiLinks,
  hashContent,
  normalizeConceptLabel,
  normalizeSectionTaxonomy,
  parseHtmlMeta,
  parseTitleFromHtml,
  slugify,
  stripHtmlToText,
  summarizeText,
  taxonomyWeight,
  titleCase,
  tokenize,
} from "./utils.mjs";

export function renderSectionBullets(items, emptyLabel) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : `- ${emptyLabel}`;
}

function formatConceptLabel(label) {
  if (/^[a-zA-Z0-9-\s]+$/.test(label)) {
    return titleCase(label);
  }
  return label;
}

function buildConceptRecord(label, kind, aliasOf = label, definition = "") {
  const normalized = label?.trim();
  if (!normalized || normalized.length < 2) return null;
  if (kind !== "insight" && kind !== "source-title" && normalized.length > 48) return null;
  if (/^-+/.test(normalized)) return null;
  if (kind !== "insight" && /[\u3002\uFF0C\uFF1F\uFF01\u201C\u201D]/.test(normalized)) return null;

  const canonicalLabel = normalizeConceptLabel(normalized);
  if (!canonicalLabel) return null;
  if (kind !== "insight" && kind !== "source-title" && canonicalLabel.length > 48) return null;

  const slug = slugify(canonicalLabel);
  if (!slug || slug.length < 2 || slug === "item") return null;

  return {
    label: formatConceptLabel(canonicalLabel),
    aliasOf: aliasOf?.trim() || normalized,
    slug,
    kind,
    definition: definition?.trim() || "",
    tokens: tokenize(canonicalLabel),
  };
}

function dedupeConceptRecords(items) {
  const concepts = new Map();
  for (const item of items) {
    if (!item) continue;
    const existing = concepts.get(item.slug);
    if (!existing) {
      concepts.set(item.slug, item);
      continue;
    }
    concepts.set(item.slug, {
      ...existing,
      kind: existing.kind === "source-title" && item.kind !== "source-title" ? item.kind : existing.kind,
      definition: existing.definition || item.definition || "",
      aliasOf: existing.aliasOf || item.aliasOf,
      tokens: dedupeStrings([...(existing.tokens ?? []), ...(item.tokens ?? [])]),
    });
  }
  return [...concepts.values()];
}

function normalizeClaims(claims = []) {
  return dedupeStrings(claims
    .map((claim) => {
      if (!claim) return "";
      if (typeof claim === "string") return claim.trim();
      if (typeof claim.text === "string") return claim.text.trim();
      return "";
    })
    .filter(Boolean))
    .slice(0, 24)
    .map((text) => ({
      text,
      polarity: classifyClaimPolarity(text),
    }));
}

function normalizeLlmConcepts(concepts = []) {
  return dedupeConceptRecords(concepts
    .map((concept) => {
      const label = typeof concept?.label === "string" ? concept.label : "";
      const kind = typeof concept?.kind === "string" ? concept.kind : "llm";
      return buildConceptRecord(label, kind, label, typeof concept?.definition === "string" ? concept.definition : "");
    })
    .filter(Boolean));
}

function inferBlockImportance(kind, text, sectionPath = [], taxonomy = null) {
  let score = kind === "heading" ? 62 : kind === "paragraph" ? 54 : kind === "list" ? 46 : kind === "quote" ? 58 : kind === "code" ? 38 : 42;
  score += blockKindWeight(kind);
  score += taxonomyWeight(taxonomy ?? normalizeSectionTaxonomy("article", sectionPath.at(-1) ?? "", text));
  if (sectionPath.some((item) => (sourceNormalizerConfig.signalPatterns.sectionBoost ?? []).some((pattern) => item.toLowerCase().includes(String(pattern).toLowerCase())))) score += 8;
  if ((sourceNormalizerConfig.signalPatterns.evidenceBoost ?? []).some((pattern) => text.toLowerCase().includes(String(pattern).toLowerCase()))) score += 8;
  if (text.length > 180) score += 4;
  return clampScore(score);
}

export function buildQualityBreakdown({
  status = 0,
  bodyWordCount = 0,
  description = "",
  extractedSummary = "",
  readmeSummary = "",
  kind = "web-article",
  contentType = "",
  blockCount = 0,
  sectionCount = 0,
  taxonomy = [],
  blockKinds = [],
}) {
  const depthThresholds = sourceNormalizerConfig.qualityThresholds.contentDepth;
  const contentDepth = clampScore(
    bodyWordCount >= depthThresholds.high.minWords ? depthThresholds.high.score
      : bodyWordCount >= depthThresholds.medium.minWords ? depthThresholds.medium.score
        : bodyWordCount >= depthThresholds.light.minWords ? depthThresholds.light.score
          : bodyWordCount >= depthThresholds.minimal.minWords ? depthThresholds.minimal.score
            : depthThresholds.fallback,
  );
  const structureQuality = clampScore(Math.min(100, sectionCount * 14 + blockCount * 4 + taxonomy.length * 6 + (readmeSummary ? 18 : 0)));
  const sourceAuthority = clampScore((status >= 200 && status < 400 ? 55 : 15) + (description ? 20 : 0) + (kind === "repo" ? 20 : 10));
  const freshness = 50;
  const evidenceDensity = clampScore(Math.min(100, (extractedSummary ? 24 : 0) + Math.min(38, Math.round(bodyWordCount / 4)) + Math.min(16, blockCount * 2) + Math.min(22, blockKinds.filter((item) => ["quote", "table", "code"].includes(item)).length * 7)));
  const repoSignal = clampScore(kind === "repo" ? 45 + (readmeSummary ? 25 : 10) + Math.min(20, taxonomy.filter((item) => item.startsWith("repo.")).length * 4) + (contentType.includes("html") ? 10 : 0) : 20);
  const noisePenalty = clampScore(bodyWordCount < 25 ? 30 : bodyWordCount < 50 ? 18 : 8);
  const weights = sourceNormalizerConfig.qualityWeights;
  const totalScore = clampScore(
    contentDepth * weights.contentDepth
    + structureQuality * weights.structureQuality
    + sourceAuthority * weights.sourceAuthority
    + freshness * weights.freshness
    + evidenceDensity * weights.evidenceDensity
    + repoSignal * weights.repoSignal
    - noisePenalty * weights.noisePenalty,
  );
  return { contentDepth, structureQuality, sourceAuthority, freshness, evidenceDensity, repoSignal, noisePenalty, totalScore };
}

function buildSectionSummary(blocks) {
  const headings = blocks.filter((block) => block.kind === "heading").map((block) => block.text);
  const readmeSections = headings.filter((item) => /\b(readme|overview|usage|architecture|installation|limitations|roadmap)\b/i.test(item));
  const articleSections = headings.filter((item) => /\b(summary|findings|references|introduction|background|evidence)\b/i.test(item));
  const taxonomy = dedupeStrings(blocks.map((block) => block.taxonomy).filter(Boolean));
  return { headings, readmeSections, articleSections, taxonomy };
}

export function renderNormalizedSections(item) {
  const byTaxonomy = new Map();
  for (const block of item.parsedBlocks ?? []) {
    if (!block.taxonomy || block.kind === "heading") continue;
    if (!byTaxonomy.has(block.taxonomy)) byTaxonomy.set(block.taxonomy, []);
    byTaxonomy.get(block.taxonomy).push(block);
  }
  const sections = [];
  for (const [taxonomy, blocks] of byTaxonomy.entries()) {
    const heading = taxonomy.split(".").map((part) => titleCase(part)).join(" / ");
    sections.push(`## ${heading}\n${blocks.slice(0, 3).map((block) => `- ${block.text}`).join("\n")}`);
  }
  return sections.join("\n\n");
}

function parseHtmlBlocks(html, identity) {
  const sourceFamily = detectSourceFamily(identity.kind);
  const lines = html
    .replace(/<\/(p|div|section|article|main|li|blockquote|pre|h1|h2|h3|h4|h5|h6)>/gi, "$&\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .split(/\n+/)
    .map((line) => stripHtmlToText(line))
    .filter(Boolean);
  const blocks = [];
  let currentSectionPath = [];
  for (const [index, line] of lines.entries()) {
    let kind = "paragraph";
    let level = null;
    if (/^readme$/i.test(line) || /^overview$/i.test(line) || /^usage$/i.test(line) || /^architecture$/i.test(line)) {
      kind = "heading";
      level = 2;
      currentSectionPath = [...currentSectionPath.slice(0, 1), line];
    } else if (index === 0) {
      kind = "heading";
      level = 1;
      currentSectionPath = [line];
    } else if (/^[-*]\s+/.test(line)) {
      kind = "list";
    }
    const text = line.replace(/^[-*]\s+/, "").trim();
    const sectionPath = currentSectionPath.length ? [...currentSectionPath] : [identity.kind === "repo" ? "README" : "Article"];
    const taxonomy = normalizeSectionTaxonomy(sourceFamily, sectionPath.at(-1) ?? "", text);
    blocks.push({
      id: `${slugify(text || `${kind}-${index + 1}`)}-${index + 1}`,
      kind,
      text,
      level,
      line: index + 1,
      sectionPath,
      taxonomy,
      importance: inferBlockImportance(kind, text, sectionPath, taxonomy),
      evidenceWeight: clampScore(blockKindWeight(kind) * 2 + taxonomyWeight(taxonomy) + ((sourceNormalizerConfig.signalPatterns.evidenceBoost ?? []).some((pattern) => text.toLowerCase().includes(String(pattern).toLowerCase())) ? 18 : 0)),
    });
  }
  return blocks.slice(0, 40);
}

function classifySeedUrl(url) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parsed.hostname === "github.com" && parts.length >= 2) {
      return {
        kind: "repo",
        host: parsed.hostname,
        owner: parts[0],
        repo: parts[1].replace(/\.git$/, ""),
      };
    }
    if (/repo/i.test(parsed.pathname) && parts.length >= 2) {
      return {
        kind: "repo",
        host: parsed.hostname,
        owner: parts.at(-2),
        repo: parts.at(-1).replace(/\.git$/, ""),
      };
    }
    return { kind: "web-article", host: parsed.hostname };
  } catch {
    return { kind: "web-article", host: "unknown" };
  }
}

export async function fetchSeedMetadata(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "KnowledgeFoundry/0.1" },
    signal: AbortSignal.timeout(8000),
  });
  const body = await response.text();
  const identity = classifySeedUrl(url);
  const contentType = response.headers.get("content-type") ?? "text/plain";
  const plainText = stripHtmlToText(body);
  const title = parseHtmlMeta(body, "og:title", "property") || parseTitleFromHtml(body) || `${identity.owner ? `${identity.owner}/` : ""}${identity.repo ?? new URL(url).hostname}`;
  const description = parseHtmlMeta(body, "description") || parseHtmlMeta(body, "og:description", "property")
    || body.replace(/\s+/g, " ").trim().slice(0, 240)
    || "No description available.";
  const parsedBlocks = parseHtmlBlocks(body, identity);
  const sectionSummary = buildSectionSummary(parsedBlocks);
  const blockText = parsedBlocks.map((block) => block.text).join(" ");
  const bodyWordCount = blockText.split(/\s+/).filter(Boolean).length;
  const extractedSummary = summarizeText(plainText, identity.kind === "repo" ? 320 : 260);
  const readmeSummary = identity.kind === "repo" ? extractReadmeSummary(plainText) : "";
  const qualityBreakdown = buildQualityBreakdown({
    status: response.status,
    bodyWordCount,
    description,
    extractedSummary,
    readmeSummary,
    kind: identity.kind,
    contentType,
    blockCount: parsedBlocks.length,
    sectionCount: sectionSummary.headings.length,
    taxonomy: sectionSummary.taxonomy,
    blockKinds: dedupeStrings(parsedBlocks.map((block) => block.kind)),
  });

  const metadata = {
    url,
    status: response.status,
    contentType,
    title,
    description,
    extractedSummary,
    readmeSummary,
    bodyWordCount,
    parsedBlocks,
    sectionSummary,
    qualityBreakdown,
    ...identity,
  };
  metadata.qualityScore = qualityBreakdown.totalScore;
  return metadata;
}

export function classifyClaimPolarity(text) {
  const normalized = normalizeConceptLabel(text);
  if (/\b(no|not|never|without|avoid|cannot|can't|does not|doesn't|is not|isn't|optional)\b/.test(normalized)) return "negative";
  if (/\b(require|requires|must|needed|depends on|supports|improves|enables|uses|extracts|connects|builds|creates|compiles)\b/.test(normalized)) return "positive";
  return "neutral";
}

export function parseMarkdownSource(source, manifest) {
  const lines = source.content.split(/\r?\n/);
  const title = lines.find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, "").trim() || manifest.title || source.title;
  const displayTitle = manifest.title || source.title || title;
  const sections = [];
  const bullets = [];
  const paragraphs = [];
  let currentSection = null;
  let paragraphBuffer = [];
  let paragraphStartLine = null;

  const flushParagraph = (lineNumber) => {
    if (!paragraphBuffer.length || paragraphStartLine === null) return;
    paragraphs.push({
      text: paragraphBuffer.join(" ").trim(),
      quoteSpan: createQuoteSpan("paragraph", paragraphStartLine, lineNumber),
      sectionSlug: currentSection?.slug ?? null,
      sectionHeading: currentSection?.heading ?? null,
    });
    paragraphBuffer = [];
    paragraphStartLine = null;
  };

  for (const [index, rawLine] of lines.entries()) {
    const lineNumber = index + 1;
    const line = rawLine.trim();

    if (!line) {
      flushParagraph(lineNumber - 1);
      continue;
    }

    const headingMatch = line.match(/^(#{2,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph(lineNumber - 1);
      currentSection = {
        heading: headingMatch[2].trim(),
        slug: slugify(headingMatch[2].trim()),
        level: headingMatch[1].length,
        lines: [],
        startLine: lineNumber,
      };
      sections.push(currentSection);
      continue;
    }

    const bulletMatch = line.match(/^[-*+]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph(lineNumber - 1);
      const text = bulletMatch[1].trim();
      const record = {
        text,
        line: lineNumber,
        sectionSlug: currentSection?.slug ?? null,
        sectionHeading: currentSection?.heading ?? null,
        quoteSpan: createQuoteSpan("bullet", lineNumber, lineNumber),
      };
      bullets.push(record);
      if (currentSection) currentSection.lines.push(record);
      continue;
    }

    if (paragraphStartLine === null) paragraphStartLine = lineNumber;
    paragraphBuffer.push(line);
    if (currentSection) {
      currentSection.lines.push({
        text: line,
        line: lineNumber,
        sectionSlug: currentSection.slug,
        sectionHeading: currentSection.heading,
        quoteSpan: createQuoteSpan("section-line", lineNumber, lineNumber),
      });
    }
  }
  flushParagraph(lines.length);

  const sectionRecords = sections.map((section) => ({
    heading: section.heading,
    slug: section.slug,
    level: section.level,
    startLine: section.startLine,
    endLine: section.lines.at(-1)?.line ?? section.startLine,
    body: section.lines.map((line) => line.text).join(" ").trim(),
    bulletCount: section.lines.filter((line) => line.quoteSpan.kind === "bullet").length,
  }));

  const concepts = [];
  const seenConcepts = new Set();
  const pushConcept = (label, kind) => {
    const concept = buildConceptRecord(label, kind);
    if (!concept || seenConcepts.has(concept.slug)) return;

    seenConcepts.add(concept.slug);
    systemEvents.emit("sys-log", { kind: "s", msg: `捕获高能神经节: [${kind.toUpperCase()}] ${concept.label}` });
    concepts.push(concept);
  };

  if (source.id.startsWith("insight-")) {
    pushConcept(displayTitle, "insight");
  } else {
    pushConcept(displayTitle, "source-title");
  }
  if (title !== displayTitle) pushConcept(title, "document-title");
  pushConcept(manifest.sourceType, "source-type");
  for (const tag of manifest.tags ?? []) pushConcept(tag, "tag");
  for (const section of sectionRecords) pushConcept(section.heading, "section");
  for (const link of extractWikiLinks(source.content)) pushConcept(link, "wikilink");
  for (const phrase of extractCanonicalPhrases(source.content)) pushConcept(phrase, "phrase");
  for (const keyword of extractKeywordConcepts(source.content)) pushConcept(keyword, "keyword");

  return {
    id: `${source.id}.json`,
    sourceId: source.id,
    title,
    displayTitle,
    sourceType: manifest.sourceType,
    sourcePath: source.path,
    importMode: manifest.importMode,
    originalPath: manifest.originalPath,
    tags: manifest.tags ?? [],
    excerpt: source.excerpt,
    contentHash: hashContent(source.content),
    parsedAt: new Date().toISOString(),
    sections: sectionRecords,
    bullets: bullets.slice(0, 16),
    paragraphs: paragraphs.slice(0, 12),
    wikiLinks: extractWikiLinks(source.content),
    concepts,
    claims: dedupeStrings([
      ...bullets.map((item) => item.text),
      ...paragraphs.map((item) => item.text),
    ]).slice(0, 12).map((text) => ({
      text,
      polarity: classifyClaimPolarity(text),
    })),
    stats: {
      lineCount: lines.length,
      wordCount: source.content.split(/\s+/).filter(Boolean).length,
      sectionCount: sectionRecords.length,
      bulletCount: bullets.length,
      paragraphCount: paragraphs.length,
      conceptCount: concepts.length,
      claimCount: Math.min(12, dedupeStrings([
        ...bullets.map((item) => item.text),
        ...paragraphs.map((item) => item.text),
      ]).length),
    },
  };
}

export async function applyConceptExtractionStrategy(source, manifest, parsed) {
  const strategyConfig = getConceptStrategyConfig();
  const requestedStrategy = strategyConfig.strategy;
  const ruleConcepts = dedupeConceptRecords(parsed.concepts ?? []);
  const ruleClaims = normalizeClaims(parsed.claims ?? []);
  let llmPayload = null;
  let appliedStrategy = requestedStrategy === "llm" && !strategyConfig.llmAvailable ? "rules-fallback" : "rules";

  if ((requestedStrategy === "llm" || requestedStrategy === "hybrid") && strategyConfig.llmAvailable) {
    try {
      systemEvents.emit("sys-log", { kind: "i", msg: `概念抽取策略升级: ${requestedStrategy.toUpperCase()} (${parsed.displayTitle})` });
      llmPayload = await extractKnowledgeWithLLM(source.content, parsed.displayTitle);
    } catch (error) {
      appliedStrategy = requestedStrategy === "llm" ? "rules-fallback" : "hybrid-fallback";
      systemEvents.emit("sys-log", {
        kind: "w",
        msg: `LLM 抽取不可用，回退到规则抽取 (${parsed.displayTitle}): ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  const llmConcepts = normalizeLlmConcepts(llmPayload?.concepts ?? []);
  const llmClaims = normalizeClaims(llmPayload?.claims ?? []);
  const contradictions = Array.isArray(llmPayload?.contradictions)
    ? llmPayload.contradictions
        .map((item) => (typeof item?.summary === "string" ? item.summary.trim() : ""))
        .filter(Boolean)
    : [];

  let concepts = ruleConcepts;
  let claims = ruleClaims;
  if (requestedStrategy === "llm" && llmConcepts.length) {
    concepts = llmConcepts;
    claims = llmClaims.length ? llmClaims : ruleClaims;
    appliedStrategy = "llm";
  } else if (requestedStrategy === "hybrid" && llmPayload) {
    concepts = dedupeConceptRecords([...ruleConcepts, ...llmConcepts]);
    claims = normalizeClaims([...ruleClaims, ...llmClaims]);
    appliedStrategy = llmConcepts.length || llmClaims.length ? "hybrid" : "rules";
  }

  return {
    ...parsed,
    summary: typeof llmPayload?.summary === "string" && llmPayload.summary.trim()
      ? llmPayload.summary.trim()
      : manifest.sourceSummary || parsed.excerpt,
    concepts,
    claims,
    contradictions,
    conceptExtraction: {
      requestedStrategy,
      appliedStrategy,
      llmAvailable: strategyConfig.llmAvailable,
      llmUsed: appliedStrategy === "llm" || appliedStrategy === "hybrid",
    },
    stats: {
      ...parsed.stats,
      conceptCount: concepts.length,
      claimCount: claims.length,
      contradictionCount: contradictions.length,
    },
  };
}

export function parseMarkdownBlocks(source, manifest) {
  const lines = source.content.split(/\r?\n/);
  const blocks = [];
  const sectionStack = [];
  const sourceFamily = detectSourceFamily(manifest.sourceType);
  let paragraphLines = [];
  let paragraphStart = null;
  let codeBuffer = [];
  let codeStart = null;
  let inCode = false;

  const currentSectionPath = () => sectionStack.map((item) => item.text);
  const pushParagraph = (lineNumber) => {
    if (!paragraphLines.length || paragraphStart === null) return;
    const text = paragraphLines.join(" ").trim();
    const sectionPath = currentSectionPath();
    const taxonomy = normalizeSectionTaxonomy(sourceFamily, sectionPath.at(-1) ?? "", text);
    blocks.push({
      id: `${slugify(text.slice(0, 48) || `paragraph-${paragraphStart}`)}-${paragraphStart}`,
      kind: "paragraph",
      text,
      lineStart: paragraphStart,
      lineEnd: lineNumber,
      sectionPath,
      taxonomy,
      importance: inferBlockImportance("paragraph", text, sectionPath, taxonomy),
      evidenceWeight: clampScore(blockKindWeight("paragraph") * 2 + taxonomyWeight(taxonomy) + ((sourceNormalizerConfig.signalPatterns.evidenceBoost ?? []).some((pattern) => text.toLowerCase().includes(String(pattern).toLowerCase())) ? 18 : 0)),
    });
    paragraphLines = [];
    paragraphStart = null;
  };
  const pushCode = (lineNumber) => {
    if (!codeBuffer.length || codeStart === null) return;
    const text = codeBuffer.join("\n").trim();
    const sectionPath = currentSectionPath();
    const taxonomy = normalizeSectionTaxonomy(sourceFamily, sectionPath.at(-1) ?? "", text);
    blocks.push({
      id: `${slugify(`code-${codeStart}`)}-${codeStart}`,
      kind: "code",
      text,
      lineStart: codeStart,
      lineEnd: lineNumber,
      sectionPath,
      taxonomy,
      importance: inferBlockImportance("code", text, sectionPath, taxonomy),
      evidenceWeight: clampScore(blockKindWeight("code") * 2 + taxonomyWeight(taxonomy) + ((sourceNormalizerConfig.signalPatterns.codeBoost ?? []).some((pattern) => text.toLowerCase().includes(String(pattern).toLowerCase())) ? 12 : 0)),
    });
    codeBuffer = [];
    codeStart = null;
  };

  for (const [index, rawLine] of lines.entries()) {
    const lineNumber = index + 1;
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (/^```/.test(trimmed)) {
      pushParagraph(lineNumber - 1);
      if (inCode) {
        pushCode(lineNumber);
        inCode = false;
      } else {
        inCode = true;
        codeStart = lineNumber;
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(rawLine);
      continue;
    }

    if (!trimmed) {
      pushParagraph(lineNumber - 1);
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      pushParagraph(lineNumber - 1);
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      while (sectionStack.length && sectionStack.at(-1).level >= level) sectionStack.pop();
      sectionStack.push({ level, text });
      const taxonomy = normalizeSectionTaxonomy(sourceFamily, text, text);
      blocks.push({
        id: `${slugify(text)}-${lineNumber}`,
        kind: "heading",
        text,
        level,
        lineStart: lineNumber,
        lineEnd: lineNumber,
        sectionPath: currentSectionPath(),
        taxonomy,
        importance: inferBlockImportance("heading", text, currentSectionPath(), taxonomy),
        evidenceWeight: clampScore(blockKindWeight("heading") * 2 + taxonomyWeight(taxonomy)),
      });
      continue;
    }

    const listMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (listMatch) {
      pushParagraph(lineNumber - 1);
      const text = listMatch[1].trim();
      const taxonomy = normalizeSectionTaxonomy(sourceFamily, currentSectionPath().at(-1) ?? "", text);
      blocks.push({
        id: `${slugify(text.slice(0, 48))}-${lineNumber}`,
        kind: "list",
        text,
        lineStart: lineNumber,
        lineEnd: lineNumber,
        sectionPath: currentSectionPath(),
        taxonomy,
        importance: inferBlockImportance("list", text, currentSectionPath(), taxonomy),
        evidenceWeight: clampScore(blockKindWeight("list") * 2 + taxonomyWeight(taxonomy) + 6),
      });
      continue;
    }

    const quoteMatch = trimmed.match(/^>\s+(.+)$/);
    if (quoteMatch) {
      pushParagraph(lineNumber - 1);
      const text = quoteMatch[1].trim();
      const taxonomy = normalizeSectionTaxonomy(sourceFamily, currentSectionPath().at(-1) ?? "", text);
      blocks.push({
        id: `${slugify(text.slice(0, 48))}-${lineNumber}`,
        kind: "quote",
        text,
        lineStart: lineNumber,
        lineEnd: lineNumber,
        sectionPath: currentSectionPath(),
        taxonomy,
        importance: inferBlockImportance("quote", text, currentSectionPath(), taxonomy),
        evidenceWeight: clampScore(blockKindWeight("quote") * 2 + taxonomyWeight(taxonomy) + 12),
      });
      continue;
    }

    if (/^\|.+\|$/.test(trimmed)) {
      pushParagraph(lineNumber - 1);
      const text = trimmed.replace(/\|/g, " ").replace(/\s+/g, " ").trim();
      const taxonomy = normalizeSectionTaxonomy(sourceFamily, currentSectionPath().at(-1) ?? "", text);
      blocks.push({
        id: `${slugify(`table-${lineNumber}`)}-${lineNumber}`,
        kind: "table",
        text,
        lineStart: lineNumber,
        lineEnd: lineNumber,
        sectionPath: currentSectionPath(),
        taxonomy,
        importance: inferBlockImportance("table", text, currentSectionPath(), taxonomy),
        evidenceWeight: clampScore(blockKindWeight("table") * 2 + taxonomyWeight(taxonomy) + 10),
      });
      continue;
    }

    if (paragraphStart === null) paragraphStart = lineNumber;
    paragraphLines.push(trimmed);
  }

  pushParagraph(lines.length);
  pushCode(lines.length);

  return {
    id: `${source.id}.json`,
    sourceId: source.id,
    title: manifest.title || source.title,
    sourcePath: source.path,
    generatedAt: new Date().toISOString(),
    blocks,
    taxonomy: dedupeStrings(blocks.map((block) => block.taxonomy).filter(Boolean)).sort(),
    stats: {
      blockCount: blocks.length,
      sectionCount: blocks.filter((block) => block.kind === "heading").length,
      evidenceBlockCount: blocks.filter((block) => ["paragraph", "list", "quote"].includes(block.kind)).length,
      taxonomyCount: dedupeStrings(blocks.map((block) => block.taxonomy).filter(Boolean)).length,
    },
  };
}

export function createFallbackManifest(source) {
  return {
    id: source.id,
    title: source.title,
    sourceType: "markdown",
    path: source.path,
    tags: [],
    ingestedAt: source.updatedAt,
    importMode: "file",
    originalPath: source.path,
    parsedPath: null,
    parsedBlocksPath: null,
    summaryPath: null,
    conceptSlugs: [],
    compileStats: null,
    qualityScore: null,
    qualityBreakdown: null,
    sourceSummary: source.excerpt,
    contentHash: hashContent(source.content),
  };
}
