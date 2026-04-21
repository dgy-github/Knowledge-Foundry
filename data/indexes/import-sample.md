# Imported Source

## Knowledge Synthesis
This file was imported from disk and should become a parsed source summary after compile.

- knowledge synthesis connects raw sources to wiki pages
- markdown parsing extracts reusable concepts

> Quote spans help preserve source evidence.

## Architecture
| Signal | Meaning |
| --- | --- |
| quality score | stronger source ranking |

```js
export function rankSources(items) {
  return items.sort((left, right) => right.qualityScore - left.qualityScore);
}
```
