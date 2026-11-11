'use strict';
/* 同步自检的 V122_APPROVED / V122_DROPPED 到二次换片后的口径。
   用结构化数组变换，避免手抄 46 项长数组出错。 */
const fs = require('fs');
const path = require('path');
const P = path.join(__dirname, 'selfcheck-attack.js');
let s = fs.readFileSync(P, 'utf8');

const SWAP = {
  'BV1xdZgYbEsj': 'BV1KN41197tc',   // 恢复旧准入片
  'BV1Sw411d7GN': 'BV17mWJ6LEaH',
  'BV1RT41157oz': 'BV1dY4u6RE6S',
  'BV1b64y1t71v': 'BV1bG411q7gh',
  'BV1tV4y137gN': 'BV16e4y1g7BL',
  'BV1fi4y1L774': 'BV1eY411C75Y',
  'BV13D421p75t': 'BV1vML36hEx1',
  'BV1Ji421i7rM': 'BV1Uo4y1t7S6'    // 恢复旧准入片
};
const RESTORE = ['BV1KN41197tc', 'BV1Uo4y1t7S6'];

function editArray(name, fn) {
  const re = new RegExp('(const ' + name + ' = )(\\[[^\\]]*\\])(;)');
  const m = s.match(re);
  if (!m) throw new Error('未找到 ' + name);
  const arr = JSON.parse(m[2]);
  const out = fn(arr);
  s = s.replace(re, (all, a, b, c) => a + JSON.stringify(out) + c);
  return { before: arr.length, after: out.length };
}

const a = editArray('V122_APPROVED', arr => {
  const out = arr.map(b => SWAP[b] || b);
  if (out.length !== 46 || new Set(out).size !== 46) throw new Error('APPROVED 数量/去重异常');
  return out;
});
const d = editArray('V122_DROPPED', arr => {
  const out = arr.filter(b => RESTORE.indexOf(b) < 0);
  for (const b of Object.keys(SWAP)) if (out.indexOf(b) < 0) out.push(b);
  if (new Set(out).size !== out.length) throw new Error('DROPPED 有重复');
  return out;
});

const oldNote = /   下架集合：25 个已下架 BV（[^\n]*）[^\n]*/;
const newNote = '   2026-11-10 二次换片：用户反馈「动作对不上」，8 个 BV 换为更精确的片（10 个入口）；\n'
  + '   其中 BV1KN41197tc / BV1Uo4y1t7S6 为纠正 v1.2.2 自动换片误判而主动恢复的旧准入片，已从下架集合移除（非误回潮）。\n'
  + '   下架集合：31 个 BV（重筛 15 + 精简 9 + 错配 1 + 二次换片 8 - 主动恢复 2），任何一条回潮都算回归。 */';
// 原注释共两行，第二行以「   下架集合：」开头并以 */ 结尾
if (!oldNote.test(s)) throw new Error('未找到下架集合注释');
s = s.replace(oldNote, newNote);

const oldZ2 = "check('Z2 25 个已下架 BV 全部无回潮（v1.2.2 重筛 15 + 精简 9 + 错配修正 1）'";
const newZ2 = "check('Z2 31 个已下架 BV 全部无回潮（重筛 15 + 精简 9 + 错配 1 + 换片 8 - 恢复 2）'";
if (s.indexOf(oldZ2) < 0) throw new Error('未找到 Z2 标签');
s = s.replace(oldZ2, newZ2);

fs.writeFileSync(P, s, 'utf8');
console.log(`APPROVED ${a.before} -> ${a.after}；DROPPED ${d.before} -> ${d.after}`);
console.log('注释与 Z2 标签已同步');
