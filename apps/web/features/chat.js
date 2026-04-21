import { apiBase } from "../lib/api.js";

const btnChat = document.getElementById("btn-chat");
const chatModal = document.getElementById("chat-modal");
const btnCloseChat = document.getElementById("btn-close-chat");
const btnSubmitChat = document.getElementById("btn-submit-chat");
const chatInput = document.getElementById("chat-input");
const chatHistory = document.getElementById("chat-history");

function appendChat(text, type) {
  if (!chatHistory) return null;

  const div = document.createElement("div");
  div.style.padding = "8px 12px";
  div.style.borderRadius = "4px";
  div.style.whiteSpace = "pre-wrap";

  if (type === "user") {
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
  return div;
}

async function executeChat(text, command = null) {
  if (!text || !btnSubmitChat || !chatHistory) return;

  if (!command) appendChat(text, "user");
  if (chatInput) chatInput.value = "";
  btnSubmitChat.disabled = true;

  const loadingId = `loader-${Date.now()}`;
  const loader = document.createElement("div");
  loader.id = loadingId;
  loader.style.color = "rgba(255,255,255,0.4)";
  loader.style.fontSize = "12px";
  loader.style.padding = "4px 12px";
  loader.textContent = command ? `[SYS] Running ${command}...` : "Agent is classifying intent and loading context...";
  chatHistory.appendChild(loader);
  chatHistory.scrollTop = chatHistory.scrollHeight;

  try {
    const response = await fetch(`${apiBase}/jobs/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, command }),
    });

    if (response.headers.get("content-type")?.includes("event-stream")) {
      document.getElementById(loadingId)?.remove();
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let chatDiv = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const dataStr = line.slice(6).trim();
          if (!dataStr || dataStr === "[DONE]") continue;
          try {
            const data = JSON.parse(dataStr);
            if (!chatDiv) {
              const prefix = data.intent ? `[${data.intent}]\n` : "";
              chatDiv = appendChat(prefix, "agent");
            }
            if (data.chunk && chatDiv) {
              chatDiv.textContent += data.chunk;
              chatHistory.scrollTop = chatHistory.scrollHeight;
            }
          } catch {}
        }
      }

      return;
    }

    const data = await response.json();
    document.getElementById(loadingId)?.remove();

    const prefix = data.intent ? `[${data.intent}]\n` : "";
    appendChat(prefix + data.reply, "agent");

    if (data.suggestedAction) {
      const buttonRow = document.createElement("div");
      buttonRow.style.marginTop = "4px";
      buttonRow.style.marginBottom = "12px";
      buttonRow.style.display = "flex";
      buttonRow.style.justifyContent = "flex-start";
      buttonRow.style.marginLeft = "12px";

      const actionButton = document.createElement("button");
      actionButton.style.background = data.suggestedAction === "WEB_SEARCH" ? "var(--purple)" : "var(--green)";
      actionButton.style.color = "#000";
      actionButton.style.border = "none";
      actionButton.style.padding = "6px 12px";
      actionButton.style.borderRadius = "4px";
      actionButton.style.cursor = "pointer";
      actionButton.style.fontSize = "12px";
      actionButton.style.fontWeight = "bold";
      actionButton.style.transition = "opacity 0.2s";
      actionButton.textContent = data.suggestedAction === "WEB_SEARCH" ? "Run Web Search" : "Run AI Analyze";

      actionButton.addEventListener("mouseover", () => {
        actionButton.style.opacity = "0.8";
      });
      actionButton.addEventListener("mouseout", () => {
        actionButton.style.opacity = "1";
      });
      actionButton.onclick = () => {
        actionButton.disabled = true;
        actionButton.style.opacity = "0.4";
        actionButton.style.cursor = "not-allowed";
        void executeChat(text, data.suggestedAction);
      };

      buttonRow.appendChild(actionButton);
      chatHistory.appendChild(buttonRow);
      chatHistory.scrollTop = chatHistory.scrollHeight;
    }
  } catch (error) {
    document.getElementById(loadingId)?.remove();
    appendChat(`[ERROR] ${error.message}`, "agent");
  } finally {
    btnSubmitChat.disabled = false;
  }
}

export function initChat() {
  btnChat?.addEventListener("click", () => {
    if (chatModal) chatModal.style.display = "flex";
    chatInput?.focus();
  });

  btnCloseChat?.addEventListener("click", () => {
    if (chatModal) chatModal.style.display = "none";
  });

  btnSubmitChat?.addEventListener("click", () => {
    void executeChat(chatInput?.value.trim());
  });

  chatInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void executeChat(chatInput.value.trim());
    }
  });
}
