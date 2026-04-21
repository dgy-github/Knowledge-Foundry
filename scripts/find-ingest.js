const fs = require('fs');
const lines = fs.readFileSync('d:\\knowledge-foundry\\services\\api\\workspace.mjs', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('function ingestSource'));
if (idx !== -1) {
  console.log(lines.slice(Math.max(0, idx - 5), idx + 20).join('\n'));
} else {
  console.log('Not found');
}
