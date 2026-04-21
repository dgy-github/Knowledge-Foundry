import { escapeHtml, showPreview } from "../lib/preview.js";

const canvas = document.getElementById("graphCanvas");

export function initGraph() {
  if (!canvas) return;

  const context = canvas.getContext("2d");
  const clusters = [
    { cx: 0.28, cy: 0.42, color: "#00D4FF", hub: true },
    { cx: 0.55, cy: 0.3, color: "#8B5CF6", hub: true },
    { cx: 0.48, cy: 0.68, color: "#34D399", hub: true },
    { cx: 0.72, cy: 0.55, color: "#60A5FA", hub: false },
    { cx: 0.18, cy: 0.68, color: "#00D4FF", hub: false },
    { cx: 0.65, cy: 0.75, color: "#8B5CF6", hub: false },
  ];

  let nodes = [];
  window.semanticLinks = [];

  function resize() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  function seedGraph() {
    nodes = [];
    clusters.forEach((cluster) => {
      nodes.push({ bx: cluster.cx, by: cluster.cy, x: cluster.cx, y: cluster.cy, vx: 0, vy: 0, r: cluster.hub ? 6.5 : 4.5, color: cluster.color, hub: cluster.hub, phase: Math.random() * Math.PI * 2 });
      const count = cluster.hub ? 12 : 6;
      for (let index = 0; index < count; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 0.16 + 0.04;
        const bx = cluster.cx + Math.cos(angle) * distance;
        const by = cluster.cy + Math.sin(angle) * distance;
        nodes.push({ bx, by, x: bx, y: by, vx: (Math.random() - 0.5) * 0.0004, vy: (Math.random() - 0.5) * 0.0004, r: Math.random() * 2.2 + 1.4, color: cluster.color, hub: false, phase: Math.random() * Math.PI * 2 });
      }
    });
  }

  function updateGraphNodes(items) {
    if (!items?.length) return;

    nodes = [];
    const colors = ["#00D4FF", "#8B5CF6", "#34D399", "#60A5FA", "#FBBF24", "#F87171"];
    const topItems = [...items].sort((left, right) => (right.evidenceCount || 0) - (left.evidenceCount || 0)).slice(0, 15);

    window.semanticLinks = [];
    for (let leftIndex = 0; leftIndex < topItems.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < topItems.length; rightIndex += 1) {
        const leftEvidence = topItems[leftIndex].evidence || [];
        const rightEvidence = topItems[rightIndex].evidence || [];
        const leftSources = new Set(leftEvidence.map((entry) => entry.sourceId || entry.sourceTitle));
        let common = 0;
        rightEvidence.forEach((entry) => {
          if (leftSources.has(entry.sourceId || entry.sourceTitle)) common += 1;
        });
        if (common > 0) {
          window.semanticLinks.push({ source: topItems[leftIndex], target: topItems[rightIndex], weight: common });
        }
      }
    }

    topItems.forEach((item, index) => {
      const cx = 0.15 + Math.random() * 0.7;
      const cy = 0.15 + Math.random() * 0.7;
      const color = colors[index % colors.length];
      nodes.push({ bx: cx, by: cy, x: cx, y: cy, vx: 0, vy: 0, r: 6.5, color, hub: true, phase: Math.random() * Math.PI * 2, item });

      const childCount = Math.min((item.evidenceCount || 1) + 2, 8);
      for (let childIndex = 0; childIndex < childCount; childIndex += 1) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 0.12 + 0.04;
        const bx = cx + Math.cos(angle) * distance;
        const by = cy + Math.sin(angle) * distance;
        nodes.push({ bx, by, x: bx, y: by, vx: (Math.random() - 0.5) * 0.0004, vy: (Math.random() - 0.5) * 0.0004, r: Math.random() * 2.2 + 1.4, color, hub: false, phase: Math.random() * Math.PI * 2, item });
      }
    });
  }

  function drawGraph(time) {
    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);

    if (window.semanticLinks) {
      window.semanticLinks.forEach((link) => {
        const source = nodes.find((node) => node.item === link.source && node.hub);
        const target = nodes.find((node) => node.item === link.target && node.hub);
        if (!source || !target) return;

        context.beginPath();
        context.moveTo(source.x * width, source.y * height);
        context.lineTo(target.x * width, target.y * height);
        context.strokeStyle = `rgba(251, 191, 36, ${Math.min(link.weight * 0.15 + 0.15, 0.9)})`;
        context.lineWidth = Math.min(link.weight * 0.8, 3.5);
        context.setLineDash([4, 4]);
        context.stroke();
        context.setLineDash([]);
      });
    }

    for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
        const left = nodes[leftIndex];
        const right = nodes[rightIndex];
        const dx = (left.x - right.x) * width;
        const dy = (left.y - right.y) * height;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const threshold = left.hub || right.hub ? 110 : 70;
        if (distance >= threshold) continue;

        const alpha = (1 - distance / threshold) * (left.hub || right.hub ? 0.2 : 0.1);
        const color = left.hub ? left.color : right.hub ? right.color : left.color;
        context.beginPath();
        context.moveTo(left.x * width, left.y * height);
        context.lineTo(right.x * width, right.y * height);
        context.strokeStyle = `rgba(${parseInt(color.slice(1, 3), 16)},${parseInt(color.slice(3, 5), 16)},${parseInt(color.slice(5, 7), 16)},${alpha})`;
        context.lineWidth = left.hub || right.hub ? 0.7 : 0.4;
        context.stroke();
      }
    }

    nodes.forEach((node) => {
      node.x += node.vx;
      node.y += node.vy;
      if ((node.x - node.bx > 0.06 && node.vx > 0) || (node.x - node.bx < -0.06 && node.vx < 0)) node.vx *= -0.85;
      if ((node.y - node.by > 0.06 && node.vy > 0) || (node.y - node.by < -0.06 && node.vy < 0)) node.vy *= -0.85;

      const px = node.x * width;
      const py = node.y * height;
      const pulse = Math.sin(time * 0.0015 + node.phase) * 0.35 + 0.75;
      const radius = node.r * pulse;
      const gradient = context.createRadialGradient(px, py, 0, px, py, radius * 5);
      gradient.addColorStop(0, `rgba(${parseInt(node.color.slice(1, 3), 16)},${parseInt(node.color.slice(3, 5), 16)},${parseInt(node.color.slice(5, 7), 16)},.18)`);
      gradient.addColorStop(1, "transparent");

      context.beginPath();
      context.arc(px, py, radius * 5, 0, Math.PI * 2);
      context.fillStyle = gradient;
      context.fill();

      context.beginPath();
      context.arc(px, py, radius, 0, Math.PI * 2);
      context.fillStyle = node.color;
      context.globalAlpha = node.hub ? 0.9 : 0.65;
      context.fill();
      context.globalAlpha = 1;

      if (node.hub) {
        context.beginPath();
        context.arc(px, py, radius + 3, 0, Math.PI * 2);
        context.strokeStyle = `rgba(${parseInt(node.color.slice(1, 3), 16)},${parseInt(node.color.slice(3, 5), 16)},${parseInt(node.color.slice(5, 7), 16)},.3)`;
        context.lineWidth = 1;
        context.stroke();
      }
    });
  }

  resize();
  new ResizeObserver(resize).observe(canvas);
  seedGraph();
  window.updateGraphNodes = updateGraphNodes;

  (function animate(time) {
    drawGraph(time);
    requestAnimationFrame(animate);
  })(0);

  canvas.addEventListener("mousemove", (event) => {
    const rect = canvas.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    let hovered = false;

    for (const node of nodes) {
      if (!node.item) continue;
      if (Math.hypot(mx - node.x * canvas.width, my - node.y * canvas.height) < 15) hovered = true;
    }

    canvas.style.cursor = hovered ? "pointer" : "default";
  });

  canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    let clickedNode = null;
    let minDistance = 15;

    for (const node of nodes) {
      if (!node.item) continue;
      const distance = Math.hypot(mx - node.x * canvas.width, my - node.y * canvas.height);
      if (distance < minDistance) {
        minDistance = distance;
        clickedNode = node;
      }
    }

    if (!clickedNode?.item) return;

    const item = clickedNode.item;
    let details = `<div style="color:var(--purple); font-weight:bold; margin-bottom:10px;">${escapeHtml(item.definition || "")}</div>`;
    if (item.evidence?.length) {
      details += `\n<div style="color:#fff; margin-top:15px; margin-bottom:5px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:5px;">Supporting Evidence:</div>`;
      item.evidence.forEach((evidence) => {
        details += `<div style="background:rgba(0,0,0,0.3); padding:10px; margin-top:5px; border-radius:4px; border-left:2px solid var(--purple);"><div style="color:var(--cyan); font-size:10px; margin-bottom:4px;">Source: ${escapeHtml(evidence.sourceTitle || evidence.sourceId || "Unknown")}</div>${escapeHtml(evidence.text || "")}</div>`;
      });
    }

    showPreview(`Concept: ${escapeHtml(item.label)}`, `Kind: ${escapeHtml(item.kinds?.[0] || item.kind || "unknown")}`, details);
  });
}
