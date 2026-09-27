# 薄肌日记 · 纳西妲的居家哑铃健身桌宠

手机桌面常驻二次元桌宠（纳西妲）陪伴的**居家哑铃**增肌记录 App。纯前端 PWA，无构建、无后端、数据仅存本机。

- 在线体验：https://wage98.github.io/boji-diary/
- 版本：v7.6 ｜ 许可：个人使用（角色素材溯源见 `assets/CREDITS.md`）

## 目录职责

| 路径 | 内容 |
|---|---|
| `index.html` `app.js` `styles.css` `sw.js` `manifest.json` | App 源码（单页、无构建） |
| `assets/` | 图标与角色素材、`CREDITS.md` |
| `docs/` | 工作日志、经验总结、架构说明、竞品差距分析、审验记录、待办与未决问题、接手提示词 |
| `tools/` | 可复现自检脚本（jsdom） |
| `_archive/` | 本地归档（旧版源码/未使用素材/历史二维码），已 gitignore，不入库 |

## 功能速览

- **训练**：推/拉/腿/泵 4 日 23 个居家哑铃动作；组次与重量记录、渐进超负荷建议（+2.5kg）、组间休息计时、计划可编辑、B 站章节时间戳可自验。
- **饮食**：饮水按 **ml** 计量；**拍照留档 + 81 项本地食物库 + OpenFoodFacts 在线查询**，名称/份量/热量全字段可手动校正；增/改/删齐全。
- **数据**：番茄 ToDo 式统计格、月历打卡视图（✓/评分）、每日训练评分（感受/体力/满意度）、近 7 日柱状图。
- **我的**：档案（昵称/身高/体重/哑铃）**实时编辑并即时影响建议重量与热量目标**；头像可上传；JSON/CSV 导出与导入。
- **助手**：42 条带证据等级的知识库 + 多轮上下文追问 + 结合本机数据回答（今天练什么 / 蛋白够吗 / 连打几天）。
- **桌宠**：8 种情绪、打字机气泡、左右缘直立探头吸附、可拖拽；手机返回键关层不退出。

## 本地运行与验证

```bash
# 1) 语法门禁
node --check app.js && node --check sw.js

# 2) 安装自检依赖（一次性）
cd C:/Users/WaGe/.workbuddy/binaries/node/workspace && npm i jsdom --registry=https://registry.npmmirror.com

# 3) 跑自检（功能回归 41 项 + 攻击式自检 51 项）
node tools/selfcheck.js
```

本地打开：`file://` 直接双击 `index.html` 即可（此模式下 Service Worker 不注册，功能不受影响）；
如需完整 PWA 行为，用任意静态服务器托管后以 `http://localhost` 访问。

## 部署

GitHub Pages 自动发布（推送 `main` 后约 1–3 分钟生效）。推送方式二选一：
1. REST contents API（需 PAT，`contents:write`）；
2. `git push`（需 PAT 且具备仓库写权限）。

Service Worker 对**页面请求采用网络优先**，因此手机下次打开即为最新版本，无需手动刷新或重新发版。

## 已知边界

- **拍照 ≠ 自动识别**：纯前端离线无法运行图像识别模型。当前为「拍照留档 + 食物库估算 + 手动校正」，在线库走 OpenFoodFacts（免费、无密钥，失败自动回落本地库）。真·AI 识别需接云端 API，见 `docs/待办与未决问题.md`。
- 数据仅存本机，换机请用导出/导入 JSON。
