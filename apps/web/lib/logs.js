import { apiBase } from "./api.js";

const logBody = document.getElementById("logBody");

function pad(value) {
  return String(value).padStart(2, "0");
}

function nowStamp() {
  const now = new Date();
  return `[${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}]`;
}

export function appendLog(type, tag, message, instant = false) {
  if (!logBody) return;
  const row = document.createElement("div");
  row.className = `log-row${instant ? "" : " fresh"}`;
  row.innerHTML = `<div class="ldot ${type}"></div><span class="ltime">${nowStamp()}</span><span class="ltag ${type}">${tag}:</span><span class="lmsg">${message}</span>`;
  logBody.appendChild(row);
  logBody.scrollTop = logBody.scrollHeight;
  if (logBody.children.length > 60) logBody.removeChild(logBody.firstChild);
}

export function startSystemEvents() {
  if (!logBody) return null;

  const eventSource = new EventSource(`${apiBase}/events`);
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const div = document.createElement("div");
    div.className = "log-row raw";
    const color = data.kind === "s" ? "var(--cyan)" : data.kind === "i" ? "var(--yellow)" : "var(--green)";
    div.innerHTML = `<span style="color:${color}">[${new Date().toLocaleTimeString()}]</span> ${data.msg || data.message || ""}`;
    logBody.appendChild(div);
    if (logBody.children.length > 200) logBody.removeChild(logBody.firstChild);
    logBody.scrollTop = logBody.scrollHeight;
  };

  return eventSource;
}
