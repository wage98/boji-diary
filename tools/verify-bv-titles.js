/* 逐一用 B 站官方 view 接口复核 47 个 BV 的真实标题 / 秒级时长 / 活性。
   只读外部接口，不修改任何源码。产出 tools/bv-verify.json */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const audit = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'plan-audit.json'), 'utf8'));
const bvs = Object.keys(audit.byBv);

function sleep(ms) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
  catch (e) { /* noop */ }
}
function view(bvid) {
  let lastErr = '';
  for (let i = 0; i < 4; i++) {
    try {
      const out = execFileSync('curl', [
        '-sS', '--max-time', '15',
        '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        '-H', 'Referer: https://www.bilibili.com/',
        `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`
      ], { encoding: 'utf8', timeout: 25000, maxBuffer: 4 * 1024 * 1024 });
      const j = JSON.parse(out);
      if (j.code === 0 && j.data && j.data.title) {
        return {
          ok: true, bvid, title: j.data.title, duration: j.data.duration,
          owner: (j.data.owner && j.data.owner.name) || '',
          pubdate: j.data.pubdate || null
        };
      }
      lastErr = 'code=' + j.code + ' ' + (j.message || '');
    } catch (e) { lastErr = String(e.message || e).slice(0, 120); }
    sleep(400 * (i + 1));
  }
  return { ok: false, bvid, error: lastErr };
}

const result = {};
for (let i = 0; i < bvs.length; i++) {
  const bv = bvs[i];
  const r = view(bv);
  result[bv] = r;
  const uses = audit.byBv[bv].map(u => u.set + '/' + u.day + ':' + u.name).join(', ');
  console.log(`[${i + 1}/${bvs.length}] ${bv} ${r.ok ? `OK ${r.duration}s | ${r.title}` : 'FAIL ' + r.error}  << ${uses}`);
  sleep(220);
}
fs.writeFileSync(path.join(ROOT, 'tools', 'bv-verify.json'), JSON.stringify(result, null, 2), 'utf8');
const ok = Object.values(result).filter(r => r.ok);
const dead = Object.values(result).filter(r => !r.ok);
const over = ok.filter(r => r.duration > 95);
console.log('\n===== 汇总 =====');
console.log('总数', bvs.length, '| 活性 OK', ok.length, '| 死链/失败', dead.length, '| >95秒', over.length);
if (dead.length) console.log('失败清单:', dead.map(d => d.bvid + ':' + d.error).join('\n  '));
if (over.length) console.log('超时长:', over.map(d => d.bvid + ':' + d.duration).join(', '));
