'use strict';
/* 针对「动作—画面对不上」的 9 个动作重筛视频。
   只输出候选与证据，不自动改写 app.js：最终挑选由人工按变体精度判定。
   规则沿用产品口径：≤95s、直给教学、变体精确、view 接口活性复核。 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const ROOT = path.resolve(__dirname, '..');

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
function search(kw) {
  const html = curl('https://search.bilibili.com/all?keyword=' + encodeURIComponent(kw));
  const parts = html.split('bili-video-card__info--tit');
  const out = [];
  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i - 1];
    const bvm = chunk.match(/BV[0-9A-Za-z]{10}/);
    if (!bvm) continue;
    const dm = chunk.match(/(\d{1,2}):(\d{2})/);
    const secs = dm ? (+dm[1]) * 60 + (+dm[2]) : 9999;
    const tm = parts[i].match(/title="([^"]*)"/);
    out.push({ bv: bvm[0], title: tm ? tm[1] : '', secs });
  }
  return out;
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

const SIG = [['标准', 6], ['细节', 6], ['要点', 6], ['避坑', 7], ['纠错', 7], ['新手', 6],
['保姆级', 5], ['逐帧', 6], ['正确', 4], ['教学', 4], ['教程', 4], ['怎么做', 3],
['分解', 4], ['精讲', 3], ['完整', 3], ['动作', 1], ['练', 1]];
const BAD = ['跟练', '合集', '系列', '计划', '挑战', '打卡', '游戏', '混剪', '训练营', '直播', 'vlog', 'VLOG'];
function score(title, secs) {
  if (!title) return -1e9;
  let s = 0;
  for (const [k, v] of SIG) if (title.indexOf(k) >= 0) s += v;
  for (const b of BAD) if (title.indexOf(b) >= 0) s -= 100;
  if (/第\s*\d+\s*天|【\d+】|第\d+期/.test(title)) s -= 40;   // 系列编号
  if (secs >= 30 && secs <= 95) s += 5;                        // 不因 <30s 罚分（上次误换的教训）
  if (title.length > 55) s -= 3;                               // 营销长标题略降权
  return s;
}

/* 每个动作：keywords = 多组搜索词；must = 标题必须命中的词（变体精确）；
   any = 至少命中一个；none = 必须避开；old = 当前 BV */
const TASKS = [
  {
    key: '俯身侧平举', old: 'BV1xdZgYbEsj',
    keywords: ['俯身侧平举 教学', '俯身哑铃侧平举 标准', '哑铃反向飞鸟 后束 教学'],
    must: [], any: ['侧平举', '反向飞鸟', '后束'], none: ['绳索', '器械', '面拉', '蝴蝶机', '上斜'],
    note: '须为「俯身 + 哑铃」的后束水平外展；用户反馈画面不对，优先换掉原片'
  },
  {
    key: '单臂哑铃划船（手撑椅）', old: 'BV1Sw411d7GN',
    keywords: ['单臂哑铃划船 教学', '单臂哑铃划船 标准动作', '单手哑铃划船 新手'],
    must: ['划船'], any: ['单臂', '单手'], none: ['器械', '绳索', '坐姿', '杠铃', 'T杠'],
    note: '须明确单臂/单手，排除器械坐姿划船'
  },
  {
    key: '哑铃仰卧上拉', old: 'BV1RT41157oz',
    keywords: ['哑铃仰卧上拉 教学', '哑铃直臂上拉 教学', '仰卧哑铃上拉 标准'],
    must: [], any: ['仰卧上拉', '直臂上拉', '上拉'], none: ['杠铃', '绳索', '器械', '引体', '下拉'],
    note: '须为哑铃 pullover（仰卧），排除直臂下压/高位下拉'
  },
  {
    key: '俯身哑铃面拉', old: 'BV1ZT411H7JD',
    keywords: ['俯身哑铃面拉 教学', '哑铃面拉 动作', '俯身面拉 后束'],
    must: ['面拉'], any: [], none: ['绳索'],
    note: '须为哑铃面拉（非绳索），标题需含动作名'
  },
  {
    key: '哑铃箭步蹲', old: 'BV1b64y1t71v',
    keywords: ['哑铃箭步蹲 标准教学', '哑铃箭步蹲 动作细节', '箭步蹲 正确做法 哑铃'],
    must: ['箭步蹲'], any: [], none: ['交替', '保加利亚', '原地', '跳', '行走', '系列'],
    note: '须为向前迈步的箭步蹲，排除交替/原地/保加利亚'
  },
  {
    key: '原地哑铃分腿蹲', old: 'BV1tV4y137gN',
    keywords: ['原地分腿蹲 教学', '原地箭步蹲 标准动作', '分腿蹲 动作教学'],
    must: [], any: ['分腿蹲', '箭步蹲'], none: ['保加利亚', '跳', '行走', '交替', '后脚'],
    note: '须为原地分腿蹲（静态分腿站），术语可含「原地箭步蹲」'
  },
  {
    key: '绳索夹胸', old: 'BV1fi4y1L774',
    keywords: ['绳索夹胸 标准教学', '龙门架夹胸 教学', '站姿绳索夹胸 动作'],
    must: ['夹胸'], any: [], none: ['跪姿', '蝴蝶机', '器械夹胸', '坐姿'],
    note: '须为龙门架站姿绳索夹胸，排除跪姿/蝴蝶机'
  },
  {
    key: '负重卷腹', old: 'BV13D421p75t',
    keywords: ['负重卷腹 标准教学', '负重卷腹 动作细节', '哑铃负重卷腹 教学'],
    must: ['负重卷腹'], any: [], none: ['每日', '系列', '结束动作'],
    note: '标题须直接含「负重卷腹」，排除训练日志式标题'
  },
  {
    key: '悬垂举腿', old: 'BV1Ji421i7rM',
    keywords: ['悬垂举腿 标准教学', '悬垂举腿 动作细节', '悬垂举腿 新手 正确'],
    must: ['悬垂举腿'], any: [], none: ['踢', '摆', '卷腹', '抬腿器', '器械'],
    note: '须为悬垂举腿（非踢腿/摆动变体）'
  }
];

// 当前准入集合（用于标注「候选 BV 是否已被别的动作占用」）
let approved = [];
try {
  const sc = fs.readFileSync(path.join(ROOT, 'tools/selfcheck-attack.js'), 'utf8');
  const m = sc.match(/const V122_APPROVED = \[([^\]]+)\]/);
  if (m) approved = JSON.parse('[' + m[1] + ']');
} catch (e) { }
const bvOwner = {};
try {
  const audit = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/plan-audit.json'), 'utf8'));
  const rows = Array.isArray(audit) ? audit : (audit.entries || audit.rows || []);
  for (const r of rows) { const b = r.bv || r.BV; if (b) (bvOwner[b] = bvOwner[b] || []).push(r.name); }
} catch (e) { }

const result = {};
for (const t of TASKS) {
  const seen = new Set();
  const raw = [];
  for (const kw of t.keywords) {
    for (const c of search(kw)) {
      if (c.bv === t.old || seen.has(c.bv)) continue;
      seen.add(c.bv);
      if (c.secs > 95) continue;
      const title = c.title;
      if (t.must.some(k => title.indexOf(k) < 0)) continue;
      if (t.any.length && !t.any.some(k => title.indexOf(k) >= 0)) continue;
      if (t.none.some(k => title.indexOf(k) >= 0)) continue;
      raw.push(c);
    }
    sleep(500);
  }
  const verified = [];
  for (const c of raw.slice(0, 18)) {
    const v = view(c.bv);
    if (v && v.secs <= 95) {
      // 复核后的真实标题也要过一遍变体过滤
      if (t.must.some(k => v.title.indexOf(k) < 0)) continue;
      if (t.any.length && !t.any.some(k => v.title.indexOf(k) >= 0)) continue;
      if (t.none.some(k => v.title.indexOf(k) >= 0)) continue;
      verified.push({
        bv: c.bv, title: v.title, secs: v.secs, total: score(v.title, v.secs),
        inPool: approved.indexOf(c.bv) >= 0, owner: bvOwner[c.bv] || []
      });
    }
    sleep(420);
  }
  verified.sort((a, b) => b.total - a.total);
  result[t.key] = { old: t.old, note: t.note, candidates: verified.slice(0, 12) };
  console.log(`\n===== ${t.key}（原 ${t.old}）=====  ${t.note}`);
  if (!verified.length) { console.log('  无合规候选（需放宽词再搜）'); continue; }
  for (const c of verified.slice(0, 12)) {
    console.log(`  ${c.bv} ${String(c.secs).padStart(2)}s 评分${String(c.total).padStart(3)} ${c.inPool ? '[池内]' : '      '} ${c.title}`);
  }
}
fs.writeFileSync(path.join(ROOT, 'tools/reswap-candidates.json'), JSON.stringify(result, null, 2), 'utf8');
console.log('\n候选已写入 tools/reswap-candidates.json');
