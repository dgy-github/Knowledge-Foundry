const fs = require('fs');

const repair = (filepath) => {
  let content = fs.readFileSync(filepath, 'utf8');
  // replace literal backslash n with actual newline
  content = content.replace(/\\n/g, '\n');
  fs.writeFileSync(filepath, content, 'utf8');
  console.log("Repaired literal \\n in", filepath);
};

repair('d:\\\\knowledge-foundry\\\\services\\\\api\\\\llm-client.mjs');
repair('d:\\\\knowledge-foundry\\\\services\\\\api\\\\workspace.mjs');
repair('d:\\\\knowledge-foundry\\\\services\\\\api\\\\server.mjs');
