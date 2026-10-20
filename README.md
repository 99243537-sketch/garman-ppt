# 天然矿物色 PPT Skill（mineral-ppt）

一个 AI 技能包：把定稿的讲稿（.docx / .md / .txt）一键变成可编辑的 .pptx 课件，页面放原文摘句，完整原文进讲稿备注。

**完整介绍：[zhaodun.work/ppt](https://www.zhaodun.work/ppt/)**　·　当前版本 0.2.1 试用版

## 它做什么

读文档、安排分页、生成 .pptx，成品能在 PowerPoint 里继续编辑，不是图片拼贴。

- **页面只放原文摘句**：完整原文放进每一页的讲稿备注，讲解时对着备注念就行。
- **卡片式逐个推进**：要点逐条出现，讲一条按一下，不提前剧透。
- **逐字校验**：摘句必须与原文完全一致，对不上会自动修正，不会编造内容。

## 效果

**普通效果**：浅色底配白色卡片，清爽正式，适合白天投影和打印讲义。

<img src="web/preview/normal-1.jpg" width="49%" alt="普通效果封面"> <img src="web/preview/normal-2.jpg" width="49%" alt="普通效果卡片页">

**毛玻璃效果**：深色模糊矿物背景配半透明玻璃卡片，适合大屏和暗光环境。

<img src="web/preview/glass-1.jpg" width="49%" alt="毛玻璃效果封面"> <img src="web/preview/glass-2.jpg" width="49%" alt="毛玻璃效果卡片页">

两种效果在生成前切换，同一份讲稿可以出两种版本。

**卡片逐个推进**：讲一条、按一下、下一条出现，前面的自动变淡但不消失。走完整页再点一次，所有卡片同时恢复高亮。

<img src="docs/images/cards-demo.gif" width="80%" alt="卡片逐个推进动画演示">

<sub>录屏来自《智能体的初步应用》第 16 页。</sub>

动画用的是 PowerPoint 原生动画（「进入 → 出现」和「强调 → 透明」），打开就能放映，也能随时增删卡片、调整节奏。

## 五种矿物色

配色按一套统一的矿物色规范来做，从七块收藏标本里挑出五块，每种颜色各管一件事，成品拿去讲课不用再调。字体统一用微软雅黑。

| 矿物 | 色值 | 用途 |
|---|---|---|
| 天河石 | `#70C6D6` | 主色，封面与识别线 |
| 青金石 | `#122947` | 深色骨架，标题与章节页 |
| 孔雀石 | `#245F4D` | 第二类别色 |
| 磷氯铅矿 | `#59652E` | 第三类别色 |
| 钒铅矿 | `#B04D2F` | 唯一焦点，每页一处 |

完整规范与矿物照片见[色彩规范生成器](https://www.zhaodun.work/color/)。

## 用法

1. 从 [Releases](https://github.com/99243537-sketch/mineral-ppt/releases/latest) 下载最新版 `mineral-ppt-x.y.z.zip`。
2. 装进你用的 AI 工具（WorkBuddy、ChatGPT 等支持技能的工具）。不支持导入的，解压后把 `mineral-ppt` 文件夹直接发给它。
3. 把定稿文档一起发过去，说：「做成 PPT」。想要毛玻璃效果就加一句「毛玻璃效果」。

技能在本地跑，不上传文档。

生成后请用 PowerPoint 或 WPS 放映检查一遍。手机预览可能替换字体、看不到动画。

## 适合什么场合

讲稿已经定好、只差一份能讲的课件，比如培训课件、读书分享、课题汇报。这个技能省掉的是排版和逐条整理，不是替你写内容。

## 开发者信息

| 路径 | 内容 |
|---|---|
| `skill/mineral-ppt/` | 正式技能（单文件脚本，无需 npm install） |
| `tools/doc2ppt/` | 正式技能源码（Node 与浏览器共用） |
| `web/` | 网页版前端（部署到 zhaodun.work/ppt/） |
| `server/` | 网页版后端：分页方案服务 ppt-planner |
| `skill-probe/` | 兼容性测试技能，见 [docs/测试技能.md](docs/测试技能.md) |
| `docs/` | 设计说明、交接记录、攻略 |

**发布流程**：`skill/` 或 `skill-probe/` 有改动推到 main 后，`.github/workflows/release.yml` 自动打包并上传到对应 Release。

## 署名

默认配色基于赵盾矿物色彩系统。转载或商用请注明出处：赵盾 AI 学习工作室 · zhaodun.work
