import { classifyIntent } from '../services/api/llm-client.mjs';
import fs from 'node:fs';
import path from 'node:path';

// load env
const envContent = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    process.env[match[1]] = match[2].replace(/(^"|"$)/g, '');
  }
}

async function test() {
  console.log("API KEY:", process.env.LLM_API_KEY ? "EXISTS" : "MISSING");
  console.log("BASE URL:", process.env.LLM_BASE_URL);
  
  const text1 = "记住，Agent的架构核心是解耦合，必须引入StateGraph作为引擎。";
  const intent1 = await classifyIntent(text1);
  console.log("Intent 1:", intent1);

  const text2 = "上辈子的记事本写错了，现在最新的进展是，我们已经完成了 Hermes Auto-Evolution 的完全闭环，把它覆盖进图谱。";
  const intent2 = await classifyIntent(text2);
  console.log("Intent 2:", intent2);
}

test();
