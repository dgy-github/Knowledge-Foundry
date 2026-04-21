import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { workspace } from "./config.mjs";
import { getKnowledgeFile, findSourceManifestByPath } from "./store.mjs";
import { classifyIntent, answerQueryWithLLMStream, synthesizeEvolutionNode } from "../llm-client.mjs";
import { duckDuckGoSearch } from "../web-retriever.mjs";
import { createJob } from "./jobs.mjs";

export async function resolveWikiForSource(id) {
  const source = await getKnowledgeFile("source", id);
  const relativePath = source.path;
  return findSourceManifestByPath(relativePath);
}

export async function handleAgentChat(text, command) {
  let intent = "QUERY";
  
  if (command) {
    intent = "QUERY";
  } else {
    // 修复乱码问题
    const isEvolve = /纠正|错了|不对|改成|更正|应该是|并不是|重新整理|需要校正/.test(text);
    const isQuery = /是什么|怎么做|为什么|有哪些|推荐|介绍|\?|？|何为|如何|帮我查|搜一下|到底/.test(text);
    
    if (isQuery && !isEvolve) {
      intent = "QUERY";
    } else {
      try { intent = await classifyIntent(text); } catch(e) { console.error("Classify error:", e); }
    }
  }
  
  console.log("[AGENT] Intent Resolved:", intent);
  
  if (intent === "QUERY") {
    
    // Command Branches
    if (command === "WEB_SEARCH") {
      console.log("[AGENT] Interactive Web Search Escalation...");
      const searchResults = await duckDuckGoSearch(text);
      if (searchResults && searchResults.length > 0) {
        const webContext = "Web Search Results:\n" + searchResults.map(r => `Title: ${r.title}\nSnippet: ${r.snippet}\nURL: ${r.url}\n`).join("\n");
        
        return (async function* () {
           yield { intent: "WEB_SEARCH", status: "start" }; 
           let fullAnswer = "";
           for await (const chunk of answerQueryWithLLMStream(text, webContext)) {
              fullAnswer += chunk;
              yield { intent: "WEB_SEARCH", chunk };
           }
           
           if (fullAnswer) {
             const safeTitle = text.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 30);
             const filename = "websearch-" + safeTitle + "-" + Date.now() + ".md";
             const filePath = path.join(workspace.raw, filename);
             const mdFront = ["---", `title: "Web Search: ${text}"`, `sourceType: "web-search"`, `tags: ['auto-generated', 'web-search']`, "---"].join("\n");
             const mdBody = ["# " + text, "## Found Summary", fullAnswer, "## Source Snippets", searchResults.map(r => `> ${r.snippet} [${r.title}](${r.url})`).join("\n\n")].join("\n\n");
             await writeFile(filePath, mdFront + "\n\n" + mdBody + "\n", 'utf8');
             createJob("compile").catch(e => console.log(e));
           }
        })();
      }
      return { type: "chat", intent: "WEB_SEARCH", reply: "Web search did not return usable results." };
    }
    
    if (command === "AI_ANALYZE") {
      console.log("[AGENT] Interactive AI Analyze Escalation...");
      const slug = text.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/gi, '');
      const wikiPath = path.join(workspace.wiki, `${slug}.md`);
      let context = "Graph Context not firmly attached.";
      try {
        context = await readFile(wikiPath, 'utf8');
      } catch(e) {}
      
      return (async function* () {
         yield { intent: "AI_ANALYZE", status: "start" };
         for await (const chunk of answerQueryWithLLMStream(text, context)) {
            yield { intent: "AI_ANALYZE", chunk };
         }
      })();
    }

    // Default Fast Search Branch
    const job = await createJob("query", { question: text, outputKind: "report" });
    const jobPath = path.join(workspace.jobs, job.id + ".json");
    let answer = "查询无返回报告。";
    let suggestedAction = null;

    try {
      const jobData = JSON.parse(await readFile(jobPath, 'utf8'));
      
      if (jobData.evidenceCount === 0) {
        return { 
           type: "chat", 
           intent: "QUERY_MISS", 
           reply: "不好意思，我的本地知识库中没有找到相关记录。\n是否需要为您连线全网搜索？",
           suggestedAction: "WEB_SEARCH"
        };
      }
      
      if (jobData.artifactPath) {
        const rawReport = await readFile(path.join(workspace.wiki, path.basename(jobData.artifactPath)), 'utf8');
        let tempAns = rawReport.split('## Summary')[1] || rawReport;
        tempAns = tempAns.split('## Evidence')[0] || tempAns;
        answer = "【秒级雷达扫描命中】\n\n以下是从底层无序提取的原始网格锚点：\n\n" + tempAns.trim() + "\n\n[SYS] 此时抓取的内容为生拼硬接数据。是否需要消耗算力让大模型做逻辑推演？";
        suggestedAction = "AI_ANALYZE";
      }
    } catch(e) { console.error(e); }
    return { type: "chat", intent: "QUERY", reply: answer.trim(), suggestedAction };
  }

  if (intent === "INGEST" || intent === "EVOLVE") {
    const node = await synthesizeEvolutionNode(text);
    const title = node.title || ("Node " + Date.now());
    const contentText = node.content || text;
    
    const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '-');
    const filename = (intent === "EVOLVE" ? "evo-" : "nanobot-") + safeTitle + "-" + Date.now() + ".md";
    const filePath = path.join(workspace.raw, filename);
    
    const mdFront = ["---", "title: " + JSON.stringify(title), "sourceType: " + JSON.stringify(intent), "tags: ['auto-generated', '" + intent.toLowerCase() + "']", "---"].join("\n");
    const mdBody = ["# " + title, contentText].join("\n\n");
    await writeFile(filePath, mdFront + "\n\n" + mdBody + "\n", 'utf8');
    
    createJob("compile").catch(e => console.log(e));
    
    const reply = intent === "EVOLVE" 
      ? "[Cognitive Mutation] 逻辑修复剂已注入到本体知识网。"
      : "[Nanobot] 原生知识切片已投放到收件箱准备重组。";
      
    return { type: "chat", intent: intent, reply: reply };
  }
  return { type: "chat", intent: "ERROR", reply: "未识别的神经信号" };
}
