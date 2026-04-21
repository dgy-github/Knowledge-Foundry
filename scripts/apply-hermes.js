const fs = require('fs');

// 1. Repair llm-client.mjs
let llm = fs.readFileSync('services/api/llm-client.mjs', 'utf8');
llm = llm.replace(/[\\s\\S]*/, (text) => {
  if (text.includes("classifyIntent")) return text;
  return text + \`
export async function classifyIntent(text) {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return "QUERY";
  
  const endpoint = process.env.LLM_BASE_URL || "https://open.bigmodel.cn/api/coding/paas/v4/chat/completions";
  const model = process.env.LLM_MODEL || "GLM-4.7";

  const systemPrompt = "Intent classifier.\\n1. QUERY\\n2. INGEST\\n3. EVOLVE\\nReply strictly with 1 keyword.";
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
      body: JSON.stringify({ model: model, temperature: 0.1, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: text.slice(0, 2000) }] })
    });
    const data = await response.json();
    const result = (data.choices?.[0]?.message?.content || "").trim().toUpperCase();
    if (result.includes("EVOLVE")) return "EVOLVE";
    if (result.includes("INGEST")) return "INGEST";
    return "QUERY";
  } catch (e) { return "QUERY"; }
}

export async function synthesizeEvolutionNode(text) {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return { title: "Raw Input", content: text };

  const endpoint = process.env.LLM_BASE_URL || "https://open.bigmodel.cn/api/coding/paas/v4/chat/completions";
  const model = process.env.LLM_MODEL || "GLM-4.7";

  const systemPrompt = "Synthesize user input into JSON format: { \\"title\\": \\"short title\\", \\"content\\": \\"detailed markdown\\" }";
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
      body: JSON.stringify({ model: model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: text.slice(0, 5000) }], response_format: { type: "json_object" } })
    });
    const data = await response.json();
    return JSON.parse(data.choices?.[0]?.message?.content || "{}");
  } catch (e) { return { title: "Auto Log", content: text }; }
}
\`;
});

// Since the newlines got ruined previously in llm-client, let's just restore it cleanly.
// No wait, llm-client wasn't reset by git. I'll just write it outright using my original string block.
llm = \`
export async function extractKnowledgeWithLLM(text, title) {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error("No LLM_API_KEY");
  const endpoint = process.env.LLM_BASE_URL || "https://open.bigmodel.cn/api/coding/paas/v4/chat/completions";
  const model = process.env.LLM_MODEL || "GLM-4.7";
  const systemPrompt = "You are an LLM Wiki knowledge compiler. Produce structured JSON for concepts, claims, contradictions with keys: title, summary, sourceType, tags, concepts (label, slug, kind, definition), claims (text, polarity), contradictions (summary). Return ONLY JSON object.";
  const response = await fetch(endpoint, {
    method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
    body: JSON.stringify({ model: model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: "Title: " + title + "\\n\\nContent:\\n" + text.slice(0, 32000) }], response_format: { type: "json_object" } })
  });
  if (!response.ok) throw new Error("LLM API failed " + response.status);
  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content || "{}";
  try { return JSON.parse(rawText); } catch (err) { throw new Error("JSON parse err"); }
}

export async function answerQueryWithLLM(question, contextText) {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return null;
  const endpoint = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;
  const systemPrompt = "Answer the user question comprehensively based on the context evidence.";
  const response = await fetch(endpoint, {
    method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
    body: JSON.stringify({ model: model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: "Question: " + question + "\\n\\nContext evidence:\\n" + contextText.slice(0, 32000) }] })
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.choices?.[0]?.message?.content || null;
}

export async function classifyIntent(text) {
  const apiKey = process.env.LLM_API_KEY;
  const endpoint = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;
  if (!apiKey) return "QUERY";
  const systemPrompt = "Intent classifier.\\n1. QUERY (questions)\\n2. INGEST (recording isolated facts)\\n3. EVOLVE (correcting previous knowledge)\\nReply strictly with 1 keyword.";
  try {
    const response = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
      body: JSON.stringify({ model: model, temperature: 0.1, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: text.slice(0, 2000) }] })
    });
    const data = await response.json();
    const result = (data.choices?.[0]?.message?.content || "").trim().toUpperCase();
    if (result.includes("EVOLVE")) return "EVOLVE";
    if (result.includes("INGEST")) return "INGEST";
    return "QUERY";
  } catch (e) { return "QUERY"; }
}

export async function synthesizeEvolutionNode(text) {
  const apiKey = process.env.LLM_API_KEY;
  const endpoint = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;
  if (!apiKey) return { title: "Raw Input", content: text };
  const systemPrompt = "Synthesize user input into JSON format: { \\"title\\": \\"short title\\", \\"content\\": \\"detailed markdown\\" }";
  try {
    const response = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
      body: JSON.stringify({ model: model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: "Please purify into standard markdown note:\\n" + text.slice(0, 5000) }], response_format: { type: "json_object" } })
    });
    const data = await response.json();
    return JSON.parse(data.choices?.[0]?.message?.content || "{}");
  } catch (e) { return { title: "Auto Log", content: text }; }
}
\`;
fs.writeFileSync('services/api/llm-client.mjs', llm.trim(), 'utf8');

// 2. Add ENV loader and /jobs/chat to server.mjs
let srv = fs.readFileSync('services/api/server.mjs', 'utf8');
const envLoader = \`
import path from "node:path";

try {
  const envContent = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
  for (const line of envContent.split('\\n')) {
    const match = line.match(/^\\s*([\\w.-]+)\\s*=\\s*(.*)?\\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      process.env[key] = value;
    }
  }
} catch (e) {}

\`;
if (!srv.includes("process.env['LLM_API_KEY']")) {
  srv = srv.replace('import { createServer as createHttpServer } from "node:http";', 'import { createServer as createHttpServer } from "node:http";\\n' + envLoader);
}
const chatRoute = \`
    if (req.method === "POST" && req.url === "/jobs/chat") {
      try {
        const body = await parseJsonBody(req);
        if (!body.text) throw new Error("Missing text");
        const { handleAgentChat } = await import('./workspace.mjs');
        const responseData = await handleAgentChat(body.text);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(responseData));
        return;
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
        return;
      }
    }
\`;
if (!srv.includes("/jobs/chat")) {
  srv = srv.replace('const methodParams = req.url.match(/\\/jobs\\/([a-zA-Z0-9_-]+)/);', chatRoute + '\\n      const methodParams = req.url.match(/\\/jobs\\/([a-zA-Z0-9_-]+)/);');
}
fs.writeFileSync('services/api/server.mjs', srv, 'utf8');

// 3. Patch workspace.mjs imports and functions
let ws = fs.readFileSync('services/api/workspace.mjs', 'utf8');
const reqClient = \`import { extractKnowledgeWithLLM, classifyIntent, synthesizeEvolutionNode, answerQueryWithLLM } from "./llm-client.mjs";\`;
ws = ws.replace(/import .* from "\\.\\/llm-client\\.mjs";/, reqClient);

// LLM Ingestion inside workspace compile (restoring earlier logic)
const llmIngestLogic = \`
           try {
             const llmResult = await extractKnowledgeWithLLM(source.content, source.title || manifest.title);
             parsed = adaptLlmToParsed(source, manifest, llmResult, timestamp);
           } catch(e) {
             console.error("[LLM_ENGINE] Error, falling back to heuristic:", e.message);
             parsed = parseMarkdownSource(source, manifest);
           }
\`;
if (!ws.includes("extractKnowledgeWithLLM(source.content")) {
  ws = ws.replace("parsed = parseMarkdownSource(source, manifest);", llmIngestLogic);
}

// LLM query synthesis
const queryLogic = \`const synthesis = await synthesizeQueryFromGraph(question);
    if (process.env.LLM_API_KEY) {
      const contextLines = synthesis.evidence.map(item => \`[\${item.sourceTitle}] \${item.text}\`).join('\\n');
      console.log("[LLM_ENGINE] Synthesizing question with LLM...");
      try {
        const llmAnswer = await answerQueryWithLLM(question, contextLines);
        if (llmAnswer) synthesis.answer = llmAnswer;
      } catch (e) { console.error("[LLM_ENGINE] Query fallback:", e); }
    }
\`;
if (!ws.includes("answerQueryWithLLM(question")) {
  ws = ws.replace("const synthesis = await synthesizeQueryFromGraph(question);", queryLogic);
}

// Chat Function
const chatFunc = \`
export async function handleAgentChat(text) {
  let intent;
  try { intent = await classifyIntent(text); } catch(e) { intent = "QUERY"; }
  console.log("[AGENT] Intent Resolved:", intent);
  
  if (intent === "QUERY") {
    const job = await createJob("query", { question: text, outputKind: "report" });
    const jobPath = path.join(workspace.jobs, job.id + ".json");
    let answer = "查询无返回";
    try {
      const jobData = JSON.parse(await fs.promises.readFile(jobPath, 'utf8'));
      if (jobData.artifactPath) {
        answer = await fs.promises.readFile(path.join(workspace.wiki, path.basename(jobData.artifactPath)), 'utf8');
        answer = answer.split('## Graph Answer')[1] || answer;
        answer = answer.split('## Matched Concepts')[0] || answer;
      }
    } catch(e) { console.error(e); }
    return { type: "chat", intent: "QUERY", reply: answer.trim() };
  }

  if (intent === "INGEST" || intent === "EVOLVE") {
    const node = await synthesizeEvolutionNode(text);
    const title = node.title || ("Node " + Date.now());
    const contentText = node.content || text;
    
    const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '-');
    const filename = (intent === "EVOLVE" ? "evo-" : "nanobot-") + safeTitle + "-" + Date.now() + ".md";
    const filePath = path.join(workspace.raw, filename);
    
    // Explicitly joining without backticks and literal newlines.
    const mdFront = ["---", "title: " + JSON.stringify(title), "sourceType: " + JSON.stringify(intent), "tags: ['auto-generated', '" + intent.toLowerCase() + "']", "---"].join("\\n");
    const mdBody = ["# " + title, contentText].join("\\n\\n");
    
    await fs.promises.writeFile(filePath, mdFront + "\\n\\n" + mdBody + "\\n", 'utf8');
    createJob("compile").catch(e => console.log(e));
    
    const reply = intent === "EVOLVE" 
      ? "[Cognitive Mutation] Correction applied. Node overrides injected into graph."
      : "[Nanobot] Knowledge ingested layout.";
      
    return { type: "chat", intent: intent, reply: reply };
  }
  return { type: "chat", intent: "ERROR", reply: "Unknown" };
}
\`;

if (!ws.includes("handleAgentChat")) {
  ws += "\\n" + chatFunc;
}
fs.writeFileSync('services/api/workspace.mjs', ws, 'utf8');

console.log("Restored all Hermes Auto-Evolution pipelines cleanly!");
