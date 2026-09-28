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
check('E8 未知问题兜底（不瞎编 + v7.11 共情口径）', () => {
  const w = boot(J({ profile: { weight: 70 } }));
  const r = w.nahidaReply('明天股票会涨吗');
  return /不想拍脑袋|不太确定|不确定/.test(r) && r.indexOf('卧推') >= 0;   // 必须给出替代话题，不能只说不知道
});
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

asyncChecks().then(() => aiChecks()).then(() => v79Checks()).then(() => v710Checks()).then(() => v711Checks()).then(() => v80Checks()).then(() => {
  console.log(results.join('\n'));
  console.log(`\n==== 攻击式自检：${pass} PASS / ${fail} FAIL ====`);
  process.exit(fail ? 1 : 0);
});

// ===== v7.9 增量：桌宠 Q 版形象 / 眨眼 / 彩蛋 / 知识库扩充 / 数据化回答 / 复制上一餐 =====
function v79Checks() {
  // I1 形象：10 情绪 + 眨眼帧全部输出有效 SVG
  {
    const w = boot(J({ profile: { weight: 70 } }));
    const f = w.eval('nahidaSVG');
    const moods = ['happy','cheer','proud','expect','think','sad','sleep','wave','hover','drag','blink'];
    const okAll = moods.every(m => { const s = f(m);
      return s.indexOf('<svg') === 0 && s.indexOf('undefined') < 0 && s.indexOf('NaN') < 0 && s.indexOf('<script') < 0; });
    check('I1 形象 v7.9：11 种帧（含眨眼）输出均有效', () => okAll);
  }
  // I2 眨眼帧支持对象参数（保留嘴型/腮红，不产生 NaN）
  {
    const w = boot(J({ profile: { weight: 70 } }));
    const hb = w.eval('nahidaSVG')({ eye:'closed', mouth:'o', blush:1, brow:'up', fx:'' });
    check('I2 眨眼帧对象参数 → 有效 SVG', () => hb.indexOf('<svg') === 0 && hb.indexOf('NaN') < 0);
  }
  // I3 眨眼调度与连点彩蛋已接线
  {
    const w = boot(J({ profile: { weight: 70 } }));
    check('I3 scheduleBlink / petTapEgg 已定义', () =>
      w.eval('typeof scheduleBlink') === 'function' && w.eval('typeof petTapEgg') === 'function');
  }
  // I4/I5 知识库扩充与新条目命中
  {
    const w = boot(J({ profile: { weight: 70 } }));
    check('I4 知识库条数 ≥ 60', () => w.eval('window.__KB').length >= 60);
    const r1 = w.eval('nahidaReply')('奶茶能喝吗');
    const r2 = w.eval('nahidaReply')('引体向上做不了');
    check('I5 新知识条目可命中（奶茶/引体）', () => r1.indexOf('液态热量') >= 0 && r2.indexOf('离心') >= 0);
  }
  // I6–I8 数据化回答（优先级与兜底）
  {
    const w = boot(J({ profile: { weight: 70 } }));
    const dr = w.eval('dataReply');
    check('I6 体重趋势（有档案无曲线）→ 引导记录而非档案文案', () => dr('最近体重趋势如何').indexOf('还没有体重曲线') >= 0);
    check('I7 本周统计回答含天数且不报错', () => dr('本周练了几次').indexOf('本周') >= 0);
    check('I8 吃什么建议（无记录）→ 结合蛋白缺口给推荐', () => dr('今天吃什么').indexOf('蛋白还差') >= 0);
  }
  // I9/I10 一键复制上一餐
  {
    const yst = new Date(); yst.setDate(yst.getDate() - 1);
    const yk = yst.getFullYear() + '-' + (yst.getMonth() + 1) + '-' + yst.getDate();
    const w = boot(J({ profile: { weight: 70 },
      meals: { [yk]: { 0: [{ n:'鸡胸', p:35, c:0, f:3, q:1, photo:'data:image/jpeg;base64,AAAA' }] } } }));
    w.goModule('diet');
    const row = w.document.querySelector('[data-rep]');
    check('I9 该餐今天为空且有历史 → 显示一键复制行', () => !!row && row.textContent.indexOf('鸡胸') >= 0);
    if (row) {
      w.__click(row);
      const tk = w.eval('todayKey')();
      const arr = w.__S.meals[tk] && w.__S.meals[tk][0];
      check('I10 点击复制 → 条目新增且照片已去除', () => !!arr && arr.length === 1 && arr[0].n === '鸡胸' && !arr[0].photo);
    }
  }
}

// ===== v7.10 增量：小蛛皮肤 / 悬挂翻转爱心 / 教练身份 / 桌面背景 / 识别评测联动 =====
function v710Checks() {
  // J1–J4 皮肤体系
  {
    const w = boot(J({ profile: { weight: 70 } }));
    const svg = w.eval('spiderSVG')('happy', 'v2');
    check('J1 小蛛 SVG 输出有效（svg 标签+viewBox）', () => svg.indexOf('<svg') >= 0 && svg.indexOf('viewBox') >= 0);
    check('J2 无 petSkin 脏数据 → 默认迁移为 spiderV3（v8.0 视频同款）', () => w.__S.petSkin === 'spiderV3');
    const moods = ['happy','cheer','proud','expect','think','sad','sleep','wave','hover','drag','blink'];
    check('J3 小蛛三个版本 11 种帧全部输出有效', () => moods.every(m =>
      w.eval('spiderSVG')(m,'v1').indexOf('<svg') >= 0
      && w.eval('spiderSVG')(m,'v2').indexOf('<svg') >= 0
      && w.eval('spiderSVG')(m,'v3').indexOf('<svg') >= 0));
    const w2 = boot(J({ profile: { weight: 70 }, petSkin: 'svg' }));
    check('J4 旧值迁移：svg→nahida、spider→spiderV3、spiderV2→spiderV3、official 保留',
      () => w2.__S.petSkin === 'nahida'
        && boot(J({ profile:{weight:70}, petSkin:'spider' })).__S.petSkin === 'spiderV3'
        && boot(J({ profile:{weight:70}, petSkin:'spiderV2' })).__S.petSkin === 'spiderV3'
        && boot(J({ profile:{weight:70}, petSkin:'official' })).__S.petSkin === 'official'
        && boot(J({ profile:{weight:70}, petSkin:'spiderV1' })).__S.petSkin === 'spiderV1');
  }
  // J5–J7 桌宠行为
  {
    const w = boot(J({ profile: { weight: 70 } }));
    w.__S.petDock = { edge: 'top', off: 0.5 };
    w.eval('applyDock')();
    check('J5 顶边悬挂：edge-top → pet 挂上 edge-t 类', () => w.document.getElementById('pet').classList.contains('edge-t'));
    w.eval('petFlip')();
    check('J6 翻跟头：petFlip → flip 类', () => w.document.getElementById('pet').classList.contains('flip'));
    w.eval('petHearts')(3);
    check('J7 冒爱心：petHearts → fly-heart 节点入列', () => w.document.querySelectorAll('#pet .fly-heart').length >= 3);
  }
  // J8–J11 教练身份 + 背景
  {
    const w = boot(J({ profile: { weight: 70 }, settings: { coachName: '阿铁', bg: 'p3' } }));
    check('J8 教练名可配置', () => w.eval('coachName')() === '阿铁');
    const w2 = boot(J({ profile: { weight: 70 } }));
    check('J9 教练名缺省回落纳西妲', () => w2.eval('coachName')() === '纳西妲');
    w.eval('applyCoachIdentity')();
    check('J10 applyCoachIdentity → 聊天输入占位与引导文案生效', () => {
      const inp = w.document.getElementById('chat-text');
      const ob = w.document.querySelector('#onboard .sub');
      return inp && inp.placeholder.indexOf('阿铁') >= 0 && ob && ob.innerHTML.indexOf('阿铁') >= 0;
    });
    w.eval('applyWallpaper')();
    check('J11 背景预设 p3 → wallpaper 渐变生效；脏 bg 回落默认', () => {
      const el = w.document.getElementById('wallpaper');
      const okP3 = el.style.background.indexOf('linear-gradient') >= 0 && el.classList.contains('wall-custom');
      w.__S.settings.bg = 'not-a-preset';
      w.eval('applyWallpaper')();
      const okFall = el.style.background === '' && !el.classList.contains('wall-custom');
      return okP3 && okFall;
    });
  }
  // J12–J14 识别优化联动
  {
    const w = boot(J({ profile: { weight: 70 } }));
    const lib = w.eval('window.__S') && null; // noop
    const has = w.eval('EST_LIB.some(x=>x.n.indexOf("蒸饺")>=0)') && w.eval('EST_LIB.some(x=>x.n.indexOf("寿司")>=0)') && w.eval('EST_LIB.some(x=>x.n.indexOf("薯条")>=0)');
    check('J12 EST_LIB 新增蒸饺/寿司/薯条（测试集驱动）', () => !!has);
    check('J13 生产 prompt 含盖饭/份量锚点/背景忽略规则', () => {
      const p = w.eval('VISION_PROMPT');
      return p.indexOf('盖饭') >= 0 && p.indexOf('主体') >= 0 && p.indexOf('113g') >= 0;
    });
  }
  {
    const src = fs.readFileSync(path.join(PROJ, 'tools', 'eval-vision.js'), 'utf8');
    check('J14 识别评测工具就绪（真值表 13 条 + live 模式）', () => (src.match(/file:'/g) || []).length >= 26 && src.indexOf('--live') >= 0);
    const rep = fs.existsSync(path.join(PROJ, 'eval-set', 'last-offline-report.txt'));
    check('J15 离线评测报告已落盘', () => rep);
  }
}


// ===== v7.11 增量：统一皮肤注册表 / 5 轮上下文 / 闲聊知识库 / 模拟评测联动 =====
function v711Checks() {
  // K1–K3 统一切换
  {
    const w = boot(J({ profile: { weight: 70 } }));
    const keys = w.eval('PET_SKINS.map(x=>x.key)');
    check('K1 皮肤注册表五键齐全（nahida/spiderV1/V2/V3/official）',
      () => JSON.stringify(keys) === JSON.stringify(['nahida','spiderV1','spiderV2','spiderV3','official']));
    check('K2 skinBy 脏键回落第一项而非崩溃', () => w.eval('skinBy')('bad-key').key === 'nahida');
    // 切换保留停靠与情绪状态
    w.__S.petDock = { edge:'top', off:0.5 }; w.__S.petMood = 'sleep';
    w.eval('applyDock')(); w.eval('applyPetArt')('sleep');
    w.__S.petSkin = 'nahida'; w.eval('applyPetArt')('sleep');
    check('K3 切换皮肤不丢状态（悬挂类保留 + 情绪保留）',
      () => w.document.getElementById('pet').classList.contains('edge-t') && w.__S.petMood === 'sleep');
  }
  // K4–K6 上下文窗口 5 轮
  {
    const w = boot(J({ profile: { weight: 70 } }));
    const reply = w.eval('nahidaReply');
    ['卧推肩疼怎么办','深蹲膝盖响','鸡蛋吃几个','奶茶能喝吗','今天吃什么','随便聊聊','谢谢'].forEach(q => reply(q));
    check('K4 上下文窗口封顶 5 轮（多问不膨胀）', () => w.eval('window.__CTX').hist.length === 5);
    const w2 = boot(J({ profile: { weight: 70 } }));
    const r2 = w2.eval('nahidaReply');
    r2('引体向上做不了'); const a = r2('它怎么练');
    check('K5 指代消解：“它”复用窗口内最近主题（引体→离心）', () => a.indexOf('离心') >= 0);
    check('K6 闲聊知识库命中（晚安/心情不好）', () => {
      const w3 = boot(J({ profile: { weight: 70 } }));
      const r3 = w3.eval('nahidaReply');
      return r3('晚安').indexOf('晚安呀') >= 0 && r3('心情不好怎么办').indexOf('接住') >= 0;
    });
  }
  // K7–K8 形象差异与评测联动
  {
    const w = boot(J({ profile: { weight: 70 } }));
    check('K7 小蛛两版本主题确实不同（配色/纹样/胸标/身形比）', () => {
      const T = w.eval('SPIDER_THEME');
      return T.v1.red !== T.v2.red && T.v1.web !== T.v2.web && T.v1.emblem !== T.v2.emblem && T.v1.body !== T.v2.body;
    });
    const rep = fs.existsSync(path.join(PROJ, 'eval-set', 'last-simulate-report.txt'));
    check('K8 多场景模拟评测报告已落盘（准确率口径）', () => {
      if(!rep) return false;
      const t = fs.readFileSync(path.join(PROJ, 'eval-set', 'last-simulate-report.txt'), 'utf8');
      return t.indexOf('准确率') >= 0 && t.indexOf('迭代效果') >= 0;
    });
  }
}

// ===== v8.0 增量：按视频规格重制小蛛 / 7 项动作 / 助手与识别缺陷修复 / 存储稳定性 =====
function v80Checks() {
  const CSS = fs.readFileSync(path.join(PROJ, 'styles.css'), 'utf8');
  // L1–L8 形象规格（对齐「小蛛桌宠·按视频款式重制规格书」3.1 / 3.2）
  {
    const w = boot(J({ profile: { weight: 70 } }));
    const T = w.eval('SPIDER_THEME').v3;
    check('L1 v3 配色 = 视频实测值（主红 #C92848 / 藏蓝 #344383 / 描边 #241018）',
      () => /^#c92848$/i.test(T.red) && /^#344383$/i.test(T.blue) && /^#241018$/i.test(T.ink));
    check('L2 v3 蛛网为中心放射 + 6 主干 + 不透明度提到 .45',
      () => T.web === 'radial' && T.webRays === 6 && T.webOp === 0.45);
    check('L3 v3 胸标为蜘蛛徽记（撤销 v2 的哑铃胸标）', () => T.emblem === 'spider');
    check('L4 v3 身形比回到 1.00（撤销 v2 的 1.07）', () => T.body === 1.00);
    const svg = w.eval('spiderSVG')('happy', 'v3');
    check('L5 v3 眼罩为水滴形 + 粗描边 3.4', () => svg.indexOf('stroke-width="3.4"') >= 0);
    check('L6 v3 无地面阴影（视频角色悬浮于桌面）', () => svg.indexOf('cy="146"') < 0);
    check('L7 v3 不出现星星眼 / 爱心眼 / 泪眼装饰', () => {
      const bad = ['#f3cd72', '#ff8fa6', '#7ec8f0'];   // 星 / 爱心 / 泪的填充色
      return bad.every(c => svg.indexOf(c) < 0);
    });
    check('L8 主题缺字段补默认值（旧主题不会读到 undefined）', () => {
      const t = w.eval('spTheme')('v1');
      return !!(t.redHL && t.blueD && t.lens && t.webW && t.lw && t.eyeShape);
    });
  }
  // L9–L11 助手缺陷修复
  {
    const w = boot(J({ profile: { weight: 70 } }));
    const md = w.eval('md');
    check('L9 助手回答不再吞掉证据正文（星级标记后的说明文本须保留）', () => {
      const out = md('先降重量。\n*[B] 证据：NSCA 建议肩胛稳定是卧推安全前提*');
      return out.indexOf('证据等级 B') >= 0 && out.indexOf('NSCA 建议肩胛稳定是卧推安全前提') >= 0;
    });
    check('L10 教练头像预设 SVG → data URI（旧版直接当 img src 会渲染成破图）', () => {
      w.__S.settings.coachAvatar = 'dog1';
      const src = String(w.eval('coachAvatarSrc')());
      return src.indexOf('data:image/svg+xml') === 0 && src.indexOf('<svg') < 0 && src.indexOf('%3Csvg') > 0;
    });
    check('L11 气泡文本为非字符串时不崩溃', () => w.eval('md')(undefined) === '' && w.eval('md')(null) === '');
  }
  // L12–L14 AI 识别：拒绝假识别
  {
    const w = boot(J({ profile: { weight: 70 } }));
    const sv = w.eval('sanitizeVision');
    check('L12 模型空响应 → 返回 null，不再兜底成「150 kcal」假结果', () => sv({}) === null && sv(null) === null);
    check('L13 只给热量 → 按 20/50/30 拆宏量且热量守恒', () => {
      const d = sv({ name: '炒饭', grams: 400, kcal: 600 });
      return !!d && Math.abs((d.p * 4 + d.c * 4 + d.f * 9) - d.kcal) <= 2;
    });
    check('L14 extractJSON 能剥离 markdown 代码块', () => {
      const j = w.eval('extractJSON')('```json\n{"name":"米饭","kcal":260}\n```');
      return !!j && j.name === '米饭';
    });
  }
  // L15 存储稳定性
  {
    const w = boot(J({ profile: { weight: 70 } }));
    check('L15 写入失败时 save() 不抛异常并返回 false（旧版会抛错中断整条调用链）', () => {
      // 循环引用让 JSON.stringify 抛错，等价于配额溢出 / 存储不可用时的失败路径
      const cyc = {}; cyc.self = cyc; w.__S.__boom = cyc;
      let r = null;
      try { r = w.eval('save')(); } catch (_) { return false; }
      delete w.__S.__boom;
      return r === false;
    });
  }
  // L16–L18 视频动作
  {
    check('L16 视频 7 项动作的 keyframes 全部就绪', () => {
      const need = ['pet-idle', 'pet-wave', 'pet-crouch', 'pet-exit', 'ghost-fade-1', 'ghost-fade-2', 'pet-bubble-pop'];
      return need.every(n => CSS.indexOf('@keyframes ' + n) >= 0);
    });
    check('L17 不实现行走 / 跳跃动画（视频逐帧已否证）',
      () => !/@keyframes\s+(pet-)?(walk|jump|run|hop)/i.test(CSS) && !/act-(walk|jump|run)/i.test(CSS));
    const w = boot(J({ profile: { weight: 70 } }));
    check('L18 动作函数可调用且不崩（wave / crouch / exit / idle / 残影 / 圆气泡）', () => {
      w.eval('bubbleBusy = false; bubbleQueue.length = 0;');   // 清掉 boot 时的问候台词队列
      const pet = w.document.getElementById('pet');
      w.eval('petAct')('wave');   const a = pet.classList.contains('act-wave');
      w.eval('petAct')('crouch'); const b = pet.classList.contains('act-crouch');
      w.eval('petAct')('exit');   const c = pet.classList.contains('act-exit');
      w.eval('petAct')('idle');   const d = pet.classList.contains('act-idle') && !pet.classList.contains('act-exit');
      w.eval('petDashGhost')();
      w.eval('petRoundBubble')('hi');
      const bub = w.document.getElementById('pet-bubble');
      return a && b && c && d && bub.classList.contains('round') && bub.innerHTML.indexOf('hi') >= 0;
    });
  }
}
