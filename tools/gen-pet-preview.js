/* 生成「自绘桌宠形象」预览页：直接抽取 app.js 中的形象函数（PET_THEME…PET_ART 块，纯函数不依赖 DOM），
   无需 jsdom，秒级完成。运行：node tools/gen-pet-preview.js（形象函数块位置变化时自动重新定位） */
const fs = require('fs');
const path = require('path');
const PROJ = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(PROJ, 'app.js'), 'utf8');

const a = SRC.indexOf('const PET_THEME = {');
const b = SRC.indexOf('const PET_ART = {};');
if (a < 0 || b < 0 || b < a) { console.error('未定位到形象代码块'); process.exit(1); }
const block = SRC.slice(a, b);
const makePet = new Function(block + '\nreturn { nahidaSVG, spiderSVG };')();
// coachDogSVG 在「我的」设置区，单独抽取（自带全部依赖）
function grabFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('no ' + name);
  let d = 0; const j = SRC.indexOf('{', i);
  for (let k = j; k < SRC.length; k++) {
    if (SRC[k] === '{') d++;
    else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); }
  }
  throw new Error('unclosed ' + name);
}
const coachDogSVG = new Function(grabFn('coachDogSVG') + '\nreturn coachDogSVG;')();

const MOODS = [
  ['happy', '开心（默认）'], ['cheer', '欢呼（完成动作）'], ['proud', '骄傲（打卡）'],
  ['expect', '期待'], ['think', '思考'], ['sad', '失落（未训练）'],
  ['sleep', '睡眠'], ['wave', '打招呼'], ['hover', '被摸头'], ['drag', '被拖动'],
];
const cards = MOODS.map(([m, label]) => `
  <div class="card">
    <div class="row"><div class="big">${makePet.spiderSVG(m,'v3')}</div><div class="big">${makePet.spiderSVG(m,'v1')}</div><div class="big">${makePet.spiderSVG(m,'v2')}</div><div class="big">${makePet.nahidaSVG(m)}</div></div>
    <div class="cap"><b>${m}</b> · ${label} ｜ 小蛛视频同款(v3) · 早期版(v1) · 现版(v2) · 小练</div>
    <div class="sizes">
      <span class="s104">${makePet.spiderSVG(m,'v3')}</span>
      <span class="s64">${makePet.spiderSVG(m,'v3')}</span>
      <span class="s40">${makePet.spiderSVG(m,'v3')}</span>
      <span class="s104">${makePet.nahidaSVG(m)}</span>
    </div>
    <div class="cap faint">小蛛 v3：104px（桌宠实际尺寸） / 64px / 40px，最右为同帧小练对照</div>
  </div>`).join('');

const DOGS = [
  { hood:'#5ba8e0', hoodText:'ALA LEI', fur:'#fdf3e4', ear:'#8a5a34' },
  { hood:'#2e2e33', hoodText:'Lanny',  fur:'#f0b060', ear:'#c98a3e', cap:'#f08c3e' },
  { hood:'#4caf6d', hoodText:'卡布达', fur:'#fbf7ef', ear:'#2e2e33', patch:'#2e2e33' }
];
const dogCards = DOGS.map(d => `
  <div class="card dog"><div class="big">${coachDogSVG(d)}</div>
  <div class="cap">教练头像 · <b>${d.hoodText}</b></div></div>`).join('');

const out = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>训练日记 · 桌宠形象预览（小蛛视频同款 / 小练 / 教练头像）</title>
<style>
  :root{ --bg:#f7f4fb; --card:#fff; --ink:#4a3f5c; --faint:#9c8fb0; --line:#ece5f4; }
  *{box-sizing:border-box;}
  body{margin:0; padding:24px; background:var(--bg); color:var(--ink);
       font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;}
  h1{font-size:20px; margin:0 0 4px;}
  p.sub{color:var(--faint); font-size:13px; margin:0 0 18px; line-height:1.7;}
  .grid{display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:14px;}
  .card{background:var(--card); border:1px solid var(--line); border-radius:18px; padding:14px; text-align:center;
        box-shadow:0 6px 18px rgba(120,100,150,.08);}
  .card.dog{min-width:150px;}
  .row{display:flex; justify-content:center; gap:10px;}
  .big svg{width:104px; height:130px;}
  .cap{font-size:12px; color:var(--ink); margin-top:6px;}
  .cap.faint{color:var(--faint); font-size:10.5px; margin-top:6px;}
  .sizes{display:flex; align-items:flex-end; justify-content:center; gap:14px; margin-top:10px;
         padding-top:10px; border-top:1px dashed var(--line);}
  .s104 svg{width:104px; height:130px;} .s64 svg{width:64px; height:80px;} .s40 svg{width:40px; height:50px;}
  footer{margin-top:20px; font-size:12px; color:var(--faint); line-height:1.8;}
</style></head><body>
<h1>桌宠形象预览 · v8.0（小蛛视频同款 v3 / 早期版 v1 / 现版 v2 / 小练 / 教练头像）</h1>
<p class="sub"><b>v3「视频同款」</b>（最左，当前默认）= 按参考视频逐帧取色重制：主红 <code>#C92848</code> + 藏蓝 <code>#344383</code> + 描边 <code>#241018</code>，中心放射蛛网（6 主干）· 蜘蛛胸标 · 身形比 1.00 · 水滴形眼罩 · 无地面阴影。<br>
v1 早期版 / v2 现版（去红蓝化的差异化版）保留可切换；小练 = v7.9 精致 Q 版自绘。均为<strong>自绘</strong>分层 SVG，一种情绪 = 一组图层参数。教练头像为三只连帽衫小狗自绘 SVG。</p>
<div class="grid">${cards}${dogCards}</div>
<footer>
  生成方式：<code>node tools/gen-pet-preview.js</code>（直接执行 app.js 中的形象函数，页面内容是当前代码的真实输出，非手写样例）。<br>
  切换皮肤：App「我的」页 → 桌宠形象与外观设置（小蛛 / 小练 / 官方素材）。
</footer>
</body></html>`;

const dest = path.join(PROJ, 'docs', '桌宠形象预览.html');
fs.writeFileSync(dest, out, 'utf8');
const kb = Math.round(Buffer.byteLength(out, 'utf8') / 1024);
console.log('已生成:', dest, kb + ' KB', '| 情绪数:', MOODS.length, '| 教练头像:', DOGS.length);
