#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { listKnowledgeFiles, getWikiDetail, searchWorkspace, ingestSource } from "./workspace.mjs";

const server = new McpServer({
  name: "Knowledge-Foundry-MCP",
  version: "0.1.0",
});

server.tool(
  "search_knowledge_base",
  "搜索知识库中的原始资料与 Wiki 页面",
  { query: z.string().describe("要搜索的关键词") },
  async ({ query }) => {
    const results = await searchWorkspace(query);
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    };
  }
);

server.tool(
  "read_wiki_page",
  "读取某篇 Wiki 知识卡片的完整内容",
  { pageId: z.string().describe("Wiki 卡片的 ID，如 target-concept.json") },
  async ({ pageId }) => {
    const detail = await getWikiDetail(pageId);
    return {
      content: [{ type: "text", text: detail ? detail.content : "File not found." }],
    };
  }
);

server.tool(
  "ingest_raw_knowledge",
  "摄入外部生肉内容（如长文、聊天记录或网页），导入知识底座等待编译",
  { 
    title: z.string().describe("生肉标题，如：'10 分钟看懂 AI Agent'"),
    sourceType: z.string().describe("生肉来源类型，比如 'article', 'wechat', 'slack', 等"),
    content: z.string().describe("完整的内容文本"),
  },
  async ({ title, sourceType, content }) => {
    const result = await ingestSource({ title, sourceType, content, importMode: "mcp-agent" });
    return {
      content: [{ type: "text", text: `Successfully ingested source: ${result.id}` }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Knowledge Foundry MCP Server is listening on stdio...");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
