const fs = require('fs');

// 1. Add answerQueryWithLLM to llm-client.mjs
let llmFile = 'd:\\knowledge-foundry\\services\\api\\llm-client.mjs';
let llmCode = fs.readFileSync(llmFile, 'utf8');

const newLLMFunc = `
export async function answerQueryWithLLM(question, contextText) {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return null;

  const endpoint = process.env.LLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4/chat/completions";
  const model = process.env.LLM_MODEL || "glm-4-flash";

  const systemPrompt = "你是一个深度的知识归纳助手。请根据下方提供的『相关上下文证据』，用严谨且有逻辑的 Markdown 格式回答用户的问题。如果提供的资料不足以回答，请明说。";
  
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiKey
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "需要回答的问题：" + question + "\\n\\n相关的上下文证据（可能比较散乱）：\\n" + contextText.slice(0, 36000) }
      ]
    })
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.choices?.[0]?.message?.content || null;
}
`;

if (!llmCode.includes('answerQueryWithLLM')) {
  llmCode += newLLMFunc;
  fs.writeFileSync(llmFile, llmCode, 'utf8');
}

// 2. Patch workspace.mjs
let wsFile = 'd:\\knowledge-foundry\\services\\api\\workspace.mjs';
let wsCode = fs.readFileSync(wsFile, 'utf8');

if (!wsCode.includes('answerQueryWithLLM')) {
  wsCode = wsCode.replace('import { extractKnowledgeWithLLM } from "./llm-client.mjs";', 'import { extractKnowledgeWithLLM, answerQueryWithLLM } from "./llm-client.mjs";');
  
  const target = `const synthesis = await synthesizeQueryFromGraph(question);`;
  const newCode = `const synthesis = await synthesizeQueryFromGraph(question);
    
    // Inject LLM logic
    if (process.env.LLM_API_KEY) {
      const contextLines = synthesis.evidence.map(item => \`[\${item.sourceTitle}] \${item.text}\`).join('\\n');
      console.log("[LLM_ENGINE] Synthesizing question with LLM...");
      try {
        const llmAnswer = await answerQueryWithLLM(question, contextLines);
        if (llmAnswer) synthesis.answer = llmAnswer;
      } catch (e) {
        console.error("[LLM_ENGINE] Query fallback:", e);
      }
    }`;
  
  if (wsCode.includes(target)) {
     wsCode = wsCode.replace(target, newCode);
     fs.writeFileSync(wsFile, wsCode, 'utf8');
  }
}
console.log("Patched Query pipeline!");
