const fs = require('fs');
let wsFile = 'd:\\knowledge-foundry\\services\\api\\workspace.mjs';
let content = fs.readFileSync(wsFile, 'utf8');

// remove everything after 'export async function handleAgentChat'
const idx = content.indexOf('export async function handleAgentChat');
if (idx !== -1) {
  content = content.substring(0, idx);
}

const safeCode = `
export async function handleAgentChat(text) {
  let intent;
  try {
     intent = await classifyIntent(text);
  } catch(e) {
     intent = "QUERY";
  }
  
  if (intent === "QUERY") {
    const job = await createJob("query", { question: text, outputKind: "report" });
    const jobPath = path.join(workspace.jobs, job.id + ".json");
    let answer = "No report generated.";
    try {
      const jobData = JSON.parse(await fs.promises.readFile(jobPath, 'utf8'));
      if (jobData.artifactPath) {
        answer = await fs.promises.readFile(path.join(workspace.wiki, path.basename(jobData.artifactPath)), 'utf8');
        answer = answer.split('## Graph Answer')[1] || answer;
        answer = answer.split('## Matched Concepts')[0] || answer;
      }
    } catch(e) {
      console.error(e);
    }
    return { type: "chat", intent: "QUERY", reply: answer.trim() };
  }

  if (intent === "INGEST" || intent === "EVOLVE") {
    const node = await synthesizeEvolutionNode(text);
    const title = node.title || ("Node " + Date.now());
    const contentText = node.content || text;
    
    const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '-');
    const filename = (intent === "EVOLVE" ? "evo-" : "nanobot-") + safeTitle + "-" + Date.now() + ".md";
    const filePath = path.join(workspace.raw, filename);
    
    const md = [
      "---",
      "title: " + JSON.stringify(title),
      "sourceType: " + JSON.stringify(intent),
      "tags: ['auto-generated', '" + intent.toLowerCase() + "']",
      "---",
      "",
      "# " + title,
      "",
      contentText
    ].join("\\n");
    
    await fs.promises.writeFile(filePath, md, 'utf8');
    
    createJob("compile").catch(e => console.error(e));
    
    const reply = intent === "EVOLVE" 
      ? "[Cognitive Mutation] Correction applied. Node overrides injected into graph."
      : "[Nanobot] Knowledge ingested layout.";
      
    return { type: "chat", intent: intent, reply: reply };
  }
  
  return { type: "chat", intent: "ERROR", reply: "Unknown" };
}
`;

fs.writeFileSync(wsFile, content + safeCode, 'utf8');
console.log("Fixed workspace encoding!");
