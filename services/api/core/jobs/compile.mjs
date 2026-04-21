import path from "node:path";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { workspace } from "../config.mjs";
import { getKnowledgeFile, getSourceManifest, listKnowledgeFiles, loadParsedArtifact, loadParsedBlocksArtifact, writeSourceManifest } from "../store.mjs";
import { applyConceptExtractionStrategy, buildQualityBreakdown, parseMarkdownBlocks, parseMarkdownSource, renderSectionBullets } from "../source-analysis.mjs";
import { dedupeStrings, frontmatter, hashContent, relative, slugify, titleCase } from "../utils.mjs";
import { buildKnowledgeGraph } from "../knowledge-graph.mjs";

export async function handleCompile(job, payload, timestamp) {
  const sourceEntries = await listKnowledgeFiles("source");

  const parsedPaths = [];
  const parsedBlockPaths = [];
  const generatedPaths = [];
  const rebuiltSourceIds = [];
  const reusedSourceIds = [];

  for (const sourceEntry of sourceEntries) {
    const source = await getKnowledgeFile("source", sourceEntry.id);
    const manifest = await getSourceManifest(source.id);
    const contentHash = hashContent(source.content);
    const parsedPath = path.join(workspace.parsed, `${source.id}.json`);
    const parsedBlocksPath = path.join(workspace.parsedBlocks, `${source.id}.json`);
    const summaryPath = path.join(workspace.wiki, `source-${slugify(manifest.title || source.title)}.md`);
    const existingParsed = manifest.parsedPath && manifest.contentHash === contentHash ? await loadParsedArtifact(source.id) : null;
    const existingParsedBlocks = manifest.parsedBlocksPath && manifest.contentHash === contentHash ? await loadParsedBlocksArtifact(source.id) : null;
    const shouldRebuild = !existingParsed || !(await stat(summaryPath).then(() => true).catch(() => false));
    const parsed = shouldRebuild
      ? await applyConceptExtractionStrategy(source, manifest, parseMarkdownSource(source, manifest))
      : existingParsed;
    const parsedBlocks = shouldRebuild || !existingParsedBlocks ? parseMarkdownBlocks(source, manifest) : existingParsedBlocks;
    const qualityBreakdown = buildQualityBreakdown({
      status: manifest.qualityScore ? 200 : 0,
      bodyWordCount: parsed.stats.wordCount,
      description: manifest.sourceSummary ?? parsed.excerpt ?? "",
      extractedSummary: manifest.sourceSummary ?? parsed.excerpt ?? "",
      readmeSummary: parsedBlocks.blocks
        .filter((block) => block.sectionPath?.some((item) => /\breadme\b/i.test(item)))
        .slice(0, 3)
        .map((block) => block.text)
        .join(" "),
      kind: manifest.sourceType,
      contentType: source.path.endsWith(".md") ? "text/markdown" : "text/plain",
      blockCount: parsedBlocks.stats.blockCount,
      sectionCount: parsedBlocks.stats.sectionCount,
      taxonomy: parsedBlocks.taxonomy ?? [],
      blockKinds: dedupeStrings(parsedBlocks.blocks.map((block) => block.kind)),
    });

    if (shouldRebuild || !existingParsedBlocks) {
      parsed.parsedAt = timestamp;
      parsedBlocks.generatedAt = timestamp;
      await writeFile(parsedPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
      await writeFile(parsedBlocksPath, `${JSON.stringify(parsedBlocks, null, 2)}\n`, "utf8");
      if (!rebuiltSourceIds.includes(source.id)) rebuiltSourceIds.push(source.id);
    } else {
      reusedSourceIds.push(source.id);
    }

    const relatedConceptLinks = parsed.concepts.map((concept) => `[[${concept.label}]]`);
    await writeFile(
      summaryPath,
      `${frontmatter({
        title: `Source Summary: ${parsed.displayTitle}`,
        slug: `source-${slugify(parsed.displayTitle)}`,
        aliases: [parsed.title, parsed.displayTitle],
        tags: [...parsed.tags, parsed.sourceType, "source-summary"],
        kind: "source-summary",
        sourceId: parsed.sourceId,
      })}# Source Summary: ${parsed.displayTitle}

## Source
- File: \`${source.path}\`
- Type: ${parsed.sourceType}
- Imported via: ${parsed.importMode}
- Quality score: ${qualityBreakdown.totalScore}/100
- Parsed artifact: \`${relative(parsedPath)}\`
- Parsed blocks: \`${relative(parsedBlocksPath)}\`
- Document title: ${parsed.title}
- Content hash: \`${contentHash}\`

## Summary
${parsed.summary || manifest.sourceSummary || parsed.excerpt || "No summary available yet."}

## Quality Breakdown
- Content depth: ${qualityBreakdown.contentDepth}
- Structure quality: ${qualityBreakdown.structureQuality}
- Source authority: ${qualityBreakdown.sourceAuthority}
- Evidence density: ${qualityBreakdown.evidenceDensity}
- Repo signal: ${qualityBreakdown.repoSignal}
- Noise penalty: ${qualityBreakdown.noisePenalty}

## Sections
${renderSectionBullets(parsed.sections.map((section) => `${section.heading} (lines ${section.startLine}-${section.endLine}): ${section.body || "No body captured yet."}`), "No sections parsed")}

## Parsed Blocks
${renderSectionBullets(parsedBlocks.blocks.slice(0, 6).map((block) => `${block.kind} [lines ${block.lineStart}-${block.lineEnd}] ${block.sectionPath?.length ? `${block.sectionPath.join(" > ")}: ` : ""}${block.text}`), "No structured blocks parsed")}

## Key Concepts
${renderSectionBullets(relatedConceptLinks, "No concepts extracted")}

## Extraction Strategy
- Requested: ${parsed.conceptExtraction?.requestedStrategy ?? "rules"}
- Applied: ${parsed.conceptExtraction?.appliedStrategy ?? "rules"}
- LLM Available: ${parsed.conceptExtraction?.llmAvailable ? "yes" : "no"}

## Evidence
${renderSectionBullets(parsed.bullets.slice(0, 4).map((bullet) => `"${bullet.text}" (line ${bullet.quoteSpan.startLine})`), "No bullet evidence extracted")}
`,
      "utf8",
    );

    const nextManifest = {
      ...manifest,
      title: parsed.displayTitle,
      path: source.path,
      parsedPath: relative(parsedPath),
      parsedBlocksPath: relative(parsedBlocksPath),
      summaryPath: relative(summaryPath),
      conceptSlugs: parsed.concepts.map((concept) => concept.slug),
      compileStats: parsed.stats,
      compiledAt: timestamp,
      qualityScore: qualityBreakdown.totalScore,
      qualityBreakdown,
      sourceSummary: parsed.summary || manifest.sourceSummary || parsed.excerpt,
      conceptStrategy: parsed.conceptExtraction?.appliedStrategy ?? "rules",
      contentHash,
    };
    await writeSourceManifest(source.id, nextManifest);


    parsedPaths.push(relative(parsedPath));
    parsedBlockPaths.push(relative(parsedBlocksPath));
    generatedPaths.push(relative(summaryPath));
  }

  const concepts = await buildKnowledgeGraph();
  for (const concept of concepts) {
    const conceptArtifact = {
      ...concept,
      synthesizedAt: timestamp,
    };
    const conceptIndexPath = path.join(workspace.concepts, `${concept.slug}.json`);
    const topicDir = path.join(workspace.topicWiki, concept.slug);
    const conceptPagePath = path.join(topicDir, "index.md");
    const conceptMirrorPath = path.join(workspace.wiki, `${concept.slug}.md`);
    await mkdir(topicDir, { recursive: true });

    await writeFile(conceptIndexPath, `${JSON.stringify(conceptArtifact, null, 2)}\n`, "utf8");
    const conceptPageBody = `${frontmatter({
        title: conceptArtifact.label,
        slug: conceptArtifact.slug,
        aliases: [conceptArtifact.label, ...conceptArtifact.sourceTitles].slice(0, 6),
        tags: [...conceptArtifact.kinds, "topic"],
        kind: "topic",
        sources: conceptArtifact.sourceIds,
      })}# ${conceptArtifact.label}

## Synthesized Concept
This concept page is aggregated from ${conceptArtifact.sourceTitles.length} source(s).

## Quality Signals
- Definition: ${conceptArtifact.definition || "No synthesized definition yet."}
- Evidence nodes: ${conceptArtifact.evidenceCount}
- Supporting sources: ${conceptArtifact.sourceCount}
- Contradictions: ${conceptArtifact.contradictionCount}
- Highest supporting source quality: ${conceptArtifact.qualitySummary.maxSourceQuality}/100
- Average supporting evidence quality: ${conceptArtifact.qualitySummary.averageSourceQuality}/100

## Source Coverage
${renderSectionBullets(conceptArtifact.sourceTitles.map((title) => `[[Source Summary: ${title}]]`), "No supporting sources yet")}

## Section Signals
${renderSectionBullets(conceptArtifact.sectionHeadings, "No section-level signals yet")}

## Source Evidence
${renderSectionBullets(
  conceptArtifact.evidence.map((item) => '"' + item.text + '" from ' + item.sourceTitle + (item.sectionHeading ? ' (' + item.sectionHeading + ')' : '') + (item.taxonomy ? ' <' + item.taxonomy + '>' : '') + ' [lines ' + item.quoteSpan.startLine + '-' + item.quoteSpan.endLine + ']'),
  "No evidence collected yet",
)}

## Contradictions
${renderSectionBullets(
  conceptArtifact.contradictions.map((item) => item.summary),
  "No contradictions detected in the current sources",
)}

## Backlinks
- [[Knowledge Map]]
`;
    await writeFile(conceptPagePath, conceptPageBody, "utf8");
    await writeFile(conceptMirrorPath, conceptPageBody, "utf8");

    generatedPaths.push(relative(conceptPagePath), relative(conceptMirrorPath));
  }

  const wikiPath = path.join(workspace.wiki, "knowledge-map.md");
  const conceptCoverage = [...concepts]
    .sort((left, right) => left.label.localeCompare(right.label))
    .map((concept) => `- [[${concept.label}]] -> \`data/wiki/topics/${concept.slug}/index.md\` covered by ${concept.sourceTitles.length} source(s)`);
  const sourceCoverage = [];
  for (const source of sourceEntries) {
    const manifest = await getSourceManifest(source.id);
    sourceCoverage.push(`- [[Source Summary: ${manifest.title}]] -> ${manifest.conceptSlugs.map((slug) => `[[${titleCase(slug.replace(/-/g, " "))}]]`).join(", ") || "No concepts"}`);
  }

  await writeFile(
    wikiPath,
    `# Knowledge Map

Compiled at ${timestamp}.

## Source Coverage
${sourceCoverage.join("\n") || "- No sources yet"}

## Concept Coverage
${conceptCoverage.join("\n") || "- No concepts generated"}

## Incremental Compile
- Rebuilt sources: ${rebuiltSourceIds.length}
- Reused sources: ${reusedSourceIds.length}

## Parsed Artifacts
${parsedPaths.map((item) => `- \`${item}\``).join("\n") || "- No parsed artifacts"}
`,
    "utf8",
  );

  job.artifactPath = relative(wikiPath);
  job.generatedPaths = [...generatedPaths, relative(wikiPath)];
  job.parsedPaths = parsedPaths;
  job.parsedBlockPaths = parsedBlockPaths;
  job.conceptCount = concepts.length;
  job.metrics = {
    ...(job.metrics ?? {}),
    conceptCount: concepts.length,
    rebuiltSourceCount: rebuiltSourceIds.length,
    reusedSourceCount: reusedSourceIds.length,
  };
  job.rebuiltSourceIds = rebuiltSourceIds;
  job.reusedSourceIds = reusedSourceIds;
}
