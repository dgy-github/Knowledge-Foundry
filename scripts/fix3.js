const fs = require('fs');

const code = `export async function extractKnowledgeWithLLM(text, title) {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error("No LLM_API_KEY found, fallback to fast heuristic engine.");
  }

  const endpoint = process.env.LLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4/chat/completions";
  const model = process.env.LLM_MODEL || "glm-4-flash";

  const systemPrompt = [
    "你正在维护一个 LLM Wiki，你的任务是将碎片化的信息输入编译成高度结构化、彼此关联的图谱数据。",
    "请你以极客与严谨的态度，仔细阅读提供的资料长文，然后按以下严格要求的 JSON 格式返回萃取出来的全部知识：",
    "{",
    '  "title": "资料修正后的最佳代号标题",',
    '  "summary": "不超过150字的摘要说明核心价值",',
    '  "sourceType": "markdown",',
    '  "tags": ["技术架构", "实践踩坑"],',
    '  "concepts": [',
    "    {",
    '      "label": "实体/概念名词，需首字母大写",',
    '      "slug": "kebab-case-slug",',
    '      "kind": "concept 或者 entity 或者 procedure",',
    '      "definition": "30字以内的定义说明"',
    "    }",
    "  ],",
    '  "claims": [',
    "    {",
    '      "text": "提取的观点或事实性证据",',
    '      "polarity": "positive 或者 negative"',
    "    }",
    "  ],",
    '  "contradictions": [',
    "    {",
    '      "summary": "如果本文档内存在逻辑矛盾，或者与常规行业知识存在重大偏离，在此写明"',
    "    }",
    "  ]",
    "}",
    "注意：你必须且只能返回上述完整 JSON 格式，不要返回任何 Markdown 语法圈定，只能是一个干净可解析的 JSON 对象。概念（Concepts）最少提取 3 个，最多提取 15 个。"
  ].join("\\n");

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
        { role: "user", content: "文档标题：" + title + "\\n\\n文档正文内容：\\n" + text.slice(0, 36000) }
      ],
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error("LLM API 抛出熔断错误 " + response.status + ": " + errorBody);
  }

  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content || "{}";
  
  try {
    return JSON.parse(rawText);
  } catch (err) {
    throw new Error("LLM 未正确返回 JSON: " + rawText);
  }
}
`;

fs.writeFileSync('d:\\knowledge-foundry\\services\\api\\llm-client.mjs', code, 'utf8');
