# 近期功能更新与操作指南 (Phase 3)

本文档总结了刚刚完成的三项底层技术改造。所有开发均已完毕，请按照以下指南进行测试与对接。

## 1. 核心改进点与受影响文件

本次升级主要修改了以下 3 个核心组件：
- **`services/api/workspace.mjs`**: 引入 `EventEmitter` 全局总线；引入 `@xenova/transformers` 及其对概念节点的嵌入式聚类过滤（Cosine Similarity > 0.88 合并）。
- **`services/api/server.mjs`**: 增加了 `GET /events` (SSE 长连接路由)。
- **`services/api/mcp-server.mjs`**: 暴露出给外部系统操作的 `ingest_raw_knowledge` MCP Tool。
- **`apps/web/main.js`**: 接入 `EventSource` 替换了原有的日志查询机制。

---

## 2. 功能一：SSE 实时日志流验证

**背景**：将原先前端定时轮询的列表变更为由后端主动推送状态的流式系统。
**测试步骤**：
1. 请先在浏览器中选中你的前端看板，按下 `F5` 或 `Cmd+R` **强制刷新页面**（加载最新的 `main.js`）。
2. 点击页面上大蓝色的 **[Compile]** 按钮。
3. 展开右侧的侧边栏（Drawer 控制台），你现在应该能够立刻看到后端通过 SSE 推送过来的一行行带有精确时间戳的日志（不会有轮询等待和卡顿）。

---

## 3. 功能二：向量聚类与概念合并 (Embeddings)

**背景**：系统不仅使用名称全等 BM25 匹配，现在还可以将“语义相同”的短语归于一体。
**工作机制**：
1. 每次触发 `Compile` 操作时，后端会自动拉起 `Xenova/bge-small-zh-v1.5` 引擎计算所有提取到的 Concept 节点的语义 Embedding。
2. 当两个节点余弦相似度 `>0.88`（如：“人工智能”与“AI”），程序会在构建图谱时将其归并至一个目标 `slug` 路径下，从而大幅减少同义碎片。
3. **验证方法**：在触发 `Compile` 期间观察右侧 SSE 日志，能够看到“[XXX] 合并入主神经节 [YYY] (92.5%)”等向量坍缩的提示。

---

## 4. 功能三：MCP 自动化生肉摄取网

**背景**：向外界数据源开放 `data/raw` 的写入权限，允许你在其他系统流中自动导入。
**提供的新 Tool**: `ingest_raw_knowledge`
**接入方法**：
任何能够挂载 MCP 服务的客户端（例如 Cursor、微信监听机器人、或其他 Agent），均可以调用该工具。
入参定义：
```json
{
  "title": "生肉文章标题 (string)",
  "sourceType": "分类标识，例如 'article', 'wechat', 'slack' (string)",
  "content": "生肉正文全量内容 (string)"
}
```
**验证方法**：在 Cursor 中的 MCP 面板直接调用该方法写入测试内容，随后刷新 Web 端，即可在“生肉追踪端 (Raws)”列表里看到对应的记录。
