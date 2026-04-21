import path from "node:path";
import { writeFile } from "node:fs/promises";
import { workspace } from "../config.mjs";
import { buildKnowledgeGraph } from "../knowledge-graph.mjs";
import { reconcileConcepts } from "../../llm-client.mjs";

export async function handleReconcile(job, payload, timestamp) {
  const concepts = await buildKnowledgeGraph();
  let reconciledCount = 0;
  for (const concept of concepts) {
    if (concept.contradictions && concept.contradictions.length > 0) {
      const context = concept.evidence.map(e => `[${e.sourceTitle}] ${e.text}`).join("\\n");
      for (const contradiction of concept.contradictions) {
          const resolution = await reconcileConcepts(contradiction.summary, context);
          if (resolution && resolution.resolutionSummary) {
            const wikiPath = path.join(workspace.wiki, `${concept.slug}.md`);
            const outputMarker = `\n\n## 🔄 Reconciled Insight\n- **Resolved Contradiction**: ${contradiction.summary}\n- **Conclusion**: ${resolution.resolutionSummary}\n\n${resolution.updatedMarkdown}`;
            try {
              await writeFile(wikiPath, outputMarker, { flag: 'a' });
              reconciledCount++;
            } catch(e) {}
          }
      }
    }
  }
  job.reconciledCount = reconciledCount;
  job.artifactPath = "data/wiki";
  job.metrics = {
    ...(job.metrics ?? {}),
    reconciledCount,
  };
}
