const fs = require('fs');
const path = require('path');
const p = path.join('d:', 'knowledge-foundry', 'services', 'api', 'workspace-runtime.mjs');
let d = fs.readFileSync(p, 'utf8');
d = d.replace(/let answer = \"[^"]*\";\s*let suggestedAction = null;/, 'let answer = "查询无返回报告。";\n    let suggestedAction = null;');
fs.writeFileSync(p, d, 'utf8');
console.log('Fixed line 835.');
