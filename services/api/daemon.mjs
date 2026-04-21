import { appendFile } from "node:fs/promises";
import { createJob, ensureWorkspace, getNanobotConfig, systemEvents, workspace } from "./workspace.mjs";

let nanobotStatus = {
  enabled: false,
  dryRun: true,
  intervalMs: 30000,
  running: false,
  startedAt: null,
};

function emitLog(kind, msg) {
  console.log(msg);
  systemEvents.emit("sys-log", { kind, msg });
}

async function writeAudit(entry) {
  await ensureWorkspace();
  await appendFile(workspace.nanobotAudit, `${JSON.stringify(entry)}\n`, "utf8");
}

async function dispatchAutomatedJob(type, reason, config) {
  const baseEntry = {
    timestamp: new Date().toISOString(),
    actor: "nanobot",
    type,
    reason,
    dryRun: config.dryRun,
  };

  if (config.dryRun) {
    emitLog("w", `[Nanobot] Dry-run: would dispatch ${type} (${reason}).`);
    await writeAudit({ ...baseEntry, status: "skipped-dry-run" });
    return null;
  }

  const job = await createJob(type, {
    trigger: "nanobot",
    automated: true,
    reason,
  });
  await writeAudit({ ...baseEntry, status: "dispatched", jobId: job.id });
  emitLog("s", `[Nanobot] Automated ${type} dispatched as ${job.id}.`);
  return job;
}

export function getNanobotStatus() {
  return { ...nanobotStatus };
}

export function startNanobot() {
  const config = getNanobotConfig();
  nanobotStatus = {
    ...config,
    running: config.enabled,
    startedAt: new Date().toISOString(),
  };

  if (!config.enabled) {
    emitLog("w", `[Nanobot] Disabled by config. Set NANOBOT_ENABLED=1 to arm background maintenance.`);
    return { stop() {} };
  }

  emitLog("i", `[Nanobot] Guarded mode armed. interval=${config.intervalMs}ms dryRun=${config.dryRun ? "on" : "off"}.`);

  const timer = setInterval(async () => {
    try {
      const random = Math.random();
      if (random < config.brainstormChance) {
        await dispatchAutomatedJob("brainstorm", "random-serendipity-scan", config);
      } else if (random > 1 - config.reconcileChance) {
        await dispatchAutomatedJob("reconcile", "consistency-drift-scan", config);
      } else if (random > 0.45 && random < 0.55) {
        emitLog("i", "[Nanobot] Stable heartbeat. No maintenance action emitted this cycle.");
      }
    } catch (error) {
      const errorMsg = `[Nanobot] Maintenance loop failed: ${error instanceof Error ? error.message : String(error)}`;
      emitLog("e", errorMsg);
      await writeAudit({
        timestamp: new Date().toISOString(),
        actor: "nanobot",
        status: "error",
        message: errorMsg,
      }).catch(() => {});
    }
  }, config.intervalMs);

  return {
    stop() {
      clearInterval(timer);
      nanobotStatus = {
        ...nanobotStatus,
        running: false,
      };
    },
  };
}
