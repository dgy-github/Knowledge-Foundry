# Knowledge Foundry - 核心架构与资产雷达梳理

本项目 (`knowledge-foundry`) 是一个基于 Local-First (本地优先) 和 Markdown-First (Markdown为核心) 理念构建的 **AI 助理个人知识库引擎**。它并不依赖传统的图数据库或矢量数据库，而是将一切结构化和非结构化知识作为文件（Files）持久化在硬盘上。

---

## 📌 1. 核心定位与运转逻辑
这是一个多 Agent 协同的认知构建系统。
它最核心的运转机制是流水线（Pipeline）加工机制，类似于工业流水线：
`生肉抓取 (Raw) -> 解析切块 (Parsed) -> 拓扑计算与交叉索引 (Concepts) -> 编译输出 (Wiki & Outputs)`。

### 核心亮点：
*   **白盒化系统**：所有记忆节点都暴露为明文的 `.md` 或 `.json` 文件存储在 `data/` 目录下，这意味着它不黑盒，你可以随时使用外部软件（如 Obsidian）直接编辑这些大脑资产。
*   **Pipeline 数据提纯**：利用 `Compile`、`Query`、`Lint` 等作业（Jobs）驱动知识网络的不断演进。
*   **赛博朋克数据看板**：以高密度数据拓扑图、神经纤维节点、终端指令流的方式对用户展现处理状态。

---

## 🏗️ 2. 项目骨架与关键目录扫描

项目的布局非常克制且模块化，分为前后两端和核心业务脚本层。

### 📁 核心应用层 (Apps & Services)
*   `apps/web/`：前端表现层 (Vue/React 未引入，采用纯 Vanilla JS 构建极致轻量的 HUD 看板)。
    *   `index.html`：包含主仪表盘、生肉收件箱、概念神经网络、作业流观测流四个核心视图。
    *   `main.js`：客户端的数据绑定、路由切换与渲染脚本。
*   `services/api/`：后端引擎层 (Node.js)。
    *   `server.mjs`：HTTP 暴露层，承接来自前端 UI 或外部系统的 REST API 请求。
    *   `workspace.mjs`：**（重中之重）**整个项目的大脑。包含了所有的文件读写控制 (FS)、Markdown AST 拆解 (`parseMarkdownSource`)、概念构建 (`buildKnowledgeGraph`)、以及作业队列处理引擎 (`createJob`)。
    *   `llm-client.mjs` / `web-retriever.mjs`：基础的大模型对话包装和网页蜘蛛抓取能力。

### 📁 知识资产层 (Data)
一切数据在此。分为：
*   `data/raw/`：未经大模型提炼的原始素材区（外部文章、网页片段）。
*   `data/instances/` & `data/indexes/`：
    *   `parsed/`：中间产物，将原始素材打碎成块。
    *   `concepts/`：神经节点存储区。包含被高频提及、并且带有强逻辑链接的核心专业术语 (Node Metrics)。

---

## ⚙️ 3. 值得关注的三大核心作业流 (The Job Engine)

当前系统的流转被严格约束在不同类型的 Task Job 里，这是未来扩展更多 Agent 能力的底座：

1.  **编译与重织图谱 (`compile` Job)**
    *   **职责**：读取 `raw` 里的所有新知识 -> `tokenize` 提取关键词 -> 通过质量算分 (`qualityScore`) -> 计算冲突、交叉验证 -> 将结果覆写到 `wiki/` 和 `concepts/` 中。是整个系统的认知基石。
2.  **数据穿透刺探 (`query` Job)**
    *   **职责**：接收到用户的人类发问后，启动搜索流，寻找上下文并推断结论，最终产生在 `outputs/` 中。
3.  **坏死节点猎杀 (`lint` Job / Health-check)**
    *   **职责**：定期巡检现存的拓扑网络，发现孤立的死节点、存在多重歧义的定义（Contradictions）或空内容源，保证神经网格健康度跑满 `100/100`。

---

## 💡 4. 当前瓶颈与下一步进化建议 (Next Steps)

经过对底层 `workspace.mjs` 与前端代码的梳理，我们刚刚完成了**概念提纯清洗**。以此为基础，建议在接下来的迭代中锁定以下目标：

### 🎯 重点 1: 将假 Streaming 替换为真实 WebSocket / SSE
目前 UI 面板上的“暗网数据水幕”（右侧 Drawer log）和 Jobs 任务队列实际上是在靠前端轮询或一次性 Fetch 拉取。
*   **改进**：在 `server.mjs` 中接入 `Server-Sent Events (SSE)`。让 Agent 在分析长文提取概念的过程中，可以将“找到新证据”这个动作实时打字机式地传输给前台 UI。

### 🎯 重点 2: MCP 协议扩展，接入自动化爬虫
当前 `raw` 中的生肉仍然偏向手动投喂。
*   **改进**：我们已经在侧边栏设计了 `MCP 神枢通道`，可以将你电脑上的微信公众号机器人、RSS 订阅源，通过 Model Context Protocol 协议桥接进 `data/raw`，实现完全的“AI全托管被动知识摄入”。

### 🎯 重点 3: 引入真实向量化嵌入 (Vector Embedding) 与 RAG
当前在处理 `concepts` 合并时，我们刚刚采用了**防抖正则表达式**和**字数限制屏障**来防止短句和命令行污染，这是基于字面文本匹配的（BM25 或正则）。
*   **改进**：为了实现更加“赛博朋克”的语义穿透，推荐在 `tokenize()` 之后增加一步本地轻度的 Embeddings 向量映射（例如采用本地 ONNX + M3E 模型）。这能让系统将“LLM”与“大模型”在后端合并成同一个神经节点，提高数据收缩率。
