# 训练日记 · NLP 与稳定性改造报告

> 触发：用户提供 GitHub PAT，要求依次完成「认证校验 → 清理无用文件 → 语言功能 → 稳定性与准确性」，并按四部分汇报。
> 范围：本轮仅在既有 `nahidaReply` / `KB` / `dataReply` 之上增强"问句理解"，**未改动任何既有业务逻辑接口**。

---

## 一、已删除文件清单及理由

### A. 本次实际删除（含 1.0.0 改造已删、本次推送同步清除远端）

| 文件 / 目录 | 删除位置 | 类型 | 删除理由 | 影响构建/运行？ |
|---|---|---|---|---|
| `assets/nahida-card.webp` | 远端已删 | 废弃素材 | 1.0.0 起背景改为纯 CSS 渐变，不再依赖该第三方立绘壁纸（405KB） | 否。index.html 已无引用，背景走 CSS |
| `assets/nahida-icon.webp` | 远端已删 | 废弃素材 | 桌面图标改为自绘 `icon.svg`（黑衣小狗），该 webp（33KB）为旧官方图标 | 否。index.html 两处已改 `icon.svg` |
| `tools/_dbgnlp.js` | 本地+远端 | 调试脚本 | 排查 NLP bug 时临时写的探针，非产品代码 | 否。纯本地调试用，已移除 |
| `_shot/`（41 文件：37 jpg + 4 png） | 本地已删 | 临时产物 | 桌宠逐版截图/抽帧，由 `tools/gen-pet-shot.js` 可随时再生；已被 `.gitignore` 覆盖 | 否。gitignored，不入库 |
| `薄肌日记-v7.6~v8.0-交接包.zip`、`训练日记-交接包.zip` | 本地已删 | 历史归档 | 临时版本感打包；`.zip` 被 `push.js` 的 `SKIP_EXT` 永久排除，且 gitignored | 否 |

### B. `.gitignore` 更新
新增 `*.log`、`*.tmp`、`~$*.tmp`；并加注释说明 `nahida-*.webp` 自 v1.0.0 起已移除。推送后无残留空目录问题（`_shot/` 删除后不再有空目录追踪）。

### C. 不确定删除、暂保留（待你确认）
- `assets/install-qr.png`（1.5KB）：PWA 安装指引二维码，`CREDITS.md` 标注为"用户自生成"，未被 index.html/app.js 运行时引用，但属有意的安装引导素材；建议保留（极小）。
- `assets/pet-final-preview.png`（83KB）：桌宠皮肤渲染预览图，`CREDITS.md` 标注为"生成产物，非源素材"，仅 docs 预览用，运行时由 SVG 实时生成。若想进一步瘦身安装包，可移入 `docs/` 或删除（不影响 App 运行）。

> 说明：以上两者均**未删除**，仅标注待确认。删除前已确认它们不在 `sw.js` 的运行时预缓存（ASSETS）清单中，删与不删都不影响 PWA 离线运行。

---

## 二、语言功能设计方案

### 设计目标
不引入后端、不引入 ML 模型、保持纯前端离线可用的前提下，让智能助手具备：口语归一化、同义词/口语映射、错别字容错、意图初步识别，并把"问句→知识库条目"的匹配从脆弱的 `indexOf` 改为有分值的打分匹配。

### 模块分层（对齐 Rasa 的 pipeline 思想，但全确定性）
在 `app.js` 内新增命名空间 `NLP`（纯函数集合，与既有 `KB` / `dataReply` 解耦）：

1. **Normalize（归一化层）** `nlpNormalize(s)`
   - 全角→半角、英文小写；
   - 剥离控制字符 `[\u0000-\u001f]`（防止 NUL 字节在 jsdom 下静默破坏整段脚本）；
   - 剥离语气词/标点（`NLP_FILLERS`：的/啊/呢/吧/嘛/哦/…及 ?！。， 等）；
   - 仅保留字母数字 `[\p{L}\p{N}]`，长度 cap `NLP_MAX_LEN = 200`；
   - null/非字符串安全返回 `''`。

2. **Expand（扩展层）** `nlpExpand(s)` + `NLP_SYNONYMS`
   - 口语→规范词映射：长肌肉→增肌、减肥→减脂、胸→卧推、蹲→深蹲、硬拉/手臂/腹肌/热身/拉伸/有氧/睡眠/体重/体脂/水/抽筋/头晕 …；
   - 输出归一化 token 集合（≤16），供后续打分。

3. **Intent（意图层）** `nlpIntent(q)` + `NLP_INTENTS`
   - 规则式正则意图分类器，覆盖 `today_plan` / `protein` / `kcal` / `streak` / `weight_trend` / `weight` / `this_week` / `food_advice` / `last_weight` / `water` / `greeting` / `chitchat`；
   - 返回 `{intent, score, entities:[]}`，无命中返回 `null`（保留 Rasa 式 confidence + 降级契约，便于将来替换）。

4. **Score（知识库打分层）** `nlpKbScore(q)`
   - 对每条 `KB` 条目，按其关键词集合与问句扩展 token 做分级打分：
     - 单字关键词命中 **+1**（权重最低，避免"撑"误伤"深蹲"）；
     - 多字关键词子串命中 **+2 + min(len,4)×0.5**；
     - 编辑距离 ≤1 的错别字容错 **+1.5**（超过单字、低于多字，专治 深撑→深蹲 类）；
     - 整句命中 **+6**（最高优先级）。
   - 返回 `{item, score}`；`catch` 内返回 `{item:null, score:0}`（异常不崩）。

### 集成方式（未改动任何既有业务逻辑接口）
- `nahidaReply` 中原本的内联 `KB` 关键词 `indexOf` 匹配，改为调用 `nlpKbScore(effQ)`；
- `dataReply(effQ)` 入参改为传入指代消解后的查询（既有 `ctxResolveTopic` 不变）；
- 既有的 `KB` 数组结构、`nahidaReply` / `dataReply` 函数签名、`CTX` 上下文窗口、追问 `FOLLOW_RE` 全部保持不变——本层只增强"问句理解"，不替换"对话策略"。

### 为何规则而非 ML
纯前端 PWA、零后端、需离线、需可复现、零延迟、零模型依赖。78 条 KB 的规模下，确定性打分已覆盖绝大部分口语变体；保留 `intent / score / ranking` 契约，未来若接云端 NLU（沿用现有 vision 代理模式）可平滑替换，不影响上层。

---

## 三、成熟项目对比结论

| 项目 | 借鉴点 | 适配到本项目 |
|---|---|---|
| **Rasa**（`RasaHQ/rasa`） | NLU pipeline = Tokenizer→Featurizer→IntentClassifier→EntitySynonymMapper→ResponseSelector；统一 `Component` 接口；`confidence`+`intent_ranking`；可插拔；逐组件单测 | 把"归一化→扩展→意图→打分→选择"拆成清晰分层；保留 confidence/ranking/降级契约（score+null 即降级）；synonym 映射直接采纳；组件级单测落到 `selfcheck` block #24 |
| **jpetrides/workout-tracker** | 纯 JS PWA，别名匹配（"curls"→"Bicep Curls"） | 轻量同义词表 `NLP_SYNONYMS`，扩展到中文健身口语（增肌/减脂/胸→卧推…） |
| **GuilleHoardings/WorkBuddy Trackr** | `MODULAR_ARCHITECTURE.md` + `tests/` 单测、关注点分离 | 把 `tools/selfcheck-*.js` 拆成 functional / attack 两份并保留"模块边界 + 单测"纪律；本轮 NLP 以独立纯函数 + 独立测试块存在 |

**结论**：对 78 条 KB、纯离线 PWA 而言，完整 ML NLU 是过度工程。Rasa 这套"分层 pipeline + 置信度排序 + 同义词 + 逐组件测试"的方法论，约 80% 的体验收益可在 0 运行时成本下获得。接口保持与 Rasa 兼容的契约，留好云端 NLU 的可插拔位。

---

## 四、风险与后续优化建议

### 已落地的稳定性保障
- **输入校验**：`nlpNormalize` 对 null/非字符串/超长/控制字符/HTML 注入全部不抛，返回受控结果（新增测试覆盖）；
- **异常边界**：`nlpKbScore` 等纯函数在 `try/catch` 内返回安全默认值；`extractJSON`、`save()` 等既有边界已加固（L12/L15 等）；
- **单元测试**：新增 **14 项** NLP 专项测试（归一化/同义/意图/匹配/边界/可复现），总自检由 193 → **207 项全 PASS**（功能 55 + 攻击 152）。

### 风险
1. **规则覆盖天花板**：未见过的说法会漏过意图/打分，落到诚实兜底（不编造）。缓解：从真实问句持续扩充 `NLP_SYNONYMS` / `NLP_INTENTS`。
2. **CJK 子串误伤**：无形态学，多字重叠可能误分（曾遇"深撑"单字"撑"误伤，已用分级权重修）。新增单字关键词需警惕。
3. **长度/Token 上限**：cap 200 / 16 token 防滥用，但会截断超长问句——属可接受的降级。
4. **不可见字符**：一个 NUL 字节曾静默破坏 jsdom 执行（本轮已修为正则 `\u0000-\u001f`）。建议加一道"提交前扫描 app.js 非打印字符"的本地门禁。

### 后续优化建议
- 将 NLP 纯函数抽到 `tools/nlp.test.js` 独立测试文件，进一步贴合 WorkBuddy Trackr 的测试分层；
- 在每次 `push.js` 前加 `node --check` + `selfcheck.js` 门禁（已具备，建议脚本化一键）；
- 可选：沿用 vision 代理模式，做一个极轻云端意图分类器，feature flag 后置于本地规则之后（离线默认仍走本地）；
- 确认 `install-qr.png` / `pet-final-preview.png` 是否保留以精简安装包；
- 修正测试文件头注释陈旧的"训练日记 v7.5"为当前版本；
- **PAT 安全**：本次令牌仅以一次性环境变量注入命令行，从未写入任何文件；建议任务完成后轮换该 PAT，或改用仅 `repo` 细粒度令牌。

---

## 附：本次推送记录
- 提交 1：`604c14d` — NLP 层 + 输入校验/异常边界/单元测试 + 清理（含同步删除远端 `nahida-card.webp` / `nahida-icon.webp`，共 39 文件）。
- 提交 2：`3ef8c6b` — 移除误入仓库的调试脚本 `tools/_dbgnlp.js`（同步删除远端，最终 38 文件）。
- 自检结果：功能 55 PASS / 0 FAIL，攻击 152 PASS / 0 FAIL，合计 207 全 PASS。
