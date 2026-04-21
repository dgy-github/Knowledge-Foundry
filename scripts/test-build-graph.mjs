import { buildKnowledgeGraph } from '../services/api/workspace.mjs';

async function test() {
  console.log("Starting buildKnowledgeGraph...");
  const t = Date.now();
  const graph = await buildKnowledgeGraph();
  console.log("Done! Graph size:", graph.length, "Time:", Date.now() - t, "ms");
}

test().catch(console.error);
