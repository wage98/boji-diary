'use strict';
/* 落地「动作—视频对不上」换片：8 个 BV 替换 + 1 个保留。
   每个新 BV 都先用 B 站 view 接口复核活性/真实标题/时长（≤95s）；
   label 一律使用接口返回的真实标题全文，便于逐字核对。
   不改动作名、不改顺序、不改组数/次数/负荷/休息、不新增动作或器械。 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

function sleep(ms) { try { execFileSync('powershell', ['-nop', '-c', `Start-Sleep -Milliseconds ${ms}`]); } catch (e) { } }
function curl(url) {
  for (let t = 0; t < 4; t++) {
    try {
      const r = execFileSync('curl', ['-s', '-m', '25', '-A', UA, url], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
      if (r && r.length > 50) return r;
    } catch (e) { }
    sleep(400);
  }
  return '';
}
function view(bv) {
  for (let t = 0; t < 4; t++) {
    let raw = '';
    try { raw = curl('https://api.bilibili.com/x/web-interface/view?bvid=' + bv); } catch (e) { raw = ''; }
    if (!raw) { sleep(400); continue; }
    try {
      const j = JSON.parse(raw);
      if (j.code !== 0) return null;
      return { title: j.data.title, secs: j.data.duration };
    } catch (e) { sleep(400); }
  }
  return null;
}

/* old → new；kind: restore=纠正 v1.2.2 误换、恢复旧准入片；fresh=池外新片 */
const SWAPS = [
  { action: '俯身侧平举', old: 'BV1xdZgYbEsj', next: 'BV1KN41197tc', kind: 'restore', why: '用户反馈画面不对；原片为营销式标题，回退到标题逐字精确的旧准入片' },
  { action: '单臂哑铃划船（手撑椅）', old: 'BV1Sw411d7GN', next: 'BV17mWJ6LEaH', kind: 'fresh', why: '原片标题只写「哑铃划船」且带系列字样；新片明确「单臂哑铃划船教学」' },
  { action: '哑铃仰卧上拉', old: 'BV1RT41157oz', next: 'BV1dY4u6RE6S', kind: 'fresh', why: '原片写「直臂上拉」与动作标准「肘微屈固定」冲突；新片标题即「哑铃仰卧上拉」' },
  { action: '哑铃箭步蹲', old: 'BV1b64y1t71v', next: 'BV1bG411q7gh', kind: 'fresh', why: '原片带【12】系列编号且为「交替箭步蹲」；新片「哑铃箭步蹲讲解」对应向前迈步' },
  { action: '原地哑铃分腿蹲', old: 'BV1tV4y137gN', next: 'BV16e4y1g7BL', kind: 'fresh', why: '原片标题「原地箭步蹲」术语混用；新片「哑铃分腿蹲」与静态分腿站动作一致' },
  { action: '绳索夹胸', old: 'BV1fi4y1L774', next: 'BV1eY411C75Y', kind: 'fresh', why: '原片为「跪姿夹胸」变体；新片为「绳索夹胸」保姆级器械教程' },
  { action: '负重卷腹', old: 'BV13D421p75t', next: 'BV1vML36hEx1', kind: 'fresh', why: '原片带「每日结束动作」训练日志感；新片标题即「负重卷腹」' },
  { action: '悬垂举腿', old: 'BV1Ji421i7rM', next: 'BV1Uo4y1t7S6', kind: 'restore', why: '原片「踢法教学」与动作标准「举至髋屈曲、缓慢下落」变体不符；回退到「正确做法（全程无废话）」旧准入片' },
];
/* 保留：俯身哑铃面拉 BV1ZT411H7JD。翻遍 6 组关键词，唯一明确「用哑铃做面拉」的片；
   其余候选均为绳索/弹力带面拉、俯身提拉、哑铃飞鸟，换过去反而制造器械错配。 */
const KEEP = { action: '俯身哑铃面拉', bv: 'BV1ZT411H7JD', why: '全网站索无更精确的「哑铃面拉」教学片，维持原片（语义本就对应）' };

let app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const diff = [];
const errors = [];
for (const s of SWAPS) {
  const v = view(s.next);
  sleep(420);
  if (!v) { errors.push(`${s.next} view 接口无有效响应`); continue; }
  if (v.secs > 95) { errors.push(`${s.next} 时长 ${v.secs}s >95s`); continue; }
  // 与产品里其他动作撞片检查
  const re = new RegExp("blink\\(\\s*['\"]" + s.next + "['\"]", 'g');
  const clash = (app.match(re) || []).length;
  if (clash > 0) { errors.push(`${s.next} 已被计划中其他入口占用(${clash})`); continue; }

  const pat = new RegExp("blink\\(\\s*['\"]" + s.old + "['\"]\\s*,\\s*(['\"])(?:[^\\\\]|\\\\.)*?\\1\\s*\\)", 'g');
  const hits = app.match(pat) || [];
  if (!hits.length) { errors.push(`${s.old} 在 app.js 中未找到 blink 映射`); continue; }
  const quote = v.title.indexOf("'") >= 0 ? '"' : "'";
  const label = v.title.replace(/\\/g, '\\\\').replace(/\r?\n/g, ' ');
  const repl = `blink('${s.next}', ${quote}${label}${quote})`;
  app = app.replace(pat, () => repl);
  diff.push({ ...s, newTitle: v.title, secs: v.secs, entries: hits.length, label: repl });
  console.log(`OK ${s.action.padEnd(20)} ${s.old} -> ${s.next}  ${v.secs}s  ${hits.length} 个入口  ${v.title}`);
}
if (errors.length) {
  console.error('\n有错误，未写入 app.js：\n' + errors.join('\n'));
  process.exit(1);
}
fs.writeFileSync(path.join(ROOT, 'app.js'), app, 'utf8');
fs.writeFileSync(path.join(ROOT, 'tools/video-reswap-diff.json'),
  JSON.stringify({ swaps: diff, keep: KEEP, totalEntriesChanged: diff.reduce((a, b) => a + b.entries, 0) }, null, 2), 'utf8');
console.log(`\n共替换 ${diff.length} 个 BV / ${diff.reduce((a, b) => a + b.entries, 0)} 个入口；保留 ${KEEP.action}`);
console.log('已写入 app.js 与 tools/video-reswap-diff.json');
