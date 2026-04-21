import { readFile } from "node:fs/promises";
import path from "node:path";

const aliasesPath = path.join(process.cwd(), "data", "indexes", "concept-aliases.json");

function normalizeLabel(value, replacements) {
  let normalized = value.toLowerCase().trim();
  for (const rule of replacements) {
    const escaped = rule.match.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    normalized = normalized.replace(new RegExp(`\\b${escaped}\\b`, "g"), rule.replace.toLowerCase());
  }
  return normalized.replace(/\s+/g, " ").trim();
}

function fail(message) {
  throw new Error(`aliases check failed: ${message}`);
}

const raw = await readFile(aliasesPath, "utf8");
const config = JSON.parse(raw);

if (!Array.isArray(config.replacements)) fail("`replacements` must be an array");
if (!Array.isArray(config.canonicalPhrases)) fail("`canonicalPhrases` must be an array");

const replacementKeys = new Set();
for (const [index, rule] of config.replacements.entries()) {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) fail(`replacement ${index} must be an object`);
  if (typeof rule.match !== "string" || !rule.match.trim()) fail(`replacement ${index} has an invalid \`match\``);
  if (typeof rule.replace !== "string" || !rule.replace.trim()) fail(`replacement ${index} has an invalid \`replace\``);

  const key = `${rule.match.toLowerCase()}=>${rule.replace.toLowerCase()}`;
  if (replacementKeys.has(key)) fail(`duplicate replacement rule: ${rule.match} => ${rule.replace}`);
  replacementKeys.add(key);
}

const phraseSet = new Set();
for (const [index, phrase] of config.canonicalPhrases.entries()) {
  if (typeof phrase !== "string" || !phrase.trim()) fail(`canonical phrase ${index} must be a non-empty string`);
  const normalized = normalizeLabel(phrase, config.replacements);
  if (normalized !== phrase.trim().toLowerCase()) {
    fail(`canonical phrase "${phrase}" should already be stored in normalized lowercase form; expected "${normalized}"`);
  }
  if (phraseSet.has(normalized)) fail(`duplicate canonical phrase: ${phrase}`);
  phraseSet.add(normalized);
}

for (const rule of config.replacements) {
  const normalizedReplace = normalizeLabel(rule.replace, config.replacements);
  if (normalizedReplace !== rule.replace.trim().toLowerCase()) {
    fail(`replacement target "${rule.replace}" should be normalized already; expected "${normalizedReplace}"`);
  }
}

console.log(`aliases check ok: ${config.replacements.length} replacement rules, ${config.canonicalPhrases.length} canonical phrases`);
