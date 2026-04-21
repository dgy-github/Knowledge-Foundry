import { fetchJson } from "../lib/api.js";
import { appendLog } from "../lib/logs.js";
import { escapeHtml, loadArtifactPreview, renderPreviewSection, showPreview } from "../lib/preview.js";

const rawSourcesMetric = document.getElementById("metric-raws");
const conceptsMetric = document.getElementById("metric-concepts");
const healthScoreMetric = document.getElementById("metric-health");
const healthSubMetric = document.getElementById("metric-health-sub");

const badgeRaws = document.getElementById("badge-raws");
const badgeConcepts = document.getElementById("badge-concepts");
const badgeJobs = document.getElementById("badge-jobs");

const btnBrainstorm = document.getElementById("btn-brainstorm");
const btnReconcile = document.getElementById("btn-reconcile");
const btnCompile = document.getElementById("btn-compile");
const btnHealth = document.getElementById("btn-health");

const searchInput = document.getElementById("global-search-input");
const btnGlobalSearch = document.getElementById("btn-global-search");

const ingestModal = document.getElementById("ingest-modal");
const btnOpenIngest = document.getElementById("btn-open-ingest");
const btnCloseModal = document.getElementById("btn-close-modal");
const btnSubmitIngest = document.getElementById("btn-submit-ingest");
const sourceTitleInput = document.getElementById("source-title");
const sourceTypeInput = document.getElementById("source-type");
const sourceContentInput = document.getElementById("source-content");
const sourceFileInput = document.getElementById("source-file");

const researchModal = document.getElementById("research-modal");
const btnOpenResearch = document.getElementById("btn-open-research");
const btnCloseResearchModal = document.getElementById("btn-close-research-modal");
const btnSubmitResearch = document.getElementById("btn-submit-research");
const researchTopicInput = document.getElementById("research-topic");
const researchNotesInput = document.getElementById("research-notes");
const researchSeedsInput = document.getElementById("research-seeds");

async function runJob(path, button, tag, options = {}) {
  if (button?.dataset.busy) return null;

  if (button) {
    button.dataset.busy = "1";
    button.dataset.previousHtml = button.innerHTML;
    button.style.color = "#A78BFA";
    button.innerHTML = `<span style="animation:spin .8s linear infinite;display:inline-block">R</span> &nbsp;Running...`;
    button.style.boxShadow = "0 0 30px rgba(139,92,246,.7), 0 0 60px rgba(139,92,246,.25)";
  }

  try {
    appendLog("i", tag, `Dispatched ${path}`);
    const job = await fetchJson(path, options.method ? options : { ...options, method: "POST" });
    appendLog("s", tag, `Completed ${job.id}`);
    await loadDashboard();
    return job;
  } catch (error) {
    appendLog("e", tag, error.message);
    throw error;
  } finally {
    if (button) {
      button.innerHTML = button.dataset.previousHtml || button.innerHTML;
      button.style.color = "";
      button.style.boxShadow = "";
      delete button.dataset.previousHtml;
      delete button.dataset.busy;
    }
  }
}

function maintenanceLabel(maintenance) {
  if (!maintenance?.enabled) return "Nanobot: disabled";
  return maintenance.dryRun ? "Nanobot: dry-run" : "Nanobot: live";
}

export async function loadDashboard() {
  try {
    const health = await fetchJson("/health");
    const counts = health.workspace?.counts ?? {};
    const rawCount = counts.rawSourceCount ?? health.workspace?.rawCount ?? 0;
    const conceptCount = counts.conceptCount ?? health.workspace?.conceptCount ?? 0;
    const jobCount = counts.jobCount ?? health.workspace?.jobCount ?? 0;

    if (rawSourcesMetric) rawSourcesMetric.textContent = rawCount;
    if (badgeRaws) badgeRaws.textContent = rawCount;
    if (conceptsMetric) conceptsMetric.textContent = conceptCount;
    if (badgeConcepts) badgeConcepts.textContent = conceptCount;
    if (badgeJobs) badgeJobs.textContent = jobCount;

    let score = health.status === "ok" || health.status === "online" ? 100 : 0;
    if (health.report?.result === "issues found") score = 85;

    const ringNum = document.querySelector(".ring-num");
    const ringFill = document.querySelector(".ring-fill");
    if (ringNum) ringNum.textContent = score;
    if (ringFill) ringFill.style.strokeDashoffset = 188 - (188 * score) / 100;

    if (healthScoreMetric) {
      healthScoreMetric.innerHTML = `${score}<span style="font-size:16px;color:rgba(255,255,255,0.2)">/100</span>`;
    }
    if (healthSubMetric) {
      healthSubMetric.innerHTML = `Mode: ${health.mode} | QA Cycle: ${health.qaCycle} | ${maintenanceLabel(health.maintenance)}`;
    }

    fetchJson("/concepts")
      .then((result) => {
        if (result.items && window.updateGraphNodes) {
          window.updateGraphNodes(result.items);
        }
      })
      .catch((error) => {
        console.error(error);
      });
  } catch (error) {
    appendLog("e", "ERROR", "Dashboard health check failed.");
  }
}

function initFileInput() {
  sourceFileInput?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (sourceTitleInput) sourceTitleInput.value = file.name;
    if (sourceTypeInput) sourceTypeInput.value = file.name.endsWith(".md") ? "markdown" : "repo";

    if (file.name.toLowerCase().endsWith(".pdf")) {
      if (sourceContentInput) sourceContentInput.value = "Extracting text from PDF (Initializing pdf.js)...";
      appendLog("i", "INGEST", `Processing PDF ${file.name}...`);

      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";

        for (let i = 1; i <= pdf.numPages; i += 1) {
          if (sourceContentInput) sourceContentInput.value = `Extracting PDF page ${i}/${pdf.numPages}...`;
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map((item) => item.str);
          fullText += `${strings.join(" ")}\n\n`;
        }

        if (sourceContentInput) sourceContentInput.value = fullText.trim();
        appendLog("s", "INGEST", `Extracted ${pdf.numPages} pages from PDF ${file.name}`);
      } catch (error) {
        if (sourceContentInput) sourceContentInput.value = `Failed to parse PDF: ${error.message}`;
        appendLog("e", "INGEST", `PDF Error: ${error.message}`);
      }
    } else {
      if (sourceContentInput) sourceContentInput.value = await file.text();
      appendLog("i", "INGEST", `Prepared local file ${file.name}`);
    }
  });
}

function initIngestModal() {
  btnOpenIngest?.addEventListener("click", () => {
    if (ingestModal) ingestModal.style.display = "flex";
  });

  btnCloseModal?.addEventListener("click", () => {
    if (ingestModal) ingestModal.style.display = "none";
  });

  btnSubmitIngest?.addEventListener("click", async () => {
    if (!btnSubmitIngest || btnSubmitIngest.dataset.busy) return;

    btnSubmitIngest.dataset.busy = "1";
    const previousHtml = btnSubmitIngest.innerHTML;
    btnSubmitIngest.innerHTML = `<span style="animation:spin .8s linear infinite;display:inline-block">U</span> &nbsp;Uploading...`;

    try {
      const payload = {
        title: sourceTitleInput?.value.trim() || "Untitled Source",
        sourceType: sourceTypeInput?.value || "markdown",
        content: sourceContentInput?.value.trim() || "",
      };

      const created = await fetchJson("/sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      appendLog("s", "INGEST", `Source added: ${created.id}`);
      if (sourceTitleInput) sourceTitleInput.value = "";
      if (sourceContentInput) sourceContentInput.value = "";
      if (ingestModal) ingestModal.style.display = "none";
      await loadDashboard();
    } catch (error) {
      appendLog("e", "INGEST", error.message);
    } finally {
      btnSubmitIngest.innerHTML = previousHtml;
      delete btnSubmitIngest.dataset.busy;
    }
  });
}

function initResearchModal() {
  btnOpenResearch?.addEventListener("click", () => {
    if (researchModal) researchModal.style.display = "flex";
  });

  btnCloseResearchModal?.addEventListener("click", () => {
    if (researchModal) researchModal.style.display = "none";
  });

  btnSubmitResearch?.addEventListener("click", async () => {
    const topic = researchTopicInput?.value.trim() || "";
    if (!topic) {
      appendLog("w", "RESEARCH", "Topic is required before dispatch.");
      researchTopicInput?.focus();
      return;
    }

    const seedSources = (researchSeedsInput?.value || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    try {
      const job = await runJob("/jobs/research", btnSubmitResearch, "RESEARCH", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          topic,
          notes: researchNotesInput?.value.trim() || "",
          seedSources,
        }),
      });

      if (researchModal) researchModal.style.display = "none";
      if (researchTopicInput) researchTopicInput.value = "";
      if (researchNotesInput) researchNotesInput.value = "";
      if (researchSeedsInput) researchSeedsInput.value = "";

      showPreview(
        `Research: ${escapeHtml(job.topic || topic)}`,
        `Seeds: ${job.metrics?.harvestedSeedCount ?? seedSources.length} | Follow-up: ${escapeHtml(job.followupJobId || "pending")}`,
        [
          renderPreviewSection("Research Job", JSON.stringify(job, null, 2)),
          renderPreviewSection("Harvested Seeds", (job.harvestedSeeds ?? []).map((item) => `${item.title} (${item.kind}) -> ${item.url}`).join("\n") || "No harvested seeds."),
        ].join(""),
      );
    } catch (error) {
      appendLog("e", "RESEARCH", error.message);
    }
  });
}

async function buildSearchResultDetail(result) {
  if (result.kind === "source") {
    const detail = await fetchJson(`/sources/${encodeURIComponent(result.id)}`);
    const summary = await loadArtifactPreview(detail.manifest?.summaryPath, "Compiled Source Summary");
    return [
      renderPreviewSection("Raw Source", detail.content),
      summary ? renderPreviewSection(`${summary.label} (${summary.meta})`, summary.content) : "",
      renderPreviewSection("Source Manifest", JSON.stringify(detail.manifest ?? {}, null, 2)),
    ].join("");
  }

  if (result.kind === "concept") {
    const detail = await fetchJson(`/concepts/${encodeURIComponent(result.id)}`);
    return [
      renderPreviewSection("Definition", detail.definition || "No synthesized definition yet."),
      renderPreviewSection("Evidence", (detail.evidence ?? []).map((item) => `${item.sourceTitle || item.sourceId}: ${item.text}`).join("\n\n") || "No concept evidence."),
      renderPreviewSection("Concept Artifact", JSON.stringify(detail, null, 2)),
    ].join("");
  }

  if (result.kind === "wiki") {
    const detail = await fetchJson(`/wiki/pages/${encodeURIComponent(result.id)}`);
    return renderPreviewSection("Wiki Page", detail.content);
  }

  if (result.kind === "output") {
    const detail = await fetchJson(`/outputs/${encodeURIComponent(result.id)}`);
    return renderPreviewSection("Output Artifact", detail.content);
  }

  if (result.kind === "parsed") {
    const detail = await fetchJson(`/parsed/${encodeURIComponent(result.id)}`);
    return renderPreviewSection("Parsed Artifact", JSON.stringify(detail, null, 2));
  }

  return renderPreviewSection("Search Result", JSON.stringify(result, null, 2));
}

async function renderSearchResults(query, items) {
  showPreview(
    `Search: ${escapeHtml(query)}`,
    `${items.length} hit(s) | Press Enter to re-run`,
    `
      <div style="display:grid; grid-template-columns: 220px 1fr; gap:16px;">
        <div id="search-results-list" style="display:flex; flex-direction:column; gap:8px; max-height:70vh; overflow:auto;"></div>
        <div id="search-result-details" style="min-height:240px;"></div>
      </div>
    `,
  );

  const list = document.getElementById("search-results-list");
  const details = document.getElementById("search-result-details");
  if (!list || !details) return;

  const selectResult = async (result, row) => {
    list.querySelectorAll("[data-search-hit]").forEach((item) => {
      item.style.borderColor = "rgba(255,255,255,0.08)";
      item.style.background = "rgba(255,255,255,0.02)";
    });
    if (row) {
      row.style.borderColor = "rgba(0,212,255,0.35)";
      row.style.background = "rgba(0,212,255,0.06)";
    }

    details.innerHTML = `<div style="opacity:0.5">Loading ${escapeHtml(result.title)}...</div>`;
    details.innerHTML = await buildSearchResultDetail(result);
  };

  items.forEach((item, index) => {
    const row = document.createElement("button");
    row.type = "button";
    row.dataset.searchHit = item.id;
    row.style.textAlign = "left";
    row.style.padding = "10px 12px";
    row.style.borderRadius = "8px";
    row.style.border = "1px solid rgba(255,255,255,0.08)";
    row.style.background = "rgba(255,255,255,0.02)";
    row.style.color = "#fff";
    row.style.cursor = "pointer";
    row.innerHTML = `
      <div style="font-size:12px; font-weight:700; margin-bottom:4px;">${escapeHtml(item.title)}</div>
      <div style="font-size:10px; color:rgba(255,255,255,0.45); margin-bottom:4px;">${escapeHtml(item.kind.toUpperCase())} · Score ${escapeHtml(String(item.score ?? 0))}</div>
      <div style="font-size:10px; color:rgba(255,255,255,0.65); line-height:1.5;">${escapeHtml(item.excerpt || item.path || "")}</div>
    `;
    row.addEventListener("click", () => {
      void selectResult(item, row);
    });
    list.appendChild(row);

    if (index === 0) {
      void selectResult(item, row);
    }
  });
}

async function runGlobalSearch() {
  const query = searchInput?.value.trim() || "";
  if (!query) return;

  try {
    appendLog("i", "SEARCH", `Searching for "${query}"...`);
    const result = await fetchJson(`/search?q=${encodeURIComponent(query)}`);
    if (!result.items?.length) {
      showPreview(`Search: ${escapeHtml(query)}`, "0 hit(s)", renderPreviewSection("Search", "No matching records yet."));
      appendLog("w", "SEARCH", `No local hits for "${query}".`);
      return;
    }
    appendLog("s", "SEARCH", `Found ${result.total} hit(s) for "${query}".`);
    await renderSearchResults(query, result.items);
  } catch (error) {
    appendLog("e", "SEARCH", error.message);
  }
}

function initGlobalSearch() {
  btnGlobalSearch?.addEventListener("click", () => {
    void runGlobalSearch();
  });

  searchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void runGlobalSearch();
    }
  });
}

export function initDashboard() {
  window.appendLog = appendLog;
  appendLog("i", "SYSTEM", "Knowledge Foundry console linked.", true);

  btnBrainstorm?.addEventListener("click", () => {
    void runJob("/jobs/brainstorm", btnBrainstorm, "BRAINSTORM");
  });
  btnReconcile?.addEventListener("click", () => {
    void runJob("/jobs/reconcile", btnReconcile, "RECONCILE");
  });
  btnCompile?.addEventListener("click", () => {
    void runJob("/jobs/compile", btnCompile, "COMPILE");
  });
  btnHealth?.addEventListener("click", () => {
    void runJob("/jobs/health-check", btnHealth, "HEALTH");
  });

  const btnWipe = document.getElementById("btn-wipe");
  btnWipe?.addEventListener("click", async () => {
    if (confirm("⚠️ 警告：此操作将永久删库！将清空所有生肉源文件、提取的知识概念图谱、以及所有大模型生成数据。\n你确定要启动核弹清空吗？")) {
      const prevHtml = btnWipe.innerHTML;
      try {
        btnWipe.innerHTML = "<span>🗑️</span> 清空中...";
        btnWipe.style.opacity = "0.5";
        btnWipe.style.pointerEvents = "none";
        await fetchJson("/workspace/clear", { method: "DELETE" });
        alert("知识库已彻底清空！");
        appendLog("w", "SYSTEM", "Workspace nuked by user.");
        void loadDashboard();
        if (window.updateGraphNodes) {
          window.updateGraphNodes([]);
        }
      } catch (error) {
        alert(`清空失败: ${error.message}`);
      } finally {
        btnWipe.innerHTML = prevHtml;
        btnWipe.style.opacity = "1";
        btnWipe.style.pointerEvents = "auto";
      }
    }
  });

  const evtSource = new EventSource("/sys/events");
  const nanoLog = document.getElementById("nanobot-log");

  if (nanoLog) {
    nanoLog.innerHTML = `<div style="color:rgba(16,185,129,0.5); font-style:italic;">[SYSTEM] Secure websync established. Listening for neural anomalies...</div>`;

    evtSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const div = document.createElement("div");

        let color = "#059669";
        let shadow = "";
        if (data.kind === "w") { color = "#F59E0B"; }
        else if (data.kind === "e") { color = "#EF4444"; shadow = "0 0 5px #ef4444"; }
        else if (data.kind === "s") { color = "#3B82F6"; shadow = "0 0 8px rgba(59,130,246,0.6)"; }
        else if (data.kind === "i") { color = "#10B981"; shadow = "0 0 5px rgba(16,185,129,0.3)"; }

        div.style.color = color;
        div.style.textShadow = shadow;
        div.style.animation = "fade-in-up 0.3s ease-out forwards";
        div.innerHTML = `<span style="opacity:0.4; margin-right:6px;">[${new Date().toLocaleTimeString("en-US", { hour12: false })}]</span> ${escapeHtml(data.msg)}`;

        nanoLog.appendChild(div);

        if (nanoLog.childElementCount > 80) nanoLog.firstElementChild.remove();
        nanoLog.scrollTop = nanoLog.scrollHeight;
      } catch {
        // Ignore malformed SSE chunks.
      }
    };
  }

  initFileInput();
  initIngestModal();
  initResearchModal();
  initGlobalSearch();
  void loadDashboard();
}
