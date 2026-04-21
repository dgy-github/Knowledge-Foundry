const fs = require('fs');

let file = 'd:\\knowledge-foundry\\services\\api\\server.mjs';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `      const methodParams = req.url.match(/\\/jobs\\/([a-zA-Z0-9_-]+)/);`;

const addition = `
    if (req.method === "POST" && req.url === "/jobs/chat") {
      try {
        const body = await parseJsonBody(req);
        const { text } = body;
        if (!text) throw new Error("Missing text");
        
        // Import chat handler from workspace dynamically or statically previously
        // Actually, we'll inline route logic to call handleAgentChat
        const { handleAgentChat } = await import('./workspace.mjs');
        const responseData = await handleAgentChat(text);
        
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(responseData));
        return;
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
        return;
      }
    }
`;

if (!content.includes('/jobs/chat')) {
  // insert before the /jobs/:type wildcard to prevent it from intercepting /jobs/chat as a generic job
  content = content.replace(targetStr, addition + '\\n' + targetStr);
  fs.writeFileSync(file, content, 'utf8');
}
console.log("Added /jobs/chat to server.mjs");
