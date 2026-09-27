/* 快速抽取 nahidaSVG 相关纯函数（不依赖 DOM），输出一张拼图 HTML 供截图验收。
   运行：NODE_PATH=<jsdom路径可省略> node tools/gen-pet-shot.js
   说明：形象函数不触碰 document，因此无需 jsdom，比完整预览页快得多。 */
const fs = require('fs');
const path = require('path');
const PROJ = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(PROJ, 'app.js'), 'utf8');

const a = SRC.indexOf('const PET_THEME = {');
const b = SRC.indexOf('const PET_ART = {};');
if (a < 0 || b < 0 || b < a) { console.error('未定位到形象代码块'); process.exit(1); }
const block = SRC.slice(a, b);
// eslint-disable-next-line no-new-func
const nahidaSVG = new Function(block + '\nreturn nahidaSVG;')();

const MOODS = process.argv[2] ? process.argv[2].split(',')
  : ['happy', 'cheer', 'proud', 'expect', 'think', 'sad', 'sleep', 'wave', 'hover', 'drag'];

const cards = MOODS.map(m =>
  `<div class="c">${nahidaSVG(m)}<span>${m}</span></div>`).join('');

const out = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<style>
 body{margin:0;background:#efeaf7;display:flex;flex-wrap:wrap;padding:10px;
      font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
 .c{margin:6px;background:#fff;border-radius:14px;padding:6px 4px 2px;text-align:center;
    box-shadow:0 4px 12px rgba(120,100,150,.10)}
 .c svg{width:160px;height:200px;display:block}
 span{display:block;font-size:11px;color:#7a6f8c;padding:2px 0 3px}
</style></head><body>${cards}</body></html>`;

const dest = path.join(PROJ, '_shot.html');
fs.writeFileSync(dest, out, 'utf8');
console.log('已生成', dest, '| 情绪:', MOODS.join(','));
