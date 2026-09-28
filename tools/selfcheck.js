/* 训练日记 · 自检总入口：依次跑「功能回归」与「攻击式自检」 */
const { spawnSync } = require('child_process');
const path = require('path');
const NODE = process.execPath;
const NODE_PATH = 'C:/Users/WaGe/.workbuddy/binaries/node/workspace/node_modules';
const files = ['selfcheck-functional.js', 'selfcheck-attack.js'];
let bad = 0;
for (const f of files) {
  console.log('----- ' + f + ' -----');
  const r = spawnSync(NODE, [path.join(__dirname, f)], {
    stdio: 'inherit',
    env: Object.assign({}, process.env, { NODE_PATH })
  });
  if (r.status !== 0) bad++;
}
console.log(bad ? 'RESULT: FAILED' : 'RESULT: ALL PASSED');
process.exit(bad ? 1 : 0);
