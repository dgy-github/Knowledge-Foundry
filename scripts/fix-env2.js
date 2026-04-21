const fs = require('fs');
let env = fs.readFileSync('d:\\knowledge-foundry\\.env', 'utf8');
env = env.replace(/glm-4\.7/g, 'glm-4-flash');
fs.writeFileSync('d:\\knowledge-foundry\\.env', env, 'utf8');
console.log("Changed model to glm-4-flash!");
