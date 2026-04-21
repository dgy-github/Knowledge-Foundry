const fs = require('fs');

let wsFile = 'd:\\knowledge-foundry\\services\\api\\workspace.mjs';
let wsCode = fs.readFileSync(wsFile, 'utf8');

const target1 = `export async function ingestSource({
  title,
  sourceType,
  content,
  tags = [],
  sourcePath,
  qualityScore = null,
  qualityBreakdown = null,
  sourceSummary = null,
}) {
  await ensureWorkspace();
  const importedPath = typeof sourcePath === "string" ? sourcePath.trim() : "";
  const importedFileName = importedPath ? path.basename(importedPath) : "";
  const importedExt = importedFileName ? path.extname(importedFileName) || ".md" : ".md";
  const safeTitle = title?.trim() || (importedFileName ? titleFromFile(importedFileName) : "Untitled Source");
  const fileName = \`\${slugify(safeTitle)}\${importedPath ? importedExt : ".md"}\`;
  const filePath = path.join(workspace.raw, fileName);
  const now = new Date().toISOString();
  let importMode = "inline";`;

const new1 = `export async function ingestSource({
  title,
  sourceType,
  content,
  base64Data = null,
  tags = [],
  sourcePath,
  qualityScore = null,
  qualityBreakdown = null,
  sourceSummary = null,
}) {
  await ensureWorkspace();
  const importedPath = typeof sourcePath === "string" ? sourcePath.trim() : "";
  const importedFileName = importedPath ? path.basename(importedPath) : "";
  let importedExt = importedFileName ? path.extname(importedFileName) || ".md" : ".md";
  const safeTitle = title?.trim() || (importedFileName ? titleFromFile(importedFileName) : "Untitled Source");

  let ingestedContent = content;
  if (base64Data) {
     const tmpName = \`tmp-\${Date.now()}-\${Math.floor(Math.random()*1000)}\${importedExt}\`;
     const tmpPath = path.join(workspace.raw, tmpName);
     const mdPath = path.join(workspace.raw, \`\${tmpName}.md\`);
     try {
       const buffer = Buffer.from(base64Data, 'base64');
       await writeFile(tmpPath, buffer);
       console.log(\`[MarkItDown] Translating \${tmpName} binary into Markdown...\`);
       const { execSync } = require("node:child_process");
       execSync(\`python -m markitdown "\${tmpPath}" -o "\${mdPath}"\`);
       ingestedContent = await readFile(mdPath, 'utf8');
       importedExt = ".md"; // force it to be markdown moving forward
       
       const fsPromises = require('node:fs/promises');
       await fsPromises.unlink(tmpPath).catch(() => {});
       await fsPromises.unlink(mdPath).catch(() => {});
     } catch (err) {
       console.error("[MarkItDown] Conversion failed:", err.message);
       ingestedContent = \`[MarkItDown 转换错误]\\n\\n\${err.message}\`;
     }
  }

  const fileName = \`\${slugify(safeTitle)}\${importedPath ? importedExt : ".md"}\`;
  const filePath = path.join(workspace.raw, fileName);
  const now = new Date().toISOString();
  let importMode = "inline";`;

const target2 = `  let originalPath = importedPath;
  if (!importedPath) {
    await writeFile(filePath, content, "utf8");
    importMode = "inline";
    originalPath = null;
  } else if (importMode === "copy") {`;

const new2 = `  let originalPath = importedPath;
  if (base64Data || !importedPath) {
    await writeFile(filePath, ingestedContent, "utf8");
    importMode = base64Data ? "binary-extracted" : "inline";
    originalPath = null;
  } else if (importMode === "copy") {`;

if (wsCode.includes('qualityBreakdown = null,')) {
  wsCode = wsCode.replace(target1, new1);
  wsCode = wsCode.replace(target2, new2);
  fs.writeFileSync(wsFile, wsCode);
  console.log("workspace.mjs fully patched for ingest!");
} else {
  console.log("Could not find targets in workspace.mjs");
}
