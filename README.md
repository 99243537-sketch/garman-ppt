# 天然矿物色 PPT 讲稿制作（mineral-ppt）

把已定稿的文档（.docx / .md / .txt）转换成可编辑的 PPTX：忠实原文、矿物色彩、卡片讲课动画、讲稿备注。

**状态：开发中。** 目前只有兼容性测试技能（`skill-probe/`），正式版尚未发布。

## 目录

| 路径 | 内容 |
|---|---|
| `skill-probe/mineral-ppt-probe/` | 兼容性测试技能（单文件脚本，无需 npm install） |
| `tools/probe/` | 测试技能源码与打包说明 |
| `docs/` | 设计说明、交接记录、攻略 |
| `.github/workflows/release.yml` | 打 `v*` 标签后自动打包并发布 Release |

## 用法（测试技能）

把 Release 里的压缩包发给智能体（WorkBuddy、OpenClaw 等），说：「请按 SKILL.md 运行兼容性测试」。

## 署名

默认配色基于赵盾矿物色彩系统。转载或商用请注明出处：赵盾 AI 学习工作室 · zhaodun.work
