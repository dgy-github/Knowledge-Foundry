# Knowledge Foundry (知识熔炉)

一个基于“Markdown 为先 (Markdown-first)”理念构建的本机大语言模型 (LLM) 知识库系统。这个系统允许你摄取未经加工的研究生肉素材，将其编译提取为结构化概念的 Wiki 词条，执行多轮对话发问，并通过底层 Agent 代理使其随时间推移不断进化、自动脱水去噪。

本项目由 `multi-agent-dev-starter` 脱胎而来，作为一款全自动化的高阶个人第二大脑 (Agentic OS) 独立演进。在最新版本中，已经融合了**实时 SSE 水幕日志**、**MCP 自动化生肉抓取网络**以及基于 **Xenova/M3E 架构的本地向量空间折叠** 能力。

## 核心能力 (What It Does)

- **摄取 (Ingest)**: 通过前端手工录入或 MCP (Model Context Protocol) 自动化通道，将外界长文、网页、聊天片段等各种源头的生肉素材导入至 `data/raw/` 目录。
- **编译与神经坍塌 (Compile)**: 将粗糙的原始素材切块、提取重点，并通过高维向量余弦相似度计算 (>0.88 相似度自动合并)，将同义概念规约为统一的独立神经元节点，保存在 `data/wiki/` 以及 `data/indexes/concepts/` 中。
- **探查 (Query)**: 借助 Agent 驱动的问答管道（Q&A Workflow），实现跨文本的检索和串联推理。
- **繁衍 (Generate)**: 系统自动依据查询或研究路线，在 `data/outputs/` 下生成衍生的知识报告 (Markdown) 或演示文稿 (Slide Decks)。
- **自愈 (Maintain)**: 调度后台的 health-check 作业自动巡检知识网络，猎杀冲突或孤立的数据死链，维持高达 100/100 的健康度。

## 架构布局 (Project Layout)

- `agents/` — System Prompt 中枢（规划师 Planner、架构师 Architect、前端 Frontend、后端 Backend、QA 与审查代码的特化 Agent）
- `apps/web/` — 基于流式 SSE 长连接与原生 JS 构建的“赛博朋克风”前台 HUD 看板
- `services/api/` — 核心发动机引擎：
  - `server.mjs`: 系统 HTTP/SSE 路由分发器
  - `workspace.mjs`: 文件控制中心与本地多模态解析（含 Vector Embedding）引擎
  - `mcp-server.mjs`: 与大模型对话上下文深度绑定的 MCP 扩展探针
- `data/` — 【一切记忆在此】：
  - `raw/` — 最原始的生肉收集箱
  - `wiki/` — 沉淀并且生成出的 Markdown 文档与知识主题
  - `outputs/` — 面向具体问题的定制化汇报输出
  - `indexes/` — 暂存的数据索引（AST Block 层块、概念存储、Jobs执行态等）
- `scripts/` — 提供驱动命令（编排 orchestrator，代码规约 lint 等）
- `specs/` — 项目的设计规范、架构说明与 QA 测试报告存放地

## 闪电启动 (Quick Start)

```bash
npm install
# 安装包含 @xenova/transformers 在内的本地底层依赖引擎

copy .env.example .env
# 按需填写 LLM_API_KEY，或保持为空进入本地兜底模式

npm run orchestrate
# 启动多环境调度节点
```

## 环境变量 (Environment)

- `npm run api:start` 与 `npm run api:mcp` 会读取根目录下的 `.env`。
- 推荐先从 [`.env.example`](D:/knowledge-foundry/.env.example) 复制一份到 `.env` 再改。
- 如果不填 `LLM_API_KEY`，系统会继续工作，但概念抽取和问答增强会回退到本地规则模式。

### 关键开关

- `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL`
  控制 LLM 推理与增强抽取。
- `KNOWLEDGE_CONCEPT_STRATEGY`
  概念抽取策略，支持 `rules`、`llm`、`hybrid`。
- `ENABLE_VECTOR_SEARCH`
  是否启用本地向量重排；首次启用会预热本地 embedding 模型。
- `VECTOR_SEARCH_RERANK_CANDIDATES`
  向量重排候选数，默认 `24`，越大越慢但召回更稳。
- `NANOBOT_ENABLED`
  是否启动后台维护守护线程。
- `NANOBOT_DRY_RUN`
  守护线程是否只记录审计而不真正写入知识库。
- `NANOBOT_INTERVAL_MS`
  心跳间隔，默认 `30000` 毫秒。

### 推荐配置

1. 安全本地模式

```env
LLM_API_KEY=
KNOWLEDGE_CONCEPT_STRATEGY=rules
ENABLE_VECTOR_SEARCH=0
NANOBOT_ENABLED=0
```

2. 平衡混合模式（推荐）

```env
LLM_API_KEY=your_key_here
KNOWLEDGE_CONCEPT_STRATEGY=hybrid
ENABLE_VECTOR_SEARCH=1
VECTOR_SEARCH_RERANK_CANDIDATES=24
NANOBOT_ENABLED=1
NANOBOT_DRY_RUN=1
NANOBOT_INTERVAL_MS=30000
```

3. 自动演化实验模式

```env
LLM_API_KEY=your_key_here
KNOWLEDGE_CONCEPT_STRATEGY=hybrid
ENABLE_VECTOR_SEARCH=1
NANOBOT_ENABLED=1
NANOBOT_DRY_RUN=0
NANOBOT_INTERVAL_MS=60000
```

> 建议先从“平衡混合模式”开始。这样能拿到更好的检索与概念抽取质量，同时避免 nanobot 直接改写知识库。

## 本地服务 (Local Runtime)

- `npm run api:start` — 在 `3210` 端口开启后端全功率服务，开放诸如 `/health`, `/sources`, `/wiki/pages`, `/events (SSE流)`, 以及 MCP/Job 等管线。
- `npm run web:preview` — 开启轻量前台静态站，默认绑定在 `http://127.0.0.1:4173`。
- `npm run dev` — Agent 脑内沙盘打样空转执行（Dry-run）。

## 核心接口 (API Surface)

详见 [`specs/api-contract.yaml`](specs/api-contract.yaml)。几个最核心的高光能力：

- `GET /health` — 侦测当前所有的架构节点运转状态。
- `GET /events` — SSE 核心活水通道！长连接监听系统的神经节提取和向量塌缩信息流。
- `POST /sources` — 给系统主动喂食知识素材。
- `POST /jobs/compile` — 引爆全图谱重新扫描与神经折叠加工作业。
- `POST /jobs/query` — 向底座发出深度提问。
- `GET /search` — 全局词典索引检索。

## 代码免疫机制 (Validation)

- `npm run lint` — 巡检本工程代码，以及校验概念词、标准化格式规则。
- `npm run typecheck` — 基础类型防护。
- `npm run test` — Agent 流水线的模拟运行与 `services/api/server.test.mjs` 服务抗压测试。

## 补充约定 (Notes)

- 核心全自动执行依赖于大模型 API Token（如果是使用专有的 `@openai/codex-sdk` 模式）。否则后台系统会自动降级（Fall back）到本地兜底模式。
- 一切知识都**落盘为可见的文件体系（File-backed）**，全量在 `data/` 目录下。没有任何不可观测的技术黑盒，随时可以使用 Markdown 文档编辑器手工介入。
