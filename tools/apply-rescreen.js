'use strict';
/* 应用 v1.2.2 重筛结果：仅应用经人工复核通过的 15 个替换，回滚 10 个误换（保留原优质短片）。
   生成 tools/v122-map.json 供 selfcheck 与文档使用。 */
const fs = require('fs');
const path = require('path');
const R = JSON.parse(fs.readFileSync(path.join(__dirname, 'rescreen-result.json'), 'utf8'));

// 人工复核后决定回滚（保留原片）的动作名
const REVERT = new Set([
  '平板支撑', '单臂哑铃划船（扶墙/凳）', '集中弯举（坐姿）', '登山者',
  '杠铃平板卧推', '平板哑铃飞鸟', '绳索夹胸', '高位下拉', '直臂下压', '俯卧腿弯举'
]);

// 读取 v1.2.1 准入集合（用于计算 DROPPED）
const sc = fs.readFileSync(path.join(__dirname, 'selfcheck-attack.js'), 'utf8');
const m = sc.match(/const V121_APPROVED\s*=\s*\[([\s\S]*?)\];/);
const V121 = m[1].match(/BV[0-9A-Za-z]{10}/g);

let src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const swaps = [];
const applied = new Set();
for (const r of R) {
  if (REVERT.has(r.name)) continue;
  if (r.chosen === r.cur) continue;
  const title = (r.title || '').replace(/'/g, '’');
  const re = new RegExp("blink\\('" + r.cur + "',\\s*[\"']([^\"']*)[\"']\\)", 'g');
  const n = (src.match(re) || []).length;
  if (!n) { console.log('WARN no match for', r.cur); continue; }
  src = src.replace(re, () => "blink('" + r.chosen + "', '" + title + "')");
  applied.add(r.cur);
  swaps.push({ name: r.name, cur: r.cur, chosen: r.chosen, title, secs: r.secs });
  console.log(`SWAP ${r.name}: ${r.cur} -> ${r.chosen} (${n} place(s), ${r.secs}s)`);
}
fs.writeFileSync(path.join(__dirname, '..', 'app.js'), src, 'utf8');

// 计算最终 54 唯一 BV（approved）与下架（dropped）
const approved = [];
const seen = new Set();
for (const r of R) { const bv = REVERT.has(r.name) ? r.cur : r.chosen; if (!seen.has(bv)) { seen.add(bv); approved.push(bv); } }
const dropped = V121.filter(b => !seen.has(b));
fs.writeFileSync(path.join(__dirname, 'v122-map.json'), JSON.stringify({ approved, dropped, swaps }, null, 2), 'utf8');
console.log(`\nApplied swaps=${swaps.length}; approved=${approved.length}; dropped=${dropped.length}`);
if (dropped.length) console.log('dropped:', dropped.join(','));
