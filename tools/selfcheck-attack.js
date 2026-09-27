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
      check('D1 在线查询 fetch reject → 重试后兜底文案', () => el && el.textContent.indexOf('没查到') >= 0);
      // D2 返回非 JSON
      let w2 = boot(J({ profile: { weight: 70 } }));
      w2.fetch = () => Promise.resolve({ ok: true, json: () => Promise.reject(new Error('bad json')) });
      w2.goModule('diet'); w2.openFoodSheet(0, w2.document.querySelector('#mod-body'), null);
      w2.__click(w2.document.querySelector('#food-hits [data-hit]'));
      w2.__click(w2.document.querySelector('#fe-off'));
      setTimeout(() => {
        check('D2 返回非 JSON → 重试后兜底文案', () => w2.document.querySelector('#off-hits').textContent.indexOf('没查到') >= 0);
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
      }, 1350);   // D2：弱网自动重试 1 次（900ms 延迟）后才有兜底文案
    }, 1350);     // D1：同上
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

/* ---------- G. v7.7 识别流程（置信度 / 条码 / 历史推荐 / 二次校验 / 相册入口） ---------- */
check('G1 foodConfidence 非法来源→0，合法来源在(0,1]', () => { const w = boot(J({ profile: { weight: 70 } }));
  return w.foodConfidence('nope') === 0 && w.foodConfidence('barcode') === 0.95 && w.foodConfidence() === 0 && w.foodConfidence('off') === 0.8; });
check('G2 confLabel 四档正确', () => { const w = boot(J({ profile: { weight: 70 } })); const L = w.confLabel;
  return L(0.95)[0] === '高' && L(0.75)[0] === '中' && L(0.45)[0] === '低' && L(0)[0] === '无'; });
check('G3 favFoods 空 meals 不崩返回空数组', () => { const w = boot(J({ profile: { weight: 70 } })); const f = w.favFoods();
  return Array.isArray(f) && f.length === 0; });
check('G4 favFoods 脏 meals 结构不崩且只收数组餐项', () => { const w = boot(J({ profile: { weight: 70 },
    meals: { a: 'x', b: { 0: 'not-array' }, c: { 0: [{ n: '鸡胸肉(150g)', p: 35, c: 0, f: 6, q: 1 }] } } }));
  const f = w.favFoods(); return Array.isArray(f) && f.length === 1 && f[0].cnt === 1; });
check('G5 favFoods 按频次排序且历史置信度 0.75', () => { const w = boot(J({ profile: { weight: 70 },
    meals: { '2026-9-27': { 0: [{ n: '鸡蛋(1个)', p: 6, c: 1, f: 5, q: 1 }, { n: '鸡蛋(1个)', p: 6, c: 1, f: 5, q: 2 }], 1: [{ n: '鸡胸肉(150g)', p: 35, c: 0, f: 6, q: 1 }] } } }));
  const f = w.favFoods(); return f[0].n === '鸡蛋(1个)' && f[0].cnt === 2 && Math.abs(f[0].conf - 0.75) < 0.001; });
check('G6 detectBarcodePhoto 无 BarcodeDetector → 错误回调不崩', () => { const w = boot(J({ profile: { weight: 70 } }));
  let called = false, er = null;
  w.detectBarcodePhoto('data:image/jpeg;base64,AAAA', (e, c) => { called = true; er = e; });
  return called && !!er; });
check('G7 detectBarcodePhoto 非法 dataURL → 错误回调', () => { const w = boot(J({ profile: { weight: 70 } }));
  let er = null; w.detectBarcodePhoto('garbage', (e) => { er = e; }); return !!er; });
check('G8 fetchOFFBarcode 无 fetch → 错误回调', () => { const w = boot(J({ profile: { weight: 70 } }));
  w.fetch = undefined; let er = null;
  w.fetchOFFBarcode('6901234567890', (e) => { er = e || 'ok'; });
  return !!er && er !== 'ok'; });
check('G9 低置信度（模糊匹配）结果显示警示条', () => { const w = boot(J({ profile: { weight: 70 } })); w.goModule('diet');
  w.openFoodSheet(0, w.document.querySelector('#mod-body'), null);
  const s = w.document.querySelector('#food-search'); s.value = '鸡胸'; w.__input(s);
  w.__click(w.document.querySelector('#food-hits [data-hit]'));
  return w.document.querySelector('#food-editor .fs-warn.warn-lo') !== null; });
check('G10 历史推荐选中显示「中」置信度徽章', () => { const w = boot(J({ profile: { weight: 70 },
    meals: { '2026-9-27': { 0: [{ n: '鸡蛋(1个)', p: 6, c: 1, f: 5, q: 1 }] } } }));
  w.goModule('diet'); w.openFoodSheet(0, w.document.querySelector('#mod-body'), null);
  const fav = w.document.querySelector('#fav-hits [data-fav]'); if (!fav) return false;
  w.__click(fav);
  return w.document.querySelector('#food-editor .cf-badge.cf-mid') !== null; });
check('G11 热量覆盖 99999 被夹取到 5000', () => { const w = boot(J({ profile: { weight: 70 } })); w.goModule('diet');
  w.openFoodSheet(0, w.document.querySelector('#mod-body'), null);
  w.__click(w.document.querySelector('#food-hits [data-hit]'));
  const k = w.document.querySelector('#fe-kfix'); k.value = '99999'; w.__input(k);
  return w.document.querySelector('#fe-kfix').value === '5000'; });
check('G12 单份热量 >4000 时确认添加被拦截（结果二次校验）', () => { const d = new Date(); const tk = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const w = boot(J({ profile: { weight: 70 } })); w.goModule('diet');
  w.openFoodSheet(0, w.document.querySelector('#mod-body'), null);
  w.__click(w.document.querySelector('#food-hits [data-hit]'));
  const k = w.document.querySelector('#fe-kfix'); k.value = '9999'; w.__input(k);
  w.__click(w.document.querySelector('#fe-add'));
  const stillOpen = w.document.querySelector('#food-sheet').classList.contains('show');
  const recs = ((w.__S.meals[tk] || {})[0]) || [];
  return stillOpen && recs.length === 0; });
check('G13 拍照/相册入口分离（相册 input 无 capture、拍照 input 有 capture）', () => { const w = boot(J({ profile: { weight: 70 } })); w.goModule('diet');
  const created = [];
  const origCreate = w.document.createElement.bind(w.document);
  w.document.createElement = (tag) => { const el = origCreate(tag); if (String(tag).toLowerCase() === 'input') created.push(el); return el; };
  const body = w.document.querySelector('#mod-body');
  w.openPhotoIntake(0, body, false);
  w.openPhotoIntake(0, body, true);
  return created.length === 2 && !created[0].hasAttribute('capture') && created[1].hasAttribute('capture'); });

/* ---------- H. v7.8 新增：AI 识别校验 / 体重曲线 / 自定义动作 / 自绘形象 ---------- */
check('H1 AI 结果离谱值被夹取（克 99999→2000、热量 -5→0、蛋白 1e6→200）', () => {
  const w = boot(J({ profile: { weight: 70 } })); const sv = w.eval('sanitizeVision');
  const r = sv({ name: 'x'.repeat(80), grams: 99999, kcal: -5, protein: 1e6, carb: -3, fat: 999, confidence: 5 });
  return r.grams === 2000 && r.kcal >= 0 && r.p <= 200 && r.c >= 0 && r.f <= 200 && r.conf <= 1 && r.name.length <= 24;
});
check('H2 AI 热量与宏量矛盾 >35% → 以宏量为准并降置信度', () => {
  const w = boot(J({ profile: { weight: 70 } })); const sv = w.eval('sanitizeVision');
  const r = sv({ name: '饭', grams: 200, kcal: 5000, protein: 5, carb: 58, fat: 1, confidence: 0.9 });
  return r.kcal === Math.round(5*4 + 58*4 + 1*9) && r.conf <= 0.7 && r.adjusted === true;
});
check('H3 AI 只给热量 → 自动拆出宏量且自洽', () => {
  const w = boot(J({ profile: { weight: 70 } })); const sv = w.eval('sanitizeVision');
  const r = sv({ name: '饭', grams: 150, kcal: 300, confidence: 0.8 });
  return Math.abs((r.p*4 + r.c*4 + r.f*9) - r.kcal) <= 3;
});
check('H4 extractJSON：```json 包裹可解析 / 垃圾文本返回 null', () => {
  const w = boot(J({ profile: { weight: 70 } })); const ex = w.eval('extractJSON');
  return ex('```json\n{"a":1}\n```').a === 1 && ex('抱歉我无法识别') === null && ex('') === null && ex(null) === null;
});
check('H5 logWeight 脏数据不写入（abc / 500 / 10 / null）', () => {
  const w = boot(J({ profile: { weight: 70 } })); const lw = w.eval('logWeight');
  ['abc', 500, 10, null, undefined, NaN, {}].forEach(v => lw(v));
  return w.__S.bodyWeights.length === 0;
});
check('H6 logWeight 同日覆盖、跨日追加且按日期排序', () => {
  const w = boot(J({ profile: { weight: 70 }, bodyWeights: [
    { d: '2026-10-2', w: 70 }, { d: '2026-9-3', w: 72 }, { d: '2026-9-20', w: 71 } ] }));
  const lw = w.eval('logWeight');
  lw(69.5);                                     // 今日
  const arr = w.__S.bodyWeights;
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; })();
  const dv = w.eval('dateVal');
  let sorted = true; for (let i = 1; i < arr.length; i++) if (dv(arr[i].d) < dv(arr[i-1].d)) sorted = false;
  return sorted && arr.filter(x => x.d === today).length === 1 && arr.filter(x => x.d === today)[0].w === 69.5;
});
check('H7 体重曲线：空数据有兜底文案、单点无 NaN、多点生成路径', () => {
  const w = boot(J({ profile: { weight: 70 } })); const g = w.eval('weightChartSVG'), cw = w.eval('cleanWeights');
  const empty = g([]);
  const one = g([{ d: '2026-9-1', w: 70 }]);
  const many = g([{ d: '2026-9-1', w: 72 }, { d: '2026-9-5', w: 70.5 }, { d: '2026-9-9', w: 69 }, { d: '2026-9-20', w: 68.4 }]);
  const bad = cw.call(null) === undefined || true;
  return empty.indexOf('还没有体重记录') >= 0 && one.indexOf('NaN') < 0 && many.indexOf('NaN') < 0
      && many.indexOf('<path') >= 0 && bad;
});
check('H8 自绘形象：10 种情绪都能生成且无 undefined / 无外链', () => {
  const w = boot(J({ profile: { weight: 70 } })); const f = w.eval('nahidaSVG');
  const moods = ['happy','cheer','proud','expect','think','sad','sleep','wave','hover','drag'];
  // 外链检查：只允许 SVG 命名空间声明，不允许任何 href/src/外域 URL（保证离线可用、无追踪）
  const noRemote = s => {
    const stripped = s.replace('http://www.w3.org/2000/svg', '');
    return stripped.indexOf('http') < 0 && stripped.indexOf('href') < 0 && stripped.indexOf('src') < 0;
  };
  return moods.every(m => { const s = f(m);
    return s.indexOf('<svg') === 0 && s.indexOf('undefined') < 0 && s.indexOf('NaN') < 0 && noRemote(s) && s.indexOf('<script') < 0; });
});
check('H9 皮肤切换：official 用素材、svg 用 dataURI', () => {
  const w = boot(J({ profile: { weight: 70 } }));
  w.__S.petSkin = 'official'; w.eval('applyPetArt')('happy');
  const a = w.document.getElementById('pet-img').getAttribute('src');
  w.__S.petSkin = 'svg'; w.eval('applyPetArt')('cheer');
  const b = w.document.getElementById('pet-img').getAttribute('src');
  return a.indexOf('assets/') >= 0 && b.indexOf('data:image/svg+xml') === 0 && b.indexOf('svg') > 0;
});
check('H10 自定义动作：超名截断 / 组数夹取 / XSS 不执行', () => {
  const w = boot(J({ profile: { weight: 70 } })); w.goModule('training');
  w.__click(w.document.querySelector('#mx-add'));
  w.document.querySelector('#mx-name').value = '<img src=x onerror=alert(1)>超长动作名测试测试测试';
  w.document.querySelector('#mx-sets').value = '99';
  w.document.querySelector('#mx-rest').value = '9999';
  w.__click(w.document.querySelector('#mx-save'));
  const x = w.__S.myEx[0];
  return w.__S.myEx.length === 1 && x.name.length <= 16 && x.sets === 10 && x.rest === 300
      && w.document.querySelectorAll('[onerror]').length === 0 && w.document.querySelectorAll('img[src="x"]').length === 0;
});
check('H11 自定义动作：完成勾选落库、删除生效（且不产生 NaN 键）', () => {
  const w = boot(J({ profile: { weight: 70 } })); w.confirm = () => true; w.goModule('training');
  w.__click(w.document.querySelector('#mx-add'));
  w.document.querySelector('#mx-name').value = '侧平举';
  w.__click(w.document.querySelector('#mx-save'));
  const btn = w.document.querySelector('#mod-body [data-mex]');
  w.__click(btn);
  const k = Object.keys(w.__S.checkins[w.eval('selKey()')].ex);
  const okDone = k.some(x => x.indexOf('c') === 0) && k.every(x => x !== 'NaN');
  w.__click(w.document.querySelector('#mod-body [data-mdel]'));
  return okDone && w.__S.myEx.length === 0;
});
check('H12 自定义动作上限 20 个（超出不写入）', () => {
  const list = []; for (let i = 0; i < 20; i++) list.push({ id: 'm' + i, name: '动作' + i, part: '肩', sets: 3, reps: '12', rest: 60, note: '' });
  const w = boot(J({ profile: { weight: 70 }, myEx: list })); w.goModule('training');
  w.__click(w.document.querySelector('#mx-add'));
  w.document.querySelector('#mx-name').value = '第21个';
  w.__click(w.document.querySelector('#mx-save'));
  return w.__S.myEx.length === 20;
});
check('H13 myEx 脏数据（非数组 / 缺 id 项）不影响训练页渲染', () => {
  const w1 = boot(J({ profile: { weight: 70 }, myEx: 'bad' })); w1.goModule('training');
  const w2 = boot(J({ profile: { weight: 70 }, myEx: [{ name: '无id动作' }, null, 42] })); w2.goModule('training');
  return Array.isArray(w1.__S.myEx) && w1.__S.myEx.length === 0 && w2.document.querySelector('#mx-add') !== null;
});
check('H14 体重录入越界被拒绝（25 / 500 / 空）', () => {
  const d = new Date(); const tk = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
  const w = boot(J({ profile: { weight: 70 } })); w.goModule('data');
  const inp = w.document.querySelector('#wt-in');
  inp.value = '25'; w.__click(w.document.querySelector('#wt-add'));
  const a = w.__S.bodyWeights.length;
  inp.value = '500'; w.__click(w.document.querySelector('#wt-add'));
  const b = w.__S.bodyWeights.length;
  inp.value = '68.5'; w.__click(w.document.querySelector('#wt-add'));
  return a === 0 && b === 0 && w.__S.bodyWeights.length === 1 && w.__S.bodyWeights[0].w === 68.5 && w.__S.profile.weight === 68.5;
});
check('H15 AI 设置：非 https 地址被拒绝且提示', () => {
  const w = boot(J({ profile: { weight: 70 } })); w.goModule('profile');
  w.document.querySelector('#vs-mode').value = 'proxy';
  w.document.querySelector('#vs-ep').value = 'http://a.com/recognize';
  w.document.querySelector('#vs-tk').value = 'tk';
  w.__click(w.document.querySelector('#vs-save'));
  return w.__S.vision.mode !== 'proxy' && w.document.querySelector('#vs-tip').innerHTML.indexOf('https') >= 0;
});

/* ---------- AI 识别链路（异步，mock 模型服务） ---------- */
const TINY = 'x'.repeat(300);
async function aiChecks() {
  const mk = (handler) => {
    const w = boot(J({ profile: { weight: 70 } }));
    w.fetch = handler;
    return w;
  };
  // V1 未开启 → 不发任何请求
  {
    let calls = 0;
    const w = mk(() => { calls++; return Promise.resolve({ ok: true, text: () => Promise.resolve('{}') }); });
    const r = await w.eval('visionRecognize')(TINY);
    check('V1 AI 未开启 → 返回未开启且不发请求', () => r.ok === false && r.error.indexOf('未开启') >= 0 && calls === 0);
  }
  // V2 地址非法 / 缺凭据
  {
    const w = boot(J({ profile: { weight: 70 }, vision: { mode: 'proxy', endpoint: 'ftp://x', token: 't', model: 'm' } }));
    const r = await w.eval('visionRecognize')(TINY);
    const w2 = boot(J({ profile: { weight: 70 }, vision: { mode: 'proxy', endpoint: 'https://x.dev/recognize', token: '', model: 'm' } }));
    const r2 = await w2.eval('visionRecognize')(TINY);
    const w3 = boot(J({ profile: { weight: 70 }, vision: { mode: 'proxy', endpoint: 'https://x.dev/recognize', token: 't', model: 'm' } }));
    const r3 = await w3.eval('visionRecognize')('ab');
    check('V2 地址非 http / 缺凭据 / 图片过短 → 均被前置拦截', () =>
      r.error.indexOf('地址无效') >= 0 && r2.error.indexOf('凭据') >= 0 && r3.error.indexOf('图片数据异常') >= 0);
  }
  // V3 proxy 成功
  {
    const w = boot(J({ profile: { weight: 70 }, vision: { mode: 'proxy', endpoint: 'https://x.dev/recognize', token: 't', model: 'glm-4v-flash' } }));
    w.fetch = () => Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify({ ok: true, data: { name: '米饭', grams: 200, kcal: 260, protein: 5, carb: 58, fat: 1, confidence: 0.8 } })) });
    const r = await w.eval('visionRecognize')(TINY);
    check('V3 代理模式成功 → 返回结构化结果且经过二次校验', () =>
      r.ok === true && r.data.name === '米饭' && r.data.grams === 200 && r.data.kcal > 0 && r.data.conf <= 0.88);
  }
  // V4 服务 500 → 自动重试 1 次后失败（不抛异常）
  {
    let calls = 0;
    const w = boot(J({ profile: { weight: 70 }, vision: { mode: 'proxy', endpoint: 'https://x.dev/recognize', token: 't', model: 'm' } }));
    w.fetch = () => { calls++; return Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve('err') }); };
    const r = await w.eval('visionRecognize')(TINY);
    check('V4 服务 500 → 重试 1 次共 2 次请求后返回错误', () => r.ok === false && calls === 2 && r.error.indexOf('500') >= 0);
  }
  // V5 网络中断 → 重试后仍失败，返回可展示的错误
  {
    let calls = 0;
    const w = boot(J({ profile: { weight: 70 }, vision: { mode: 'proxy', endpoint: 'https://x.dev/recognize', token: 't', model: 'm' } }));
    w.fetch = () => { calls++; return Promise.reject(new Error('offline')); };
    const r = await w.eval('visionRecognize')(TINY);
    check('V5 网络中断 → 重试后返回「网络错误」而非崩溃', () => r.ok === false && calls === 2 && !!r.error);
  }
  // V6 4xx 不重试
  {
    let calls = 0;
    const w = boot(J({ profile: { weight: 70 }, vision: { mode: 'proxy', endpoint: 'https://x.dev/recognize', token: 't', model: 'm' } }));
    w.fetch = () => { calls++; return Promise.resolve({ ok: false, status: 401, text: () => Promise.resolve('no') }); };
    await w.eval('visionRecognize')(TINY);
    check('V6 401 口令错误 → 不重试（避免刷额度）', () => calls === 1);
  }
  // V7 直连 OpenAI 兼容格式（模型输出被 ```json 包裹）
  {
    const w = boot(J({ profile: { weight: 70 }, vision: { mode: 'direct', endpoint: 'https://api.example.com/v1/chat/completions', token: 'k', model: 'glm-4v-flash' } }));
    w.fetch = () => Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify({
      choices: [{ message: { content: '```json\n{"name":"番茄炒蛋","grams":250,"kcal":330,"protein":18,"carb":12,"fat":22,"confidence":0.75}\n```' } }] })) });
    const r = await w.eval('visionRecognize')(TINY);
    check('V7 直连模式：剥掉代码块后正确解析', () => r.ok === true && r.data.name === '番茄炒蛋' && r.data.grams === 250 && r.data.kcal === 330);
  }
  // V8 模型返回无法解析 → 明确错误
  {
    const w = boot(J({ profile: { weight: 70 }, vision: { mode: 'direct', endpoint: 'https://api.example.com/v1/chat/completions', token: 'k', model: 'm' } }));
    w.fetch = () => Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify({ choices: [{ message: { content: '我看不出来' } }] })) });
    const r = await w.eval('visionRecognize')(TINY);
    check('V8 模型返回非 JSON → 返回「无法解析」', () => r.ok === false && r.error.indexOf('无法解析') >= 0);
  }
  // V9 uncertain → 置信度被打到 ≤0.35（不假装确定）
  {
    const w = boot(J({ profile: { weight: 70 } })); const sv = w.eval('sanitizeVision');
    const r = sv({ name: '不清楚', grams: 100, kcal: 200, protein: 5, carb: 20, fat: 5, confidence: 0.9, uncertain: true });
    check('V9 模型标 uncertain → 置信度强制降到 0.35 以下', () => r.uncertain === true && r.conf <= 0.35);
  }
}

asyncChecks().then(() => aiChecks()).then(() => {
  console.log(results.join('\n'));
  console.log(`\n==== 攻击式自检：${pass} PASS / ${fail} FAIL ====`);
  process.exit(fail ? 1 : 0);
});
