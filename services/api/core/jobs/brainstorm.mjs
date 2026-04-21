import path from "node:path";
import { writeFile } from "node:fs/promises";
import { workspace } from "../config.mjs";
import { buildKnowledgeGraph } from "../knowledge-graph.mjs";
import { synthesizeBrainstorming } from "../../llm-client.mjs";
import { slugify } from "../utils.mjs";
import { createJob } from "../jobs.mjs";

function getJaccardSimilarity(setA, setB) {
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

export async function handleBrainstorm(job, payload, timestamp) {
  const allConcepts = await buildKnowledgeGraph();
  
  // Filter out sparse concepts (need at least 1 reliable evidence)
  const concepts = allConcepts.filter(c => c.evidence && c.evidence.length > 0);

  if (concepts.length >= 2) {
    let bestPair = null;
    let lowestSimilarity = 1.1; // Max similarity is 1.0

    // O(N^2) search for the most disjoint pair
    // Shuffle concepts array first to add serendipity if there are multiple Disjoint pairs
    const shuffled = [...concepts].sort(() => 0.5 - Math.random());

    for (let i = 0; i < shuffled.length; i++) {
        for (let j = i + 1; j < shuffled.length; j++) {
            const cA = shuffled[i];
            const cB = shuffled[j];
            const setA = new Set(cA.sourceIds);
            const setB = new Set(cB.sourceIds);
            
            const sim = getJaccardSimilarity(setA, setB);
            
            if (sim < lowestSimilarity) {
                lowestSimilarity = sim;
                bestPair = [cA, cB];
                // If we found completely disjoint sources, break early
                if (sim === 0) break;
            }
        }
        if (lowestSimilarity === 0) break;
    }

    if (bestPair) {
        const [cA, cB] = bestPair;
        
        const contextA = cA.evidence.map(e => e.text).join("\\n");
        const contextB = cB.evidence.map(e => e.text).join("\\n");
        
        const insight = await synthesizeBrainstorming(cA.label, cB.label, contextA, contextB);
        if (insight && insight.title) {
          const titleSlug = slugify(insight.title);
          const randId = Date.now();
          const articleTitle = `Insight ${randId}: ${insight.title}`;
          const outputMarker = `# ${articleTitle}\n\n## 🌌 Evolution Cross-Pollination\n- **A**: [[${cA.label}]]\n- **B**: [[${cB.label}]]\n\n## Core Insight\n${insight.insightSummary}\n\n## Elaboration\n${insight.generatedMarkdown}`;
          
          const pathInsight = path.join(workspace.raw, `insight-${titleSlug}-${randId}.md`);
          await writeFile(pathInsight, outputMarker, 'utf8');
          job.insightSlug = titleSlug;
          job.selectedConcepts = [cA.label, cB.label];
          job.jaccardSimilarity = lowestSimilarity;
          
          await createJob("compile", { trigger: "brainstorm" });
        }
    }
  }
  job.artifactPath = "data/raw";
  job.metrics = {
    ...(job.metrics ?? {}),
    selectedConceptCount: job.selectedConcepts?.length ?? 0,
  };
}
