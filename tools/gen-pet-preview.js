/* 生成「自绘桌宠形象」预览页：用 jsdom 真实执行 app.js，取出 nahidaSVG() 的输出渲染成静态 HTML。
   目的：让方案 A 的效果可以被肉眼验收（而不是只看代码）。运行：node tools/gen-pet-preview.js */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const PROJ = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(PROJ, 'index.html'), 'utf8').replace('<script src="app.js"></script>', '');
const APP = fs.readFileSync(path.join(PROJ, 'app.js'), 'utf8');

const dom = new JSDOM(HTML, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window;
w.localStorage.setItem('boji_v7', JSON.stringify({ profile: { weight: 70, height: 170, dumbbell: 10 } }));
const sc = w.document.createElement('script');
sc.textContent = APP;
w.document.body.appendChild(sc);
w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
const svg = w.eval('nahidaSVG');

const MOODS = [
  ['happy', '开心（默认）'], ['cheer', '欢呼（完成动作）'], ['proud', '骄傲（打卡）'],
  ['expect', '期待'], ['think', '思考'], ['sad', '失落（未训练）'],
  ['sleep', '睡眠'], ['wave', '打招呼'], ['hover', '被摸头'], ['drag', '被拖动'],
];
const cards = MOODS.map(([m, label]) => `
  <div class="card">
    <div class="big">${svg(m)}</div>
    <div class="cap"><b>${m}</b> · ${label}</div>
    <div class="sizes">
      <span class="s104">${svg(m)}</span>
      <span class="s64">${svg(m)}</span>
      <span class="s40">${svg(m)}</span>
    </div>
    <div class="cap faint">104px（桌宠实际尺寸） / 64px / 40px（小屏低配）</div>
  </div>`).join('');

const out = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>薄肌日记 · 自绘桌宠形象预览（方案 A 分层 SVG）</title>
<style>
  :root{ --bg:#f7f4fb; --card:#fff; --ink:#4a3f5c; --faint:#9c8fb0; --line:#ece5f4; }
  *{box-sizing:border-box;}
  body{margin:0; padding:24px; background:var(--bg); color:var(--ink);
       font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;}
  h1{font-size:20px; margin:0 0 4px;}
  p.sub{color:var(--faint); font-size:13px; margin:0 0 18px; line-height:1.7;}
  .grid{display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:14px;}
  .card{background:var(--card); border:1px solid var(--line); border-radius:18px; padding:14px; text-align:center;
        box-shadow:0 6px 18px rgba(120,100,150,.08);}
  .big svg{width:120px; height:150px;}
  .cap{font-size:12px; color:var(--ink); margin-top:6px;}
  .cap.faint{color:var(--faint); font-size:10.5px; margin-top:6px;}
  .sizes{display:flex; align-items:flex-end; justify-content:center; gap:14px; margin-top:10px;
         padding-top:10px; border-top:1px dashed var(--line);}
  .s104 svg{width:104px; height:130px;} .s64 svg{width:64px; height:80px;} .s40 svg{width:40px; height:50px;}
  footer{margin-top:20px; font-size:12px; color:var(--faint); line-height:1.8;}
</style></head><body>
<h1>自绘桌宠形象 · 方案 A 分层 SVG</h1>
<p class="sub">全部由 <code>nahidaSVG(mood)</code> 实时生成：一种情绪 = 一组图层参数（眼型 / 嘴型 / 腮红 / 特效），不是 10 张独立图。<br>
零外部依赖、无外链、无脚本，单张约 1.5–2 KB，可无损缩放，支持后续扩展到「捏桌宠」。</p>
<div class="grid">${cards}</div>
<footer>
  生成方式：<code>node tools/gen-pet-preview.js</code>（jsdom 真实执行 app.js 后取值，页面内容是当前代码的真实输出，非手写样例）。<br>
  切换皮肤：App「我的」页 → 桌宠形象（自绘 SVG ⇄ 官方素材）。
</footer>
</body></html>`;

const dest = path.join(PROJ, 'docs', '桌宠形象预览.html');
fs.writeFileSync(dest, out, 'utf8');
const kb = Math.round(Buffer.byteLength(out, 'utf8') / 1024);
console.log('已生成:', dest, kb + ' KB', '| 情绪数:', MOODS.length);
