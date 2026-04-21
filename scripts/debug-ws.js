const fs = require('fs');
const file = 'd:\\knowledge-foundry\\services\\api\\workspace.mjs';
const lines = fs.readFileSync(file, 'utf8').split('\\n');
const idx = lines.findIndex(l => l.includes('for (const src of aggregatedSources) {'));
if (idx !== -1) {
    console.log(lines.slice(idx - 5, idx + 15).join('\\n'));
}
