import { conceptAliasConfig, sourceNormalizerConfig, stopwords } from "./config.mjs";
import path from "node:path";
import { createHash } from "node:crypto";

export function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/ig, "-").replace(/^-+|-+$/g, "") || "item";
}

export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeConceptLabel(value) {
  let normalized = value.toLowerCase().trim();
  for (const rule of conceptAliasConfig.replacements) {
    const pattern = new RegExp(`\\b${escapeRegex(String(rule.match).toLowerCase())}\\b`, "g");
    normalized = normalized.replace(pattern, String(rule.replace).toLowerCase());
  }
  normalized = normalized.replace(/\s+/g, " ").trim();
  return normalized;
}

export function titleCase(value) {
  return value.split(/\s+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export function titleFromFile(filePath) {
  return path.basename(filePath, path.extname(filePath)).replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function relative(filePath, root = process.cwd()) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

export function yamlValue(value) {
  if (Array.isArray(value)) return `[${value.map((item) => `"${String(item).replace(/"/g, '\\"')}"`).join(", ")}]`;
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

export function frontmatter(fields) {
  return `---\n${Object.entries(fields).map(([key, value]) => `${key}: ${yamlValue(value)}`).join("\n")}\n---\n\n`;
}

export function hashContent(content) {
  return createHash("sha1").update(content).digest("hex");
}

export function dedupeStrings(items) {
  return [...new Set(items.filter(Boolean))];
}

export function tokenize(value) {
  const matches = normalizeConceptLabel(value).match(/[a-z0-9-]{2,}|[\u4e00-\u9fa5]+/ig) ?? [];
  return dedupeStrings(matches.map(s => s.toLowerCase()).filter(token => !/^-+/.test(token)).filter(token => !stopwords.has(token)));
}

export function extractWikiLinks(content) {
  const links = [];
  for (const match of content.matchAll(/\[\[(.+?)\]\]/g)) links.push(match[1].trim());
  return dedupeStrings(links);
}

export function extractKeywordConcepts(content) {
  const counts = new Map();
  for (const word of tokenize(content)) counts.set(word, (counts.get(word) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).slice(0, 8).map(([word]) => word);
}

export function extractCanonicalPhrases(content) {
  const normalized = normalizeConceptLabel(content);
  return conceptAliasConfig.canonicalPhrases.filter((phrase) => normalized.includes(phrase));
}

export function createQuoteSpan(kind, startLine, endLine) {
  return { kind, startLine, endLine };
}

export function parseHtmlMeta(html, tag, attribute = "name") {
  const escaped = escapeRegex(tag);
  const patterns = [
    new RegExp(`<meta[^>]+${attribute}=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attribute}=["']${escaped}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

export function parseTitleFromHtml(html) {
  return html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ?? "";
}

export function stripHtmlToText(html) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<main[^>]*>/gi, "\n").replace(/<\/main>/gi, "\n")
    .replace(/<article[^>]*>/gi, "\n").replace(/<\/article>/gi, "\n")
    .replace(/<section[^>]*>/gi, "\n").replace(/<\/section>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6)>/gi, "\n")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

export function summarizeText(text, maxLength = 280) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  const slice = normalized.slice(0, maxLength);
  const boundary = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("; "), slice.lastIndexOf(", "), slice.lastIndexOf(" "));
  return `${slice.slice(0, boundary > 120 ? boundary : maxLength).trim()}...`;
}

export function extractReadmeSummary(text) {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const readmeIndex = lines.findIndex((line) => /\breadme\b/i.test(line));
  const startIndex = readmeIndex >= 0 ? readmeIndex + 1 : 0;
  const relevant = lines.slice(startIndex).filter((line) => !/^#+\s*$/.test(line) && !/^(stars?|forks?|issues?|watchers?):/i.test(line)).slice(0, 6).join(" ");
  return summarizeText(relevant, 220);
}

export function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function detectSourceFamily(kind) {
  const normalizedKind = normalizeConceptLabel(kind);
  for (const [family, config] of Object.entries(sourceNormalizerConfig.sourceFamilies)) {
    if ((config.detect ?? []).some((pattern) => normalizedKind.includes(String(pattern).toLowerCase()))) return family;
  }
  return "article";
}

export function normalizeSectionTaxonomy(sourceFamily, heading, text = "") {
  const normalized = normalizeConceptLabel(`${heading} ${text}`);
  const familyConfig = sourceNormalizerConfig.sourceFamilies[sourceFamily] ?? sourceNormalizerConfig.sourceFamilies.article;
  for (const rule of familyConfig.taxonomyRules ?? []) {
    if ((rule.patterns ?? []).some((pattern) => normalized.includes(String(pattern).toLowerCase()))) return rule.taxonomy;
  }
  return familyConfig.fallbackTaxonomy ?? `${sourceFamily}.misc`;
}

export function taxonomyWeight(taxonomy) {
  return sourceNormalizerConfig.taxonomyWeights[taxonomy] ?? 0;
}

export function blockKindWeight(kind) {
  return sourceNormalizerConfig.blockKindWeights[kind] ?? 0;
}
