'use strict';
/* 同步 docs/视频来源核对.md 到二次换片后的口径：
   ① 动作表 8 行 BV/真实标题/时长/链接；② 结论区补一行；③ 追加第五节换片记录。 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const P = path.join(ROOT, 'docs/视频来源核对.md');
const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/video-reswap-diff.json'), 'utf8'));

let lines = fs.readFileSync(P, 'utf8').split(/\r?\n/);
for (const s of d.swaps) {
  const idx = lines.findIndex(l => l.trim().startsWith('|') && l.indexOf('`' + s.old + '`') >= 0);
  if (idx < 0) throw new Error('动作表未找到 ' + s.old);
  const p = lines[idx].split('|');
  if (p.length < 7) throw new Error('表格列数异常: ' + lines[idx]);
  p[2] = ` \`${s.next}\` `;
  p[3] = ` ${s.newTitle} `;
  p[4] = ` ${s.secs} 秒 `;
  p[5] = ` [打开](https://www.bilibili.com/video/${s.next}) `;
  lines[idx] = p.join('|');
  console.log('行已更新:', s.action, s.old, '->', s.next);
}

// 结论区补一行统计（插在「本轮二次精简」行之后）
const at = lines.findIndex(l => l.indexOf('| 本轮二次精简（动作减法） |') === 0);
if (at < 0) throw new Error('未找到结论区锚点');
lines.splice(at + 1, 0,
  '| 2026-11-10 二次换片（用户确认「动作对不上」） | 8 个 BV 换为标题与动作变体更精确的片、影响 10 个入口；1 条（俯身哑铃面拉）因全网站索无更精确替代而保留；详见文末第五节 |');

let doc = lines.join('\n');
if (doc.indexOf('## 五、2026-11-10 二次换片') >= 0) throw new Error('第五节已存在，避免重复追加');

const rows = d.swaps.map(s =>
  `| ${s.action} | \`${s.old}\` | \`${s.next}\` | ${s.newTitle} | ${s.secs} 秒 | ${s.kind === 'restore' ? '恢复旧准入片' : '池外新片'} | ${s.why} |`).join('\n');
doc += `

## 五、2026-11-10 二次换片（按用户确认执行，本地副本，未推送）

用户反馈「动作对不上」——即**实际视频画面与动作不符**。这属于标题文本、时长、链接活性之外的画面层问题，只能靠用户反馈发现（我无法观片）。按此前建议执行换片：

| 动作 | 原 BV | 新 BV | 新片真实标题 | 时长 | 类型 | 原因 |
|---|---|---|---|---|---|---|
${rows}

**保留项**：俯身哑铃面拉 \`BV1ZT411H7JD\`「找到一个绳索面拉的哑铃替代动作！」39 秒。用 6 组关键词（哑铃面拉 教学 / 俯身哑铃面拉 / 哑铃面拉 后束 / 哑铃面拉 替代 / 俯身面拉 教学 / 面拉 哑铃）搜索，候选全部是**绳索面拉、弹力带面拉、俯身哑铃提拉或哑铃飞鸟**，换成任何一条都会引入器械或动作错配；原片是唯一明确「用哑铃做面拉」的片，语义本就对应，故维持。

**约束变更**：原任务要求「不新增未提供的视频」，用户本轮明确回复「换」，据此仅放宽视频来源一项——新增 6 个池外教学片，另有 2 个是纠正 v1.2.2 自动换片误判而恢复的旧准入片（俯身侧平举 \`BV1KN41197tc\`、悬垂举腿 \`BV1Uo4y1t7S6\`，已从自检下架集合移除）。**动作、器械、训练目标与结构一律未新增**，动作顺序、组数、次数、负荷、休息均未改动。

**复核**：8 个新 BV 全部经 B 站官方 \`view\` 接口回读 code=0、真实标题全文写入 \`blink\` label、时长 36–79 秒（≤95s）；全池仍为 **64 个入口 / 46 个唯一视频 / 0 死链 / 0 条超 95 秒**。自检 \`tools/selfcheck-attack.js\` 同步为准入 46 项、下架 31 项，结果 **205 PASS / 0 FAIL**。

逐条机器可读证据：\`tools/video-reswap-diff.json\`、\`tools/reswap-candidates.json\`、\`tools/bv-verify.json\`。
`;
fs.writeFileSync(P, doc, 'utf8');
console.log('核对文档已更新，含第五节');
