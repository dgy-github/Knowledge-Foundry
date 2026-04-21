import { fetchOptionalJson } from "./api.js";

const drawer = document.getElementById("preview-drawer");
const btnCloseDrawer = document.getElementById("btn-close-drawer");
const drawerTitle = document.getElementById("drawer-title");
const drawerMeta = document.getElementById("drawer-meta");
const drawerContent = document.getElementById("drawer-content");

export function initPreviewDrawer() {
  btnCloseDrawer?.addEventListener("click", hidePreview);
}

export function hidePreview() {
  if (drawer) drawer.style.right = "-600px";
}

export function showPreview(title, meta, content) {
  if (!drawer || !drawerTitle || !drawerMeta || !drawerContent) return;
  drawerTitle.innerHTML = title;
  drawerMeta.innerHTML = meta;
  drawerContent.innerHTML = content;
  drawer.style.right = "0";
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderPreviewSection(label, content) {
  return `
    <div style="margin-top:18px;">
      <div class="section-label">${escapeHtml(label)}</div>
      <pre style="margin:0; padding:12px; white-space:pre-wrap; word-break:break-word; background:rgba(0,0,0,0.22); border:1px solid rgba(255,255,255,0.06); border-radius:8px; color:rgba(255,255,255,0.82);">${escapeHtml(content || "No content available.")}</pre>
    </div>
  `;
}

function artifactIdFromPath(pathValue) {
  if (typeof pathValue !== "string" || !pathValue.trim()) return null;
  return pathValue.replace(/\\/g, "/").split("/").pop() || null;
}

export async function loadArtifactPreview(pathValue, label = "Artifact") {
  const artifactId = artifactIdFromPath(pathValue);
  if (!artifactId) return null;

  if (pathValue.startsWith("data/wiki/")) {
    const detail = await fetchOptionalJson(`/wiki/pages/${encodeURIComponent(artifactId)}`);
    return detail ? { label, meta: detail.path || pathValue, content: detail.content } : null;
  }

  if (pathValue.startsWith("data/outputs/")) {
    const detail = await fetchOptionalJson(`/outputs/${encodeURIComponent(artifactId)}`);
    return detail ? { label, meta: detail.path || pathValue, content: detail.content } : null;
  }

  return null;
}
