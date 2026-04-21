const fs = require('fs');

const repair = (filepath) => {
  let content = fs.readFileSync(filepath, 'utf8');
  // I need to change back literal newline inside split('') to \n
  content = content.replace(/split\('\\n'/g, "split('\\n')");
  fs.writeFileSync(filepath, content, 'utf8');
  console.log("Fixed split in", filepath);
};

repair('d:\\\\knowledge-foundry\\\\services\\\\api\\\\server.mjs');
repair('d:\\\\knowledge-foundry\\\\services\\\\api\\\\workspace.mjs');
