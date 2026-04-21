import path from "node:path";
import { writeFile } from "node:fs/promises";
import { ensureWorkspace, workspace } from "./config.mjs";

import { handleCompile } from "./jobs/compile.mjs";
import { handleResearch } from "./jobs/research.mjs";
import { handleQuery } from "./jobs/query.mjs";
import { handleHealthCheck } from "./jobs/health.mjs";
import { handleReconcile } from "./jobs/reconcile.mjs";
import { handleBrainstorm } from "./jobs/brainstorm.mjs";

const handlers = {
  "compile": handleCompile,
  "research": handleResearch,
  "query": handleQuery,
  "health-check": handleHealthCheck,
  "reconcile": handleReconcile,
  "brainstorm": handleBrainstorm,
};

export async function createJob(type, payload = {}) {
  await ensureWorkspace();
  const timestamp = new Date().toISOString();
  const id = `${type}-${Date.now()}`;
  const job = { id, type, jobType: type, status: "completed", createdAt: timestamp, payload, metrics: {} };

  const handler = handlers[type];
  if (handler) {
    await handler(job, payload, timestamp);
  } else {
    throw new Error(`Unknown job type: ${type}`);
  }

  const jobPath = path.join(workspace.jobs, `${id}.json`);
  await writeFile(jobPath, `${JSON.stringify(job, null, 2)}\n`, "utf8");
  return job;
}
