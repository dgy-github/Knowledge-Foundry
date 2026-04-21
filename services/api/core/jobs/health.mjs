import path from "node:path";
import { writeFile } from "node:fs/promises";
import { workspace } from "../config.mjs";
import { getKnowledgeFile, listKnowledgeFiles, listConceptArtifacts } from "../store.mjs";
import { relative, slugify } from "../utils.mjs";

export async function handleHealthCheck(job, payload, timestamp) {
  const wikiPages = await listKnowledgeFiles("wiki");
  const concepts = await listConceptArtifacts();
  
  const validSlugs = new Set();
  const validLabels = new Set();
  
  // Register concepts
  for (const c of concepts) {
    validSlugs.add(c.slug);
    validLabels.add(c.label.toLowerCase());
  }

  // Register wiki pages
  for (const page of wikiPages) {
    const slug = page.id.replace(/\.md$/, "");
    validSlugs.add(slug);
    validLabels.add(page.title.toLowerCase());
  }

  // "knowledge-map" is always a valid root
  validSlugs.add("knowledge-map");

  const findings = [];
  const incomingLinksCount = new Map();

  for (const page of wikiPages) {
    incomingLinksCount.set(page.id, incomingLinksCount.get(page.id) || 0);

    const fullPage = await getKnowledgeFile("wiki", page.id);
    const content = fullPage.content || "";

    // 1. Empty Node Detection
    const textContent = content.replace(/!\[.*?\]\(.*?\)/g, "").replace(/\[\[.*?\]\]/g, "");
    if (textContent.trim().length < 50 && page.id !== "knowledge-map.md") {
      findings.push({
        severity: "info",
        page: page.path,
        message: "Sparse or empty node detected. Content is too short.",
      });
    }

    // 2. Dead Link Detection
    const linkMatches = content.match(/\[\[(.*?)\]\]/g) || [];
    for (const match of linkMatches) {
      // e.g., "[[Source Summary: Some Title]]"
      const targetLabel = match.slice(2, -2).trim();
      const targetSlug = slugify(targetLabel);

      let targetId = `${targetSlug}.md`;
      if (validSlugs.has(targetSlug) || validLabels.has(targetLabel.toLowerCase())) {
        // Link is valid, log incoming reference
        // Note: multiple links to same topic in same file count multiple times, which is fine for orphan detection
        if (!incomingLinksCount.has(targetId)) incomingLinksCount.set(targetId, 0);
        incomingLinksCount.set(targetId, incomingLinksCount.get(targetId) + 1);
      } else {
        // Dead link
        findings.push({
          severity: "error",
          page: page.path,
          message: `Dead link detected: "${targetLabel}" does not resolve to an existing concept or page.`,
        });
      }
    }
  }

  // 3. Orphan Detection
  for (const page of wikiPages) {
    if (page.id === "knowledge-map.md") continue; // knowledge-map is root
    const count = incomingLinksCount.get(page.id) || 0;
    if (count === 0 && !page.id.startsWith("source-")) {
      // Topic pages or other pages with 0 inbound links
      findings.push({
        severity: "warning",
        page: page.path,
        message: "Orphan node detected. No other pages link to this document.",
      });
    }
  }

  const findingPath = path.join(workspace.health, "latest.json");
  await writeFile(findingPath, `${JSON.stringify({ createdAt: timestamp, findings }, null, 2)}\n`, "utf8");
  job.artifactPath = relative(findingPath);
  job.findingsCount = findings.length;
  job.metrics = {
    ...(job.metrics ?? {}),
    findingsCount: findings.length,
  };
}
