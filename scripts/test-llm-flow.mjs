import fs from 'node:fs/promises';
import { resolve } from 'node:path';

const API_URL = "http://127.0.0.1:3210";
const FILE_PATH = "D:\\\\wx_channel-main\\\\downloads\\\\_ai_reports\\\\parallel_processing\\\\prompts\\\\GitHub_落地项目_全量项目版_最终文档.md";

async function run() {
  console.log("==========================================");
  console.log("🚀 开始全链路 LLM API 测试 (上传 -> 编译 -> 检索)");
  console.log("==========================================\\n");

  console.log("[1/4] 读取生肉文件...");
  let content = "";
  try {
    content = await fs.readFile(FILE_PATH, 'utf8');
    console.log("✅ 成功读取文件，共计 " + content.length + " 个字符。");
  } catch (err) {
    console.error("❌ 无法读取目标文件：", err.message);
    process.exit(1);
  }

  console.log("\\n[2/4] 调用接口上传文件到系统 (POST /sources)...");
  try {
    const ingestRes = await fetch(API_URL + "/sources", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: "GitHub_落地项目测试用",
        sourceType: "markdown",
        content: content
      })
    });
    const ingestData = await ingestRes.json();
    if (!ingestRes.ok) throw new Error(JSON.stringify(ingestData));
    console.log("✅ 上传成功！分配的 Source ID: " + ingestData.id);
  } catch (err) {
    console.error("❌ 上传失败，请检查后台是否在运行 (npm run api:start)：", err.message);
    process.exit(1);
  }

  console.log("\\n[3/4] 召唤大模型启动暴力编译 (POST /jobs/compile) [这可能需要 10~30 秒，请耐心等待]...");
  const startTime = Date.now();
  try {
    const compileRes = await fetch(API_URL + "/jobs/compile", { method: 'POST' });
    const compileData = await compileRes.json();
    if (!compileRes.ok) throw new Error(JSON.stringify(compileData));
    const cost = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log("✅ 编译完成！耗时 " + cost + " 秒。");
    console.log("   - 萃取概念数: " + compileData.conceptCount);
    console.log("   - 已落盘知识图谱路径: " + compileData.artifactPath);
  } catch (err) {
    console.error("❌ 编译过程中断或大模型超时：", err.message);
    process.exit(1);
  }

  console.log("\\n[4/4] 使用大模型进行检索分析 (POST /jobs/query)...");
  try {
    const queryRes = await fetch(API_URL + "/jobs/query", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: "根据刚才的文档，这个项目在落地部署方面遇到了什么坑点和挑战？",
        outputKind: "report"
      })
    });
    const queryData = await queryRes.json();
    if (!queryRes.ok) throw new Error(JSON.stringify(queryData));
    console.log("✅ 检索合成成功！");
    console.log("   - 回答线索梳理: " + queryData.filedWikiPath);
    console.log("   - 详情可前往前端界面查看最新的日志！");
  } catch (err) {
    console.error("❌ 检索合成失败：", err.message);
  }

  console.log("\\n🎉 全链路测试跑通结束！");
}

run();
