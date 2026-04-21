const fs = require('fs');
let env = fs.readFileSync('d:\\knowledge-foundry\\.env', 'utf8');
env = env.replace(/#.*$/gm, '').replace(/"/g, '').trim();
fs.writeFileSync('d:\\knowledge-foundry\\.env', env, 'utf8');
console.log("Fixed .env!");
