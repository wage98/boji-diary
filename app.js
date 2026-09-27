/* ============================================================
   薄肌日记 v7.6 · app.js
   手机桌面常驻二次元桌宠（纳西妲）健身 App —— 居家哑铃方案
   - 常驻浮层桌宠：情绪状态机 + 待机循环 + 左右缘直立探头吸附 + 点击对话 + 事件反应
   - 桌宠=桌面主屏，dock 展开 训练/饮食/聊天/数据/我的
   - v7.3：真实 PWA（manifest + SW 离线）、计划可编辑 + 哑铃渐进超负荷
   - v7.4：P0 返回键层栈；P0 修复饮食页 ReferenceError；P1 移动端整屏适配；
          P2 数据导出（JSON/CSV）与导入、撤销打卡
   - v7.5：①档案实时编辑（身高/体重/哑铃/昵称/头像上传，即时影响建议重量与热量目标）
          ②明确“居家哑铃”场景文案 ③饮水改为 ml 计量（旧“杯”自动迁移 ×250ml）
          ④饮食主入口=拍照记录 + 常见食物库快速估算 + 名称/份量/热量全字段手动校正
          ⑤数据页恢复月历视图（每日完成状态）与每日训练评分（感受/体力/满意度）
          ⑥番茄ToDo 式统计：统计格 + 连续天数激励 + 月历可视化
   - v7.6：仓库治理（死代码接线/清理）+ 拍照识别攻坚（81 项本地库 + OpenFoodFacts 在线查询
            + 热量手动覆盖 + 失败兜底）+ 智能助手（42 条知识库 + 多轮上下文 + 结合本机数据）
   - 复用 v6 已验证资产：训练计划(4训练日23动作 + B站章节时间戳) / 知识库 / 打卡 / 数据
   纯前端 · localStorage 持久化 · 无构建
   ============================================================ */
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
const esc = s => s.replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const COACH_NAME = '纳西妲';

/* ---------- 视频深链（卓叔 B站合集，章节时间戳可点开自验） ---------- */
const BV = 'https://www.bilibili.com/video/BV1FY4y1y7Vh';
const vid = (t, label) => ({ url: `${BV}/?t=${t}`, label });
const TIMESTAMP_NOTE = '时间戳取自卓叔《30个家庭哑铃增肌动作教学》合集章节，属最佳可得映射，点开可自验。';

/* ---------- 训练计划（4 训练日 / 23 动作） ---------- */
const PLANS = {
  push: { name:'推日 · 胸肩三头', greeting:'今天练胸肩，把手机放下，胸肌支棱起来！', ex:[
    { name:'哑铃卧推', sets:4, reps:'8-12', rest:75, base:0.8, video:vid(139,'哑铃卧推 02:19'),
      standard:'肩胛后缩下沉，哑铃下放至胸侧，推起时呼气、胸肌主动收缩。',
      note:'别耸肩借力；小臂垂直地面，手腕中立。' },
    { name:'上斜哑铃推举', sets:3, reps:'10-12', rest:60, base:0.6, video:vid(230,'上斜哑铃推举'),
      standard:'椅背 30° 左右，推举轨迹略向锁骨聚拢。',
      note:'角度别太高，否则压肩膀。' },
    { name:'哑铃肩推', sets:3, reps:'10-12', rest:60, base:0.5, video:vid(420,'哑铃肩推'),
      standard:'核心收紧，推至顶端不锁死，肩胛稳定。',
      note:'腰别反弓，重量宁轻勿借。' },
    { name:'哑铃侧平举', sets:3, reps:'12-15', rest:45, base:0.25, video:vid(686,'哑铃侧平举 11:26'),
      standard:'小臂略内旋“倒水”感，肘高于腕，顶峰停顿。',
      note:'别甩重量，用肩中束发力。' },
    { name:'俯身侧平举', sets:3, reps:'12-15', rest:45, base:0.2, video:vid(560,'俯身侧平举'),
      standard:'俯身约 45°，后束主导向两侧抬起。',
      note:'脖子放松，别耸肩。' },
    { name:'颈后臂屈伸', sets:3, reps:'10-12', rest:45, base:0.3, video:vid(1300,'颈后臂屈伸 21:40'),
      standard:'上臂贴耳固定，仅小臂伸展。',
      note:'肘别外撇，动作慢。' },
  ]},
  pull: { name:'拉日 · 背二头', greeting:'练背啦，想象把世界拉向你(｡･ω･｡)', ex:[
    { name:'单臂哑铃划船', sets:4, reps:'10-12', rest:60, base:0.7, video:vid(300,'单臂哑铃划船'),
      standard:'脊柱中立，肘贴身体向后上方拉，背阔主导。',
      note:'别用惯性甩，顶峰夹背。' },
    { name:'俯身哑铃硬拉', sets:3, reps:'10-12', rest:75, base:0.9, video:vid(500,'俯身哑铃硬拉'),
      standard:'髋铰链，哑铃贴腿下滑，臀腿主导。',
      note:'腰挺直，别圆背。' },
    { name:'哑铃耸肩', sets:3, reps:'12-15', rest:45, base:0.8, video:vid(620,'哑铃耸肩'),
      standard:'直上直下耸肩，顶峰停顿。',
      note:'别转肩，斜方发力。' },
    { name:'俯身哑铃面拉', sets:3, reps:'12-15', rest:45, base:0.2, video:vid(700,'面拉'),
      standard:'俯身，双手各持一哑铃，拉向眉心方向并外旋，后束主导。',
      note:'居家哑铃版面拉，改善圆肩，别耸肩。' },
    { name:'锤式弯举', sets:3, reps:'10-12', rest:45, base:0.3, video:vid(900,'锤式弯举'),
      standard:'中立握，肘固定身体两侧弯举。',
      note:'别借力摆。' },
    { name:'集中弯举', sets:3, reps:'10-12', rest:45, base:0.2, video:vid(980,'集中弯举'),
      standard:'肘抵大腿内侧，顶峰收缩二头。',
      note:'慢起慢落。' },
  ]},
  legs: { name:'腿日 · 臀腿', greeting:'腿是发动机，今天好好虐它！', ex:[
    { name:'高脚杯深蹲', sets:4, reps:'10-12', rest:75, base:1.0, video:vid(832,'高脚杯深蹲 13:52'),
      standard:'哑铃抱胸，髋膝同步下蹲至大腿水平，重心在足中。',
      note:'膝盖跟脚尖同向，别内扣。' },
    { name:'保加利亚分腿蹲', sets:3, reps:'10-12', rest:60, base:0.6, video:{ url:'https://search.bilibili.com/all?keyword=保加利亚分腿蹲', label:'保加利亚分腿蹲（合集外·站内搜）' },
      standard:'后脚搭凳，前腿下蹲至 90°，躯干略前倾。',
      note:'合集未收录，已给站内搜索兜底；核心收紧。' },
    { name:'哑铃罗马尼亚硬拉', sets:3, reps:'10-12', rest:75, base:0.9, video:vid(520,'哑铃罗马尼亚硬拉'),
      standard:'微屈膝，髋后推，腘绳主导，背挺直。',
      note:'下放靠腘绳拉伸感，别圆背。' },
    { name:'哑铃箭步蹲', sets:3, reps:'12/腿', rest:60, base:0.6, video:vid(860,'哑铃箭步蹲'),
      standard:'向前迈步下蹲，前后腿约 90°。',
      note:'躯干稳定，膝盖不内扣。' },
    { name:'站姿提踵', sets:3, reps:'15-20', rest:40, base:0.8, video:vid(1000,'站姿提踵'),
      standard:'踮脚至顶端停顿，慢落。',
      note:'全程控制，别弹震。' },
    { name:'臀桥', sets:3, reps:'12-15', rest:45, base:1.0, video:vid(950,'臀桥'),
      standard:'肩撑地，髋顶起至肩髋膝一线。',
      note:'顶峰夹臀停顿。' },
  ]},
  pump: { name:'泵感日 · 手臂胸', greeting:'小重量高次数，今天主打一个泵！', ex:[
    { name:'哑铃飞鸟', sets:3, reps:'12-15', rest:45, base:0.3, video:vid(250,'哑铃飞鸟'),
      standard:'微屈肘画弧，胸肌拉伸到收缩。',
      note:'别用太大重量，感受胸。' },
    { name:'二头弯举', sets:3, reps:'12-15', rest:45, base:0.25, video:vid(880,'二头弯举'),
      standard:'肘固定，慢起慢落全幅度。',
      note:'别甩。' },
    { name:'三头下压', sets:3, reps:'12-15', rest:45, base:0.2, video:vid(1320,'三头下压'),
      standard:'大臂贴体，仅小臂下压。',
      note:'顶峰伸尽。' },
    { name:'腕弯举', sets:3, reps:'15-20', rest:40, base:0.1, video:vid(1100,'腕弯举'),
      standard:'前臂固定，腕部屈伸。',
      note:'小重量即可。' },
    { name:'卷腹', sets:3, reps:'15-20', rest:40, base:0, video:vid(1150,'卷腹'),
      standard:'腹肌收缩卷起，下背贴地。',
      note:'别用脖子拉。' },
  ]},
};
// 7 天类型：周日休，其余按 推/拉/腿/泵/推/拉 循环
const DAY_TYPES = ['rest','push','pull','legs','pump','push','pull'];
const WEEKDAY = ['周日','周一','周二','周三','周四','周五','周六'];
const getDayType = w => (Number.isInteger(+w) && w >= 0 && w <= 6) ? DAY_TYPES[w] : 'rest';
const dayTypeLabel = t => t === 'rest' ? '休息日' : PLANS[t].name;

/* ---------- 知识库（v7.6：38 条，覆盖训练 / 营养 / 计划 / 恢复与常见问答，带证据等级 + 追问补充） ---------- */
const KB = [
  // ——— 训练·动作与强度 ———
  { q:'卧推肩疼怎么办', a:'先降重量，检查肩胛是否后缩下沉、小臂是否垂直。肩疼多因耸肩或重量过大。\n*[B] 证据：NSCA 建议肩胛稳定是卧推安全前提*', k:['卧推','肩','疼','胸'],
    more:'三步自检：①空手做 10 次，感受肩胛后缩下沉；②把重量降到能做满 12 次且不变形；③哑铃下放位置从乳线略下移到胸侧，别让肩膀“顶”在最前端。若 2 周内仍疼，换成上斜推或俯卧撑，并及时就医。' },
  { q:'侧平举怎么练中束', a:'小臂略内旋“倒水”感，肘略高于腕，顶峰停顿 1 秒，重量选能控的。\n*[B] 证据：肌电研究显示顶峰停顿提升中束激活*', k:['侧平举','中束','肩'],
    more:'进阶细节：站姿比坐姿更稳；起始让哑铃停在身体侧前方 15°，避免用斜方“耸”起来；每组 12–15 次、最后 2 次略吃力即可，别甩。' },
  { q:'每次练多久合适', a:'力量训练 45–70 分钟足够，过长皮质醇升高反而不利增肌。\n*[A] 证据：ACSM 抗阻训练建议每次 30–60 分钟*', k:['时长','多久','时间'],
    more:'实操：热身 5–10 分钟 + 主项 4–5 个动作 + 2 个补充动作，组间休息 60–90 秒。超过 75 分钟就开始“磨洋工”，不如收工去吃和睡。' },
  { q:'一周练几次', a:'新手 3–4 次全身或上下分化；有基础可做推拉腿 5–6 次。\n*[A] 证据：ACSM/ISSN 推荐每周每肌群 10–20 组*', k:['频率','几次','一周'],
    more:'频率比单次容量更重要：同一肌群每周练 2 次，效果好于一周只练 1 次大容量。你现在是推/拉/腿/泵四日循环，周日休息，正好覆盖。' },
  { q:'深蹲膝盖疼', a:'先看膝盖是否内扣、重心是否前移；可先高脚杯深蹲找模式。\n*[B] 证据：膝痛多因代偿*', k:['深蹲','膝盖','疼','腿'],
    more:'自检三步：①脚尖与膝同向，下蹲时主动“撑开”臀部；②重心压在足中，别踮脚；③先减重 30% 做 12 次找模式。若出现刺痛或肿胀要停并就医。' },
  { q:'小腿怎么练', a:'站姿提踵 15–20 次，顶峰停顿，慢落，每周 2–3 次。\n*[C] 证据：高次数对小腿有效*', k:['小腿','提踵'] },
  { q:'平台期怎么办', a:'换动作顺序/加 deload 周/调睡眠饮食，别一直硬刚。\n*[C] 证据：周期化训练*', k:['平台','卡','期'],
    more:'给一份 4 周脱坑方案：第 1 周 deload（重量 ×0.7，组数减半）；第 2–3 周回到原重量并把每组多做 1–2 次；第 4 周尝试 +2.5kg。同时核对睡眠（7–9h）与蛋白（1.8g/kg）。' },
  { q:'哑铃和杠铃哪个好', a:'新手哑铃更易上手且单边均衡；进阶可杠铃上大重量。\n*[C] 证据：各有所长*', k:['哑铃','杠铃','区别'] },
  { q:'热身要做多久', a:'5–10 分钟动态热身 + 目标动作空杆/轻重量 1–2 组。\n*[B] 证据：动态热身提升表现降伤*', k:['热身','warm'],
    more:'模板：原地踏步/开合跳 2 分钟 → 肩绕环与髋绕环各 10 次 → 第一个动作用 50% 重量做 8 次、70% 做 5 次，再进正式组。' },
  { q:'什么时候加重量', a:'某动作能标准完成目标次数上限（如 12 次做满）连续 2 次，就加 2.5–5%。\n*[C] 证据：渐进超负荷原则*', k:['加重量','加重','进步'],
    more:'哑铃可按 0.5–2.5kg 小步加。判断标准只有一条：动作不变形 + 最后 1–2 次略吃力。加了就降次数没关系，先把新重量“站稳”。' },
  { q:'怎么判断重量合适', a:'最后 2 次稍吃力但动作不变形 = 合适；变形就减。\n*[C] 证据：RPE 7–8 区间*', k:['重量','合适','选'] },
  { q:'训练时怎么呼吸', a:'发力时呼气、还原时吸气，别憋气；大重量可用瓦式呼吸但别久憋。\n*[B] 证据：力量训练呼吸与安全建议*', k:['呼吸','憋气','用力'] },
  { q:'要练到力竭吗', a:'不必。每组留 1–2 次余量（RIR 2–3）更利于长期进步，新手尤甚。\n*[A] 证据：训练至力竭与疲劳管理研究*', k:['力竭','RIR','练到','极限'] },
  { q:'肌肉酸痛还能练吗', a:'轻微延迟性酸痛可以练（换部位或降 20% 重量）；关节刺痛、单侧剧痛就停。\n*[B] 证据：DOMS 与主动恢复*', k:['酸痛','疼','DOMS','还能练'] },
  { q:'动作速度怎么控制', a:'向心 1 秒、顶峰停顿 1 秒、离心 2–3 秒，全程幅度。\n*[B] 证据：离心控制与肌肥大*', k:['速度','节奏','离心','慢'] },
  // ——— 营养 ———
  { q:'蛋白质吃多少', a:'增肌期每天 1.6–2.2 g/kg 体重。\n*[A] 证据：ISSN 立场 1.6–2.2 g/kg*', k:['蛋白','蛋白质','吃'],
    more:'分摊到 3–4 餐，每餐 25–40g 蛋白吸收利用更好。参考：鸡胸 150g≈35g、鸡蛋 1 个≈6g、蛋白粉 1 勺≈24g、牛奶 250ml≈8g。' },
  { q:'练完吃什么', a:'训练后 1–2 小时补充蛋白 + 碳水，如鸡胸+饭或蛋白粉+香蕉。\n*[B] 证据：运动后营养窗口有利于合成*', k:['练完','后','吃','补充'] },
  { q:'练前要吃吗', a:'训练前 1–2 小时少量碳水 + 蛋白即可，别吃太撑。\n*[B] 证据：训前碳水提升表现*', k:['练前','前','吃'] },
  { q:'喝水重要吗', a:'每天 30–40 ml/kg，训练中小口多次，缺水掉力量。\n*[B] 证据：脱水降运动表现*', k:['喝水','水','喝','饮水'],
    more:'简易判断：尿液淡黄=够；深黄=补。训练中每 15–20 分钟喝 100–200ml，别等口渴再灌。' },
  { q:'食物热量怎么估算', a:'手掌法：掌心≈100g肉、拳头≈1碗饭、拇指≈1勺油。更准可查 OpenFoodFacts 开源食物数据库。\n*[B] 证据：OpenFoodFacts 公开营养数据库*', k:['热量','估算','卡路里','kcal'],
    more:'外食估算三招：①油和酱料单独算（1 勺油≈126 kcal）；②主食按碗算（1 碗米饭≈200 kcal）；③看得到原材料的菜比浓汤/红烧/干锅低 30–50%。' },
  { q:'增肌要多吃多少', a:'每日热量盈余 200–300 kcal，配合训练，每月约增 0.5–1kg 体重。\n*[A] 证据：能量盈余与增肌速率*', k:['增肌','盈余','多吃','热量'],
    more:'盈余太大只会长脂肪。做法：先按当前体重维持 1 周看体重变化，再每天加 200 kcal（约 1 碗饭 + 1 勺蛋白粉）。' },
  { q:'减脂怎么吃', a:'热量亏空 300–500 kcal/天，蛋白拉到 1.8–2.2 g/kg，并保留力量训练保肌肉。\n*[A] 证据：减脂期高蛋白与抗阻训练*', k:['减脂','减重','掉秤','少吃'],
    more:'节奏：每周掉 0.5–1% 体重最稳。先砍油和零食，再砍部分主食；训练不掉重量、睡眠 ≥7h，避免情绪性暴食。' },
  { q:'碳水要不要少吃', a:'不必极端低碳。训练前后保留碳水，其余按需分配。\n*[B] 证据：碳水与训练表现*', k:['碳水','主食','米饭'] },
  { q:'蛋白粉有必要吗', a:'优先吃食物，缺口再用蛋白粉补齐，它不是必选项。\n*[A] 证据：蛋白质来源研究*', k:['蛋白粉','补剂','粉'] },
  { q:'肌酸要不要吃', a:'每天 3–5g 一水肌酸，安全且对力量/肌肉量有帮助，可长期服用。\n*[A] 证据：ISSN 肌酸立场*', k:['肌酸','creatine','补剂'] },
  { q:'脂肪怎么吃', a:'占总热量 20–30%，以坚果、鱼、橄榄油为主。\n*[B] 证据：膳食脂肪指南*', k:['脂肪','油','坚果'] },
  { q:'喝酒影响增肌吗', a:'会。酒精抑制蛋白合成、影响睡眠与恢复，尽量训练日不喝。\n*[B] 证据：酒精与肌肉合成*', k:['酒','喝酒','酒精','啤酒'] },
  // ——— 计划制定 ———
  { q:'只在家练哑铃够吗', a:'够。哑铃可覆盖推拉腿全部模式，关键是渐进超负荷：动作达标就加重量或次数。\n*[B] 证据：抗阻训练剂量-反应 Meta 分析（居家哑铃方案同样适用）*', k:['居家','在家','够吗','哑铃'],
    more:'居家增肌三件套：①可调节哑铃（或两组固定重量）；②一张凳子做卧推/分腿蹲；③弹力带补面拉和侧向动作。重量不够就用慢速离心 + 单侧动作提高难度。' },
  { q:'新手怎么排计划', a:'每周 3 次全身训练（每次 5–6 个复合动作）起步，8 周后再考虑分化。\n*[A] 证据：初学者训练频率研究*', k:['新手','入门','开始','排计划'],
    more:'示例（每周一二五）：高脚杯深蹲 3×10、哑铃卧推 3×10、单臂划船 3×10、肩推 3×10、卷腹 3×15。每个动作留 2 次余量，两周后尝试加 1 次。' },
  { q:'怎么安排分化', a:'频率优先：每肌群每周 10–20 组、练 2 次优于 1 次。\n*[A] 证据：ACSM/ISSN 组数建议*', k:['分化','推拉腿','上下','安排'] },
  { q:'什么时候换计划', a:'6–8 周或连续 2–3 周停滞才换，别每周换动作。\n*[B] 证据：周期化训练*', k:['换计划','换动作','周期'] },
  { q:'要不要做有氧', a:'每周 2–3 次 20–30 分钟中低强度有氧，与力量训练分开或放在最后。\n*[A] 证据：心肺与代谢健康建议*', k:['有氧','跑步','心肺','快走'] },
  { q:'休息日怎么安排', a:'睡眠 7–9 小时、蛋白吃够，可快走或拉伸 20–30 分钟。\n*[B] 证据：主动恢复*', k:['休息日','恢复','安排'] },
  { q:'出差没器械怎么办', a:'用自重与弹力带维持：深蹲/俯卧撑/箭步蹲/弹力带划船，每次 20–30 分钟。\n*[C] 证据：维持性训练*', k:['出差','没器械','旅行','自重'] },
  // ——— 恢复与常见问答 ———
  { q:'睡不够影响增肌吗', a:'会。睡眠不足掉合成激素、升皮质醇，建议 7–9 小时。\n*[A] 证据：睡眠与肌肉修复Meta分析*', k:['睡眠','睡','恢复'],
    more:'睡前三件事：①训练结束 3 小时内别摄入咖啡因；②睡前一小时放下手机（蓝光影响入睡）；③固定起床时间，比固定入睡时间更有效。' },
  { q:'女生会练成金刚芭比吗', a:'不会，女性睾酮低，增肌慢，只会更紧致。\n*[A] 证据：性激素差异*', k:['女生','女','金刚'] },
  { q:'休息日能运动吗', a:'可以快走/拉伸/散步，别做大重量；休息也是训练。\n*[B] 证据：主动恢复*', k:['休息','休','恢复'] },
  { q:'感冒了能练吗', a:'发烧/全身酸痛就停；仅鼻塞轻症可做低强度，重量减半。\n*[B] 证据：运动与感染期建议*', k:['感冒','生病','发烧','难受'] },
  { q:'空腹训练好不好', a:'可以，但强度高或晨练头晕时先吃少量碳水（如半根香蕉）。\n*[C] 证据：空腹与 fed 状态训练*', k:['空腹','早上','晨练'] },
  { q:'练后要拉伸多久', a:'训练后 5–10 分钟静态拉伸，每个部位 15–30 秒。\n*[C] 证据：柔韧性与恢复*', k:['拉伸','放松','柔韧'] },
  { q:'多久能看到效果', a:'力量 2–4 周提升，体型 8–12 周可见变化，别天天称体重。\n*[B] 证据：训练适应时间进程*', k:['多久','效果','变化','没效果'] },
  { q:'早上练还是晚上练', a:'以能长期坚持的时间为准，规律性比时段更重要。\n*[C] 证据：训练时间与依从性*', k:['早上','晚上','时间','几点'] },
];

/* ---------- 多轮对话上下文（记住上一话题，支持追问与“结合我的数据”回答） ---------- */
const CTX = { lastItem:null, lastQ:'', turns:0, greet:false };
const FOLLOW_RE = /再(说|讲|详细|展开)(一点|些|点)?|详细(一点|些|说)|还有呢|然后呢|为什么|具体(怎么做|如何|点)|那(该|要)?怎么办|它呢|这个呢|继续|接着说/;
// 结合本机数据的个性化回答（今天练什么 / 蛋白够吗 / 连打几天 / 上次重量 …）
function dataReply(q){
  const t=getDayType(wd()), g=dailyGoal();
  if(/今天练|练什么|今日计划|今天计划|练啥/.test(q)){
    if(t==='rest') return '今天是休息日哦，好好恢复~ 想动一动可以快走 30 分钟或拉伸 20 分钟(｡･ω･｡)';
    const p=PLANS[t]; const ck=STATE.checkins[todayKey()];
    const done=ck&&ck.ex?Object.values(ck.ex).filter(Boolean).length:0;
    return `今天练【${p.name}】（${p.ex.length} 个动作，约 ${estMin(p)} 分钟）\n已完成 ${done}/${p.ex.length}。\n前三个：${p.ex.slice(0,3).map((e,i)=>`${i+1}. ${e.name} ${e.sets}×${e.reps}`).join('；')}`;
  }
  if(/蛋白(够|够吗|多少|吃了)|吃了多少蛋白/.test(q)){
    const key=todayKey(), meals=STATE.meals[key]||{}; let pTot=0;
    Object.keys(meals).forEach(mi=>(meals[mi]||[]).forEach(f=>{ pTot += (f.p||0) * mealQty(f); }));
    const pct = g.protein ? Math.round(pTot/g.protein*100) : 0;
    return `今天已记录蛋白 ${Math.round(pTot)}g / 目标 ${g.protein}g（${pct}%）\n${pTot>=g.protein?'达标啦，纳西妲很高兴(★ω★)':'还差 '+Math.round(g.protein-pTot)+'g，建议：鸡胸 150g≈35g 或 蛋白粉 1 勺≈24g。'}`;
  }
  if(/热量|卡路里|kcal|今天吃了/.test(q)){
    const key=todayKey(), meals=STATE.meals[key]||{}; let kc=0;
    Object.keys(meals).forEach(mi=>(meals[mi]||[]).forEach(f=>{ kc += foodKcal(f); }));
    return `今天已记录 ${Math.round(kc)} kcal / 目标约 ${g.kcal} kcal。\n${kc? '数据来自你手动/拍照记录，估算误差通常在 ±20%。':'还没记录饮食哦，拍照记一笔更准~'}`;
  }
  if(/连续|打卡几天|坚持了|几天了|streak/.test(q)){
    return `你已经连续打卡 ${streak()} 天，累计 ${Object.keys(STATE.checkins).length} 天 (｡･ω･｡)ﾉ\n${streak()>=7?'一周以上啦，保持节奏！':'先定个小目标：连打 7 天。'}`;
  }
  if(/体重|多重|多少斤|目标/.test(q)){
    return STATE.profile
      ? `档案里是 ${STATE.profile.height}cm / ${STATE.profile.weight}kg，单哑铃 ${STATE.profile.dumbbell}kg。\n按此计算：蛋白目标 ${g.protein}g、热量约 ${g.kcal} kcal、饮水 ${g.water} ml。可在“我的”页随时改，改完立即生效。`
      : '还没设置档案，去“我的”页填一下身高体重，我才能给你算目标~';
  }
  if(/上次(重量|练)|加重|加重量|超负荷/.test(q)){
    const t2=getDayType(wd()); if(t2==='rest' || !STATE.exLast[t2]) return '还没有上一次的重量记录，先练一轮并填起始重量，我就记住啦~';
    const rows=Object.keys(STATE.exLast[t2]).slice(0,3).map(i=>`${PLANS[t2].ex[i].name}：上次 ${STATE.exLast[t2][i]}kg`);
    return `上次重量（${PLANS[t2].name}）：\n${rows.join('\n')}\n全部动作达标后建议 +2.5kg（训练页有“应用”按钮）。`;
  }
  if(/喝水|饮水|水/.test(q)){
    const w=STATE.waterMl||0;
    return `今天已喝 ${w} ml / 目标 ${g.water} ml。\n${w>=g.water?'目标达成 💧':'再来一杯 250ml 就又近一步啦~'}`;
  }
  return null;
}
function nahidaReply(text){
  const raw=(text||'').trim(); if(!raw) return '你想问什么呢？(｡･ω･｡)';
  const q=raw.toLowerCase();
  // 1) 追问：接上一话题展开
  if(FOLLOW_RE.test(q) && CTX.lastItem){
    CTX.turns++;
    const it=CTX.lastItem;
    if(it.more) return `接着【${it.q}】展开说：\n${it.more}`;
    return `接着【${it.q}】给你 3 步可执行：\n1. ${it.a.split('\n')[0]}\n2. 只改一个变量（重量 / 次数 / 频率），观察 1–2 周。\n3. 把结果记在数据页，下次我按你的记录帮你判断。`;
  }
  // 2) 结合本机数据的个性化回答
  const dr=dataReply(q); if(dr){ CTX.turns++; return dr; }
  // 3) 知识库匹配（关键词命中计分）
  let best=null,bs=0;
  for(const item of KB){ let s=0; for(const k of item.k) if(q.indexOf(k.toLowerCase())>=0) s+=2; if(s>bs){bs=s;best=item;} }
  if(bs>0){ CTX.lastItem=best; CTX.lastQ=raw; CTX.turns++; return best.a + (best.more ? '\n（回我“再详细点”，我展开讲）' : ''); }
  // 4) 寒暄
  if(/你好|hi|在吗|在呢|嗨/.test(q)) return `你好呀，我是${COACH_NAME}，你的居家哑铃增肌教练(｡･ω･｡)ﾉ\n训练、营养、恢复都可以问我——我只回答有出处的，没把握的会直说。`;
  // 5) 兜底：不装懂
  return `这个我不太确定，不想瞎编误导你(>_<)\n我擅长这些：\n· 今天练什么 / 我蛋白够吗 / 连打几天了\n· ${KB.slice(0,4).map(x=>x.q).join('、')}\n也可以直接问动作名称，比如“卧推”“深蹲”。`;
}

/* ---------- 食物库（v7.5：常见食物估算库，拍照记录后在此快速选取并校正） ---------- */
// p/c/f 为“每 1 份”的宏量（克），热量 = p*4 + c*4 + f*9；份量可在校正面板再调
const EST_LIB = [
  // —— 蛋白类（每 1 份）
  { n:'鸡胸肉(150g)', p:35, c:0, f:6 }, { n:'鸡蛋(1个)', p:6, c:1, f:5 },
  { n:'蛋白粉(1勺)', p:24, c:2, f:1 }, { n:'牛奶(250ml)', p:8, c:12, f:8 },
  { n:'无糖酸奶(1杯)', p:6, c:6, f:4 }, { n:'酸奶(1杯)', p:6, c:12, f:5 },
  { n:'豆浆(1杯)', p:9, c:6, f:6 }, { n:'三文鱼(100g)', p:20, c:0, f:13 },
  { n:'虾仁(100g)', p:20, c:0, f:1 }, { n:'金枪鱼罐头(1罐)', p:22, c:0, f:2 },
  { n:'猪瘦肉(100g)', p:22, c:0, f:10 }, { n:'牛腱肉(100g)', p:26, c:0, f:8 },
  { n:'牛肉末(100g)', p:20, c:0, f:15 }, { n:'鸡腿(红烧/1个)', p:28, c:4, f:14 },
  { n:'鸡翅(2个)', p:18, c:2, f:18 }, { n:'排骨(100g)', p:18, c:2, f:20 },
  { n:'鸭胸(100g)', p:20, c:0, f:8 }, { n:'豆腐(100g)', p:8, c:2, f:5 },
  { n:'奶酪(2片)', p:10, c:1, f:14 },
  // —— 主食类
  { n:'米饭(1碗)', p:4, c:55, f:0 }, { n:'面条(1碗)', p:8, c:60, f:2 },
  { n:'馒头(1个)', p:7, c:45, f:1 }, { n:'全麦面包(2片)', p:8, c:34, f:3 },
  { n:'包子(1个)', p:7, c:28, f:5 }, { n:'饺子(10个)', p:12, c:40, f:8 },
  { n:'白粥(1碗)', p:3, c:30, f:0 }, { n:'小米粥(1碗)', p:3, c:28, f:2 },
  { n:'玉米(1根)', p:4, c:30, f:2 }, { n:'红薯(1个/150g)', p:3, c:38, f:0 },
  { n:'土豆(1个/150g)', p:3, c:26, f:0 }, { n:'意面(1份)', p:8, c:65, f:4 },
  { n:'米粉(1碗)', p:6, c:58, f:4 }, { n:'蛋炒饭(1份)', p:12, c:70, f:15 },
  { n:'披萨(1块)', p:12, c:30, f:10 }, { n:'汉堡(1个)', p:18, c:42, f:28 },
  { n:'凉皮(1份)', p:5, c:45, f:8 }, { n:'燕麦(50g)', p:7, c:30, f:3 },
  // —— 蔬果类
  { n:'西兰花(100g)', p:3, c:7, f:0 }, { n:'菠菜(1份)', p:3, c:4, f:0 },
  { n:'番茄(1个)', p:1, c:5, f:0 }, { n:'黄瓜(1根)', p:1, c:4, f:0 },
  { n:'炒青菜(1份)', p:2, c:6, f:6 }, { n:'蒜蓉西兰花(1份)', p:4, c:8, f:7 },
  { n:'苹果(1个)', p:0, c:25, f:0 }, { n:'香蕉(1根)', p:1, c:23, f:0 },
  { n:'橙子(1个)', p:1, c:20, f:0 }, { n:'葡萄(1串)', p:1, c:25, f:0 },
  { n:'西瓜(1块)', p:1, c:18, f:0 }, { n:'梨(1个)', p:0, c:22, f:0 },
  { n:'草莓(10颗)', p:1, c:8, f:0 }, { n:'猕猴桃(1个)', p:1, c:14, f:0 },
  { n:'牛油果(半个)', p:2, c:9, f:15 }, { n:'蓝莓(1盒)', p:1, c:20, f:0 },
  // —— 家常菜 / 外食
  { n:'番茄炒蛋(1份)', p:9, c:8, f:12 }, { n:'宫保鸡丁(1份)', p:22, c:15, f:18 },
  { n:'鱼香肉丝(1份)', p:18, c:20, f:15 }, { n:'麻婆豆腐(1份)', p:14, c:10, f:18 },
  { n:'青椒肉丝(1份)', p:16, c:8, f:14 }, { n:'红烧肉(1份)', p:18, c:6, f:35 },
  { n:'水煮牛肉(1份)', p:26, c:10, f:28 }, { n:'麻辣烫(1碗)', p:18, c:35, f:22 },
  { n:'火锅(人均1顿)', p:40, c:50, f:40 }, { n:'烧烤(3串)', p:18, c:5, f:20 },
  { n:'紫菜蛋花汤(1碗)', p:4, c:2, f:3 }, { n:'排骨汤(1碗)', p:8, c:3, f:12 },
  { n:'轻食沙拉(1份)', p:12, c:15, f:10 },
  // —— 坚果油脂 / 饮品零食
  { n:'花生(1小把)', p:7, c:6, f:14 }, { n:'混合坚果(30g)', p:6, c:6, f:15 },
  { n:'核桃(3个)', p:4, c:3, f:18 }, { n:'芝麻酱(1勺)', p:3, c:2, f:8 },
  { n:'橄榄油(1勺)', p:0, c:0, f:14 }, { n:'可乐(1罐)', p:0, c:39, f:0 },
  { n:'奶茶(1杯500ml)', p:3, c:45, f:12 }, { n:'拿铁(1杯)', p:6, c:12, f:6 },
  { n:'美式咖啡(1杯)', p:0, c:1, f:0 }, { n:'啤酒(1罐)', p:1, c:13, f:0 },
  { n:'薯片(1包/70g)', p:4, c:38, f:26 }, { n:'巧克力(1块)', p:3, c:25, f:18 },
  { n:'冰淇淋(1个)', p:4, c:22, f:12 }, { n:'蛋糕(1块)', p:5, c:35, f:15 },
  { n:'饼干(3片)', p:2, c:20, f:8 },
];
const MEAL_NAMES = ['早餐','午餐','晚餐','加餐'];
// v7.5：每日目标不再写死，随档案（体重等）实时计算
// 蛋白 1.8g/kg（ISSN 1.6–2.2 区间中值）· 热量 ≈ 33 kcal/kg（轻活动量估）· 饮水 ≈ 35 ml/kg（30–40 区间中值）
function dailyGoal(){
  const p = STATE.profile;
  const w0 = p && +p.weight;
  if(!w0 || !isFinite(w0)) return { protein:120, kcal:2000, water:2000 };
  const w = Math.max(30, Math.min(200, w0));     // 夹取：脏数据/极端值不产生荒谬目标
  return {
    protein: Math.round(w * 1.8),
    kcal:    Math.round(w * 33),
    water:   Math.round(w * 35 / 50) * 50,
  };
}

/* ---------- 状态持久化 ---------- */
const KEY = 'boji_v7';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const save = () => localStorage.setItem(KEY, JSON.stringify(STATE));
let STATE = Object.assign({
  profile:null, isFirstLaunch:true,
  checkins:{}, weights:{}, meals:{}, water:0, waterMl:null,
  scores:{},                                 // v7.5：每日训练评分 { feel, energy, sat, at }
  petPos:null, petDock:null, petMood:'happy', lastPetTouch:Date.now(),
  planEdits:{}, exLast:{}, editPlan:false,   // v7.3：计划可编辑 + 渐进超负荷记忆
}, load());
// v7.5 数据迁移：旧版饮水按“杯”（1杯≈250ml），一次性换算为 ml
if(STATE.waterMl == null && STATE.water > 0) STATE.waterMl = Math.round(STATE.water * 250);
if(!STATE.scores || typeof STATE.scores !== 'object') STATE.scores = {};

/* ---------- 工具 ---------- */
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; };
const wd = () => new Date().getDay();
const selKey = () => STATE.selDate || todayKey();
const estMin = plan => plan.ex.reduce((s,e)=>s + e.sets*((e.rest||60)/60) + e.sets*1.2, 0) | 0;
const suggKg = e => STATE.profile ? Math.max(1, Math.round((STATE.profile.dumbbell||10) * (e.base||0.4))) : null;
const streak = () => { let n=0; const d=new Date(); for(;;){ const k=`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; if(STATE.checkins[k]){n++; d.setDate(d.getDate()-1);} else break; } return n; };
// v7.3 渐进超负荷：重量按 0.5kg 取整（哑铃片最小刻度）
const roundHalf = x => Math.round((+x) * 2) / 2;
// 计算某动作的上次重量与“建议下一级重量”（达标后 +2.5kg）
function overloadSuggestion(t, i){
  const last = STATE.exLast?.[t]?.[i];
  if(last == null || last === '' || +last === 0) return { cur:0, next:null, ready:false };
  const ck = STATE.checkins[todayKey()];
  const ready = ck && ck.ex && Object.values(ck.ex).filter(Boolean).length >= PLANS[t].ex.length;
  return { cur:+last, next:roundHalf((+last) + 2.5), ready:!!ready };
}

/* ============================================================
   桌宠情绪引擎
   ============================================================ */
// 打字机气泡语速配置（可按需调慢/调快）
const TYPE = { charMs:42, startDelay:140, dwellPerChar:52, minDwell:2600, maxDwell:6200 };

// 台词池：随机抽取、不连续重复；语气活泼可爱（沿用纳西妲，不瞎编知识）
const LINES = {
  happy:['今天也要元气满满哦~','陪你一起变强(｡･ω･｡)ﾉ','要不要先喝口水呀','今天也要好好吃饭才行~'],
  expect:['该动一动啦，别瘫着~','今天的训练在等你哦','来，和我一起练嘛(｡•ᴗ•｡)','热身做好了没？'],
  cheer:['完成啦！超厉害的！','你今天超级棒(★ω★)','打卡成功，奖励自己一下~','这就是坚持的力量呀！'],
  proud:['我就知道你能做到！','进步看得见呢(｡･ω･｡)','继续保持这个节奏~','纳西妲超为你骄傲的！'],
  sad:['今天还没练哦…','偷偷告诉你，动一下就好','明天我们一起补上嘛','呜…你都不理我(>_<)'],
  think:['让我想想这个问题…','嗯…查一下资料先','稍等，我组织下语言','这个我得确认一下出处'],
  sleep:['zzz… 我先眯一会儿','好困…你也早点休息呀','晚安，明天见~','呼…困得睁不开眼了'],
  wave:['你来啦！','嗨~ 想我了没','在呢在呢，随时找我','抓到你啦(｡･ω･｡)ﾉ'],
  hover:['诶？你碰我啦(｡õ∀õ)','嘿嘿，被你发现啦~','摸摸头，舒服~','我一直在哦，放心'],
  drag:['带我去哪儿呀~','飞咯飞咯(｡ˇ∀ˇ)','抓稳咯，别松手！','去新位置安家啦'],
  idleLong:['主人好久没动啦，记得起来拉伸一下哦','偷偷提醒：喝口水、眨眨眼~','久坐伤身，站起来走走嘛(｡•ᴗ•｡)','我陪你，但也要动一动呀'],
};
const _lastIdx = {};
function pickLine(pool){ const arr = LINES[pool] || LINES.happy; if(arr.length===1) return arr[0];
  let i; do { i = Math.floor(Math.random()*arr.length); } while(i === _lastIdx[pool]); _lastIdx[pool] = i; return arr[i]; }
let petTimer=null, idleTimer=null, sleepTimer=null, nudgeTimer=null;
function setMood(mood, autoRevertMs){
  const pet = $('#pet'); if(!pet) return;
  Array.from(pet.classList).forEach(c=>{ if(c.startsWith('mood-')) pet.classList.remove(c); });
  pet.classList.add('mood-' + mood);
  say(pickLine(mood));
  STATE.petMood = mood; save();
  clearTimeout(petTimer);
  if(autoRevertMs) petTimer = setTimeout(()=>setMood('happy'), autoRevertMs);
}
// 气泡打字机：逐字显示，读完停留后消失；多句排队不丢字
let bubbleQueue = [], bubbleBusy = false;
function say(text){ if(!text) return; bubbleQueue.push(text); pumpBubble(); }
function pumpBubble(){ if(bubbleBusy) return; const t = bubbleQueue.shift(); if(t==null) return; bubbleBusy = true; typeBubble(t, ()=>{ bubbleBusy = false; pumpBubble(); }); }
function typeBubble(text, done){
  const b = $('#pet-bubble'); if(!b){ done(); return; }
  b.classList.add('show'); b.textContent = ''; clearTimeout(b._t);
  let i = 0;
  const tick = () => { if(i <= text.length){ b.textContent = text.slice(0, i); i++; b._t = setTimeout(tick, TYPE.charMs); }
    else { const dwell = Math.min(TYPE.maxDwell, Math.max(TYPE.minDwell, text.length * TYPE.dwellPerChar));
      b._t = setTimeout(()=>{ b.classList.remove('show'); b._t = setTimeout(done, 360); }, dwell); } };
  b._t = setTimeout(tick, TYPE.startDelay);
}
function petIdle(){
  clearTimeout(idleTimer);
  idleTimer = setTimeout(()=>{
    const r = Math.random();
    if(r<0.4) setMood('think', 2600);
    else if(r<0.7) setMood('expect', 2600);
    else if(r<0.85) setMood('happy', 2600);
    else setMood('wave', 2200);
    petIdle();
  }, 4200 + Math.random()*4000);
}
function petWake(){
  clearTimeout(sleepTimer); clearTimeout(nudgeTimer);
  STATE.lastPetTouch = Date.now();
  if($('#pet').classList.contains('mood-sleep')) setMood('wave', 1800);
  sleepTimer = setTimeout(()=>{ if(Date.now()-STATE.lastPetTouch > 55000) setMood('sleep'); }, 55000);
  // 长时间空闲（>28s 未互动）给一句轻柔提醒，不进睡眠
  nudgeTimer = setTimeout(()=>{ if(Date.now()-STATE.lastPetTouch > 28000 && !$('#pet').classList.contains('mood-sleep')) say(pickLine('idleLong')); }, 28000);
}
const PEEK = 0.56;   // 探头比例：贴边时约 56% 身体在屏内、44% 被屏幕边缘裁切
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
// 侧边探头停靠（仅左右两缘）：角色保持直立、头朝屏内（非吸附侧），半身探出被屏幕裁切
function applyDock(){
  const pet = $('#pet'); if(!pet) return;
  const sr = $('#screen').getBoundingClientRect();
  const pw = pet.offsetWidth || 126, ph = pet.offsetHeight || 150;
  const dock = (STATE.petDock && (STATE.petDock.edge==='left'||STATE.petDock.edge==='right'))
    ? STATE.petDock : { edge:'right', off:0.62 };     // 旧的上/下停靠数据迁移为默认右缘
  const isRight = dock.edge==='right';
  const left = isRight ? sr.width - pw*PEEK : -pw*(1-PEEK);
  const top = clamp(dock.off*sr.height - ph/2, 56 - ph/2, sr.height - 104 - ph/2);
  pet.style.left = left+'px'; pet.style.top = top+'px'; pet.style.transform = 'none';
  pet.classList.remove('edge-l','edge-r','peek-more');
  pet.classList.add(isRight?'edge-r':'edge-l');
}
// 拖拽结束后吸附到较近的一侧（只考虑左/右）
function dockToNearest(){
  const pet = $('#pet'); const sr = $('#screen').getBoundingClientRect(); const r = pet.getBoundingClientRect();
  const cx = r.left - sr.left + r.width/2, cy = r.top - sr.top + r.height/2;
  const edge = cx < sr.width/2 ? 'left' : 'right';
  const off = clamp(cy/sr.height, 0.1, 0.9);
  STATE.petDock = { edge, off }; save(); applyDock();
}
function initPet(){
  const pet = $('#pet'); if(!pet) return;
  if(STATE.petPos && !STATE.petDock){ STATE.petDock = { edge:'right', off:0.62 }; }  // 兼容旧版位置数据
  applyDock();
  setMood(STATE.petMood && LINES[STATE.petMood] ? STATE.petMood : 'happy');
  petWake(); petIdle();
  let sx,sy,ox,oy,dragged=false,pid=null;
  pet.addEventListener('pointerdown', e=>{
    pid=e.pointerId; pet.setPointerCapture(pid); pet.classList.add('dragging');
    pet.classList.remove('edge-l','edge-r','edge-t','edge-b','peek-more');  // 拎起时转正
    sx=e.clientX; sy=e.clientY; dragged=false;
    const r=pet.getBoundingClientRect(); const sr=$('#screen').getBoundingClientRect();
    ox=r.left-sr.left; oy=r.top-sr.top; e.preventDefault();
  });
  pet.addEventListener('pointermove', e=>{
    if(pid===null) return;
    const dx=e.clientX-sx, dy=e.clientY-sy;
    if(Math.abs(dx)>5||Math.abs(dy)>5){ if(!dragged) say(pickLine('drag')); dragged=true; }
    const sr=$('#screen').getBoundingClientRect();
    let nl=ox+dx, nt=oy+dy;
    nl=Math.max(8, Math.min(sr.width-pet.offsetWidth-8, nl));
    nt=Math.max(50, Math.min(sr.height-pet.offsetHeight-90, nt));
    pet.style.left=nl+'px'; pet.style.top=nt+'px'; pet.style.transform='none';
  });
  const end=()=>{
    if(pid===null) return;
    pet.releasePointerCapture(pid); pid=null; pet.classList.remove('dragging');
    if(!dragged){ openAssistant(); }            // 轻点 = 展开助手对话
    else { dockToNearest(); setMood('happy', 1600); }   // 拖拽 = 吸附最近边
    petWake();
  };
  pet.addEventListener('pointerup', end);
  pet.addEventListener('pointercancel', end);
  pet.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ openAssistant(); }});
  // 鼠标悬停：向屏内多探头一点 + 轻脉冲 + 一句可爱台词（触屏无此事件）
  pet.addEventListener('pointerenter', e=>{
    if(e.pointerType!=='mouse') return;
    if(pet.classList.contains('dragging') || pet.classList.contains('mood-sleep')) return;
    pet.classList.add('hover-pulse','peek-more');
    setTimeout(()=>pet.classList.remove('hover-pulse','peek-more'), 620);
    say(pickLine('hover'));
  });
}

/* ============================================================
   P0 移动端返回键：层栈 + history 守卫
   ------------------------------------------------------------
   · 每打开一层（面板/弹窗）压入一条 history 记录，返回键回到上一层
   · 无层可退时才做“再按一次退出”，连按两次（2.2s 内）才真正离开
   · UI 上的 ✕ / 完成 通过 UI 关闭路径同步回退 history，避免堆栈错位
   ============================================================ */
const NAV = { stack:[], g:0, suppress:0, lastExit:0 };   // g = 由我们压入的 history 条数
const CLOSERS = {
  assistant:   ()=>{ const p=$('#assistant'); p.classList.remove('open'); p.setAttribute('aria-hidden','true'); },
  module:      ()=>{ const p=$('#module');    p.classList.remove('open'); p.setAttribute('aria-hidden','true'); },
  onboard:     ()=>{ $('#onboard').classList.remove('show'); },
  'done-modal':()=>{ $('#done-modal').classList.remove('show'); },
  'food-sheet':()=>{ const s=$('#food-sheet'); s.classList.remove('show'); s.setAttribute('aria-hidden','true'); },
};
function navPush(tag){
  try { history.pushState({ boji:tag }, '', location.href); NAV.g++; return true; } catch(_){ return false; }
}
// 打开一层：先垫一条 shield（挡住真实的上一页），再压本层
function navOpen(id){
  if(NAV.g===0) navPush('shield');
  if(navPush('layer:'+id)) NAV.stack.push(id);
}
// UI 主动关闭（点 ✕ / 完成）：先关 DOM，再一次性回退对应层数
function navUIClose(id){
  const fn = CLOSERS[id]; if(fn) fn();
  const i = NAV.stack.lastIndexOf(id);
  if(i<0) return;
  const n = NAV.stack.length - i;          // 连同它之上的层一起退
  NAV.stack.length = i;
  NAV.suppress = n;
  try { history.go(-n); } catch(_){ NAV.suppress = 0; }
}
window.addEventListener('popstate', ()=>{
  NAV.g = Math.max(0, NAV.g - 1);
  if(NAV.suppress>0){ NAV.suppress--; return; }      // UI 关闭路径已处理，这里只做计数对齐
  const id = NAV.stack.pop();
  if(id){ const fn=CLOSERS[id]; if(fn) fn(); return; }
  navExitAttempt();
});
function navExitAttempt(){
  const now = Date.now();
  if(now - NAV.lastExit < 2200){          // 2.2s 内第二次 → 真退出
    NAV.lastExit = 0;
    try { window.close(); } catch(_){}
    setTimeout(()=>{ try { history.back(); } catch(_){} }, 80);
    return;
  }
  NAV.lastExit = now;
  toast('再按一次退出薄肌日记 (｡･ω･｡)');
  navPush('shield');                      // 补一层哨兵，防止下一次直接离开
}

/* ============================================================
   面板路由
   ============================================================ */
function openPanel(id){ const p=$('#'+id); p.classList.add('open'); p.setAttribute('aria-hidden','false'); navOpen(id); }
function closePanel(id){ navUIClose(id); }
function openAssistant(){ renderAssistant(); if($('#assistant').classList.contains('open')){ return; } openPanel('assistant'); setMood('wave',1500); }
function goModule(name){
  const titles={training:['训练计划','居家哑铃 · 点日期看当天动作'],diet:['今日饮食','拍照记录吃进来的'],data:['我的数据','打卡·月历·评分·趋势'],profile:['我的','档案与设置']};
  $('#mod-title').textContent=titles[name][0]; $('#mod-sub').textContent=titles[name][1];
  renderModule(name);
  if($('#module').classList.contains('open')) return;   // 已打开：只重渲染，不重复压栈
  openPanel('module');
}

/* ============================================================
   桌面主屏
   ============================================================ */
function renderHome(){
  const now=new Date();
  $('#c-time').textContent = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
  $('#sb-time').textContent = $('#c-time').textContent;
  $('#c-date').textContent = `${WEEKDAY[now.getDay()]} · ${now.getMonth()+1}月${now.getDate()}日`;
  const t=getDayType(now.getDay());
  const done = !!STATE.checkins[todayKey()];
  $('#home-stats').innerHTML = `
    <div class="hs-pill">🏠 居家哑铃</div>
    <div class="hs-pill">今天<b> ${dayTypeLabel(t)}</b></div>
    <div class="hs-pill">打卡<b> ${done?'已✓':'未'}</b></div>
    <div class="hs-pill">连续<b> ${streak()} 天</b></div>`;
  const ht = $('#home-today');
  if(t==='rest'){
    ht.innerHTML = `<div class="hc-head"><span class="hc-ic">🌿</span><div><b>今天休息日</b><span>肌肉在悄悄生长</span></div></div>
      <p class="hc-sub">睡够 7.5h、蛋白吃够，或快走 30 分钟。点底部“训练”可看其他训练日动作。</p>`;
  } else {
    const plan = PLANS[t]; const exDone = STATE.checkins[todayKey()]?.ex || {};
    const doneN = plan.ex.filter((_,i)=>exDone[i]).length, pct = Math.round(doneN/plan.ex.length*100);
    ht.innerHTML = `<div class="hc-head"><span class="hc-ic">💪</span><div><b>${plan.name}</b><span>${plan.greeting}</span></div>
      <button class="hc-go" id="hc-go">进入 ›</button></div>
      <div class="hc-chips">${plan.ex.slice(0,5).map((e,i)=>`<span class="hc-chip${exDone[i]?' on':''}">${exDone[i]?'✓ ':''}${e.name}</span>`).join('')}${plan.ex.length>5?`<span class="hc-chip more">+${plan.ex.length-5}</span>`:''}</div>
      <div class="hc-bar"><i style="width:${pct}%"></i></div>`;
    $('#hc-go').onclick = ()=>goModule('training');
  }
}

/* ============================================================
   助手对话（纳西妲）
   ============================================================ */
function md(s){ return esc(s).replace(/\*\[([ABC])\][^*]*\*/g,(_,lv)=>`<span class="ev">证据等级 ${lv}</span>`).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>'); }
function addMsg(role,text){
  const chat=$('#chat'); const node=el(`<div class="msg ${role}">${role==='bot'?`<img class="av" src="assets/nahida-icon.webp" alt="">`:''}${md(text)}</div>`);
  chat.appendChild(node); chat.scrollTop=chat.scrollHeight;
}
function renderAssistant(){
  const chat=$('#chat');
  if(chat.childElementCount===0){
    addMsg('bot',`你好呀，我是${COACH_NAME}，你的专属增肌教练(｡･ω･｡)ﾉ\n训练、营养、恢复都可以问我——我只回答有科学出处的，没把握的我会直说，不瞎编。`);
  }
  const quick=$('#quick');
  quick.innerHTML='';
  ['今天练什么','蛋白质吃多少','卧推肩疼怎么办','什么时候加重量'].forEach(q=>{
    const b=el(`<button>${q}</button>`); b.onclick=()=>sendMsg(q); quick.appendChild(b);
  });
}
function sendMsg(text){
  text=(text||$('#chat-text').value).trim(); if(!text) return;
  $('#chat-text').value=''; addMsg('user',text); setMood('think',1400);
  setTimeout(()=>{ const r=nahidaReply(text); addMsg('bot',r); setMood(/完成|棒|厉害|✓/.test(r)?'cheer':'happy',2600); }, 620);
}

/* ============================================================
   训练模块（周历 + 当日动作）
   ============================================================ */
function renderModule(name){
  const body=$('#mod-body');
  if(name==='training') return renderTraining(body);
  if(name==='diet') return renderDiet(body);
  if(name==='data') return renderData(body);
  if(name==='profile') return renderProfile(body);
}
function renderTraining(body){
  const sel=selKey(); const [Y,M,D]=sel.split('-').map(Number);
  const d=new Date(Y,M-1,D); const w=d.getDay(); const t=getDayType(w);
  const planSafe = PLANS[t] ? t : 'rest';
  const isToday = sel===todayKey();
  const done = !!STATE.checkins[sel];
  let html = `<div class="card"><h4>本周安排 <span class="tag">${isToday?'今天':WEEKDAY[w]}</span></h4><div class="week">`;
  for(let i=0;i<7;i++){ const dd=new Date(); dd.setDate(dd.getDate()-dd.getDay()+i);
    const k=`${dd.getFullYear()}-${dd.getMonth()+1}-${dd.getDate()}`; const tw=dd.getDay(); const tt=getDayType(tw);
    const cls=['wday']; if(tw===wd())cls.push('today'); if(k===sel)cls.push('sel'); if(STATE.checkins[k])cls.push('done');
    html+=`<button class="${cls.join(' ')}" data-day="${k}"><span>${WEEKDAY[tw][1]}</span><span class="wd-d">${dd.getDate()}</span><span>${tt==='rest'?'休':tt[0].toUpperCase()}</span></button>`;
  }
  html+=`</div></div>`;
  if(planSafe==='rest'){
    html+=`<div class="card"><h4>休息日 ♡</h4><p style="font-size:13px;color:var(--ink2);line-height:1.7">${PLANS?'今天让肌肉悄悄生长。睡眠 7.5h+、蛋白吃够，也可以快走 30 分钟。':''}休息也是训练的一部分。</p>
    <div class="dash"></div><p style="font-size:12px;color:var(--faint)">想看动作？点上方其他训练日 →</p></div>`;
  } else {
    const plan=PLANS[t]; const exDone=STATE.checkins[sel]?.ex||{};
    html+=`<div class="card"><h4>${plan.name} <span class="tag">居家哑铃</span><span class="tag">约 ${estMin(plan)} 分钟</span></h4><p style="font-size:12px;color:var(--ink2)">${plan.greeting}</p>
      <button class="plan-edit-btn" id="plan-edit">${STATE.editPlan?'完成编辑 ✓':'✎ 编辑计划'}</button></div>`;
    plan.ex.forEach((e,i)=>{
      const finished=exDone[i];
      const eff=(STATE.planEdits[t] && STATE.planEdits[t][i]) ? Object.assign({}, e, STATE.planEdits[t][i]) : e;
      const ov=overloadSuggestion(t,i);
      const editRow = STATE.editPlan
        ? `<div class="ex-edit">组数 <input type="number" inputmode="numeric" min="1" max="10" value="${eff.sets}" data-ps="${i}"> 次数 <input type="text" value="${eff.reps}" data-pr="${i}"></div>`
        : '';
      const overRow = ov.next ? `<div class="ex-over">上次 <b>${ov.cur}</b>kg · 建议 <b>${ov.next}</b>kg${ov.ready?` <button data-apply="${i}">应用 +2.5</button>`:'（达标后解锁）'}</div>` : '';
      html+=`<div class="ex"><div class="ex-top"><span class="ex-no">${i+1}</span><span class="ex-name">${e.name}</span><span class="ex-sets">${eff.sets}×${eff.reps} · 休${e.rest}s</span></div>
        <div class="ex-kv"><span class="k">动作标准</span><span class="v ok">${e.standard}</span><span class="k">注意事项</span><span class="v warn">${e.note}</span></div>
        <div class="ex-weight">起始重量 <input type="number" inputmode="decimal" value="${STATE.weights[sel]?.[i] ?? (suggKg(e)||'')}" placeholder="kg" data-w="${i}"> kg</div>
        ${editRow}${overRow}
        <div class="ex-video" data-v="${e.video.url}">▶ ${e.video.label}</div>
        <button class="ex-do ${finished?'done':''}" data-ex="${i}">${finished?'已完成 ✓':'完成这组'}</button></div>`;
    });
    html+=`<button class="btn-grad" id="day-finish" style="margin-top:4px">${done?'今日已打卡 ✓':'完成今日训练并打卡'}</button>`;
    // P2：已有记录的“删”——可撤销当天打卡（数据仍在列表内，只是去掉打卡标记）
    if(done) html+=`<button class="ex-do" id="day-undo" style="background:var(--glass);color:var(--faint);margin-top:8px">撤销今日打卡</button>`;
    html+=`<p style="font-size:10.5px;color:var(--faint);margin-top:10px;line-height:1.6">${TIMESTAMP_NOTE}</p>`;
  }
  body.innerHTML=html;
  // 绑定
  $$('#mod-body .wday').forEach(b=>b.onclick=()=>{ STATE.selDate=b.dataset.day; save(); renderTraining(body); });
  $$('#mod-body .ex-video').forEach(v=>v.onclick=()=>window.open(v.dataset.v,'_blank'));
  $$('#mod-body .ex-do').forEach(b=>b.onclick=()=>{ const i=+b.dataset.ex; STATE.checkins[sel]=STATE.checkins[sel]||{ex:{}}; const now=!STATE.checkins[sel].ex[i]; STATE.checkins[sel].ex[i]=now; save(); renderTraining(body);
    if(now){ setMood('cheer',1500); toast('动作完成 +1 (｡･ω･｡)'); startRest((PLANS[t] && PLANS[t].ex[i] && PLANS[t].ex[i].rest) || 60); } else stopRest(); });
  $$('#mod-body .ex-weight input').forEach(inp=>inp.onchange=()=>{ const i=+inp.dataset.w; STATE.weights[sel]=STATE.weights[sel]||{}; STATE.weights[sel][i]=inp.value; save(); });
  const fin=$('#day-finish'); if(fin) fin.onclick=()=>finishDay(sel,t);
  const und=$('#day-undo'); if(und) und.onclick=()=>{ if(!confirm('撤销今天的打卡记录？动作勾选会保留。')) return;
    delete STATE.checkins[sel]; save(); renderTraining(body); renderHome(); toast('已撤销今日打卡'); };
  const pe=$('#plan-edit'); if(pe) pe.onclick=()=>{ STATE.editPlan=!STATE.editPlan; save(); renderTraining(body); };
  $$('#mod-body [data-ps]').forEach(inp=>inp.onchange=()=>{ const i=+inp.dataset.ps; STATE.planEdits[t]=STATE.planEdits[t]||{}; STATE.planEdits[t][i]=Object.assign({}, STATE.planEdits[t][i], { sets:+inp.value||3 }); save(); });
  $$('#mod-body [data-pr]').forEach(inp=>inp.onchange=()=>{ const i=+inp.dataset.pr; STATE.planEdits[t]=STATE.planEdits[t]||{}; STATE.planEdits[t][i]=Object.assign({}, STATE.planEdits[t][i], { reps:inp.value }); save(); });
  $$('#mod-body [data-apply]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.apply; const w=STATE.exLast?.[t]?.[i]; if(w==null) return; const inp=body.querySelector(`.ex-weight input[data-w="${i}"]`); if(inp){ inp.value=roundHalf((+w)+2.5); STATE.weights[sel]=STATE.weights[sel]||{}; STATE.weights[sel][i]=inp.value; save(); toast('已应用渐进超负荷建议 +2.5kg'); } });
  // v7.5 治理：把原本写好却没接线的组间休息计时器接上（点“完成这组”后自动倒计时）
  $('#rt-skip') && ($('#rt-skip').onclick=stopRest);
}
/* ---------- 组间休息计时器（v7.5 治理：把已有 UI 接线，去掉死代码） ---------- */
let restId=null;
function startRest(sec){
  const box=$('#rest-timer'); if(!box) return;
  let left=Math.max(1, Math.round(+sec||60));
  $('#rt-sec').textContent=left;
  box.classList.remove('hidden');
  clearInterval(restId);
  restId=setInterval(()=>{
    left--; $('#rt-sec').textContent=Math.max(0,left);
    if(left<=0){ stopRest(); setMood('happy',1600); toast('休息结束，开始下一组！'); }
  }, 1000);
}
function stopRest(){ clearInterval(restId); restId=null; const b=$('#rest-timer'); if(b) b.classList.add('hidden'); }

function finishDay(sel,t){
  const plan=PLANS[t]; const exDone=STATE.checkins[sel]?.ex||{};
  const total=plan.ex.length; const done=Object.values(exDone).filter(Boolean).length;
  // v7.3：记录每个动作“上次用重量”（来自 STATE.weights 的实时保存），供渐进超负荷建议使用
  STATE.exLast[t]=STATE.exLast[t]||{};
  plan.ex.forEach((e,i)=>{ const w=STATE.weights[sel]?.[i]; if(w!=null && w!=='') STATE.exLast[t][i]=w; });
  if(done<total){ toast(`还有 ${total-done} 个动作没完成哦`); setMood('sad',2000); return; }
  STATE.checkins[sel]={ex:exDone, at:Date.now()}; save();
  setMood('cheer',3500); setTimeout(()=>setMood('proud',3000),3600);
  $('#done-emoji').textContent='🎉'; $('#done-title').textContent='今日训练完成！';
  $('#done-sub').textContent=`${plan.name} · 全部 ${total} 个动作达成，纳西妲为你骄傲(★ω★)`;
  $('#done-stats').innerHTML=`<div class="ds"><b>${total}</b><span>动作</span></div><div class="ds"><b>${estMin(plan)}</b><span>分钟</span></div><div class="ds"><b>${streak()}</b><span>连续天</span></div>`;
  $('#done-modal').classList.add('show');
  navOpen('done-modal');          // 入栈：返回键先关弹窗，不退出 App
  renderHome();
  setTimeout(()=>toast('到「数据」页给今天的训练打个分吧 (｡･ω･｡)'), 1200);
}

/* ---------- 饮食（v7.5：饮水按 ml · 拍照记录 + 常见食物库估算 + 手动校正） ---------- */
// 兼容旧数据：早期记录没有 q 字段，按 1 份计
const mealQty = f => (f && typeof f === 'object' && +f.q > 0) ? +f.q : 1;
const foodKcal = f => (+f.kcalFix > 0) ? Math.round(+f.kcalFix * mealQty(f)) : Math.round((f.p*4 + f.c*4 + f.f*9) * mealQty(f));
function renderDiet(body){
  const key=todayKey();
  const meals=STATE.meals[key]||{};
  const water=STATE.waterMl||0;
  const goal=dailyGoal();
  const wPct=Math.min(100, Math.round(water/goal.water*100));
  let pTot=0,cTot=0,fTot=0,kcalTot=0;
  let html=`<div class="card"><h4>今日饮水 <span class="tag">${water} / ${goal.water} ml</span></h4>
    <div class="water-bar"><i style="width:${wPct}%"></i></div>
    <div class="row-btns"><button class="btn-grad" id="water-100" style="padding:9px">+100ml</button>
    <button class="btn-grad" id="water-250" style="padding:9px">+250ml</button>
    <button class="ex-do" id="water-sub" style="background:var(--glass);color:var(--ink2)">-100ml</button></div></div>`;
  MEAL_NAMES.forEach((mn,mi)=>{
    const list=meals[mi]||[]; let mp=0,mc=0,mf=0,mk=0;
    list.forEach(f=>{ const q=mealQty(f); mp+=f.p*q; mc+=f.c*q; mf+=f.f*q; mk+=foodKcal(f); });
    pTot+=mp; cTot+=mc; fTot+=mf; kcalTot+=mk;
    html+=`<div class="card"><h4>${mn} <span class="tag">蛋白 ${Math.round(mp)}g</span><span class="tag" style="background:rgba(126,177,232,.18);color:#4a7fae">${mk} kcal</span></h4>`;
    if(list.length){
      list.forEach((f,i)=>{ const q=mealQty(f);
        const thumb = f.photo ? `<img class="fd-ph" src="${f.photo}" alt="">` : '🍽️';
        html+=`<div class="list-row"><span class="lr-ic">${thumb}</span><span class="fd-n">${esc(f.n)}</span>
          <span class="fd-q">${q}份 · ${foodKcal(f)} kcal</span>
          <span class="fd-x" data-dec="${mi}:${i}">−</span><span class="fd-x" data-inc="${mi}:${i}">+</span>
          <span class="lr-ar fd-del" data-del="${mi}:${i}">✕</span></div>`; });
    } else html+=`<p style="font-size:12px;color:var(--faint)">还没记录</p>`;
    html+=`<div class="row-btns" style="margin-top:8px">
      <button class="ex-do" data-photo="${mi}">📷 拍照记录</button>
      <button class="ex-do ghost-btn" data-add="${mi}">✍ 手动选</button></div></div>`;
  });
  html+=`<div class="card"><h4>今日总计 <span class="tag">${kcalTot} / ${goal.kcal} kcal</span></h4>
    <div class="row"><span>蛋白质</span><b>${Math.round(pTot)} / ${goal.protein} g</b></div>
    <div class="row"><span>碳水</span><b>${Math.round(cTot)} g</b></div>
    <div class="row"><span>脂肪</span><b>${Math.round(fTot)} g</b></div>
    <p style="font-size:11px;color:var(--faint);padding-top:4px">目标随档案体重实时计算（蛋白 1.8g/kg · 热量 ≈33kcal/kg）</p></div>`;
  body.innerHTML=html;
  $('#water-100').onclick=()=>addWater(100,body);
  $('#water-250').onclick=()=>addWater(250,body);
  $('#water-sub').onclick=()=>addWater(-100,body);
  $$('#mod-body [data-photo]').forEach(b=>b.onclick=()=>openPhotoIntake(+b.dataset.photo,body));
  $$('#mod-body [data-add]').forEach(b=>b.onclick=()=>openFoodSheet(+b.dataset.add,body,null));
  // 改：± 份数
  $$('#mod-body [data-inc]').forEach(x=>x.onclick=()=>{ const [mi,i]=x.dataset.inc.split(':').map(Number); changeQty(mi,i,+0.5,body); });
  $$('#mod-body [data-dec]').forEach(x=>x.onclick=()=>{ const [mi,i]=x.dataset.dec.split(':').map(Number); changeQty(mi,i,-0.5,body); });
  // 删：移除该条
  $$('#mod-body [data-del]').forEach(x=>x.onclick=()=>{ const [mi,i]=x.dataset.del.split(':').map(Number);
    const arr=STATE.meals[todayKey()]?.[mi]; if(!arr) return; arr.splice(i,1); save(); renderDiet(body); toast('已删除该条记录'); });
}
function addWater(ml,body){
  const before=STATE.waterMl||0;
  STATE.waterMl=Math.max(0, before+ml);
  const goal=dailyGoal().water;
  save(); renderDiet(body);
  if(before<goal && STATE.waterMl>=goal) toast('今日饮水目标达成 💧 纳西妲给你点赞！');
}
function changeQty(mi,i,d,body){
  const arr=STATE.meals[todayKey()]?.[mi]; if(!arr || !arr[i]) return;
  const q=Math.max(0.5, +(mealQty(arr[i])+d).toFixed(1));
  arr[i].q=q; save(); renderDiet(body);
}
/* ---------- 拍照记录：拍照 → 压缩缩略图 → 校正面板 ---------- */
function compressImage(file, maxPx, cb){
  const img=new Image();
  const url=URL.createObjectURL(file);
  img.onload=()=>{
    const sc=Math.min(1, maxPx/Math.max(img.width, img.height));
    const cv=document.createElement('canvas');
    cv.width=Math.max(1, Math.round(img.width*sc)); cv.height=Math.max(1, Math.round(img.height*sc));
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    URL.revokeObjectURL(url);
    cb(cv.toDataURL('image/jpeg', 0.72));
  };
  img.onerror=()=>{ URL.revokeObjectURL(url); cb(null); };
  img.src=url;
}
function openPhotoIntake(mi, body){
  const inp=document.createElement('input');
  inp.type='file'; inp.accept='image/*';
  try { inp.setAttribute('capture','environment'); } catch(_){}
  inp.onchange=()=>{ const f=inp.files && inp.files[0]; if(!f) return;
    compressImage(f, 160, du=>{
      if(!du) toast('照片读取失败，可直接手动校正');
      openFoodSheet(mi, body, du);       // 识别失败也进入校正面板（无缩略图）
    });
  };
  inp.click();
}
/* ---------- 校正面板：本地库估算 + OpenFoodFacts 在线查询 + 全字段手动校正 ---------- */
const OFF_API='https://world.openfoodfacts.org/cgi/search.pl?search_terms=';
let _fsSel=null;   // { n,p,c,f,q } 或 { n,p,c,f,per100:true,grams } + 可选 kcalFix（用户手动覆盖这份总热量）
// OpenFoodFacts 公开 API（无需密钥）：按名称查包装食品每 100g 营养；7s 超时、失败回落本地库
function queryOFF(q, cb){
  if(typeof fetch!=='function'){ cb(new Error('当前环境不支持联网查询'), null); return; }
  const url=OFF_API + encodeURIComponent(q) + '&search_simple=1&action=process&json=1&page_size=5&fields=product_name,brands,nutriments';
  let ctl=null, timer=null;
  try{
    ctl = (typeof AbortController==='function') ? new AbortController() : null;
    timer = setTimeout(function(){ try{ if(ctl) ctl.abort(); }catch(e){} }, 7000);
    fetch(url, ctl ? { signal: ctl.signal } : undefined)
      .then(function(r){ if(!r || !r.ok) throw new Error('HTTP ' + (r && r.status)); return r.json(); })
      .then(function(d){
        const list=(d && Array.isArray(d.products) ? d.products : []).map(function(x){
          const nu=x.nutriments||{};
          const kcal100 = +(nu['energy-kcal_100g'] != null ? nu['energy-kcal_100g']
                            : (nu['energy_100g'] ? Math.round(nu['energy_100g']/4.184) : 0)) || 0;
          return { n:((x.product_name||'').trim() || '未命名商品') + (x.brands ? ' · ' + x.brands : ''),
                   p:+(nu.proteins_100g)||0, c:+(nu.carbohydrates_100g)||0, f:+(nu.fat_100g)||0,
                   kcal100:kcal100, per100:true, grams:100, q:1 };
        }).filter(function(x){ return x.kcal100 || x.p || x.c || x.f; }).slice(0,5);
        cb(null, list);
      })
      .catch(function(e){ cb(e, null); })
      .finally(function(){ if(timer) clearTimeout(timer); });
  }catch(e){ if(timer) clearTimeout(timer); cb(e, null); }
}
const selFactor = s => s.per100 ? (Math.max(1, +s.grams||100))/100 : Math.max(0.5, +s.q||1);
function selKcal(s){
  if(!s) return 0;
  if(+s.kcalFix > 0) return Math.round(+s.kcalFix);          // 用户手动覆盖优先
  return Math.round((s.p*4 + s.c*4 + s.f*9) * selFactor(s));
}
function selName(s){ return s.per100 ? s.n + ' ' + (s.grams||100) + 'g' : s.n; }
function openFoodSheet(mi, body, photo){
  _fsSel=null;
  const list=$('#food-list');
  const photoHtml = photo
    ? `<div class="fs-photo"><img src="${photo}" alt=""><span>📷 已拍摄留档 · 请在下方搜索/选择食物并校正份量（离线用本地库，联网可查在线库）</span></div>`
    : `<div class="fs-photo no"><span>未带照片 · 从常见食物中选取，份量与热量都可改</span></div>`;
  list.innerHTML=`<input id="food-search" type="text" placeholder="搜索食物，如：鸡胸、米饭、饺子…" maxlength="30">
    ${photoHtml}<div id="off-hits"></div><div id="food-hits"></div><div id="food-editor"></div>`;
  const renderHits=kw=>{
    const q=(kw||'').trim().toLowerCase();
    const hits=EST_LIB.filter(f=>!q || f.n.toLowerCase().indexOf(q)>=0).slice(0,10);
    const hitsEl=list.querySelector('#food-hits');
    hitsEl.innerHTML = hits.map(f=>{ const idx=EST_LIB.indexOf(f);
      return `<div class="food-row" data-hit="${idx}"><div class="fr-m"><b>${f.n}</b>
        <span>蛋白 ${f.p}g · 碳水 ${f.c}g · 脂肪 ${f.f}g · 约 ${Math.round(f.p*4+f.c*4+f.f*9)} kcal/份</span></div>
        <span class="lr-ar">选 ›</span></div>`; }).join('')
      || `<p class="fs-none">本地库没有匹配项，可点「在线查询」试试，或选相近食物后改名字</p>`;
    hitsEl.querySelectorAll('[data-hit]').forEach(r=>r.onclick=()=>{
      _fsSel=Object.assign({}, EST_LIB[+r.dataset.hit], { q:1 });
      renderEditor();
    });
  };
  const renderEditor=()=>{
    const ed=list.querySelector('#food-editor'); if(!ed) return;
    if(!_fsSel){ ed.innerHTML=`<p class="fs-none">先在上面选一个食物，再校正名称 / 份量 / 热量</p>`; return; }
    const per100=!!_fsSel.per100, unit=per100?'克':'份', amt=per100?(_fsSel.grams||100):_fsSel.q;
    ed.innerHTML=`<div class="fs-edit">
      <label>食物名（可改）<input id="fe-name" type="text" maxlength="40" value="${esc(_fsSel.n)}"></label>
      <div class="fs-qrow">${unit}数
        <button id="fe-dec" type="button">−</button>
        <input id="fe-q" type="number" inputmode="decimal" min="${per100?'1':'0.5'}" step="${per100?'10':'0.5'}" value="${amt}">
        <button id="fe-inc" type="button">＋</button>
        <span id="fe-kcal">约 <b>${selKcal(_fsSel)}</b> kcal</span></div>
      <div class="fs-qrow">手动覆盖热量<input id="fe-kfix" type="number" inputmode="numeric" min="0" step="10" placeholder="选填：这份实际 kcal" value="${_fsSel.kcalFix||''}"></div>
      <button class="btn-grad ghost-btn" id="fe-off" type="button" style="margin-bottom:8px">🌐 在线查询「${esc((_fsSel.n||'').slice(0,10))}」</button>
      <button class="btn-grad" id="fe-add" type="button">添加到${MEAL_NAMES[mi]}</button></div>`;
    const syncKcal=()=>{ const k=$('#fe-kcal'); if(k) k.innerHTML=`约 <b>${selKcal(_fsSel)}</b> kcal`; };
    $('#fe-name').oninput=e=>{ _fsSel.n=e.target.value; };
    const curAmt=()=> _fsSel.per100 ? _fsSel.grams : _fsSel.q;
    const setAmt=v=>{ if(_fsSel.per100) _fsSel.grams=Math.max(1, Math.round(+v||100)); else _fsSel.q=Math.max(0.5, +(+v).toFixed(1)||1); delete _fsSel.kcalFix; syncKcal(); };
    $('#fe-q').oninput=e=>setAmt(e.target.value);
    $('#fe-q').onchange=e=>{ setAmt(e.target.value); $('#fe-q').value=curAmt(); };
    $('#fe-dec').onclick=()=>{ setAmt(curAmt() - (_fsSel.per100?50:0.5)); $('#fe-q').value=curAmt(); };
    $('#fe-inc').onclick=()=>{ setAmt(curAmt() + (_fsSel.per100?50:0.5)); $('#fe-q').value=curAmt(); };
    $('#fe-kfix').oninput=e=>{ const v=+e.target.value; if(v>0){ _fsSel.kcalFix=v; } else delete _fsSel.kcalFix; syncKcal(); };
    $('#fe-off').onclick=()=>{
      const kw=(_fsSel.n||'').replace(/[（(].*?[)）]/g,'').trim() || '';
      if(!kw){ toast('先填个食物名再查询'); return; }
      const offEl=list.querySelector('#off-hits');
      offEl.innerHTML=`<p class="fs-none">正在查询在线食物库…</p>`;
      queryOFF(kw, (err, rows)=>{
        if(err || !rows || !rows.length){
          offEl.innerHTML=`<p class="fs-none">在线库没查到（离线或该食物未收录）· 用上面本地库估算即可，数值可手动改</p>`;
          return;
        }
        offEl.innerHTML=`<div class="fs-off-t">在线结果（每 100g）</div>` + rows.map((f,i)=>
          `<div class="food-row" data-off="${i}"><div class="fr-m"><b>${esc(f.n.slice(0,28))}</b>
            <span>${Math.round(f.kcal100)} kcal · 蛋白 ${f.p}g · 碳水 ${f.c}g · 脂肪 ${f.f}g /100g</span></div>
            <span class="lr-ar">选 ›</span></div>`).join('');
        offEl.querySelectorAll('[data-off]').forEach(r=>r.onclick=()=>{
          _fsSel=Object.assign({}, rows[+r.dataset.off]);
          renderEditor(); toast('已载入在线数据，默认按 100g 计');
        });
      });
    };
    $('#fe-add').onclick=()=>{
      const s=_fsSel; if(!s) return;
      const per100=!!s.per100;
      const factor=per100 ? selFactor(s) : 1;      // 在线条目按克数折算；本地库保留“每份”基准
      const amount=per100 ? 1 : selFactor(s);      // 本地库：份数即数量，后续还能 ±0.5 调整
      const kcal=selKcal(s);
      const name=(s.n||'').trim() || '未知食物';
      const rec={ n:selName(s), p:+(s.p*factor).toFixed(1), c:+(s.c*factor).toFixed(1), f:+(s.f*factor).toFixed(1), q:amount, photo:photo||null };
      if(+s.kcalFix>0) rec.kcalFix=Math.round((+s.kcalFix) / (per100 ? 1 : amount));   // 覆盖值按“每份”存，±份数时同步缩放
      if(!(rec.p||rec.c||rec.f) && !rec.kcalFix) rec.kcalFix=kcal;
      const key=todayKey();
      STATE.meals[key]=STATE.meals[key]||{};
      STATE.meals[key][mi]=STATE.meals[key][mi]||[];
      STATE.meals[key][mi].push(rec);
      save(); navUIClose('food-sheet'); _fsSel=null;
      toast(`已记录 ${name} · ${kcal} kcal`);
      if($('#module').classList.contains('open')) renderDiet(body);
    };
  };
  const searchEl=list.querySelector('#food-search');
  searchEl.oninput=e=>renderHits(e.target.value);
  searchEl.onkeydown=e=>{ if(e.key==='Enter'){ const first=list.querySelector('#food-hits [data-hit]'); if(first) first.click(); } };
  renderHits('');
  renderEditor();
  $('#food-close').onclick=()=>navUIClose('food-sheet');
  $('#food-sheet').classList.add('show');
  $('#food-sheet').setAttribute('aria-hidden','false');
  navOpen('food-sheet');
}

/* ---------- 数据（v7.5：番茄ToDo 式统计格 + 月历视图 + 每日训练评分） ---------- */
let dataMonth=null, dataScoreDay=null;   // 数据页内临时视图状态（不持久化）
let _scoreDraft={};
const SCORE_ITEMS=[['feel','训练感受'],['energy','体力状态'],['sat','满意度']];
function scoreEditorHtml(sc){
  return SCORE_ITEMS.map(([f,label])=>
    `<div class="score-row"><span>${label}</span><span class="stars" data-sf="${f}">${
      [1,2,3,4,5].map(n=>`<i class="star${sc && sc[f]>=n ? ' on':''}" data-star="${n}">★</i>`).join('')
    }</span></div>`).join('');
}
function renderData(body){
  const now=new Date();
  if(!dataMonth) dataMonth={ y:now.getFullYear(), m:now.getMonth() };   // m: 0-based
  if(dataScoreDay===null){ const tk=todayKey(); dataScoreDay = STATE.checkins[tk] ? tk : null; }
  // 统计格（番茄ToDo 式）
  const totalCheck=Object.keys(STATE.checkins).length;
  let monthDone=0;
  Object.keys(STATE.checkins).forEach(k=>{ const [Y,M]=k.split('-').map(Number); if(Y===dataMonth.y && M-1===dataMonth.m) monthDone++; });
  const totalEx=Object.keys(STATE.checkins).reduce((s,k)=>s+Object.values(STATE.checkins[k].ex||{}).filter(Boolean).length,0);
  // 月历：每日完成状态（✓=已打卡，★=已评分）
  const first=new Date(dataMonth.y, dataMonth.m, 1);
  const days=new Date(dataMonth.y, dataMonth.m+1, 0).getDate();
  const lead=first.getDay();   // 0=周日，与「周日休」计划对齐
  let cells='';
  for(let i=0;i<lead;i++) cells+=`<span class="cal-day empty"></span>`;
  for(let d=1;d<=days;d++){
    const k=`${dataMonth.y}-${dataMonth.m+1}-${d}`;
    const done=!!STATE.checkins[k]; const scored=!!STATE.scores[k];
    const cls=['cal-day']; if(done)cls.push('done'); if(k===dataScoreDay)cls.push('sel'); if(k===todayKey())cls.push('today');
    cells+=`<button type="button" class="${cls.join(' ')}" data-cal="${k}"><span>${d}</span>${done?'<i>✓</i>':''}</button>`;
  }
  const scSel = dataScoreDay ? STATE.scores[dataScoreDay] : null;
  const scoreCard = dataScoreDay
    ? `<div class="card"><h4>训练评分 <span class="tag">${dataScoreDay}</span></h4>
       <div id="score-body">${scoreEditorHtml(scSel)}</div>
       <div class="row-btns" style="margin-top:10px">
         <button class="btn-grad" id="score-save" style="padding:9px">保存评分</button>
         ${scSel?`<button class="ex-do ghost-btn" id="score-del">清除</button>`:''}
       </div></div>`
    : `<p style="font-size:12px;color:var(--faint);text-align:center">完成打卡后，点月历中带 ✓ 的日期可给当天训练评分</p>`;
  body.innerHTML=`
    <div class="stat-grid">
      <div class="stat-tile"><b style="color:var(--pink)">🔥 ${streak()}</b><span>连续打卡天数</span></div>
      <div class="stat-tile"><b>${totalCheck}</b><span>累计打卡天数</span></div>
      <div class="stat-tile"><b>${monthDone}</b><span>本月已完成</span></div>
      <div class="stat-tile"><b>${totalEx}</b><span>累计完成动作</span></div>
    </div>
    <div class="card"><div class="cal-head">
        <button type="button" data-pm="1">‹</button>
        <b>${dataMonth.y} 年 ${dataMonth.m+1} 月</b>
        <button type="button" data-nm="1">›</button></div>
      <div class="cal-week"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>
      <div class="cal-grid">${cells}</div>
      <p style="font-size:10.5px;color:var(--faint);margin-top:8px">✓ 已打卡 · 点日期可补录/查看当天训练评分</p></div>
    ${scoreCard}`;
  // 近 7 日动作数 + 体重趋势 + 知识库（v7.4 已有，保留）
  const keys=Object.keys(STATE.checkins).sort().slice(-7);
  const maxv=Math.max(1,...keys.map(k=>Object.values(STATE.checkins[k].ex||{}).filter(Boolean).length));
  let bars='';
  keys.forEach(k=>{ const n=Object.values(STATE.checkins[k].ex||{}).filter(Boolean).length; const dt=new Date(k); const h=Math.round(n/maxv*100);
    bars+=`<div class="bar" style="height:${h}px"><span>${dt.getDate()}</span></div>`; });
  body.innerHTML+=`<div class="card"><h4>近 7 日动作数</h4><div class="chart">${bars}</div></div>
    <div class="card"><h4>体重趋势</h4><p style="font-size:13px;color:var(--ink2)">当前 ${STATE.profile?STATE.profile.weight+' kg':'未设置'}，可在“我的”页实时修改。</p></div>
    <div class="card"><h4>知识库</h4><p style="font-size:12.5px;color:var(--ink2);line-height:1.7">纳西妲内置 <b style="color:var(--pink)">${KB.length}</b> 条带证据等级的训练/营养问答（A=系统综述 · B=权威机构 · C=专家共识）。点“聊天”随时问。</p></div>`;
  // 绑定：月历翻页 / 选日 / 评分
  const pm=body.querySelector('[data-pm]'); if(pm) pm.onclick=()=>{ dataMonth.m--; if(dataMonth.m<0){ dataMonth.m=11; dataMonth.y--; } renderData(body); };
  const nm=body.querySelector('[data-nm]'); if(nm) nm.onclick=()=>{ dataMonth.m++; if(dataMonth.m>11){ dataMonth.m=0; dataMonth.y++; } renderData(body); };
  $$('#mod-body [data-cal]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.cal;
    if(!STATE.checkins[k]){ toast('这一天还没有打卡记录哦'); return; }
    dataScoreDay=k;
    const s=STATE.scores[k]||{};
    _scoreDraft={ feel:s.feel, energy:s.energy, sat:s.sat };
    renderData(body);
  });
  $$('#mod-body .stars').forEach(st=>st.querySelectorAll('.star').forEach(s=>s.onclick=()=>{
    const f=st.dataset.sf, n=+s.dataset.star;
    _scoreDraft[f]=n;
    st.querySelectorAll('.star').forEach(x=>x.classList.toggle('on', +x.dataset.star<=n));
  }));
  const sv=$('#score-save'); if(sv) sv.onclick=()=>{
    if(!( _scoreDraft.feel||_scoreDraft.energy||_scoreDraft.sat )){ toast('先点星星打个分吧 (｡･ω･｡)'); return; }
    STATE.scores[dataScoreDay]=Object.assign({ at:Date.now() }, _scoreDraft);
    save(); setMood('happy',1800); toast('已保存训练评分，纳西妲看到你的感受啦'); renderData(body);
  };
  const dl=$('#score-del'); if(dl) dl.onclick=()=>{ delete STATE.scores[dataScoreDay]; _scoreDraft={}; save(); renderData(body); toast('已清除该日评分'); };
}

/* ---------- 我的（v7.5：自定义昵称 + 头像上传 + 档案实时编辑，改完立即生效） ---------- */
function renderProfile(body){
  const p=STATE.profile; const g=dailyGoal();
  const avatar = p && p.avatar ? p.avatar : 'assets/nahida-icon.webp';
  body.innerHTML=`<div class="profile-head"><img id="pf-av" src="${avatar}" alt=""><b id="pf-name">${esc(p?(p.name||'训练者'):'训练者')}</b><span>${p?`${p.height}cm · ${p.weight}kg · 哑铃${p.dumbbell}kg`:'未设置档案'}</span>
    <button class="hc-go" id="pf-av-btn">📷 更换头像</button></div>
    <div class="card" style="padding:6px 14px">
      <h4 style="margin:8px 0 2px">档案（改完立即生效）</h4>
      <div class="pf-edit">
        <label>昵称<input id="pe-name" type="text" maxlength="12" value="${esc(p&&p.name||'训练者')}"></label>
        <label>身高 cm<input id="pe-h" type="number" inputmode="decimal" value="${p?p.height:''}"></label>
        <label>体重 kg<input id="pe-w" type="number" inputmode="decimal" value="${p?p.weight:''}"></label>
        <label>单哑铃 kg<input id="pe-d" type="number" inputmode="decimal" value="${p?p.dumbbell:''}"></label>
      </div>
      <p style="font-size:11px;color:var(--faint);padding:4px 0 10px">体重/哑铃改动会即时影响：训练建议起始重量、每日蛋白/热量/饮水目标、体重趋势。</p>
    </div>
    <div class="card" style="padding:6px 14px">
      <div class="list-row"><span class="lr-ic">🔥</span>连续打卡<b style="margin-left:auto">${streak()} 天</b></div>
      <div class="list-row"><span class="lr-ic">💧</span>今日饮水<b style="margin-left:auto">${STATE.waterMl||0} ml / ${g.water} ml</b></div>
      <div class="list-row"><span class="lr-ic">🎯</span>今日目标<b style="margin-left:auto">${g.protein}g 蛋白 · ${g.kcal} kcal</b></div>
      <div class="list-row"><span class="lr-ic">📚</span>知识库<b style="margin-left:auto">${KB.length} 条</b></div>
      <div class="list-row"><span class="lr-ic">🎨</span>角色出处<b style="margin-left:auto">纳西妲·原神</b></div>
    </div>
    <div class="card" style="padding:6px 14px">
      <h4 style="margin:8px 0 2px">数据管理</h4>
      <div class="list-row" id="exp-json"><span class="lr-ic">💾</span>导出备份 JSON<span class="lr-ar">›</span></div>
      <div class="list-row" id="exp-csv"><span class="lr-ic">📄</span>导出训练/饮食 CSV<span class="lr-ar">›</span></div>
      <div class="list-row" id="imp-json"><span class="lr-ic">📥</span>导入 JSON 备份<span class="lr-ar">›</span></div>
    </div>
    <div class="card" style="padding:6px 14px">
      <div class="list-row" id="reset-pet"><span class="lr-ic">↺</span>重置桌宠位置<span class="lr-ar">›</span></div>
      <div class="list-row" id="reset-all"><span class="lr-ic">🗑️</span>清空所有数据<span class="lr-ar">›</span></div>
    </div>
    <p style="font-size:11px;color:var(--faint);text-align:center;padding:6px">角色素材来源见 assets/CREDITS.md · 数据仅存本机</p>`;
  // 头像上传：本地压缩为 128px dataURL 存入档案
  $('#pf-av-btn').onclick=()=>{
    if(!STATE.profile){ toast('先在引导里设置身高体重哦'); return; }
    const inp=document.createElement('input');
    inp.type='file'; inp.accept='image/*';
    inp.onchange=()=>{ const f=inp.files && inp.files[0]; if(!f) return;
      compressImage(f, 128, du=>{ if(!du){ toast('图片读取失败'); return; }
        STATE.profile.avatar=du; save(); renderProfile(body); toast('头像已更新 ✨'); }); };
    inp.click();
  };
  // 档案实时编辑：oninput 即保存（不整页重渲染，避免打字丢焦点）
  const applyLive=()=>{
    if(!STATE.profile) return;
    const h=+$('#pe-h').value, w=+$('#pe-w').value, d=+$('#pe-d').value;
    const name=($('#pe-name').value||'').trim().slice(0,12) || STATE.profile.name;
    if(h>=140 && h<=220) STATE.profile.height=h;
    if(w>=30 && w<=200) STATE.profile.weight=w;
    if(d>0 && d<=100) STATE.profile.dumbbell=d;
    STATE.profile.name=name;
    save();
    $('#pf-name').textContent=name;
  };
  ['pe-name','pe-h','pe-w','pe-d'].forEach(id=>{ const n=$('#'+id); if(n) n.oninput=applyLive; });
  $('#reset-pet').onclick=()=>{ STATE.petDock={edge:'right', off:0.62}; delete STATE.petPos; delete STATE.selDate; save(); applyDock(); toast('桌宠位置已重置'); };
  $('#reset-all').onclick=()=>{ if(confirm('确定清空所有本地数据？')){ localStorage.removeItem(KEY); location.reload(); } };
  $('#exp-json') && ($('#exp-json').onclick=exportJSON);
  $('#exp-csv') && ($('#exp-csv').onclick=exportCSV);
  $('#imp-json') && ($('#imp-json').onclick=importJSON);
}

/* ---------- P2 数据导出 / 导入 ---------- */
function downloadFile(name, mime, text){
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(()=>{ a.remove(); URL.revokeObjectURL(url); }, 1500);
}
const _csvRow = arr => arr.map(c=>`"${String(c==null?'':c).replace(/"/g,'""')}"`).join(',');
function exportJSON(){
  const data = JSON.stringify({ app:'薄肌日记', version:7, exportedAt:new Date().toISOString(), state:STATE }, null, 2);
  downloadFile(`薄肌日记-备份-${todayKey()}.json`, 'application/json;charset=utf-8', data);
  toast('已导出 JSON 备份（可留存/换机恢复）');
}
function exportCSV(){
  const ckRows=[['日期','星期','计划','完成动作数','动作总数']];
  Object.keys(STATE.checkins).sort().forEach(k=>{
    const [Y,M,D]=k.split('-').map(Number); const dt=new Date(Y,M-1,D); const t=getDayType(dt.getDay());
    const total = t==='rest' ? 0 : PLANS[t].ex.length;
    const doneN = Object.values(STATE.checkins[k].ex||{}).filter(Boolean).length;
    ckRows.push([k, WEEKDAY[dt.getDay()], t==='rest'?'休息日':PLANS[t].name, doneN, total]);
  });
  const wRows=[['日期','计划','动作','重量(kg)']];
  Object.keys(STATE.weights||{}).sort().forEach(k=>{
    Object.keys(STATE.weights[k]).forEach(i=>{
      const [Y,M,D]=k.split('-').map(Number); const dt=new Date(Y,M-1,D); const t=getDayType(dt.getDay());
      const name = t==='rest' ? '休息日' : (PLANS[t].ex[i] ? PLANS[t].ex[i].name : `动作${+i+1}`);
      wRows.push([k, t==='rest'?'-':PLANS[t].name, name, STATE.weights[k][i]]);
    });
  });
  const mRows=[['日期','餐次','食物','份数','蛋白(g)','碳水(g)','脂肪(g)']];
  Object.keys(STATE.meals||{}).sort().forEach(k=>{
    Object.keys(STATE.meals[k]).forEach(mi=>{
      (STATE.meals[k][mi]||[]).forEach(f=>{ const q=mealQty(f);
        mRows.push([k, MEAL_NAMES[mi]||mi, f.n, q, +(f.p*q).toFixed(1), +(f.c*q).toFixed(1), +(f.f*q).toFixed(1)]); });
    });
  });
  const csv = ckRows.map(_csvRow).join('\r\n') + '\r\n\r\n' + wRows.map(_csvRow).join('\r\n') + '\r\n\r\n' + mRows.map(_csvRow).join('\r\n');
  downloadFile(`薄肌日记-记录-${todayKey()}.csv`, 'text/csv;charset=utf-8', '\ufeff' + csv);   // BOM：Excel 不乱码
  toast('已导出 CSV（打卡/重量/饮食三段）');
}
function importJSON(){
  const inp = document.createElement('input');
  inp.type='file'; inp.accept='application/json,.json';
  inp.onchange=()=>{
    const f = inp.files && inp.files[0]; if(!f) return;
    const rd = new FileReader();
    rd.onload=()=>{
      try{
        const d = JSON.parse(rd.result);
        const st = (d && d.state) ? d.state : d;
        if(!st || typeof st !== 'object') throw new Error('bad');
        STATE = Object.assign({
          profile:null, isFirstLaunch:true, checkins:{}, weights:{}, meals:{}, water:0, waterMl:null,
          scores:{},
          petPos:null, petDock:null, petMood:'happy', lastPetTouch:Date.now(),
          planEdits:{}, exLast:{}, editPlan:false,
        }, st);
        if(STATE.waterMl == null && STATE.water > 0) STATE.waterMl = Math.round(STATE.water * 250);
        if(!STATE.scores || typeof STATE.scores !== 'object') STATE.scores = {};
        save(); toast('导入成功，正在重载…'); setTimeout(()=>location.reload(), 700);
      }catch(_){ toast('这不是有效的备份 JSON 文件'); }
    };
    rd.readAsText(f);
  };
  inp.click();
}

/* ============================================================
   引导 / 完成 / 计时 / toast
   ============================================================ */
function toast(t){ const el=$('#toast'); el.textContent=t; el.classList.add('show'); clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'),2200); }
function showOnboard(){ if(STATE.isFirstLaunch){ $('#onboard').classList.add('show'); navOpen('onboard'); } }
$('#ob-save') && ($('#ob-save').onclick=()=>{
  const h=+$('#ob-h').value, w=+$('#ob-w').value, d=+$('#ob-d').value;
  if(h<140||h>220||w<30||w>200||!d){ toast('身高140-220、体重30-200、哑铃重量必填'); return; }
  STATE.profile={height:h,weight:w,dumbbell:d,name:'训练者'}; STATE.isFirstLaunch=false; save();
  navUIClose('onboard'); setMood('cheer',3000); toast('开始和纳西妲一起练吧！'); renderHome();
});
$('#done-ok') && ($('#done-ok').onclick=()=>navUIClose('done-modal'));

/* ============================================================
   启动
   ============================================================ */
function boot(){
  // 壁纸加模糊由 css 处理；时钟每秒
  renderHome(); initPet(); showOnboard();
  // v7.3 真实 PWA：注册 Service Worker（仅 https/localhost 生效，file:// 静默跳过）
  if('serviceWorker' in navigator){
    window.addEventListener('load', ()=>{ navigator.serviceWorker.register('sw.js').catch(()=>{}); });
  }
  setInterval(renderHome, 30000);
  // dock
  $$('#dock .dock-item[data-go]').forEach(b=>b.onclick=()=>goModule(b.dataset.go));
  $('#pet-talk').onclick=()=>openAssistant();
  // 面板关闭
  $$('[data-close]').forEach(b=>b.onclick=()=>closePanel(b.dataset.close));
  // 聊天
  $('#chat-send').onclick=()=>sendMsg();
  $('#chat-text').addEventListener('keydown',e=>{ if(e.key==='Enter') sendMsg(); });
  // 5 分钟后若未打卡，桌宠委屈提醒（仅今日且未打卡）
  setTimeout(()=>{ if(!STATE.checkins[todayKey()] && getDayType(wd())!=='rest') setMood('sad',6000); }, 300000);
}
document.addEventListener('DOMContentLoaded', boot);
