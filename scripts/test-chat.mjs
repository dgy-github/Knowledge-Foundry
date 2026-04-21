import { handleAgentChat } from '../services/api/workspace.mjs';

async function test() {
  console.log("Calling handleAgentChat...");
  const t = Date.now();
  const res = await handleAgentChat("nanoGPT 是什么", null);
  console.log("Done! Time:", Date.now() - t, "ms\\n", res);
}

test().catch(console.error);
