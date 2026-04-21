const fs = require('fs');

const htmlFile = 'd:\\knowledge-foundry\\apps\\web\\index.html';
const jsFile = 'd:\\knowledge-foundry\\apps\\web\\main.js';

let html = fs.readFileSync(htmlFile, 'utf8');
let js = fs.readFileSync(jsFile, 'utf8');

const htmlOld = `<input type="text" id="source-title" class="form-ctrl" placeholder="给这份资料取个代号（例：AGI通用范式论）">
      <select id="source-type" class="form-ctrl">
        <option value="markdown">本地 Markdown 备忘</option>
        <option value="web-article">散落网页与文献片段</option>
        <option value="repo">完整源码仓库镜像</option>
      </select>
      <textarea id="source-content" class="form-ctrl" style="height: 160px; font-family: 'JetBrains Mono', monospace; font-size: 11px; line-height: 1.6; resize: none;" placeholder=">把您的粗糙文本、网页正文摘要全部丢进这个反应炉里被提炼...<"></textarea>`;

const htmlNew = `<label class="form-ctrl" style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; cursor:pointer; background:rgba(0,212,255,0.05); border:1px dashed rgba(0,212,255,0.3); color:var(--cyan); height:80px; transition:all 0.2s;" onmouseover="this.style.background='rgba(0,212,255,0.1)'" onmouseout="this.style.background='rgba(0,212,255,0.05)'">
        <input type="file" id="source-file" accept=".md,.txt,.json,.js,.py,.csv" style="display:none;">
        <span style="font-size:22px;">📂</span>
        <span style="font-weight:600; font-size:12px; letter-spacing:.5px;">点击呼出本地资源管理器装载文件 (Auto Read)</span>
      </label>
      <input type="text" id="source-title" class="form-ctrl" placeholder="代号将从文件自动萃取..." readonly style="opacity:0.6; pointer-events:none; background:rgba(0,0,0,0.2);">
      <select id="source-type" class="form-ctrl" style="display:none;">
        <option value="markdown">本地 Markdown 备忘</option>
        <option value="repo">完整源码仓库镜像</option>
      </select>
      <textarea id="source-content" class="form-ctrl" style="height: 90px; font-family: 'JetBrains Mono', monospace; font-size: 10px; line-height: 1.6; resize: none; opacity:0.6; pointer-events:none; background:rgba(0,0,0,0.2);" placeholder="文件矩阵解析后将在此处进行全息投影..." readonly></textarea>`;

html = html.replace(htmlOld, htmlNew);

const jsOld = `const sourceContentInput = document.getElementById("source-content");`;
const jsNew = `const sourceContentInput = document.getElementById("source-content");
const sourceFileInput = document.getElementById("source-file");

if (sourceFileInput) {
  sourceFileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    sourceTitleInput.value = file.name;
    try { sourceTypeInput.value = file.name.endsWith('.md') ? "markdown" : "repo"; } catch(e){}
    try { sourceContentInput.value = await file.text(); } catch(e){}
    try { appendLog("i", "SYSTEM", \`[传输引流] 提取本地档案序列映射: \${file.name}\`); } catch(e){}
  });
}
`;

js = js.replace(jsOld, jsNew);

fs.writeFileSync(htmlFile, html, 'utf8');
fs.writeFileSync(jsFile, js, 'utf8');
console.log('File picker patch applied');
