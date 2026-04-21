const fs = require('fs');
let env = fs.readFileSync('d:\\knowledge-foundry\\.env', 'utf8');

// The user has a Coding Plan URL
env = env.replace(/LLM_BASE_URL=.*$/m, 'LLM_BASE_URL="https://open.bigmodel.cn/api/coding/paas/v4/chat/completions"');
env = env.replace(/LLM_MODEL=.*$/m, 'LLM_MODEL="GLM-4.7"');

fs.writeFileSync('d:\\knowledge-foundry\\.env', env, 'utf8');
console.log("Restored user Coding Plan!");
