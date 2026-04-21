import fs from 'node:fs/promises';

const API_URL = "http://127.0.0.1:3210";
let testCount = 0;
let passCount = 0;

async function chat(id, text, expectedIntentPattern) {
  console.log(`\n--- [Test Case ${id}] ---`);
  console.log(`📥 Input: ${text.slice(0, 80)}...`);
  
  try {
    const res = await fetch(API_URL + "/jobs/chat", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    
    if (!res.ok) {
      console.log(`🔴 FAIL: HTTP Error ${res.status}`);
      return false;
    }
    
    const data = await res.json();
    console.log(`🤖 Intent: ${data.intent}`);
    console.log(`📝 Reply: ${data.reply.slice(0, 100)}...`);
    
    // Check if the intent matches the expected regex/pattern
    if (new RegExp(expectedIntentPattern, 'i').test(data.intent)) {
      console.log(`🟢 PASS`);
      passCount++;
      testCount++;
      return data;
    } else {
      console.log(`🔴 FAIL: Expected intent matching /${expectedIntentPattern}/, got ${data.intent}`);
      testCount++;
      return data;
    }
  } catch (err) {
    console.log(`🔴 FAIL: Exception thrown - ${err.message}`);
    testCount++;
    return false;
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runSuite() {
  console.log("🧬 启动 Hermes Agent 极限边界测试用例集...\n");

  // 【测试用例 1: 复杂意图的模糊边界 (Query vs Ingest)】
  await chat(
    "1-1",
    "话说，微服务的服务网格（Service Mesh）到底和传统的API网关有什么区别啊？我记得有人说网关管南北向，网格管东西向，是这样吗？",
    "QUERY|INGEST" // It's mainly a question, so QUERY is expected, but INGEST is somewhat acceptable due to assertion
  );

  // 【测试用例 2: 极端情绪化长文本的提纯 (Nanobot Ingestion)】
  const rant = "今天真的是气死我了。前端老是埋怨接口慢，搞得我排查了半天。结果你猜怎么着？根本不是数据库查询慢！！而是Redis缓存雪崩了！导致所有的请求全部被打到了MySQL上。所以给我记住这条血泪铁律：在大并发下，必须使用随机过期时间加互斥锁（Mutex）来防止缓存热点失效雪崩！别再让我看到一刀切的TTL设定了！";
  await chat("2-1", rant, "INGEST|EVOLVE");

  console.log("\n⏳ 缓冲 8 秒等待数据凝结...");
  await sleep(8000);

  // 【测试用例 3: 连环打脸测试 (EVOLVE 强行覆盖)】
  await chat(
    "3-1",
    "给我把刚才关于Redis雪崩的记录给抹平。实际上我复盘后发现，那个项目的问题并不是雪崩，而是【缓存击穿】！！解决的终极方案是利用布隆过滤器（Bloom Filter）拦截空请求，根本无需互斥锁！脑子清醒点，把记录改掉！",
    "EVOLVE"
  );

  console.log("\n⏳ 缓冲 15 秒等待高优先级图谱重构...");
  await sleep(15000);

  // 【测试用例 4: Evolve后的即时检索图谱验证 (Query 最新状态)】
  // If the agent correctly evolved, it will answer Bloom Filter instead of Mutex.
  await chat(
    "4-1",
    "如果遇到大并发请求失效被打到数据库上，终极解决方案是什么？",
    "QUERY"
  );

  // 【测试用例 5: 无意义的游离语义屏蔽 (Garbage Input)】
  await chat(
    "5-1",
    "哈哈哈哈哈哈哈哈哈哈哈哈哈哈！！！！我今天吃了个煎饼果子，好辣啊！",
    "INGEST|QUERY" // The LLM may INGEST it as a random diary note or QUERY it since it's just chatter.
  );
  
  console.log(`\n✅ 测试总结: ${passCount} / ${testCount} 测试用例通过。`);
}

runSuite();
