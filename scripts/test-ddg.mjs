import { duckDuckGoSearch } from "../services/api/web-retriever.mjs";
async function run() {
  console.log("Searching ddg...");
  const t = Date.now();
  const res = await duckDuckGoSearch("nanoGPT");
  console.log("Time:", Date.now()-t, "ms");
  console.log(res);
}
run().catch(console.error);
