/* 从线上取回的 app.js 中精确抽取 PLAN_SETS 结构（只读，不修改源码）。
   产出 tools/plan-audit.json：每个入口的 套/日/顺序/动作名/肌群/组数/次数/节奏/休息/base/kgBase/BV/label */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

const start = src.indexOf('const PLAN_SETS = {');
if (start < 0) throw new Error('PLAN_SETS not found');
const end = src.indexOf('\n};', start);
if (end < 0) throw new Error('PLAN_SETS end not found');
const code = src.slice(start, end + 3);

const blink = (bvid, label) => ({ url: 'https://www.bilibili.com/video/' + bvid, bvid, label });
const PLAN_SETS = new Function('blink', code + '\nreturn PLAN_SETS;')(blink);

const DAYS = ['push', 'pull', 'legs', 'core'];
const entries = [];
const byBv = {};
for (const key of ['A', 'B', 'C']) {
  const set = PLAN_SETS[key];
  for (const day of DAYS) {
    const d = set.days[day];
    d.ex.forEach((e, i) => {
      const bv = e.video && e.video.bvid;
      const row = {
        set: key, setName: set.name, day, dayName: d.name, order: i + 1,
        name: e.name, muscle: e.muscle, sets: e.sets, reps: e.reps, tempo: e.tempo,
        rest: e.rest, base: e.base, kgBase: e.kgBase || null,
        bv, label: e.video && e.video.label,
        standard: e.standard, note: e.note
      };
      entries.push(row);
      if (bv) (byBv[bv] = byBv[bv] || []).push({ set: key, day, name: e.name });
    });
  }
}

const out = {
  source: 'wage98/boji-diary @ main (c60715a), app.js',
  appVersion: (src.match(/const APP_VERSION = '([^']+)'/) || [])[1] || null,
  totalEntries: entries.length,
  uniqueBv: Object.keys(byBv).length,
  perSet: {}, daysPerSet: {},
  entries, byBv
};
for (const key of ['A', 'B', 'C']) {
  out.perSet[key] = entries.filter(e => e.set === key).length;
  out.daysPerSet[key] = {};
  for (const day of DAYS) out.daysPerSet[key][day] = entries.filter(e => e.set === key && e.day === day).length;
}
fs.writeFileSync(path.join(ROOT, 'tools', 'plan-audit.json'), JSON.stringify(out, null, 2), 'utf8');

console.log('APP_VERSION =', out.appVersion);
console.log('总入口 =', out.totalEntries, ' 唯一BV =', out.uniqueBv);
console.log('每套动作数 =', JSON.stringify(out.perSet));
console.log('每天动作数 =', JSON.stringify(out.daysPerSet));
console.log('\n--- 全部映射（动作 → BV → label）---');
for (const e of entries) {
  console.log(`${e.set}/${e.day}#${e.order} ${e.name} | ${e.bv} | ${e.label}`);
}
console.log('\n--- 同一 BV 被多个不同动作名使用（潜在错配）---');
for (const [bv, uses] of Object.entries(byBv)) {
  const names = [...new Set(uses.map(u => u.name))];
  if (names.length > 1) console.log(`${bv} => ${names.join(' / ')}`);
}
