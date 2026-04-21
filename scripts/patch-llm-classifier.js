const fs = require('fs');
let file = 'd:\\knowledge-foundry\\services\\api\\llm-client.mjs';
let content = fs.readFileSync(file, 'utf8');

const additions = `
export async function classifyIntent(text) {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return "QUERY";
  
  const endpoint = process.env.LLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4/chat/completions";
  const model = process.env.LLM_MODEL || "glm-4-flash";

  const systemPrompt = "你是一个意图识别引擎。用户会输入一句话。请判断其意图归属。\\n" +
  "可选意图：\\n" +
  "1. QUERY (用户在提问，例如：什么是架构？怎么解决超时？)\\n" +
  "2. INGEST (用户提供了一段孤立的知识要求你只记录下来，例如：总结一个知识点：微服务要加锁。)\\n" +
  "3. EVOLVE (用户极其明确地指出你之前的认知是错误的，要求你修正，或者要求你『纠正脑子里这段记录』)\\n\\n" +
  "只允许回复 'QUERY', 'INGEST', 或 'EVOLVE' 这三个单词中的一个。不要有任何废话。";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: model,
        temperature: 0.1,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text.slice(0, 5000) }
        ]
      })
    });
    if (!response.ok) return "QUERY";
    const data = await response.json();
    const result = (data.choices?.[0]?.message?.content || "").trim().toUpperCase();
    if (result.includes("EVOLVE")) return "EVOLVE";
    if (result.includes("INGEST")) return "INGEST";
    return "QUERY";
  } catch (e) {
    return "QUERY";
  }
}

export async function synthesizeEvolutionNode(text) {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return { title: "Raw Input", content: text };

  const endpoint = process.env.LLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4/chat/completions";
  const model = process.env.LLM_MODEL || "glm-4-flash";

  const systemPrompt = "你的任务是将用户口语化的知识纠正或随手记内容，提纯成一篇格式极为优美的学术级 Markdown 笔记。\\n" +
  "必须包含以下 JSON 格式：\\n" +
  "{\\n  \\"title\\": \\"生成的简短凝练标题\\",\\n  \\"content\\": \\"使用Markdown语法的详细知识节点内容，包含逻辑分段与归纳\\"\\n}\\n" +
  "不要包含多余文本。";

  try {
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
          { role: "user", content: "请提纯以下输入为标准化知识：\\n" + text.slice(0, 10000) }
        ],
        response_format: { type: "json_object" }
      })
    });
    if (!response.ok) throw new Error("Failed");
    const data = await response.json();
    return JSON.parse(data.choices?.[0]?.message?.content || "{}");
  } catch (e) {
    return { title: "Automated Log", content: text };
  }
}
`;

if (!content.includes('classifyIntent')) {
  fs.writeFileSync(file, content + '\\n' + additions, 'utf8');
}
console.log("Added classifier to llm-client");
