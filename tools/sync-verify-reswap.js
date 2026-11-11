'use strict';
/* 把二次换片的 8 个新 BV 的官方接口证据并入 bv-verify.json。
   保留首轮 47 条作为历史证据（当前有效集合为 46 条，以 V122_APPROVED 为准）。 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
function sleep(ms) { try { execFileSync('powershell', ['-nop', '-c', `Start-Sleep -Milliseconds ${ms}`]); } catch (e) { } }
function view(bv) {
  for (let t = 0; t < 4; t++) {
    let raw = '';
    try { raw = execFileSync('curl', ['-s', '-m', '25', '-A', UA, 'https://api.bilibili.com/x/web-interface/view?bvid=' + bv], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }); } catch (e) { raw = ''; }
    if (!raw) { sleep(400); continue; }
    try {
      const j = JSON.parse(raw);
      if (j.code !== 0) return null;
      return { ok: true, bvid: bv, title: j.data.title, duration: j.data.duration, owner: (j.data.owner && j.data.owner.name) || '', pubdate: j.data.pubdate || 0 };
    } catch (e) { sleep(400); }
  }
  return null;
}
const p = path.join(ROOT, 'tools/bv-verify.json');
const v = JSON.parse(fs.readFileSync(p, 'utf8'));
const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/video-reswap-diff.json'), 'utf8'));
for (const s of d.swaps) {
  const r = view(s.next);
  sleep(400);
  if (!r || r.duration > 95) { console.error('FAIL', s.next); process.exit(1); }
  v[s.next] = r;
  console.log('OK', s.next, r.duration + 's', r.title);
}
fs.writeFileSync(p, JSON.stringify(v, null, 2), 'utf8');
console.log('bv-verify.json 现有条目 =', Object.keys(v).length, '（含历史）；当前有效 46 条以 V122_APPROVED 为准');
