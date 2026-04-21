# Indexes

This directory stores generated manifests, parsed artifacts, concept indexes, job records, and health-check outputs for the knowledge workspace.

## Key Files
- `concept-aliases.json`: editable concept normalization config used by compile and query.
- `concept-aliases.schema.json`: local JSON Schema for editor validation and field reference.
- `sources/`: source manifests written during ingest and updated during compile.
- `parsed/`: structured source parse artifacts used by concept synthesis and query.
- `concepts/`: synthesized concept graph artifacts used by concept pages and graph-backed query.
- `jobs/`: job manifests for compile, query, and health-check runs.

## Concept Alias Config
- `replacements`: ordered literal phrase replacements.
- `canonicalPhrases`: multi-word canonical concepts that should be recognized directly in normalized source text.

## Matching Rules
- Matching is case-insensitive because source text and config terms are normalized to lowercase before comparison.
- Replacement matching uses word boundaries, so `parser` matches the whole word but not the middle of another token.
- `match` is treated as a literal phrase, not a regex.
- Replacements run in array order, so earlier rules win when phrases overlap.
- After replacements, whitespace is compacted and the final value is slugged for concept ids.

## Editing Tips
- Prefer singular canonical names like `source summary` instead of plural variants.
- Put more specific phrases before broader ones when they overlap.
- If two surface forms should land in one concept page, point both at the same canonical `replace` value.
- Add a phrase to `canonicalPhrases` when you want a multi-word concept recognized even if it is not present in tags or headings.
