import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["tsc", "--noEmit"], {
  cwd: process.cwd(),
  encoding: "utf8",
  shell: true,
});

if (result.status !== 0) {
  throw new Error(result.stderr || result.stdout || "tsc --noEmit failed");
}

console.log("typecheck ok: TypeScript compilation succeeded");
