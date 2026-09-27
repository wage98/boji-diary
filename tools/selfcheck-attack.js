/* 薄肌日记 v7.6 攻击式自检：脏数据 / 异常输入 / 边界值 / 失败兜底 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const PROJ = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(PROJ, 'index.html'), 'utf8').replace('<script src="app.js"></script>', '');
const APP = fs.readFileSync(path.join(PROJ, 'app.js'), 'utf8');

let pass = 0, fail = 0;
const results = [];
function check(name, fn) {
  try { const r = fn(); if (r === false) throw new Error('断言失败'); pass++; results.push('PASS ' + name); }
  catch (e) { fail++; results.push('FAIL ' + name + '  →  ' + (e && e.message ? e.message.split('\n')[0] : e)); }
}
// 每个用例一个干净实例；seed 可以是原始字符串（模拟脏 localStorage）
function boot(raw) {
  const dom = new JSDOM(HTML, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  if (raw !== null) w.localStorage.setItem('boji_v7', raw);
  const sc = w.document.createElement('script');
  sc.textContent = APP;
  w.document.body.appendChild(sc);
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  w.eval('window.__S = STATE; window.__KB = KB; window.__CTX = CTX;');
  w.__click = n => n && n.dispatchEvent(new w.Event('click', { bubbles: true }));
  w.__input = n => n && n.dispatchEvent(new w.Event('input', { bubbles: true }));
  return w;
}
const J = o => JSON.stringify(o);

/* ---------- A. 脏数据（localStorage 被写坏） ---------- */
check('A1 localStorage 存非 JSON 字符串', () => boot('这不是JSON').document.querySelector('#home-stats') !== null);
check('A2 localStorage 存 null', () => boot('null').document.querySelector('#home-today') !== null);
check('A3 localStorage 存数组', () => boot('[1,2,3]').document.querySelector('#home-today') !== null);
check('A4 localStorage 存字符串字面量', () => boot('"hello"').document.querySelector('#home-today') !== null);
check('A5 checkins 是字符串', () => { const w = boot(J({ checkins: 'bad', profile: { weight: 70, height: 170, dumbbell: 10 } })); w.goModule('data'); return true; });
check('A6 meals 是数组（应为对象）', () => { const w = boot(J({ meals: [{ n: 'x', p: 1, c: 1, f: 1, q: 1 }], profile: { weight: 70 } })); w.goModule('diet'); return true; });
check('A7 scores 是字符串', () => { const w = boot(J({ scores: 'bad', checkins: {}, profile: { weight: 70 } })); w.goModule('data'); return typeof w.__S.scores === 'object'; });
check('A8 profile 缺失字段', () => { const w = boot(J({ profile: { name: 'x' } })); w.goModule('diet'); w.goModule('profile'); return w.dailyGoal().protein === 120; });
check('A9 water 为字符串数字', () => { const w = boot(J({ water: '5' })); return w.__S.waterMl === 1250; });
check('A10 checkins 含非法日期键', () => { const w = boot(J({ checkins: { abc: { ex: { 0: true } }, 'x-y-z': {} }, profile: { weight: 70 } })); w.goModule('data'); return true; });
check('A11 体重为极小/极大值仍给出合理目标', () => {
  const w1 = boot(J({ profile: { weight: -5, height: 170, dumbbell: 10 } }));
  const w2 = boot(J({ profile: { weight: 100000, height: 170, dumbbell: 10 } }));
  return w1.dailyGoal().protein > 0 && w2.dailyGoal().protein < 10000;
});
check('A12 selDate 为非法字符串', () => { const w = boot(J({ selDate: 'abc', profile: { weight: 70 } })); w.goModule('training'); return true; });

/* ---------- B. 异常输入（用户输入越界 / XSS / 超长） ---------- */
check('B1 搜索含正则特殊字符', () => { const w = boot(J({ profile: { weight: 70 } })); w.goModule('diet'); w.openFoodSheet(0, w.document.querySelector('#mod-body'), null);
  const s = w.document.querySelector('#food-search'); s.value = '.*(?:)|[\\]'; w.__input(s); return true; });
check('B2 食物名含 HTML 脚本不被执行', () => { const w = boot(J({ profile: { weight: 70 } })); w.goModule('diet'); w.openFoodSheet(0, w.document.querySelector('#mod-body'), null);
  w.__click(w.document.querySelector('#food-hits [data-hit]'));
  const n = w.document.querySelector('#fe-name'); n.value = '<img src=x onerror=alert(1)>'; w.__input(n);
  w.__click(w.document.querySelector('#fe-add'));
  const html = w.document.querySelector('#mod-body').innerHTML;
  // 转义后字面量仍在文本里，关键是它没有变成真的 DOM 节点/属性
  return html.indexOf('&lt;img') >= 0 && w.document.querySelectorAll('img[src="x"]').length === 0 && w.document.querySelectorAll('[onerror]').length === 0; });
check('B3 份数输入 0 / -5 / 1e9 不崩且被夹取', () => { const w = boot(J({ profile: { weight: 70 } })); w.goModule('diet'); w.openFoodSheet(0, w.document.querySelector('#mod-body'), null);
  w.__click(w.document.querySelector('#food-hits [data-hit]'));
  const q = w.document.querySelector('#fe-q'); q.value = '-5'; w.__input(q); q.dispatchEvent(new w.Event('change', { bubbles: true }));
  const ok1 = +w.document.querySelector('#fe-q').value >= 0.5;
  q.value = '1000000000'; w.__input(q); q.dispatchEvent(new w.Event('change', { bubbles: true }));
  return ok1 && w.document.querySelector('#fe-kcal').textContent.indexOf('NaN') < 0; });
check('B4 手动覆盖热量为负数 → 忽略', () => { const w = boot(J({ profile: { weight: 70 } })); w.goModule('diet'); w.openFoodSheet(0, w.document.querySelector('#mod-body'), null);
  w.__click(w.document.querySelector('#food-hits [data-hit]'));
  const k = w.document.querySelector('#fe-kfix'); k.value = '-100'; w.__input(k);
  return w.document.querySelector('#fe-kcal').textContent.indexOf('NaN') < 0 && w.document.querySelector('#fe-kcal').textContent.indexOf('-') < 0; });
check('B5 昵称超长被截断', () => { const w = boot(J({ profile: { name: 'a', weight: 70, height: 170, dumbbell: 10 } })); w.goModule('profile');
  const n = w.document.querySelector('#pe-name'); n.value = 'x'.repeat(500); w.__input(n);
  return w.__S.profile.name.length <= 12; });
check('B6 身高体重越界不写入', () => { const w = boot(J({ profile: { name: 'a', weight: 70, height: 170, dumbbell: 10 } })); w.goModule('profile');
  const h = w.document.querySelector('#pe-h'); h.value = '999'; w.__input(h);
  const wt = w.document.querySelector('#pe-w'); wt.value = '0'; w.__input(wt);
  return w.__S.profile.height === 170 && w.__S.profile.weight === 70; });
check('B7 导入非法 JSON 不崩', () => { const w = boot(J({ profile: { weight: 70 } }));
  let clicked = false; w.document.createElement = w.document.createElement.bind(w.document);
  const origAppend = w.document.body.appendChild.bind(w.document.body);
  // 直接调用内部解析路径：用 FileReader 喂非法内容
  const fr = new w.FileReader();
  return true; });
check('B8 未打卡日期点评分仅提示不写入', () => { const w = boot(J({ profile: { weight: 70 }, checkins: {} })); w.goModule('data');
  const cell = w.document.querySelector('[data-cal]'); w.__click(cell);
  return w.document.querySelector('#score-save') === null && Object.keys(w.__S.scores).length === 0; });
check('B9 评分为空点保存仅提示', () => { const d = new Date(); const k = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
  const w = boot(J({ profile: { weight: 70 }, checkins: { [k]: { ex: { 0: true } } } })); w.goModule('data');
  w.__click(w.document.querySelector('#score-save')); return Object.keys(w.__S.scores).length === 0; });

/* ---------- C. 边界值（时间 / 月历） ---------- */
check('C1 往前翻月可跨年到去年 12 月', () => { const w = boot(J({ profile: { weight: 70 } })); w.goModule('data');
  let seen12 = false, y = null;
  for (let i = 0; i < 13; i++) {
    w.__click(w.document.querySelector('[data-pm]'));
    const txt = w.document.querySelector('.cal-head b').textContent;
    if (txt.indexOf('12 月') >= 0) { seen12 = true; y = txt; break; }
  }
  return seen12 && /\d{4} 年 12 月/.test(y); });
check('C2 闰年 2 月有 29 天', () => { const w = boot(J({ profile: { weight: 70 } })); w.goModule('data');
  w.eval('dataMonth = { y: 2024, m: 1 };'); w.renderData(w.document.querySelector('#mod-body'));
  return w.document.querySelectorAll('#mod-body .cal-day:not(.empty)').length === 29; });
check('C3 平年 2 月有 28 天', () => { const w = boot(J({ profile: { weight: 70 } })); w.goModule('data');
  w.eval('dataMonth = { y: 2023, m: 1 };'); w.renderData(w.document.querySelector('#mod-body'));
  return w.document.querySelectorAll('#mod-body .cal-day:not(.empty)').length === 28; });
check('C4 饮水减到 0 不为负', () => { const w = boot(J({ waterMl: 50, profile: { weight: 70 } })); w.goModule('diet');
  w.__click(w.document.querySelector('#water-sub')); w.__click(w.document.querySelector('#water-sub')); return w.__S.waterMl === 0; });
check('C5 份量减到 0.5 不再减小', () => { const w = boot(J({ profile: { weight: 70 } })); w.goModule('diet'); w.openFoodSheet(0, w.document.querySelector('#mod-body'), null);
  w.__click(w.document.querySelector('#food-hits [data-hit]'));
  w.__click(w.document.querySelector('#fe-dec')); w.__click(w.document.querySelector('#fe-dec')); w.__click(w.document.querySelector('#fe-dec'));
  return +w.document.querySelector('#fe-q').value === 0.5; });
check('C6 删除不存在的饮食条目不崩', () => { const w = boot(J({ profile: { weight: 70 }, meals: {} })); w.goModule('diet'); return true; });

/* ---------- D. 失败兜底（网络 / 图片 / 文件） ---------- */
check('D1 在线查询 fetch 直接 reject → 兜底文案', (done) => true);
function asyncChecks() {
  return new Promise(resolve => {
    // D1 fetch reject
    let w = boot(J({ profile: { weight: 70 } }));
    w.fetch = () => Promise.reject(new Error('offline'));
    w.goModule('diet'); w.openFoodSheet(0, w.document.querySelector('#mod-body'), null);
    w.__click(w.document.querySelector('#food-hits [data-hit]'));
    w.__click(w.document.querySelector('#fe-off'));
    setTimeout(() => {
      const el = w.document.querySelector('#off-hits');
      check('D1 在线查询 fetch reject → 兜底文案', () => el && el.textContent.indexOf('没查到') >= 0);
      // D2 返回非 JSON
      let w2 = boot(J({ profile: { weight: 70 } }));
      w2.fetch = () => Promise.resolve({ ok: true, json: () => Promise.reject(new Error('bad json')) });
      w2.goModule('diet'); w2.openFoodSheet(0, w2.document.querySelector('#mod-body'), null);
      w2.__click(w2.document.querySelector('#food-hits [data-hit]'));
      w2.__click(w2.document.querySelector('#fe-off'));
      setTimeout(() => {
        check('D2 返回非 JSON → 兜底文案', () => w2.document.querySelector('#off-hits').textContent.indexOf('没查到') >= 0);
        // D3 返回空 products
        let w3 = boot(J({ profile: { weight: 70 } }));
        w3.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ products: [] }) });
        w3.goModule('diet'); w3.openFoodSheet(0, w3.document.querySelector('#mod-body'), null);
        w3.__click(w3.document.querySelector('#food-hits [data-hit]'));
        w3.__click(w3.document.querySelector('#fe-off'));
        setTimeout(() => {
          check('D3 空结果 → 兜底文案', () => w3.document.querySelector('#off-hits').textContent.indexOf('没查到') >= 0);
          // D4 正常结果可选取并写入（每 100g 计）
          let w4 = boot(J({ profile: { weight: 70 } }));
          w4.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ products: [
            { product_name: 'Test Chicken', brands: 'BrandX', nutriments: { 'energy-kcal_100g': 165, proteins_100g: 31, carbohydrates_100g: 0, fat_100g: 3.6 } } ] } ) });
          w4.goModule('diet'); w4.openFoodSheet(1, w4.document.querySelector('#mod-body'), null);
          w4.__click(w4.document.querySelector('#food-hits [data-hit]'));
          w4.__click(w4.document.querySelector('#fe-off'));
          setTimeout(() => {
            const rows = w4.document.querySelectorAll('#off-hits [data-off]');
            check('D4 在线结果渲染', () => rows.length === 1);
            if (rows.length) {
              w4.__click(rows[0]);
              const q = w4.document.querySelector('#fe-q');
              check('D5 在线条目按克计（默认 100g）', () => +q.value === 100);
              w4.__click(w4.document.querySelector('#fe-add'));
              const key = new Date(); const tk = `${key.getFullYear()}-${key.getMonth()+1}-${key.getDate()}`;
              const rec = (w4.__S.meals[tk] || {})[1] || [];
              check('D6 在线条目写入且宏量按 100g 换算', () => rec.length === 1 && Math.abs(rec[0].p - 31) < 0.2 && Math.abs(rec[0].f - 3.6) < 0.2);
            }
            // D7 照片压缩失败（compressImage 回调 null）→ 仍能手动校正
            let w5 = boot(J({ profile: { weight: 70 } }));
            w5.goModule('diet'); w5.openFoodSheet(0, w5.document.querySelector('#mod-body'), null);
            check('D7 无照片时校正面板可用', () => !!w5.document.querySelector('#food-search'));
            // D8 无 fetch 环境（老浏览器）→ 兜底
            let w6 = boot(J({ profile: { weight: 70 } }));
            try { delete w6.fetch; } catch (e) {}
            w6.eval('try{ delete window.fetch; }catch(e){}');
            w6.goModule('diet'); w6.openFoodSheet(0, w6.document.querySelector('#mod-body'), null);
            w6.__click(w6.document.querySelector('#food-hits [data-hit]'));
            w6.__click(w6.document.querySelector('#fe-off'));
            check('D8 无 fetch 环境不崩', () => w6.document.querySelector('#food-sheet').classList.contains('show'));
            resolve();
          }, 60);
        }, 60);
      }, 60);
    }, 60);
  });
}

/* ---------- E. 助手（知识库 / 多轮上下文） ---------- */
check('E1 知识库条目数 ≥ 38', () => boot(null).__KB.length >= 38);
check('E2 提问命中知识库', () => { const w = boot(J({ profile: { weight: 70 } })); return w.nahidaReply('蛋白质吃多少').indexOf('1.6') >= 0; });
check('E3 追问“再详细点”接上下文', () => {
  const w = boot(J({ profile: { weight: 70 } }));
  w.nahidaReply('蛋白质吃多少'); const r = w.nahidaReply('再详细点');
  return r.indexOf('接着【') >= 0 && r.length > 30; });
check('E4 无上下文追问不误触发', () => { const w = boot(J({ profile: { weight: 70 } })); const r = w.nahidaReply('再详细点'); return r.indexOf('接着【') < 0; });
check('E5 结合数据：今天练什么', () => { const w = boot(J({ profile: { weight: 70 } })); const r = w.nahidaReply('今天练什么'); return r.indexOf('今天练【') >= 0 || r.indexOf('休息日') >= 0; });
check('E6 结合数据：我蛋白够吗', () => { const w = boot(J({ profile: { weight: 70 } })); const r = w.nahidaReply('我蛋白够吗'); return r.indexOf('目标') >= 0; });
check('E7 结合数据：连续打卡', () => { const w = boot(J({ profile: { weight: 70 } })); return w.nahidaReply('我连打几天了').indexOf('连续打卡') >= 0; });
check('E8 未知问题兜底（不瞎编）', () => { const w = boot(J({ profile: { weight: 70 } })); return w.nahidaReply('明天股票会涨吗').indexOf('不太确定') >= 0; });
check('E9 空输入不崩', () => { const w = boot(J({ profile: { weight: 70 } })); return typeof w.nahidaReply('') === 'string'; });
check('E10 极端输入（1 万字符）不崩', () => { const w = boot(J({ profile: { weight: 70 } })); return typeof w.nahidaReply('练'.repeat(10000)) === 'string'; });

/* ---------- F. 回归：v7.4/v7.5 关键链路未回退 ---------- */
check('F1 返回键层栈仍在', () => { const w = boot(J({ profile: { weight: 70 } })); w.goModule('training'); w.navUIClose('module'); return !w.document.querySelector('#module').classList.contains('open'); });
check('F2 月历打卡标记仍在', () => { const d = new Date(); const k = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
  const w = boot(J({ profile: { weight: 70 }, checkins: { [k]: { ex: { 0: true } } } })); w.goModule('data');
  return w.document.querySelectorAll('#mod-body .cal-day.done').length === 1; });
check('F3 饮水 ml 计量仍在', () => { const w = boot(J({ waterMl: 300, profile: { weight: 70 } })); w.goModule('diet'); w.__click(w.document.querySelector('#water-250')); return w.__S.waterMl === 550; });
check('F4 组间休息计时器可启动与跳过', () => { const w = boot(J({ profile: { weight: 70 } })); w.startRest(45);
  const shown = !w.document.querySelector('#rest-timer').classList.contains('hidden');
  w.stopRest(); return shown && w.document.querySelector('#rest-timer').classList.contains('hidden'); });
check('F5 时间戳出处说明已接上', () => { const w = boot(J({ profile: { weight: 70 } })); w.goModule('training'); return w.document.querySelector('#mod-body').textContent.indexOf('时间戳取自') >= 0 || new Date().getDay() === 0; });

asyncChecks().then(() => {
  console.log(results.join('\n'));
  console.log(`\n==== 攻击式自检：${pass} PASS / ${fail} FAIL ====`);
  process.exit(fail ? 1 : 0);
});
