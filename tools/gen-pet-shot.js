/* 快速抽取桌宠形象相关纯函数（不依赖 DOM），输出拼图 HTML 供截图验收。
   运行：node tools/gen-pet-shot.js [mood1,mood2]
   v7.10：同时渲染小蛛（spiderSVG）与小练（nahidaSVG）两套皮肤 + 三只教练小狗头像。 */
const fs = require('fs');
const path = require('path');
const PROJ = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(PROJ, 'app.js'), 'utf8');

const a = SRC.indexOf('const PET_THEME = {');
const b = SRC.indexOf('const PET_ART = {};');
if (a < 0 || b < 0 || b < a) { console.error('未定位到桌宠形象代码块'); process.exit(1); }
const block = SRC.slice(a, b) + '\nreturn { nahidaSVG, spiderSVG };';
const { nahidaSVG, spiderSVG } = new Function(block)();

const ca = SRC.indexOf('function coachDogSVG(o)');
const cb = SRC.indexOf('const COACH_AV_SVG = {');
const cc = SRC.indexOf('};', cb) + 2;
if (ca < 0 || cb < 0 || cc < cb) { console.error('未定位到教练头像代码块'); process.exit(1); }
const coachBlock = SRC.slice(ca, cc) + '\nreturn COACH_AV_SVG;';
const COACH_AV_SVG = new Function(coachBlock)();

const MOODS = process.argv[2] ? process.argv[2].split(',')
  : ['happy', 'cheer', 'proud', 'expect', 'think', 'sad', 'sleep', 'wave', 'hover', 'drag', 'blink'];

const card = (svg, label) => `<div class="c">${svg}<span>${label}</span></div>`;
const cards = MOODS.map(m => {
  const f = m === 'blink' ? { eye:'closed', mouth:'smile', blush:1, brow:'flat', fx:'' } : m;
  return card(spiderSVG(f), '小蛛·' + m) + card(nahidaSVG(f), '小练·' + m);
}).join('') +
  Object.entries(COACH_AV_SVG).map(([k, v]) => `<div class="c av">${v}<span>教练·${k}</span></div>`).join('');

const out = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<style>
 body{margin:0;background:#efeaf7;display:flex;flex-wrap:wrap;padding:10px;
      font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
 .c{margin:6px;background:#fff;border-radius:14px;padding:6px 4px 2px;text-align:center;
    box-shadow:0 4px 12px rgba(120,100,150,.10)}
 .c svg{width:160px;height:200px;display:block}
 .c.av{width:120px} .c.av svg{width:110px;height:110px;border-radius:12px}
 span{display:block;font-size:11px;color:#7a6f8c;padding:2px 0 3px}
</style></head><body>${cards}</body></html>`;

const dest = path.join(PROJ, '_shot.html');
fs.writeFileSync(dest, out, 'utf8');
console.log('已生成', dest, '| 情绪:', MOODS.join(','));
