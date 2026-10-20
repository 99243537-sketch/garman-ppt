# GarmanPPT（garman-ppt）

把已定稿的文档（.docx / .md / .txt）转换成可编辑的 PPTX：忠实原文、13 套 Garman 自然色、卡片讲课动画、讲稿备注。

**状态：0.3.0 试用版。** 正式技能在 `skill/garman-ppt/`；兼容性测试技能在 `skill-probe/`。

## 目录

| 路径 | 内容 |
|---|---|
| `skill/garman-ppt/` | 正式技能：文档转 PPT（单文件脚本，无需 npm install） |
| `tools/doc2ppt/` | 正式技能源码（Node 与浏览器共用） |
| `tools/palette/` | Garman 自然色推色脚本（生成 `tools/doc2ppt/src/themes.js`） |
| `web/` | 网页版前端（部署到 zhaodun.work/ppt/） |
| `server/` | 网页版后端：分页方案服务 ppt-planner（调用 MiniMax） |
| `skill-probe/garman-ppt-probe/` | 兼容性测试技能（单文件脚本，无需 npm install） |
| `tools/probe/` | 测试技能源码与打包说明 |
| `docs/` | 设计说明、交接记录、攻略 |
| `.github/workflows/release.yml` | 打 `v*` 标签后自动打包并发布 Release |

## 用法（测试技能）

把 Release 里的压缩包发给智能体（WorkBuddy、OpenClaw 等），说：「请按 SKILL.md 运行兼容性测试」。

## 署名

默认配色「天河石」基于赵盾矿物色彩系统 v2.3，其余 12 套按同一结构推出（见 docs/Garman色彩规范-v3.md）。转载或商用请注明出处：赵盾 AI 学习工作室 · zhaodun.work
