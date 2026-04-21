const fs = require('fs');
const file = 'd:\\knowledge-foundry\\services\\api\\workspace.mjs';
let content = fs.readFileSync(file, 'utf8');

const target = `      // Inject LLM Contradictions
      const sourceContradictions = [];
      for (const src of aggregatedSources) {
        if (src.contradictions) {
           sourceContradictions.push(...src.contradictions);
        }
      }`;

const target2 = `        qualitySummary: bucket.qualitySummary,
        contradictions: sourceContradictions,`;

if (content.includes('aggregatedSources is not defined') || content.includes('const sourceContradictions = []')) {
  content = content.replace(target, '');
  content = content.replace(target2, '        qualitySummary: bucket.qualitySummary,\n        contradictions: [],');
  fs.writeFileSync(file, content, 'utf8');
  console.log("Removed broken aggregatedSources loop");
}
