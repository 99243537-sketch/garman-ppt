# 交接记录（2026-10-19）

新会话从这里接着做。

## 已定
- 产品名「天然矿物色 PPT 讲稿制作」，仓库 99243537-sketch/mineral-ppt（私有）。
- 第一阶段只做技能版：AI 只出「分页方案」，程序校验（摘句逐字、备注全覆盖）后排版生成；不接大模型 API。
- 第二阶段才做网页版（上传即生成，需接国产模型 API、应用登记）。
- 发布：GitHub 为准，打 v* 标签自动发 Release；网站由 Eddy 定时从 GitHub 拉取放到 zhaodun.work 下载页（仓库需公开或给 Eddy 只读令牌）。
- 设计方案全文在 Claude 文档《「文档转 PPT」网页应用与技能 · 设计方案 v0.2》。

## 测试结论（probe-0.1.0）
- WorkBuddy、Eddy（OpenClaw）：都不支持导入技能，解压后照 SKILL.md 执行，脚本均跑通（Node 22 / 24，Linux）。
- WorkBuddy 不保存技能 → 用法定为「技能包 + 文档 + 一句口令」，SKILL.md 必须自包含。
- iPhone 版 PowerPoint、WPS 预览：变淡动画、蒙层动画、毛玻璃正常。iPhone 版有一处残影：未出现的玻璃框隐约可见。
- 电脑版 PowerPoint 未单独测。
- 环境限制：npm 注册表被网络策略拦截；可用 /opt/npm-tools/node_modules 里的 esbuild、pptxgenjs、jszip（NODE_PATH）。

## 下一步
1. core 通用化（基于规范包 v1.1 的 lib.js / post.js，颜色升到 v2.3，去个人设置，自动排版）。
2. 解析（docx/md/txt）+ 分页方案校验 + 大纲直通。
3. 通用版 SKILL.md + 单文件 doc2ppt 脚本，用真实文档在 WorkBuddy 实测。
4. 网站下载页说明（给 Eddy）。

## 待赵盾决定
毛玻璃是否进第一版、毛玻璃背景来源、字体选项、署名方式、仓库是否公开及许可。
