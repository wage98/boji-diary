/* v1.2.2 → 修订提案：只落地「不触碰动作数组下标」的确定性修正，避免破坏 planEdits/exLast/weights 的索引绑定。
   1) C/legs#6 站姿提踵：BV13r4y1P7G3(半蹲提踵，变体错配) → 池内已有 BV1gJfyBsEtf(1.站姿提踵)，与 A/B 统一
   2) 组间休息 rest 按增肌标准补齐（复合 90–120 / 辅助 75 / 孤立 60 / 核心 45）
   不新增/删除任何动作、不调整顺序、不改动 sets/reps/base/kgBase、不改版本号、不推送。
   产出 tools/plan-fix-diff.json 供逐条复核。 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const file = path.join(ROOT, 'app.js');
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

// 每日目标休息（按动作在当日数组中的顺序，1-based）
const REST = {
  'A/push': [90, 75, 75, 60, 60, 60],
  'A/pull': [90, 90, 75, 60, 60],
  'A/legs': [90, 90, 90, 90, 60, 60],
  'A/core': [45, 45, 45, 45, 45],
  'B/push': [90, 75, 60, 60, 60],
  'B/pull': [90, 90, 75, 60, 60],
  'B/legs': [90, 90, 90, 60, 60],
  'B/core': [45, 45, 45, 45, 45],
  'C/push': [90, 75, 75, 60, 60],
  'C/pull': [90, 90, 90, 60, 60],
  'C/legs': [120, 90, 90, 60, 60, 60],
  'C/core': [90, 60, 60, 60, 60, 45],
};

let set = null, day = null, order = 0;
const diff = [];
const out = lines.map((line, idx) => {
  let m;
  if ((m = line.match(/^  ([ABC]): \{/))) { set = m[1]; day = null; order = 0; return line; }
  if ((m = line.match(/^      (push|pull|legs|core): \{/))) { day = m[1]; order = 0; return line; }
  if (set && day && (m = line.match(/^\s{8}\{ name:'([^']+)'/))) {
    const name = m[1];
    order++;
    const key = set + '/' + day;
    const target = REST[key] && REST[key][order - 1];
    let next = line;
    if (target) {
      const rm = next.match(/\brest:(\d+)/);
      if (rm) {
        const old = +rm[1];
        if (old !== target) {
          diff.push({ type: 'rest', set, day, order, name, line: idx + 1, old, now: target });
          next = next.replace(/\brest:\d+/, 'rest:' + target);
        }
      }
    }
    // 唯一视频错配修正
    if (set === 'C' && day === 'legs' && name === '站姿提踵') {
      const before = next;
      next = next.replace(/blink\('BV13r4y1P7G3',\s*"[^"]*"\)/, "blink('BV1gJfyBsEtf', '1.站姿提踵')");
      if (next !== before) diff.push({ type: 'video', set, day, order, name, line: idx + 1, old: 'BV13r4y1P7G3 / 半蹲提踵动作…', now: 'BV1gJfyBsEtf / 1.站姿提踵' });
    }
    return next;
  }
  return line;
});

fs.writeFileSync(file, out.join('\n'), 'utf8');
fs.writeFileSync(path.join(ROOT, 'tools', 'plan-fix-diff.json'), JSON.stringify(diff, null, 2), 'utf8');
console.log('改动条目数 =', diff.length);
console.log('视频修正 =', diff.filter(d => d.type === 'video').length,
  '| 休息修正 =', diff.filter(d => d.type === 'rest').length);
for (const d of diff) {
  console.log(`  ${d.set}/${d.day}#${d.order} ${d.name}: ${d.old} -> ${d.now}${d.type === 'rest' ? 's' : ''}`);
}
