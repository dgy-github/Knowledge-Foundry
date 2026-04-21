# Source Normalizer Config

Path: `data/indexes/source-normalizer.json`

This file controls how the knowledge pipeline normalizes source structure and how compile/query rank evidence.

## Top-Level Fields

`sourceFamilies`
- Maps a source family name such as `repo` or `article` to detection rules and taxonomy rules.

`blockKindWeights`
- Base weights for block types such as `paragraph`, `quote`, `table`, and `code`.
- Higher numbers make that block type more likely to be selected as evidence.

`taxonomyWeights`
- Extra weights applied after a block is classified into a taxonomy such as `repo.architecture` or `article.findings`.
- Taxonomy names should stay stable because they are surfaced in parsed artifacts and query outputs.

`signalPatterns`
- Keyword lists that add extra evidence or importance boosts.
- Matching is case-insensitive substring matching against normalized lowercase text.

`qualityWeights`
- Weights used when `qualityScore` is synthesized from the component metrics.
- Positive components are added; `noisePenalty` is subtracted.

`qualityThresholds`
- Threshold tables for per-metric scoring.
- Current implementation uses `qualityThresholds.contentDepth`.

## sourceFamilies

Each family supports:

`detect`
- Array of lowercase-ish substrings used to classify `sourceType` into that family.

`taxonomyRules`
- Ordered list.
- First matching rule wins.
- Each rule supports:
  - `taxonomy`: must start with `<family>.`
  - `patterns`: array of substring patterns matched against normalized heading + block text

`fallbackTaxonomy`
- Used when no taxonomy rule matches.

## Matching Rules

- Matching is currently case-insensitive.
- Matching uses normalized lowercase text after concept alias normalization and whitespace cleanup.
- Pattern matching is substring-based, not regex-based.
- Rule order matters inside `taxonomyRules`.

## Editing Guidance

- Prefer adding new taxonomy rules before broad catch-all patterns.
- Keep `taxonomyWeights` in sync with any new taxonomy names.
- Keep `blockKindWeights` and `signalPatterns` conservative; overly large boosts can make query evidence unstable.
- After edits, run `npm run normalizer:check`.

## Current Runtime Consumers

- `research`: classifies fetched HTML blocks and computes initial `qualityScore`
- `compile`: normalizes markdown sources into parsed blocks and recalculates quality
- `query`: ranks evidence using source quality, taxonomy weight, and block evidence weight
