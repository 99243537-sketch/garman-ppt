# 交接记录（2026-10-19）

新会话从这里接着做。

## 已定
- 产品名 GarmanPPT（2026-10-20 前叫「天然矿物色 PPT 讲稿制作」/ mineral-ppt），仓库 99243537-sketch/garman-ppt（公开）。
- 第一阶段只做技能版：AI 只出「分页方案」，程序校验（摘句逐字、备注全覆盖）后排版生成；不接大模型 API。
- 第二阶段才做网页版（上传即生成，需接国产模型 API、应用登记）。
- 发布：GitHub 为准，打 v* 标签自动发 Release；网站由 Eddy 定时从 GitHub 拉取放到 zhaodun.work 下载页（仓库需公开或给 Eddy 只读令牌）。
- 设计方案全文在 Claude 文档《「文档转 PPT」网页应用与技能 · 设计方案 v0.2》。

## 测试结论（probe-0.1.0）
- WorkBuddy、Eddy（OpenClaw）：都不支持导入技能，解压后照 SKILL.md 执行，脚本均跑通（Node 22 / 24，Linux）。
- WorkBuddy 不保存技能 → 用法定为「技能包 + 文档 + 一句口令」，SKILL.md 必须自包含。
- iPhone 版 PowerPoint、WPS 预览：变淡动画、蒙层动画、毛玻璃正常。iPhone 版有一处残影：未出现的玻璃框隐约可见。
- probe-0.1.1（2026-10-19 晚）：毛玻璃残影已修复，PowerPoint、WPS 测试全部通过；ChatGPT 也能运行技能。
- 残影原因与经验：局部压暗不能画在整页背景上，否则玻璃框隐藏后暗块仍在。做法改为背景只模糊，每个玻璃框用自己的局部压暗图做图片填充（替代「幻灯片背景填充」）。
- 环境限制：npm 注册表被网络策略拦截；可用 /opt/npm-tools/node_modules 里的 esbuild、pptxgenjs、jszip（NODE_PATH）。

## 第一份真实文档试做（2026-10-19 晚）
- 文档：金融支持妇女就业发展实施意见（.docx，约 4300 字）→ 14 页，赵盾评价「中规中矩，符合预期」。
- 原型在 tools/prototype/：gen.js（按分页方案生成）、post.js（主题色、组合、动画）、plan.json（该文档的分页方案示例，引用段落编号 Q01… 与逐字摘句）。
- 流程：python-docx 抽段落 → 合并 PDF 断行、删多余空格（列入修改清单）→ 写分页方案 → 校验摘句与备注覆盖 → 生成。
- 待改进：4 列卡片标题三行时离分隔线偏近；卡片下半部分偏空。

## 正式技能 0.2.0（2026-10-19 夜）
- skill/mineral-ppt：SKILL.md + references/plan-format.md + examples + scripts/doc2ppt.cjs（parse / check / build）。
- 校验已覆盖：摘句逐字、页面类型、卡片数、字数能否放下、备注全覆盖不重复、修改清单；错别字经用户确认（accepted）后同步改到页面和备注。
- 回归：实施意见 docx（14 页）与大纲 md 示例均通过；尚未在 WorkBuddy 等智能体上实测。

## 0.2.1（2026-10-19 夜）
- WorkBuddy 实测 0.2.0：流程跑通，但 0.2.0 没有毛玻璃选项；被要求后它自行改脚本，出现规范外的粉紫色、浅底白字、未出现的卡片可见。判断为技能缺陷。
- 修复：plan.json 顶层 "style": "glass" 整份毛玻璃（深色模糊矿物背景 + 压暗底图按位置 srcRect 裁取作玻璃填充，无残影）；SKILL.md 新增铁律「不改脚本，不另起炉灶」，并要求先问用户选普通还是毛玻璃。
- 毛玻璃底图由 tools/doc2ppt/make_glass.py 生成（玻璃内白字 ≈7.4:1，页脚 ≈5.3:1）。

## 网页版（2026-10-20 凌晨）
- web/：静态页面，浏览器内读文档、校验、生成（doc2ppt.browser.js 由 tools/doc2ppt/src/browser.js 打包）。
- server/：ppt-planner，Python 标准库，127.0.0.1:8790，Nginx /ppt-api/；调 MiniMax（与文章生成服务同一 Key，模型 MiniMax-M2.7）；每访客每天 5 次，校验不通过自动修正最多 2 次不计次。
- 已用模拟 MiniMax + 无头浏览器端到端测试：自动修正、错别字确认、限流、普通/毛玻璃下载均通过。尚未接真实 MiniMax。
- 部署说明：docs/部署说明-给Eddy.md。

## 下一阶段方向（已与赵盾讨论，待写成方案 v0.3）
- 质量靠程序把关：经验落到「组件（做不错）/ 检查（能发现）/ 文字规范（需判断）」三层之一。
- 两道质量闸门：方案检查 + 成品 PPTX 检查，所有平台过同一道关。
- 样张库 + 基准文档集（约 10 份），跨平台评分，分数下降不发布。

## 下一步
1. core 通用化（基于规范包 v1.1 的 lib.js / post.js，颜色升到 v2.3，去个人设置，自动排版）。
2. 解析（docx/md/txt）+ 分页方案校验 + 大纲直通。
3. 通用版 SKILL.md + 单文件 doc2ppt 脚本，用真实文档在 WorkBuddy 实测。
4. 网站下载页说明（给 Eddy）。

## 暂缓（将来再议，可能另开分支）
- 卡片统一为「一个圆角矩形装全部文字」（赵盾的手工做法）。
- 同一形状内「按段落逐条出现」的动画（需先测 WPS）。
- 当前先按已实现的做法稳定下来。

## 待赵盾决定
毛玻璃是否进第一版、毛玻璃背景来源、字体选项、署名方式、仓库是否公开及许可。

## 2026-10-20 网页版：排队取结果（解决 Cloudflare 524）

- 起因：站点在 Cloudflare 后面，单请求 100 秒断开；一次修正请求实际跑了 171 秒，学员看到 524。
- 后端：`POST /api/jobs` → 任务号；`GET /api/jobs/<id>?v=` 轮询。内存任务表，结果保留 JOB_TTL=600 秒，不落盘。MAX_CONCURRENT=3 个工人线程；GLOBAL_DAILY_LIMIT=200；MAX_QUEUE=20；同一访客同时 1 份，在途计入当日次数。旧 `/api/plan` 保留（同步等待）。IP 取 CF-Connecting-IP。
- 前端：轮询（锁屏回来立即取，网络抖动 2 分钟内容忍）；进度存 localStorage（ppt_state_v1，24 小时）支持刷新续做、做完重新下载；beforeunload 提醒；微信/QQ/钉钉/微博/飞书内置浏览器提示；txt/md 自动识别 GBK、UTF-16；.doc/.pdf/.wps/.pages 提示转换；坏 docx 中文提示；摘句只差标点/空格/全半角时本地对齐原文（snap），减少修正请求；效果图 web/preview/*.jpg（公文示例 LibreOffice 渲染）；脚本加 ?v= 防缓存。
- 测试：e2e/mock3.py + run3.py，A–M 13 个场景全部通过（慢请求、刷新续做、做完重下、标点对齐、修正、错别字中途刷新、三人并发排队、同人双开、服务器中途重启、GBK、坏文件、微信、两次失败重试）。
- Eddy 的端口已改为 8796（8790 被 minimax-video 占用）。

## 2026-10-20 第 2 次：修正提速
- 实测：修正步骤 MiniMax 失败两次后，点「再试一次」直接报「两次修正后仍有问题」——失败的修正被计入了轮数。改为成功后才 round+1。
- 修正请求改为只回改动页 `{"fix":[{"page":N,"slide":{…}}]}`（也接受完整方案），前端 merge。
- 本地自动处理：snap（标点/全半角对齐）、fixNotes（备注漏段插到前一段之后、重复去掉）、shrink（太长的摘句在逗号句号处截成前缀，仍是原文）。
- 测试 run4.py 5 个场景 + run3.py 13 个场景回归全部通过。
- 同访客同文档同步骤重复提交：直接返回正在进行的任务（接上），否则 busy_self 提示文档名和已等待秒数。run5.py 通过。

## 2026-10-20 第 3 次：流式接收
- Eddy 排查：修正失败全是 upstream_error:timeout（服务器 .env 里 REQUEST_TIMEOUT=180，非流式等整段回复超时）；2 万字文档 4 次只成功 1 次。
- 改为 stream=true（SSE 解析，未收到 finish_reason 视为 stream_cut），超时变为数据间隔，总上限 3×TIMEOUT；STREAM=0 可退回。
- 修正改为单轮提问（MiniMax 文档：多轮须原样保留 <think>）。
- note 记录 http 状态码+MiniMax 原话、超时/断线秒数。
- 待观察：2 万字文档是否仍被 MAX_OUTPUT_TOKENS=24000（含思考）截断；若是，下一步做长文档分段分页。

## 2026-10-20 第 4 次：网页版限 5000 字（暂停长文档）
- 实测 2 万字文档在 MiniMax-M2.7 上十几分钟出不来（前端 12 分钟轮询上限触发）。赵老师决定先放一放，网页版只做 5000 字以内；长文档引导用技能。
- MAX_DOC_CHARS 默认 5000（服务器 .env 需同步改）；前端 MAXC=5000（可用 window.PPT_MAX_CHARS 覆盖）。
- 以后若要支持长文档：按章节切段（每段 3–5 千字），并发分页后合并 slides（封面/目录/结尾只由首末段生成），再统一校验。

## 2026-10-20 改名 GarmanPPT（0.2.2）
- 赵盾为便于记忆，全部改名为 GarmanPPT：技能 garman-ppt（skill/garman-ppt/，Release v0.2.2 附件 garman-ppt-0.2.2.zip）；兼容性测试技能 garman-ppt-probe（v0.1.2-probe，测试稿《GarmanPPT-兼容性测试稿.pptx》）；网页版标题、服务端提示词与说明；仓库改名为 99243537-sketch/garman-ppt（GitHub 自动跳转旧地址）。功能不变。
- 没有 esbuild，单文件脚本（doc2ppt.cjs、probe.cjs）里的名称和版本号是直接替换的；网页版 doc2ppt.browser.js 未重新打包，内部版本号仍为 0.2.1。下次重新打包时以 src 为准。
- 网站上只需改 Skill 介绍页的文字和下载链接（见下一节），Eddy 的拉取地址需同步改。

## 2026-10-20 网页版取消
- 赵盾决定取消网页版讲稿制作项目，只保留技能（GarmanPPT）。Eddy 已于 10-20 撤下：ppt-planner 服务已停用（inactive + disabled），原网页备份在 /ppt-offline-20261020/，Nginx 的 /ppt-api/ 段已注释。
- https://www.zhaodun.work/ppt/ 现在是 Eddy 做的 Skill 介绍页（中英双语，另有 /ppt/en/、/letter.html、main.html 入口）。技能发新版时只更新这些页面的文字和下载链接，不要部署 web/ 和 server/。
- 仓库里的 web/、server/ 和 docs/部署说明-给Eddy.md 只作存档，不再维护。
