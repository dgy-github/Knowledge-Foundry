import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env');
const envStr = fs.readFileSync(envPath, 'utf8');
const envVars = Object.fromEntries(envStr.split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => {
  const [k, ...v] = l.split('=');
  return [k.trim(), v.join('=').trim().replace(/"/g, '')];
}));

async function testWebSearch() {
  const apiKey = envVars.LLM_API_KEY;
  const endpoint = envVars.LLM_BASE_URL || "https://open.bigmodel.cn/api/coding/paas/v4/chat/completions";
  const model = envVars.LLM_MODEL || "GLM-4";

  console.log("Using endpoint:", endpoint);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiKey
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: "user", content: "今天的新闻头条是什么？" }],
      tools: [{"type": "web_search", "web_search": {"enable": true}}]
    })
  });

  if (!response.ok) {
    console.error("HTTP Error", response.status, await response.text());
    return;
  }
  
  const data = await response.json();
  console.log("Result:", data.choices?.[0]?.message?.content);
}

testWebSearch().catch(console.error);
