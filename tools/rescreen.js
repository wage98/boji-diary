'use strict';
/* v1.2.2 动作视频重筛脚本（稳健版）
   目标：为每个动作找「细节/新手/标准/避坑/纠错/逐帧/不废腰」等直给教学片，且时长 ≤95s。
   硬规则：变体精确（哑铃版不混杠铃版等）、排除跟练/合集/计划/多动作/第N天。
   只在新片真实标题评分显著高于现片(+2)且经 view 接口复核存活、≤95s 时才替换，绝不退化。
   输出 tools/rescreen-result.json 与控制台表格。 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PROJ = path.resolve(__dirname, '..');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

function curl(url) {
  for (let t = 0; t < 4; t++) {
    try {
      const r = execFileSync('curl', ['-s', '-m', '25', '-A', UA, url], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
      if (r && r.length > 50) return r;
    } catch (e) {}
    sleep(400);
  }
  return '';
}
function sleep(ms){ try { execFileSync('powershell', ['-nop','-c',`Start-Sleep -Milliseconds ${ms}`]); } catch(e){} }

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
    try { const j = JSON.parse(raw); if (j.code !== 0) return null; return { title: j.data.title, secs: j.data.duration }; }
    catch (e) { sleep(400); }
  }
  return null;
}
// 标题信号评分：细节/新手/护腰权重更高（贴合 188/70 新手“别伤腰、要细节”诉求）
const SIG = [['标准',6],['细节',6],['要点',6],['避坑',7],['纠错',7],['新手',6],['保姆级',5],['逐帧',6],['全身',4],['正确',3],['教学',3],['怎么做',3],['教程',3],['分解',4],['一分钟',2],['干货',2],['精讲',3],['完整',3],['学会',2],['护腰',6],['不废腰',7],['腰不',6],['腰先',6]];
const BAD = ['跟练','合集','系列','计划','挑战','打卡','游戏','混剪','训练营','直播'];
function score(t) {
  if (!t) return -1e9;
  let s = 0;
  for (const [k, v] of SIG) if (t.indexOf(k) >= 0) s += v;
  for (const b of BAD) if (t.indexOf(b) >= 0) s -= 100;
  if (/第\s*\d+\s*天/.test(t)) s -= 100;
  return s;
}
function durAdj(secs){ if (secs < 30) return -10; if (secs < 35) return -4; if (secs <= 95) return 8; return 0; } // 细节需要篇幅
function passIncl(t, incl) { return incl.every(k => t.indexOf(k) >= 0); }
function passExcl(t, excl) { return !excl.some(k => t.indexOf(k) >= 0); }

const ACTIONS = [
  ['哑铃平板卧推','BV1as4y1T7YM','哑铃平板卧推',['哑铃','卧推'],['杠铃','上斜','地板','飞鸟','俯身']],
  ['上斜哑铃卧推','BV1nNZRY3EJc','上斜哑铃卧推',['上斜','哑铃','卧推'],['平板','地板','杠铃','飞鸟']],
  ['坐姿哑铃肩推','BV1CZhe6JEjM','坐姿哑铃肩推',['坐姿','哑铃','肩推'],['站姿','杠铃']],
  ['哑铃侧平举','BV16u4111716','哑铃侧平举',['哑铃','侧平举'],['俯身','绳索','器械','杠铃']],
  ['仰卧哑铃臂屈伸','BV1J5411Q7KE','仰卧哑铃臂屈伸',['仰卧','哑铃','臂屈伸'],['俯身','绳索','杠铃']],
  ['俯身侧平举','BV1KN41197tc','俯身侧平举',['俯身','哑铃','侧平举'],['站姿','坐姿','绳索','器械','杠铃']],
  ['单臂哑铃划船（手撑椅）','BV1Sw411d7GN','单臂哑铃划船',['单臂','哑铃','划船'],['双手','杠铃']],
  ['俯身哑铃划船（双手）','BV1emHx6QEvJ','俯身哑铃划船',['俯身','哑铃','划船'],['单臂','杠铃','坐姿','绳索']],
  ['哑铃耸肩','BV1N66yBKEH8','哑铃耸肩',['哑铃','耸肩'],['杠铃','器械']],
  ['俯身哑铃面拉','BV1ZT411H7JD','俯身哑铃面拉',['哑铃','面拉'],['杠铃']],
  ['锤式弯举','BV1uE411R7qv','锤式弯举',['锤式'],['杠铃','集中']],
  ['集中弯举','BV1Qg4y1272p','集中弯举',['集中','弯举'],['杠铃','锤式']],
  ['高脚杯深蹲','BV1rJsbzbEGu','高脚杯深蹲',['高脚杯','深蹲'],['杠铃','相扑','箭步','保加利亚']],
  ['哑铃罗马尼亚硬拉','BV1Q44y1Z7Xq','哑铃罗马尼亚硬拉',['罗马尼亚','哑铃','硬拉'],['杠铃']],
  ['保加利亚分腿蹲（后脚搭椅）','BV1JKczeKExz','保加利亚分腿蹲',['保加利亚','分腿蹲'],['箭步','杠铃']],
  ['哑铃箭步蹲','BV1d1pp6JE7i','哑铃箭步蹲',['箭步蹲','哑铃'],['保加利亚','杠铃','原地','相扑']],
  ['站姿提踵','BV1gJfyBsEtf','站姿提踵',['提踵','站姿'],['坐姿']],
  ['臀桥（肩撑椅）','BV1VGaU63EGS','臀桥',['臀桥'],['单腿','杠铃','器械']],
  ['卷腹','BV1s9pq63E6M','卷腹',['卷腹'],['负重','反向','悬垂','俄罗斯','器械']],
  ['反向卷腹','BV1wvcozSEyJ','反向卷腹',['反向','卷腹'],['负重','悬垂','俄罗斯']],
  ['平板支撑','BV1tZ8FzBEgf','平板支撑',['平板支撑'],['侧平板','器械']],
  ['哑铃俄罗斯转体','BV1NH4y1K7wQ','哑铃俄罗斯转体',['俄罗斯转体'],['杠铃']],
  ['死虫式','BV15rhB6mEit','死虫式',['死虫'],[]],
  ['侧平板支撑','BV1yqE16JEi1','侧平板支撑',['侧平板'],['平板支撑','平板']],
  ['地板哑铃卧推','BV1Wr4y1T7yH','地板哑铃卧推',['地板','哑铃','卧推'],['平板','上斜','杠铃','飞鸟']],
  ['地板哑铃飞鸟','BV1TjEEzFEyY','地板哑铃飞鸟',['地板','哑铃','飞鸟'],['平板','杠铃','绳索']],
  ['站姿哑铃肩推','BV1cSiRYREHk','站姿哑铃肩推',['站姿','哑铃','肩推'],['坐姿','杠铃']],
  ['哑铃俯身臂屈伸','BV1AohVz6EBb','哑铃俯身臂屈伸',['俯身','哑铃','臂屈伸'],['仰卧','绳索','杠铃']],
  ['单臂哑铃划船（扶墙/凳）','BV1E54BewEHA','单臂哑铃划船',['单臂','划船'],['双手','杠铃']],
  ['集中弯举（坐姿）','BV1vAem6LErW','集中弯举',['集中','弯举'],['杠铃','锤式']],
  ['哑铃相扑深蹲','BV1ga4y1Z717','哑铃相扑深蹲',['相扑','深蹲','哑铃'],['高脚杯','杠铃','箭步','保加利亚']],
  ['原地哑铃分腿蹲','BV1tV4y137gN','原地哑铃分腿蹲',['分腿蹲','箭步','哑铃','原地'],['保加利亚','杠铃','相扑','高脚杯']],
  ['单腿臀桥','BV1sxbj6hEco','单腿臀桥',['单腿','臀桥'],['杠铃','器械']],
  ['登山者','BV1ft4y1q7QC','登山者',['登山者'],[]],
  ['杠铃平板卧推','BV1QxGg6EEqj','杠铃平板卧推',['杠铃','平板','卧推'],['哑铃','上斜','地板','飞鸟']],
  ['坐姿器械推胸','BV1Gia76sEro','坐姿器械推胸',['器械','推胸'],['哑铃','杠铃','绳索','飞鸟']],
  ['平板哑铃飞鸟','BV1S54y1Z7pY','平板哑铃飞鸟',['平板','哑铃','飞鸟'],['地板','杠铃','绳索']],
  ['绳索夹胸','BV1fi4y1L774','绳索夹胸',['夹胸','绳索'],['哑铃','杠铃','飞鸟']],
  ['绳索下压','BV1CUpg6fEfX','绳索下压',['绳索','下压'],['哑铃','杠铃']],
  ['高位下拉','BV1Wqh26pEUM','高位下拉',['高位下拉'],['杠铃','哑铃','器械']],
  ['坐姿绳索划船','BV15FbW6aEgk','坐姿绳索划船',['坐姿','划船','绳索'],['哑铃','杠铃','俯身']],
  ['杠铃俯身划船','BV1zS2BBxEFn','杠铃俯身划船',['杠铃','俯身','划船'],['哑铃','坐姿','绳索']],
  ['直臂下压','BV1RDtZ6hEiX','直臂下压',['直臂下压'],['哑铃','杠铃']],
  ['哑铃弯举','BV1X54y1a71n','哑铃弯举',['哑铃','弯举'],['锤式','集中','杠铃']],
  ['杠铃深蹲','BV1zm4y1j7Cn','杠铃深蹲',['杠铃','深蹲'],['哑铃','高脚杯','相扑','箭步','保加利亚']],
  ['腿举','BV1BL4y1L7wt','腿举',['腿举'],['哑铃','杠铃','深蹲','箭步']],
  ['罗马尼亚硬拉','BV1SqYk6XEfv','杠铃罗马尼亚硬拉',['罗马尼亚','硬拉','杠铃'],['哑铃']],
  ['坐姿腿屈伸','BV1YR4y1x7ya','坐姿腿屈伸',['腿屈伸','坐姿'],['哑铃','杠铃','俯卧']],
  ['俯卧腿弯举','BV1Vj411x73r','俯卧腿弯举',['腿弯举'],['哑铃','杠铃','坐姿']],
  ['站姿提踵','BV13r4y1P7G3','半蹲提踵',['提踵'],['坐姿']],
  ['坐姿哑铃推举','BV1zi4y1y7QS','坐姿哑铃推举',['坐姿','哑铃','推举'],['站姿','杠铃']],
  ['绳索面拉','BV17T2UYxE12','绳索面拉',['面拉','绳索'],['哑铃','杠铃']],
  ['负重卷腹','BV13D421p75t','负重卷腹',['负重','卷腹'],['反向','悬垂','俄罗斯','器械']],
  ['悬垂举腿','BV1Uo4y1t7S6','悬垂举腿',['悬垂举腿'],['卷腹','反向','负重','器械']],
];

function pick(name, kw, incl, excl, cur) {
  const cv = view(cur);                       // 复核现片
  const curAlive = !!cv;
  const curScore = (!cv || cv.secs > 95) ? -1e9 : score(cv.title) + durAdj(cv.secs);
  const cands = search(kw).filter(c => c.secs <= 95 && passIncl(c.title, incl) && passExcl(c.title, excl));
  let best = null, bestTotal = -1e9, bestRaw = -1e9;
  for (const c of cands) {
    const raw = score(c.title);
    const total = raw + durAdj(c.secs);
    if (total > bestTotal) { bestTotal = total; bestRaw = raw; best = c; }
  }
  const reason = { curScore: Math.round(curScore), bestRaw, bestTotal: Math.round(bestTotal) };
  if (best && best.bv !== cur && bestTotal > curScore + 2) {
    const v = view(best.bv);
    if (v && v.secs <= 95) return { name, cur, chosen: best.bv, title: v.title, secs: v.secs, changed: true, note: JSON.stringify(reason) };
  }
  return { name, cur, chosen: cur, title: cv ? cv.title : '', secs: cv ? cv.secs : -1, changed: false, note: curAlive ? 'keep' : 'CUR DEAD! ' + JSON.stringify(reason) };
}

const results = [];
let changed = 0;
for (let i = 0; i < ACTIONS.length; i++) {
  const [name, cur, kw, incl, excl] = ACTIONS[i];
  const r = pick(name, kw, incl, excl, cur);
  results.push(r);
  if (r.changed) changed++;
  console.log(`[${i + 1}/${ACTIONS.length}] ${name} -> ${r.changed ? r.chosen + ' (' + r.secs + 's) ' + r.note : 'keep ' + cur + '  ' + r.note}`);
  sleep(550);
}
fs.writeFileSync(path.join(__dirname, 'rescreen-result.json'), JSON.stringify(results, null, 2), 'utf8');
console.log(`\nDONE. changed=${changed}/${ACTIONS.length}`);
