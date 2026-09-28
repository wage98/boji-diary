/* 训练日记 · GitHub 推送脚本
   为什么不用 git：本机 github.com:443 被网络策略阻断，git 协议不可用；
   api.github.com 可达，因此走 Git Data API（blobs → tree → commit → PATCH ref）做一次原子提交。
   用法：GH_TOKEN=<PAT> node tools/push.js "提交说明"            */
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!TOKEN) { console.error('缺少环境变量 GH_TOKEN'); process.exit(1); }
const REPO = 'wage98/boji-diary';
const BRANCH = 'main';
const API = 'https://api.github.com/repos/' + REPO;
const MSG = (process.argv[2] || 'chore: 更新项目文件') + '\n\n由 tools/push.js 提交';
const AUTHOR = { name: 'boji-diary', email: 'boji-diary@users.noreply.github.com' };

const PROJ = path.join(__dirname, '..');
// 不入库的目录：eval-set 30MB 测试图、_archive 本地归档、_shot 截图与抽帧产物
const SKIP_DIR = new Set(['.git', '.workbuddy', '_archive', 'node_modules', 'dist', 'build', 'eval-set', '_shot']);
const SKIP_EXT = new Set(['.zip', '.tmp', '.log', '.mjs']);
const SKIP_PREFIX = ['_shot'];   // 形象截图临时文件（.html/.png）不推送

function walk(dir, rel, out) {
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('.') && name !== '.gitignore') continue;
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    const r = rel ? rel + '/' + name : name;
    if (st.isDirectory()) { if (!SKIP_DIR.has(name)) walk(abs, r, out); continue; }
    if (SKIP_EXT.has(path.extname(name).toLowerCase())) continue;
    if (SKIP_PREFIX.some(p => name.startsWith(p))) continue;
    out.push({ rel: r, abs });
  }
}
const files = [];
walk(PROJ, '', files);

async function gh(method, url, body) {
  const opt = { method, headers: { Authorization: 'token ' + TOKEN, 'User-Agent': 'boji-push', 'Accept': 'application/vnd.github+json' } };
  if (body) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  const r = await fetch(API + url, opt);
  const txt = await r.text();
  let j = null; try { j = JSON.parse(txt); } catch (e) { }
  if (!r.ok) throw new Error(method + ' ' + url + ' → ' + r.status + ' ' + (j && j.message ? j.message : txt.slice(0, 200)));
  return j;
}

(async () => {
  console.log('待提交文件:', files.length);
  const ref = await gh('GET', '/git/ref/heads/' + BRANCH);
  const parent = ref.object.sha;
  const pc = await gh('GET', '/git/commits/' + parent);
  const baseTree = pc.tree.sha;

  /* 同步删除：Git Data API 以 base_tree 增量提交，本地已删/已移动的文件不会自动消失，
     必须显式列出 sha:null 才会从仓库移除（v8.1 整理了目录，需要清掉旧的 _shot/ 与改名前的文档）。
     只删 blob，且只删「远端有、本地没有」的路径。 */
  const rt = await gh('GET', '/git/trees/' + baseTree + '?recursive=1');
  const remotePaths = (rt.tree || []).filter(x => x.type === 'blob').map(x => x.path);
  const localSet = new Set(files.map(f => f.rel.replace(/\\/g, '/')));
  const removed = remotePaths.filter(p => !localSet.has(p));
  if (removed.length) {
    console.log('将在仓库中删除（本地已不存在）:', removed.length, '个');
    removed.slice(0, 12).forEach(p => console.log('  ×', p));
    if (removed.length > 12) console.log('  …等共', removed.length, '个');
  }

  const tree = [];
  removed.forEach(p => tree.push({ path: p, mode: '100644', type: 'blob', sha: null }));
  for (const f of files) {
    const buf = fs.readFileSync(f.abs);
    const b = await gh('POST', '/git/blobs', { content: buf.toString('base64'), encoding: 'base64' });
    tree.push({ path: f.rel.replace(/\\/g, '/'), mode: '100644', type: 'blob', sha: b.sha });
  }
  const t = await gh('POST', '/git/trees', { base_tree: baseTree, tree });
  const c = await gh('POST', '/git/commits', { message: MSG, tree: t.sha, parents: [parent], author: AUTHOR, committer: AUTHOR });
  await gh('PATCH', '/git/refs/heads/' + BRANCH, { sha: c.sha });
  console.log('已推送 commit:', c.sha);
  console.log('文件数:', files.length);
  files.slice(0, 40).forEach(f => console.log('  ·', f.rel));
  if (files.length > 40) console.log('  …等共', files.length, '个');
})().catch(e => { console.error('推送失败:', e.message); process.exit(1); });
