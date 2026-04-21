const fs = require('fs');

let wsFile = 'd:\\knowledge-foundry\\services\\api\\workspace.mjs';
let wsCode = fs.readFileSync(wsFile, 'utf8');

const importAdd = `import { classifyIntent, synthesizeEvolutionNode, answerQueryWithLLM } from "./llm-client.mjs";`;

const additions = `
export async function handleAgentChat(text) {
  console.log("[AGENT] Classifying intent for:", text);
  let intent;
  try {
     intent = await classifyIntent(text);
  } catch(e) {
     intent = "QUERY"; // fallback
  }
  
  console.log("[AGENT] Chosen Intent:", intent);

  if (intent === "QUERY") {
    // Treat as query job
    const job = await createJob("query", { question: text, outputKind: "report" });
    const output = await getOutputDetail(job.id.replace("compile-", "query-")); // Wait, job returns id. we can just read the job.artifactPath
    let answer = "查询无报告返回";
    try {
      answer = await fs.promises.readFile(job.artifactPath, 'utf8');
      // strip headers
      answer = answer.split('## Graph Answer')[1] || answer;
      answer = answer.split('## Matched Concepts')[0] || answer;
    } catch(e) {}
    return { type: "chat", intent: "QUERY", reply: answer.trim() };
  }

  if (intent === "INGEST" || intent === "EVOLVE") {
    console.log("[AGENT] Synthesizing evolutionary node...");
    const node = await synthesizeEvolutionNode(text);
    const title = node.title || "Cognitive Node " + Date.now();
    const content = node.content || text;
    
    // Save to data/raw/
    const safeTitle = title.replace(/[^a-zA-Z0-9-_\u4e00-\u9fa5]/g, '-');
    const filename = (intent === "EVOLVE" ? "evo-" : "nanobot-") + safeTitle + "-" + Date.now() + ".md";
    const filePath = path.join(workspace.raw, filename);
    await fs.promises.writeFile(filePath, \`---\\ntitle: "\${title}"\\nsourceType: "\${intent}"\\ntags: ["auto-generated", "\${intent.toLowerCase()}"]\\n---\\n\\n# \${title}\\n\\n\${content}\\n\`);
    
    console.log("[AGENT] Saved atomic thought:", filePath);
    
    // Trigger non-blocking recompile so UI feels fast
    createJob("compile").catch(e => console.error("Auto-compile failed", e));
    
    const reply = intent === "EVOLVE" 
      ? \`[认知变异突触] 你的纠正已生效。\\n系统已覆盖写入底层知识网格，神经节点：\${title}。正在后台重编译记忆结构。\`
      : \`[纳秒记录] 收录完毕：\${title}。\\n将参与下一次拓扑组装。\`;
      
    return { type: "chat", intent, reply };
  }
  
  return { type: "chat", intent: "ERROR", reply: "系统未能识别该指令。" };
}
`;

if (!wsCode.includes("classifyIntent")) {
  wsCode = wsCode.replace('import { extractKnowledgeWithLLM, answerQueryWithLLM } from "./llm-client.mjs";', importAdd);
}
if (!wsCode.includes("handleAgentChat")) {
  wsCode += '\\n' + additions;
  fs.writeFileSync(wsFile, wsCode, 'utf8');
}
console.log("Added handleAgentChat to workspace.mjs!");
