const fs = require('fs');
const file = 'd:\\knowledge-foundry\\services\\api\\llm-client.mjs';
let content = fs.readFileSync(file, 'utf8');

// The file literally contains `\` (backslash backtick). We want just backtick.
content = content.replace(/\\\\\`/g, '`').replace(/\\\\\$/g, '$');
fs.writeFileSync(file, content, 'utf8');
console.log("Fixed backslashes!");
