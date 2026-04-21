import { fetchJson } from "../lib/api.js";
import { escapeHtml, hidePreview, loadArtifactPreview, renderPreviewSection, showPreview } from "../lib/preview.js";

const navHome = document.getElementById("nav-home");
const navRaws = document.getElementById("nav-raws");
const navConcepts = document.getElementById("nav-concepts");
const navJobs = document.getElementById("nav-jobs");

const viewHome = document.getElementById("view-home");
const viewRaws = document.getElementById("view-raws");
const viewConcepts = document.getElementById("view-concepts");
const viewJobs = document.getElementById("view-jobs");

const badgeRaws = document.getElementById("badge-raws");
const badgeConcepts = document.getElementById("badge-concepts");
const badgeJobs = document.getElementById("badge-jobs");

const listRaws = document.getElementById("list-raws");
const listConcepts = document.getElementById("list-concepts");
const listJobs = document.getElementById("list-jobs");

const cardRaws = document.getElementById("card-raws");
const cardConcepts = document.getElementById("card-concepts");
const cardHealth = document.getElementById("card-health");

const conceptFilterChips = document.getElementById("chips-concepts");
const jobFilterChips = document.getElementById("chips");
const rawFilterChips = document.getElementById("chips-raws");

function applyFilter(container, selector) {
  container?.addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip) return;

    container.querySelectorAll(".chip").forEach((item) => item.classList.remove("active"));
    chip.classList.add("active");

    const filter = chip.dataset.filter;
    document.querySelectorAll(selector).forEach((row) => {
      row.style.display = filter === "all" || row.dataset.type === filter ? "" : "none";
    });
  });
}

function setSelectedRows(selector, selectedRow) {
  document.querySelectorAll(selector).forEach((row) => row.classList.remove("selected"));
  selectedRow.classList.add("selected");
}

export function switchView(targetViewId) {
  [viewHome, viewRaws, viewConcepts, viewJobs].forEach((view) => {
    if (view) view.style.display = "none";
  });
  [navHome, navRaws, navConcepts, navJobs].forEach((nav) => nav?.classList.remove("active"));
  hidePreview();

  if (targetViewId === "raws") {
    if (viewRaws) viewRaws.style.display = "grid";
    navRaws?.classList.add("active");
    void loadRaws();
    return;
  }

  if (targetViewId === "concepts") {
    if (viewConcepts) viewConcepts.style.display = "grid";
    navConcepts?.classList.add("active");
    void loadConcepts();
    return;
  }

  if (targetViewId === "jobs") {
    if (viewJobs) viewJobs.style.display = "grid";
    navJobs?.classList.add("active");
    void loadJobs();
    return;
  }

  if (viewHome) viewHome.style.display = "grid";
  navHome?.classList.add("active");
}

export function initViews() {
  navHome?.addEventListener("click", () => switchView("home"));
  navRaws?.addEventListener("click", () => switchView("raws"));
  navConcepts?.addEventListener("click", () => switchView("concepts"));
  navJobs?.addEventListener("click", () => switchView("jobs"));

  cardRaws?.addEventListener("click", () => switchView("raws"));
  cardConcepts?.addEventListener("click", () => switchView("concepts"));
  cardHealth?.addEventListener("click", () => document.getElementById("btn-health")?.click());

  applyFilter(conceptFilterChips, "#list-concepts .concept-row");
  applyFilter(jobFilterChips, "#list-jobs .job-row");
  applyFilter(rawFilterChips, "#list-raws .raw-row");
  switchView("home");
}

export async function loadRaws() {
  if (!listRaws) return;
  listRaws.innerHTML = "<div style='opacity:0.5'>Loading raw sources...</div>";

  try {
    const { items } = await fetchJson("/sources");
    if (badgeRaws) badgeRaws.textContent = items.length;
    listRaws.innerHTML = "";

    items.forEach((item) => {
      const row = document.createElement("div");
      let rawType = (item.sourceType || item.kind || "markdown").toLowerCase();
      if (item.id.toLowerCase().startsWith("insight-")) {
        rawType = "insight";
      }
      row.className = `raw-row ${rawType === "insight" ? "ai-evolved-row" : ""}`;
      row.dataset.type = rawType;
      
      const typeDisplay = rawType.toUpperCase();
      let icon = "📄";
      let evolvesBadge = "";
      if (rawType.includes("insight")) {
        icon = "🌌";
        evolvesBadge = `<div style="background: rgba(0,212,255,0.15); border: 1px solid rgba(0,212,255,0.4); padding: 2px 8px; border-radius: 4px; color: #00D4FF; font-size: 9.5px; font-weight: 700; margin-bottom: 6px; display: inline-block;">✨ AI EVOLVED</div>`;
      } else if (typeDisplay.includes("REPO") || typeDisplay.includes("GITHUB")) {
        icon = "📦";
      }
      
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:14px; flex:1; min-width:0;">
          <div style="width:36px; height:36px; border-radius:10px; background:rgba(0,212,255,0.08); border:1px solid rgba(0,212,255,0.2); display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; box-shadow: 0 0 10px rgba(0,212,255,0.1);">${icon}</div>
          <div style="flex:1; min-width:0;">
            ${evolvesBadge}
            <div style="font-weight:700; color:#fff; font-size:14px; margin-bottom:4px; font-family:'Outfit', sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(item.title || item.id)}</div>
            <div style="font-size:10.5px; color:var(--text-muted); font-family:'JetBrains Mono', monospace;">ID: <span style="color:rgba(255,255,255,0.3)">${escapeHtml(item.id)}</span></div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:12px; flex-shrink:0;">
          <span class="tag" style="background:rgba(255,255,255,0.03); border-color:rgba(255,255,255,0.08); color:var(--text-muted); padding:3px 12px; font-size:10.5px;">TYPE / ${typeDisplay}</span>
          <button class="btn-delete-source" style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#FCA5A5; border-radius:6px; padding:4px 8px; font-size:12px; cursor:pointer; display:flex; align-items:center; gap:4px;" title="Delete Source">
            <span>🗑️</span>
          </button>
        </div>
      `;
      
      const deleteBtn = row.querySelector('.btn-delete-source');
      deleteBtn.onclick = async (e) => {
        e.stopPropagation();
        if (confirm(`确定要永久删除 ${escapeHtml(item.title || item.id)} 吗？`)) {
          const prevHtml = deleteBtn.innerHTML;
          deleteBtn.innerHTML = "⌛";
          deleteBtn.style.opacity = "0.5";
          try {
            await fetchJson(`/sources/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
            row.style.opacity = "0";
            setTimeout(() => row.remove(), 200);
            window.appendLog?.("s", "SYSTEM", `Deleted source ${item.id}`);
          } catch (err) {
            alert("删除失败: " + err.message);
            deleteBtn.innerHTML = prevHtml;
            deleteBtn.style.opacity = "1";
          }
        }
      };

      row.onclick = async () => {
        const detail = await fetchJson(`/sources/${encodeURIComponent(item.id)}`);
        const summary = await loadArtifactPreview(detail.manifest?.summaryPath, "Compiled Source Summary");
        const content = [
          renderPreviewSection("Raw Source", detail.content),
          summary ? renderPreviewSection(`${summary.label} (${summary.meta})`, summary.content) : "",
          renderPreviewSection("Source Manifest", JSON.stringify(detail.manifest ?? {}, null, 2)),
        ].join("");
        showPreview(`Source: ${escapeHtml(item.title || item.id)}`, `Type: ${escapeHtml(detail.manifest?.sourceType || item.sourceType || item.kind)} | Path: ${escapeHtml(detail.path)}`, content);
      };
      listRaws.appendChild(row);
    });
  } catch (error) {
    listRaws.innerHTML = `<div style='color:var(--red)'>Error: ${escapeHtml(error.message)}</div>`;
  }
}

export async function loadConcepts() {
  if (!listConcepts) return;
  listConcepts.innerHTML = "<div style='opacity:0.5; padding:20px'>Loading concept graph...</div>";

  try {
    const { items } = await fetchJson("/concepts");
    if (badgeConcepts) badgeConcepts.textContent = items.length;
    const total = document.getElementById("cntConceptsTotal");
    if (total) total.textContent = items.length;
    const metricConcepts = document.getElementById("metric-concepts");
    if (metricConcepts) metricConcepts.textContent = items.length;
    listConcepts.innerHTML = "";

    items.forEach((item) => {
      const row = document.createElement("div");
      const kind = item.kinds?.[0] || item.kind || "unknown";
      const evidenceCount = item.evidenceCount ?? item.evidence?.length ?? 0;
      const sourceCount = item.sourceCount ?? item.sourceTitles?.length ?? 0;
      const contradictionCount = item.contradictionCount ?? item.contradictions?.length ?? 0;
      row.className = `concept-row ${kind === "insight" ? "ai-evolved-row" : ""}`;
      row.dataset.type = kind;
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="font-size:18px; color:var(--purple); filter:drop-shadow(0 0 5px var(--purple));">N</div>
          <div style="font-weight:600; color:#fff; font-size:13.5px; font-family:'Inter', sans-serif;">${escapeHtml(item.label)}</div>
        </div>
        <div>
          <span class="tag" style="background:rgba(255,255,255,0.04); border-color:rgba(255,255,255,0.1); color:var(--text-muted);">[${escapeHtml(kind.toUpperCase())}]</span>
        </div>
        <div style="text-align:right;">
          <div style="color:${evidenceCount > 2 ? "var(--cyan)" : "var(--text-muted)"}; font-family:'JetBrains Mono', monospace; font-size:12px;">Weight: ${evidenceCount}</div>
        </div>
      `;

      row.onclick = () => {
        setSelectedRows("#list-concepts .concept-row", row);

        let details = `
          <div>
            <div class="section-label">Concept Summary</div>
            <div class="terminal">
              <div class="term-head">
                <div class="term-dot" style="background:#F87171"></div><div class="term-dot" style="background:#FBBF24"></div><div class="term-dot" style="background:#34D399"></div><div class="term-title">sys-log</div>
              </div>
              <div class="term-body">
                <div class="tl"><span class="tl-msg ok">Kind:</span> <span class="mono">${escapeHtml(kind)}</span></div>
                <div class="tl"><span class="tl-msg ok">Evidence nodes:</span> <span class="mono">${evidenceCount}</span></div>
                <div class="tl"><span class="tl-msg ok">Supporting sources:</span> <span class="mono">${sourceCount}</span></div>
                <div class="tl"><span class="tl-msg ok">Contradictions:</span> <span class="mono">${contradictionCount}</span></div>
              </div>
            </div>
          </div>
          <div style="margin-top:20px;">
            <div class="section-label">Evidence Matrix</div>
            <div class="params-grid" style="display:flex; flex-direction:column; gap:8px;">`;

        if (item.evidence?.length) {
          item.evidence.forEach((evidence) => {
            details += `<div style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.05); border-left:3px solid var(--purple); padding:12px; border-radius:6px;"><div style="color:var(--cyan); font-size:10px; margin-bottom:6px; font-family:'JetBrains Mono', monospace;">Source: ${escapeHtml(evidence.sourceTitle || evidence.sourceId || "Unknown")}</div><div style="font-size:12px; line-height:1.6; color:rgba(255,255,255,0.85);">${escapeHtml(evidence.text || "")}</div></div>`;
          });
        } else {
          details += `<div class="param-row"><div class="param-key">status</div><div class="param-val mono">"No explicit evidence base referenced"</div></div>`;
        }

        if (item.definition) {
          details = `
            <div>
              <div class="section-label">Definition</div>
              <div class="params-grid"><div class="param-row"><div class="param-key">definition</div><div class="param-val mono">${escapeHtml(item.definition)}</div></div></div>
            </div>
          ` + details;
        }

        details += "</div></div>";
        showPreview(`Concept: ${escapeHtml(item.label)}`, `Type: ${escapeHtml(kind.toUpperCase())}`, details);
      };

      listConcepts.appendChild(row);
    });

    if (window.updateGraphNodes) window.updateGraphNodes(items);
  } catch (error) {
    listConcepts.innerHTML = `<div style='color:var(--red)'>Error: ${escapeHtml(error.message)}</div>`;
  }
}

export async function loadJobs() {
  if (!listJobs) return;
  listJobs.innerHTML = "<div style='opacity:0.5; padding:20px'>Loading background operations...</div>";

  try {
    const { items } = await fetchJson("/jobs");
    if (badgeJobs) badgeJobs.textContent = items.length;
    listJobs.innerHTML = "";

    let completedCount = 0;
    let runningCount = 0;
    let failedCount = 0;

    items.reverse().forEach((item) => {
      const type = (item.jobType || item.kind || item.type || "job").toLowerCase();
      let marker = "C";
      let typeClass = "compile";
      if (type.includes("query")) {
        marker = "Q";
        typeClass = "query";
      } else if (type.includes("health") || type.includes("lint")) {
        marker = "L";
        typeClass = "lint";
      } else if (type.includes("research")) {
        marker = "R";
        typeClass = "query";
      } else if (type.includes("brainstorm")) {
        marker = "B";
        typeClass = "query";
      } else if (type.includes("reconcile")) {
        marker = "H";
        typeClass = "lint";
      }

      const shortId = item.id ? item.id.split("-").pop().slice(-6) : "xxxxxx";
      const rel = (item.createdAt ? new Date(item.createdAt) : new Date()).toTimeString().slice(0, 8);
      const status = item.status || "completed";
      if (status === "completed") completedCount += 1;
      else if (status === "running" || status === "pending") runningCount += 1;
      else failedCount += 1;

      const statusMap = { completed: "Completed", running: "Running", pending: "Queued", failed: "Failed" };
      const statusText = statusMap[status] || status;
      const statusHtml = `<div class="status ${status === "pending" ? "running" : status}"><div class="sdot"></div>${escapeHtml(statusText)}</div>`;

      const row = document.createElement("div");
      row.className = `job-row ${status === "running" || status === "pending" ? "running" : ""}`;
      row.dataset.type = typeClass;
      const evidenceMetric = item.metrics?.evidenceCount ?? item.evidenceCount ?? 0;
      row.innerHTML = `
        <div class="job-left">
          <div class="job-icon ${typeClass}">${marker}</div>
          <span class="job-type ${typeClass}">[${escapeHtml(type.toUpperCase())}]</span>
        </div>
        <div class="job-mid">
          <div class="job-id"><span>${escapeHtml(type)}-</span>#${escapeHtml(shortId)}</div>
          <div class="job-tags">
            <span class="tag">Evidence: ${evidenceMetric}</span>
            ${status === "failed" ? '<span class="tag" style="color:var(--red);border-color:rgba(248,113,113,.2);background:rgba(248,113,113,.06)">Stack Error</span>' : ""}
          </div>
        </div>
        <div class="job-right">
          <div class="job-time">
            <div class="rel">${escapeHtml(rel)}</div>
            <div class="dur">-</div>
          </div>
          ${statusHtml}
        </div>
        ${status === "running" || status === "pending" ? '<div class="job-progress"><div class="job-progress-bar"></div></div>' : ""}
      `;

      row.onclick = async () => {
        setSelectedRows("#list-jobs .job-row", row);
        const detail = await fetchJson(`/jobs/${encodeURIComponent(item.id)}`);
        const primaryArtifact = await loadArtifactPreview(detail.artifactPath, "Primary Artifact");
        const filedWiki = await loadArtifactPreview(detail.filedWikiPath, "Filed Wiki");
        const payload = detail.payload ?? detail.parameters ?? item.payload ?? item.parameters ?? {};
        const payloadRows = Object.keys(payload).length
          ? Object.entries(payload)
              .map(([key, value]) => `<div class="param-row"><div class="param-key">${escapeHtml(key)}</div><div class="param-val mono">${escapeHtml(JSON.stringify(value))}</div></div>`)
              .join("")
          : `<div class="param-row"><div class="param-key">payload</div><div class="param-val mono">"{}"</div></div>`;

        let details = `
          <div>
            <div class="section-label">Payload</div>
            <div class="params-grid">${payloadRows}</div>
          </div>
          <div>
            <div class="section-label">Terminal Flow</div>
            <div class="terminal">
              <div class="term-head">
                <div class="term-dot" style="background:#F87171"></div><div class="term-dot" style="background:#FBBF24"></div><div class="term-dot" style="background:#34D399"></div><div class="term-title">sys-log</div>
              </div>
              <div class="term-body">
                <div class="tl"><span class="tl-t">${escapeHtml(rel)}</span><span class="tl-step">[INIT]</span><span class="tl-msg ok">Job detail loaded.</span></div>
                <div class="tl"><span class="tl-t">${escapeHtml(rel)}</span><span class="tl-step">[DUMP]</span><span class="tl-msg">${escapeHtml(JSON.stringify(payload, null, 2))}</span></div>
              </div>
            </div>
          </div>
        `;

        if (primaryArtifact) {
          details += renderPreviewSection(`${primaryArtifact.label} (${primaryArtifact.meta})`, primaryArtifact.content);
        }
        if (filedWiki) {
          details += renderPreviewSection(`${filedWiki.label} (${filedWiki.meta})`, filedWiki.content);
        }
        details += renderPreviewSection("Job Record", JSON.stringify(detail, null, 2));

        showPreview(`Job #${escapeHtml(shortId)}`, `Status: ${escapeHtml(statusText)}`, details);
      };

      listJobs.appendChild(row);
    });

    const completedEl = document.getElementById("cntCompleted");
    const runningEl = document.getElementById("cntRunning");
    const failedEl = document.getElementById("cntFailed");
    if (completedEl) completedEl.textContent = completedCount;
    if (runningEl) runningEl.textContent = runningCount;
    if (failedEl) failedEl.textContent = failedCount;
  } catch (error) {
    listJobs.innerHTML = `<div style='color:var(--red); padding:20px'>Error: ${escapeHtml(error.message)}</div>`;
  }
}
