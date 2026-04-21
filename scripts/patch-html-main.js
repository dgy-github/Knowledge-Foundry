const fs = require('fs');

// Patch index.html
let htmlFile = 'd:\\knowledge-foundry\\apps\\web\\index.html';
let htmlCode = fs.readFileSync(htmlFile, 'utf8');

const chatModal = `
<!-- chat modal -->
<div id="chat-modal" class="modal-overlay" style="display:none;">
  <div class="modal-content panel" style="width: 500px;">
    <div class="panel-head" style="padding: 18px 22px;">
      <div class="panel-title" style="font-size: 14px; color: #fff;">🧠 &nbsp;全域意图交互中枢 (Chat & Evolve)</div>
      <button class="toast-close" id="btn-close-chat" style="position:relative; top:0; right:0;">✕</button>
    </div>
    <div style="padding: 22px; display: flex; flex-direction: column; gap: 14px;">
      <div id="chat-history" style="height: 200px; overflow-y: auto; display:flex; flex-direction:column; gap:10px; font-size: 12px; font-family:'JetBrains Mono', monospace;">
        <div style="color:var(--cyan); opacity: 0.8;">[SYS] 意图嗅探探针已上线。请输入你要搜索、倾倒的问题或真理纠正指令...</div>
      </div>
      <textarea id="chat-input" class="form-ctrl" style="height: 60px; font-family: 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.6; resize: none;" placeholder="发送指令 (例如：整理什么是并发锁 / 解决策略写错了，必须重构 / 什么是Agent)"></textarea>
      <button class="btn-compile" id="btn-submit-chat" style="margin-top: 8px;">
        <span>☄</span> 脉冲发送 (Dispatch)
      </button>
    </div>
  </div>
</div>
`;

if (!htmlCode.includes('chat-modal')) {
  htmlCode = htmlCode.replace('</body>', chatModal + '\\n</body>');
  fs.writeFileSync(htmlFile, htmlCode, 'utf8');
}

// Patch main.js
let mainFile = 'd:\\knowledge-foundry\\apps\\web\\main.js';
let mainCode = fs.readFileSync(mainFile, 'utf8');

const chatLogic = `
/**
 * Chat Modal Logic
 */
const btnChat = document.getElementById("btn-chat");
const chatModal = document.getElementById("chat-modal");
const btnCloseChat = document.getElementById("btn-close-chat");
const btnSubmitChat = document.getElementById("btn-submit-chat");
const chatInput = document.getElementById("chat-input");
const chatHistory = document.getElementById("chat-history");

if (btnChat) {
  btnChat.addEventListener("click", () => {
    chatModal.style.display = "flex";
    chatInput.focus();
  });
}
if (btnCloseChat) {
  btnCloseChat.addEventListener("click", () => {
    chatModal.style.display = "none";
  });
}

function appendChat(text, type) {
  const div = document.createElement("div");
  div.style.padding = "8px 12px";
  div.style.borderRadius = "4px";
  div.style.whiteSpace = "pre-wrap";
  
  if (type === 'user') {
     div.style.alignSelf = "flex-end";
     div.style.background = "rgba(139,92,246,0.2)";
     div.style.color = "#ddd";
  } else {
     div.style.alignSelf = "flex-start";
     div.style.background = "rgba(52,211,153,0.1)";
     div.style.borderLeft = "2px solid var(--green)";
     div.style.color = "#fff";
  }
  div.textContent = text;
  chatHistory.appendChild(div);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

if (btnSubmitChat) {
  btnSubmitChat.addEventListener("click", async () => {
    const text = chatInput.value.trim();
    if (!text) return;
    
    appendChat(text, 'user');
    chatInput.value = "";
    btnSubmitChat.disabled = true;
    
    // Add temporary loading indicator
    const loadingId = "loader-" + Date.now();
    const loader = document.createElement("div");
    loader.id = loadingId;
    loader.style.color = "rgba(255,255,255,0.4)";
    loader.style.fontSize = "12px";
    loader.textContent = "Agent is classifying intent and processing...";
    chatHistory.appendChild(loader);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    
    try {
      const res = await fetch(\`\${API_BASE}/jobs/chat\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      document.getElementById(loadingId).remove();
      
      const prefix = data.intent ? \`[\${data.intent}] \\n\` : "";
      appendChat(prefix + data.reply, 'agent');
    } catch (e) {
      document.getElementById(loadingId).remove();
      appendChat("[ERROR] 神经突触断开: " + e.message, 'agent');
    } finally {
      btnSubmitChat.disabled = false;
    }
  });
}
`;

if (!mainCode.includes('Chat Modal Logic')) {
  mainCode += '\\n' + chatLogic;
  fs.writeFileSync(mainFile, mainCode, 'utf8');
}

console.log("Patched HTML and Main UI!");
