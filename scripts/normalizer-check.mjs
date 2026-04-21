import { readFile } from "node:fs/promises";

const config = JSON.parse(await readFile("data/indexes/source-normalizer.json", "utf8"));

if (!config || typeof config !== "object") {
  throw new Error("source normalizer config must be an object");
}

const families = config.sourceFamilies;
if (!families || typeof families !== "object") {
  throw new Error("sourceFamilies is required");
}

for (const [family, familyConfig] of Object.entries(families)) {
  if (!Array.isArray(familyConfig.taxonomyRules) || !familyConfig.taxonomyRules.length) {
    throw new Error(`sourceFamilies.${family}.taxonomyRules must be a non-empty array`);
  }
  if (typeof familyConfig.fallbackTaxonomy !== "string" || !familyConfig.fallbackTaxonomy) {
    throw new Error(`sourceFamilies.${family}.fallbackTaxonomy must be a non-empty string`);
  }
  for (const rule of familyConfig.taxonomyRules) {
    if (typeof rule.taxonomy !== "string" || !rule.taxonomy.startsWith(`${family}.`)) {
      throw new Error(`taxonomy rule in ${family} must start with "${family}."`);
    }
    if (!Array.isArray(rule.patterns) || !rule.patterns.length) {
      throw new Error(`taxonomy rule ${rule.taxonomy} must have non-empty patterns`);
    }
  }
}

for (const field of ["blockKindWeights", "taxonomyWeights", "signalPatterns", "qualityWeights", "qualityThresholds"]) {
  if (!config[field] || typeof config[field] !== "object") {
    throw new Error(`${field} is required`);
  }
}

for (const [key, value] of Object.entries(config.blockKindWeights)) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`blockKindWeights.${key} must be a non-negative number`);
  }
}

for (const [key, value] of Object.entries(config.taxonomyWeights)) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`taxonomyWeights.${key} must be a non-negative number`);
  }
}

for (const [key, value] of Object.entries(config.signalPatterns)) {
  if (!Array.isArray(value)) {
    throw new Error(`signalPatterns.${key} must be an array`);
  }
}

for (const [key, value] of Object.entries(config.qualityWeights)) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`qualityWeights.${key} must be a non-negative number`);
  }
}

const depth = config.qualityThresholds.contentDepth;
if (!depth || typeof depth !== "object") {
  throw new Error("qualityThresholds.contentDepth is required");
}

for (const key of ["high", "medium", "light", "minimal"]) {
  if (!depth[key] || !Number.isFinite(depth[key].minWords) || !Number.isFinite(depth[key].score)) {
    throw new Error(`qualityThresholds.contentDepth.${key} must include numeric minWords and score`);
  }
}

if (!Number.isFinite(depth.fallback)) {
  throw new Error("qualityThresholds.contentDepth.fallback must be numeric");
}

console.log(`normalizer check ok: ${Object.keys(families).length} families, ${Object.keys(config.taxonomyWeights).length} taxonomy weights, ${Object.keys(config.qualityWeights).length} quality weights`);
