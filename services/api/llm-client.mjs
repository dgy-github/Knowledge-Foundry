export async function extractKnowledgeWithLLM(text, title) {
  const apiKey = process.env.LLM_API_KEY?.trim();
  if (!apiKey) throw new Error("No LLM_API_KEY");
  const endpoint = process.env.LLM_BASE_URL || "https://open.bigmodel.cn/api/coding/paas/v4/chat/completions";
  const model = process.env.LLM_MODEL || "GLM-4.7";
  const systemPrompt = "You are an LLM Wiki knowledge compiler. Produce structured JSON for concepts, claims, contradictions with keys: title, summary, sourceType, tags, concepts (label, slug, kind, definition), claims (text, polarity), contradictions (summary). Return ONLY JSON object. IMPORTANT: All output text MUST be in Simplified Chinese.";
  const response = await fetch(endpoint, {
    method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
    body: JSON.stringify({ model: model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: "Title: " + title + "\n\nContent:\n" + text.slice(0, 32000) }], response_format: { type: "json_object" } })
  });
  if (!response.ok) throw new Error("LLM API failed " + response.status);
  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content || "{}";
  try { return JSON.parse(rawText); } catch (err) { throw new Error("JSON parse err"); }
}

export async function answerQueryWithLLM(question, contextText) {
  const apiKey = process.env.LLM_API_KEY?.trim();
  if (!apiKey) return null;
  const endpoint = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;
  const systemPrompt = "Answer the user question comprehensively based on the context evidence.";
  const response = await fetch(endpoint, {
    method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
    body: JSON.stringify({ model: model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: "Question: " + question + "\n\nContext evidence:\n" + contextText.slice(0, 32000) }] })
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.choices?.[0]?.message?.content || null;
}

export async function* answerQueryWithLLMStream(question, contextText) {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return;
  const endpoint = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;
  const systemPrompt = "Answer the user question comprehensively based on the context evidence.";
  
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
    body: JSON.stringify({ 
      model: model, 
      stream: true,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: "Question: " + question + "\n\nContext evidence:\n" + contextText.slice(0, 32000) }] 
    })
  });

  if (!response.ok) return;

  // Use manual text decoding chunk by chunk
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    
    // Process SSE lines
    const lines = buffer.split('\n');
    buffer = lines.pop() || "";
    
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const dataStr = line.slice(6).trim();
        if (dataStr === "[DONE]") return; // End of OpenAI stream
        if (!dataStr) continue;
        try {
          const data = JSON.parse(dataStr);
          const chunk = data.choices?.[0]?.delta?.content;
          if (chunk) {
            yield chunk;
          }
        } catch (e) {
          // ignore parsing error on chunks
        }
      }
    }
  }
}

export async function classifyIntent(text) {
  const apiKey = process.env.LLM_API_KEY;
  const endpoint = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;
  if (!apiKey) return "QUERY";
  const systemPrompt = "Intent classifier.\n1. QUERY (questions)\n2. INGEST (recording isolated facts)\n3. EVOLVE (correcting previous knowledge)\nReply strictly with 1 keyword.";
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
  const systemPrompt = "Synthesize user input into JSON format: { \"title\": \"short title\", \"content\": \"detailed markdown\" }";
  try {
    const response = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
      body: JSON.stringify({ model: model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: "Please purify into standard markdown note:\n" + text.slice(0, 5000) }], response_format: { type: "json_object" } })
    });
    const data = await response.json();
    return JSON.parse(data.choices?.[0]?.message?.content || "{}");
  } catch (e) { return { title: "Auto Log", content: text }; }
}

export async function synthesizeBrainstorming(conceptA, conceptB, contextA, contextB) {
  const apiKey = process.env.LLM_API_KEY?.trim();
  const endpoint = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;
  if (!apiKey) return { title: "Sandbox Mode Insight", insightSummary: "API Key omitted. In a real run, this would be an insightful intersection of the concepts.", generatedMarkdown: "API Key omitted fallback." };
  const systemPrompt = "You are a serendipity engine. You must force a creative intersection between two potentially unrelated concepts and generate an insight. Produce structured JSON for the insight with keys: title, insightSummary, generatedMarkdown. Return ONLY JSON object. IMPORTANT: All generated summary and markdown MUST be in Simplified Chinese.";
  const prompt = `Concept A: ${conceptA}\nContext A: ${contextA.slice(0, 5000)}\n\nConcept B: ${conceptB}\nContext B: ${contextB.slice(0, 5000)}\n\nTask: Brainstorm and generate an insightful connection or application combining A and B.`;
  try {
    const response = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
      body: JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }], response_format: { type: "json_object" } })
    });
    const data = await response.json();
    return JSON.parse(data.choices?.[0]?.message?.content || "{}");
  } catch (e) { return { title: "Brainstorm Failed", insightSummary: "Error", generatedMarkdown: "Failed to brainstorm." }; }
}

export async function reconcileConcepts(contradictionSummary, factsContext) {
  const apiKey = process.env.LLM_API_KEY?.trim();
  const endpoint = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;
  if (!apiKey) return { title: "Sandbox Mode Resolution", resolutionSummary: "API Key omitted. In a real run, this agent would resolve the factual conflict.", updatedMarkdown: "API Key omitted fallback." };
  const systemPrompt = "You are a fact-checking reconciler agent. Your job is to resolve a contradiction based on the provided facts context. Produce structured JSON with keys: title, resolutionSummary, updatedMarkdown. Return ONLY JSON object. IMPORTANT: All generated summaries and markdown MUST be in Simplified Chinese.";
  const prompt = `Contradiction to resolve: ${contradictionSummary}\n\nFacts Context:\n${factsContext.slice(0, 10000)}\n\nTask: Analyze the facts, resolve the contradiction, and write a resolution summary and updated markdown section.`;
  try {
    const response = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
      body: JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }], response_format: { type: "json_object" } })
    });
    const data = await response.json();
    return JSON.parse(data.choices?.[0]?.message?.content || "{}");
  } catch (e) { return { title: "Reconciliation Failed", resolutionSummary: "Error", updatedMarkdown: "Failed to reconcile." }; }
}
