import { createJob } from './services/api/workspace.mjs';

async function run() {
  try {
    const job = await createJob('compile');
    console.log("Compile Finished:", job);
  } catch (err) {
    console.error("Compile Failed!", err);
  }
}
run();
