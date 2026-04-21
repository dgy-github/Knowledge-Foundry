import { createJob } from '../services/api/workspace.mjs';

async function test() {
  console.log("Calling createJob...");
  const t = Date.now();
  const job = await createJob("query", { question: "nanoGPT", outputKind: "report" });
  console.log("Done! Time:", Date.now() - t, "ms", job);
}

test().catch(console.error);
