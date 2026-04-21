const fs = require('fs');

const htmlFile = 'd:\\knowledge-foundry\\apps\\web\\index.html';
const jsFile = 'd:\\knowledge-foundry\\apps\\web\\main.js';

let html = fs.readFileSync(htmlFile, 'utf8');
let js = fs.readFileSync(jsFile, 'utf8');

const htmlDict = {
  'AI Brain OS &nbsp;v2.1': 'AI 个人大脑中枢 &nbsp;v2.1',
  'Workspace': '控制舱航点',
  '> Overview<': '> 全景视界<',
  'Raw Inbox': '生肉收件箱',
  'Concept Graph': '概念神经网络',
  'Agent Jobs': '智仆作业流',
  'MCP Bridge': '神枢 MCP 通道',
  'Connected': '神经直连',
  'Control Overview': '核心全景掌控仪',
  'Last synced 2 min ago &nbsp;·&nbsp; <em>All systems nominal</em>': '2 分钟前心跳 &nbsp;·&nbsp; <em>全部伺服运作良好</em>',
  'placeholder="Search knowledge base…"': 'placeholder="在整库知识网中进行多维检索..."',
  'Raw Sources': '待处理渊源',
  'Synced live count': '未清洗的文档碎片',
  'Wiki Concepts': '精炼抽象概念',
  'Computed knowledge nodes': '由大模型提纯的元知识节点',
  'Health QA Score': '信息网格健康度',
  'Checking QA status...': '正在获取巡检探针...',
  'Knowledge Node Graph': '多线程认知拓扑图谱',
  '1843 nodes &nbsp;·&nbsp; 3291 edges': '大模型构建关联计算中...',
  'Agent Activity': '暗网 Agent 指令水幕',
  'Control Center': '主推进阀',
  'Import Raw Data': '倾倒原样数据 (Ingest)',
  'Document Title (e.g. Acme API Docs)': '给这份资料取个代号（例：AGI通用范式论）',
  'Markdown Document': '本地 Markdown 备忘',
  'Web Article / Content': '散落网页与文献片段',
  'Code Repository': '完整源码仓库镜像',
  '>Paste raw text or markdown content here...<': '>把您的粗糙文本、网页正文摘要全部丢进这个反应炉里被提炼...<',
  'Upload to Inbox': '封存进入收件箱',
  '>Live<': '>同频中<',
  '>Streaming<': '>数据流监听<',
  '> 📥 &nbsp;Import Raw Data<': '> 📥 &nbsp;喂入未处理生肉档案<'
};

for (const [en, zh] of Object.entries(htmlDict)) {
  html = html.split(en).join(zh);
}

// Special button replacements in HTML
html = html.replace('<span>⏺</span> Compile Wiki', '<span>⏺</span> 暴力重织整个网络 (Compile)');
html = html.replace('<span>🔍</span> Run QA Health Check', '<span>🔍</span> 释放异常节点侦察兵 (Lint)');
html = html.replace('<span>🧠</span> Deep Semantic Search', '<span>🧠</span> 发动深渊语义钩爪 (Search)');
html = html.replace('<span>📥</span> Import Raw Data', '<span>📥</span> 空投新源资料');


const jsDict = {
  '"Knowledge Foundry API Connected"': '"Knowledge Foundry 赛博总线连接已建立"',
  '"Failed to connect to API"': '"警告：总控机 API 发生熔断"',
  '"Mode: "': '"工作流模式: "',
  '" &nbsp;·&nbsp; QA Cycle: "': '" &nbsp;·&nbsp; 巡检世代: "',
  '"Running..."': '"引力场超载运转中..."',
  '"Dispatched "': '"[指令下达] "',
  '"Completed "': '"[周期收束] 任务ID: "',
  '"Uploading..."': '"量子传输收录中..."',
  '"Source added: "': '"生肉消化完毕，档案序列："',
  '"SYSTEM"': '"矩阵枢纽"',
  '"COMPILE"': '"强压织网"',
  '"HEALTH"': '"逻辑安检"',
  '"INGEST"': '"吞咽数据"',
  '"Untitled Source"': '"无名漂流瓶文件"'
};

for (const [en, zh] of Object.entries(jsDict)) {
  js = js.split(en).join(zh);
}

fs.writeFileSync(htmlFile, html, 'utf8');
fs.writeFileSync(jsFile, js, 'utf8');
console.log('Done Chinese UI trans');
