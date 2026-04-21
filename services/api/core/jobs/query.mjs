import path from "node:path";
import { writeFile } from "node:fs/promises";
import { workspace } from "../config.mjs";
import { synthesizeQueryFromGraph } from "../knowledge-graph.mjs";
import { renderSectionBullets } from "../source-analysis.mjs";
import { relative, slugify } from "../utils.mjs";

export async function handleQuery(job, payload, timestamp) {
  const question = payload.question ?? "Untitled question";
  const outputKind = payload.outputKind ?? "report";
  const slug = slugify(question);
  const outputPath = path.join(workspace.outputs, `${slug}.md`);
  const wikiPath = path.join(workspace.wiki, `${slug}.md`);
  const synthesis = await synthesizeQueryFromGraph(question);

  const reportBody = outputKind === "slides"
    ? `---\nmarp: true\n---\n\n# ${question}\n\n---\n\n${synthesis.answer}\n`
    : `# Generated Report\n\n## Question\n${question}\n\n## Graph Answer\n${synthesis.answer}\n\n## Matched Concepts\n${renderSectionBullets(synthesis.matchedConcepts.map((concept) => concept.label + " (" + concept.sourceTitles.length + " source(s))"), "No matching concepts")}\n\n## Evidence\n${renderSectionBullets(synthesis.evidence.map((item) => '"' + item.text + '" from ' + item.sourceTitle + (item.taxonomy ? " <" + item.taxonomy + ">" : "") + " [lines " + item.quoteSpan.startLine + "-" + item.quoteSpan.endLine + "]"), "No graph evidence available")}\n`;
  await writeFile(outputPath, reportBody, "utf8");

  const wikiBody = `# ${question}\n\n## Derived From Query\n- Output artifact: \`${relative(outputPath)}\`\n- Matched concepts: ${synthesis.matchedConcepts.map((concept) => "[[" + concept.label + "]]").join(", ") || "None"}\n\n## Summary\n${synthesis.answer}\n\n## Evidence\n${renderSectionBullets(synthesis.evidence.map((item) => '"' + item.text + '" from ' + item.sourceTitle + (item.taxonomy ? " <" + item.taxonomy + ">" : "")), "No evidence filed")}\n`;
  await writeFile(wikiPath, wikiBody, "utf8");

  job.artifactPath = relative(outputPath);
  job.filedWikiPath = relative(wikiPath);
  job.relatedConcepts = synthesis.matchedConcepts.map((concept) => concept.slug);
  job.evidenceCount = synthesis.evidence.length;
  job.retrieval = synthesis.retrieval;
  job.metrics = {
    ...(job.metrics ?? {}),
    evidenceCount: synthesis.evidence.length,
    matchedConceptCount: synthesis.matchedConcepts.length,
  };
}
