const fs = require('fs');

// Patch 1: server.mjs
let serverFile = 'd:\\knowledge-foundry\\services\\api\\server.mjs';
let serverCode = fs.readFileSync(serverFile, 'utf8');

const targetLines = `  return {
    ...body,
    title: requireNonEmptyString(body.title, "title"),
    sourceType: requireNonEmptyString(body.sourceType, "sourceType"),
  };`;

const newLines = `  return {
    ...body,
    title: requireNonEmptyString(body.title, "title"),
    sourceType: requireNonEmptyString(body.sourceType, "sourceType"),
    base64Data: body.base64Data ? body.base64Data : null,
  };`;

if(serverCode.includes(targetLines)) {
  serverCode = serverCode.replace(targetLines, newLines);
  fs.writeFileSync(serverFile, serverCode);
} else {
  console.log("Could not find validation block in server.mjs");
}

// Patch 2: workspace.mjs (ingestion)
let wsFile = 'd:\\knowledge-foundry\\services\\api\\workspace.mjs';
let wsCode = fs.readFileSync(wsFile, 'utf8');

// Need to inject an import for child_process if missing:
if (!wsCode.includes('execSync')) {
  wsCode = wsCode.replace('import path from "node:path";', 'import path from "node:path";\nimport { execSync } from "node:child_process";');
}

// target ingestSource
const ingestTarget = `export async function ingestSource(payload) {
  await ensureWorkspace();
  const id = slugify(payload.title);
  const targetFilesPath = path.join(workspace.sources, \`\${id}.json\`);`;

const ingestNew = `export async function ingestSource(payload) {
  await ensureWorkspace();
  const id = slugify(payload.title);

  // MarkItDown Bridge Check
  if (payload.base64Data) {
    const tmpName = \`tmp-\${Date.now()}-\${Math.floor(Math.random()*1000)}.\${payload.title.split('.').pop()}\`;
    const tmpPath = path.join(workspace.raw, tmpName);
    const mdPath = path.join(workspace.raw, \`\${tmpName}.md\`);
    try {
      const buffer = Buffer.from(payload.base64Data, 'base64');
      await writeFile(tmpPath, buffer);
      
      console.log(\`[MarkItDown] Invoking python parser on \${tmpName}...\`);
      // Warning: if python not configured, will throw and be caught
      execSync(\`python -m markitdown "\${tmpPath}" -o "\${mdPath}"\`);
      
      payload.content = await readFile(mdPath, 'utf8');
      
      const fsSync = await import('node:fs/promises');
      await fsSync.unlink(tmpPath).catch(() => {});
      await fsSync.unlink(mdPath).catch(() => {});
    } catch(err) {
      console.error("[MarkItDown] Failed:", err);
      payload.content = \`[MarkItDown 解析失败/非富文本或 Python 环境异常]\\\\n\\\\n\${err.message}\`;
    }
  }

  const targetFilesPath = path.join(workspace.sources, \`\${id}.json\`);`;

if (wsCode.includes('export async function ingestSource(payload) {')) {
  wsCode = wsCode.replace(ingestTarget, ingestNew);
  fs.writeFileSync(wsFile, wsCode);
} else {
  console.log("Could not find ingestSource in workspace.mjs");
}

// Patch 3: main.js
let mainFile = 'd:\\knowledge-foundry\\apps\\web\\main.js';
let mainCode = fs.readFileSync(mainFile, 'utf8');

const jsTarget = `sourceContentInput.value = await file.text();
  } catch (err) {`;

const jsNew = `if (file.name.match(/\\.(pdf|docx|pptx|xlsx|jpg|png|html)$/i)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        btnSubmitIngest.dataset.base64 = e.target.result.split(',')[1];
        sourceContentInput.value = "[系统提示：由于您选择了富文本媒体文件，已成功挂载 Base64 二进制流。当您点击提交时将唤醒 Python MarkItDown 将其砸扁重铸为 Markdown 知识矩阵。]";
      };
      reader.readAsDataURL(file);
    } else {
      sourceContentInput.value = await file.text();
    }
  } catch (err) {`;

if(mainCode.includes('sourceContentInput.value = await file.text();')) {
  mainCode = mainCode.replace(jsTarget, jsNew);
  
  // also inject base64 submission code:
  const payloadTarget = `    const payload = {
      title: sourceTitleInput.value.trim() || "无名漂流瓶文件",
      sourceType: sourceTypeInput.value,
      content: sourceContentInput.value.trim(),
    };`;
    
  const payloadNew = `    const payload = {
      title: sourceTitleInput.value.trim() || "无名漂流瓶文件",
      sourceType: sourceTypeInput.value,
      content: sourceContentInput.value.trim(),
    };
    if (btnSubmitIngest.dataset.base64) {
      payload.base64Data = btnSubmitIngest.dataset.base64;
      delete btnSubmitIngest.dataset.base64;
    }`;
  
  mainCode = mainCode.replace(payloadTarget, payloadNew);
  fs.writeFileSync(mainFile, mainCode);
} else {
  console.log("Could not find file parsing target in main.js");
}

console.log("Patched all 3 files!");
