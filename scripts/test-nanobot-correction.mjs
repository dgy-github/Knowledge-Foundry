import fs from 'node:fs/promises';
const API_URL = "http://127.0.0.1:3210";
async function chat(text) {
  console.log("------------------------");
  console.log("💬 [User]", text);
  try {
    const res = await fetch(API_URL + "/jobs/chat", {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({text})
    });
    const data = await res.json();
    console.log("🤖 [" + data.intent + "]", data.reply);
  } catch(e) {
    console.log("Error:", e.message);
  }
}
async function run() {
  await chat("nanobot 是什么东西 这个是一个框架，需要先矫正 信息啊");
  console.log("等待后台图谱织网 15 秒...");
  await new Promise(r => setTimeout(r, 15000));
  await chat("所以现在请告诉我，nanobot 到底是什么？");
}
run();
