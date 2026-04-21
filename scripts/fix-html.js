const fs = require('fs');

let content = fs.readFileSync('D:\\UI\\knowledge-foundry.html', 'utf8');

content = content.replace('<div class="metric-val">247</div>', '<div class="metric-val" id="metric-raws">0</div>');
content = content.replace('<div class="metric-foot"><span class="up">↑ 14</span> ingested today &nbsp;·&nbsp; 12 pending</div>', '<div class="metric-foot" id="metric-raws-sub">Synced live count</div>');

content = content.replace('<div class="metric-val gradient">1,843</div>', '<div class="metric-val gradient" id="metric-concepts">0</div>');
content = content.replace('<div class="metric-foot">nodes &nbsp;·&nbsp; <span class="up">3,291</span> entity links</div>', '<div class="metric-foot" id="metric-concepts-sub">Computed knowledge nodes</div>');

content = content.replace('<div class="metric-val" style="font-size:32px">85<span style="font-size:16px;color:var(--text-muted)">/100</span></div>', '<div class="metric-val" id="metric-health" style="font-size:32px">100<span style="font-size:16px;color:rgba(255,255,255,0.2)">/100</span></div>');
content = content.replace('<div class="metric-foot">Last lint: 09:41 &nbsp;·&nbsp; <span class="warn">2 islands found</span></div>', '<div class="metric-foot" id="metric-health-sub">Checking QA status...</div>');

content = content.replace('<button class="btn-compile" onclick="startCompile(this)">', '<button class="btn-compile" id="btn-compile">');

content = content.replace(
  /<button class="btn-sec">\s*<span>🔍<\/span> Run QA Health Check\s*<\/button>/,
  '<button class="btn-sec" id="btn-health">\n            <span>🔍</span> Run QA Health Check\n          </button>'
);

content = content.replace(/<script>[\s\S]*?<\/script>/g, '<script type="module" src="./main.js"></script>');

fs.writeFileSync('d:\\knowledge-foundry\\apps\\web\\index.html', content, 'utf8');
console.log('Fixed encoding and replaced content.');
