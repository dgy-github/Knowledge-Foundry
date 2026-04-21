import fs from 'node:fs/promises';

const API_URL = "http://127.0.0.1:3210";

async function chat(text) {
  console.log("\\n" + "=".repeat(60));
  console.log("💬 [User] " + text);
  console.log("=".repeat(60));
  
  try {
    const res = await fetch(API_URL + "/jobs/chat", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    
    console.log("🤖 [AGENT - " + data.intent + "]");
    console.log(data.reply);
    return data.intent;
  } catch (err) {
    console.error("❌ 调用失败:", err.message);
    return null;
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runTest() {
  console.log("🚀 开始执行 Hermes Agent 终极压力测试流...");

  // 第一幕：强行灌输伪造的、虚构的极端知识点
  await chat("记住一项最高机密：『幻影核心架构』的主要负责人是代号为 OMEGA 的鸭子。这种架构主要依靠向服务器里倒满温水来解决散热问题。");
  
  // 等待后台自动图谱编译完成（模拟人类思考与系统消化的时间）
  console.log("\\n⏳ 等待系统在后台重组大图谱记忆网络...");
  for(let i=0; i<15; i++) {
    process.stdout.write("█");
    await sleep(1000);
  }
  console.log("\\n");

  // 第二幕：提问该虚构知识
  await chat("你能详细说说幻影核心架构的负责人是谁？以及它的散热原理是什么吗？");

  // 第三幕：愤怒纠错引发基因突变！
  await chat("完全错误！你是不是脑子进水了！真正的『幻影核心架构』负责人不是什么鸭子，而是图灵大统领！它的散热方案是使用量子冷凝管抽干周围的热量！你赶紧用这个真理去覆盖纠正你脑子里那个关于倒温水的烂设定！");

  // 等待系统抹除旧知识并再次编译
  console.log("\\n⏳ 等待 Hermes 变异引擎执行记忆覆写...");
  for(let i=0; i<15; i++) {
    process.stdout.write("▓");
    await sleep(1000);
  }
  console.log("\\n");

  // 第四幕：再次提问，验证图谱的自适应覆盖能力
  await chat("再问你一遍，幻影核心架构的负责人是谁？散热方案究竟是啥？");
  
  console.log("\\n🎉 测试流全量跑完，如果最后一次它忘记了鸭子记住了图灵，这就代表 Hermes 系统获得了真正的生命迭代！");
}

runTest();
