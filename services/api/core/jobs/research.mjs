import { createResearchSource } from "../ingestion.mjs";
import { createJob } from "../jobs.mjs";

export async function handleResearch(job, payload, timestamp) {
  const research = await createResearchSource(payload, timestamp);
  const compileJob = await createJob("compile", { trigger: "research", topic: payload.topic ?? null });
  job.createdSourceId = research.primarySource.id;
  job.createdSourcePath = research.primarySource.path;
  job.harvestedSourceIds = research.harvestedSources.map((item) => item.id);
  job.harvestedSourcePaths = research.harvestedSources.map((item) => item.path);
  job.harvestedSeeds = research.fetchedSeeds;
  job.followupJobId = compileJob.id;
  job.topic = payload.topic?.trim() || "Untitled Research Topic";
  job.artifactPath = compileJob.artifactPath;
  job.metrics = {
    ...(job.metrics ?? {}),
    harvestedSeedCount: research.fetchedSeeds.length,
    harvestedSourceCount: research.harvestedSources.length,
  };
}
