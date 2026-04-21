import fs from 'node:fs';
import path from 'node:path';

// load env
const envContent = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    process.env[match[1]] = match[2].replace(/(^"|"$)/g, '');
  }
}

import { createJob, getJob } from "../services/api/workspace.mjs";

async function run() {
  console.log("Triggering compile background job...");
  const job = await createJob("compile");
  console.log("Job created with ID:", job.id);
  console.log("Waiting for background compile logic...");
  await new Promise(resolve => setTimeout(resolve, 20000));
  console.log("Done");
}
run();
