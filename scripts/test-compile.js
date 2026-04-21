const fetch = require('node-fetch') || globalThis.fetch;

async function test() {
  console.log("Triggering compile...");
  const res = await fetch('http://127.0.0.1:3210/jobs/compile', { method: 'POST' });
  console.log("Response:", res.status);
}
test();
