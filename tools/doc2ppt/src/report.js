// 生成报告（Node 与浏览器共用）
const { applyCorrections } = require("./core.js");
const { DEFAULT_THEME } = require("./themes.js");
function makeReport(doc, plan, fileName, warns, version) {
  const { applied } = applyCorrections(doc, plan);
  const pending = (plan.corrections || []).filter((c) => !c.accepted);
  return [
    `# 生成报告：${doc.source}`, "",
    `- 文件：${fileName}，共 ${plan.slides.length} 页。生成工具 doc2ppt ${version}。`,
    `- 原文 ${doc.paras.length} 段全部放进讲稿备注；页面上的每句话都能在原文中逐字找到。`,
    "- 卡片页带讲课动画：逐张出现、上一张变淡，最后一次点击全部恢复（有结论句时同时出现）。",
    `- 效果：${plan.style === "glass" ? "毛玻璃" : "普通"}；配色：Garman 自然色 · ${plan.theme || DEFAULT_THEME}；字体：微软雅黑。`, "",
    "## 排版修正（未改任何字）", "", ...(doc.fixes.length ? doc.fixes.map((f, k) => `${k + 1}. ${f}`) : ["无。"]), "",
    "## 错别字", "",
    ...applied.map((c, k) => `${k + 1}. 已改：${c.para}「${c.from}」→「${c.to}」`),
    ...pending.map((c, k) => `${k + 1}. 待确认（未改）：${c.para}「${c.from}」→「${c.to}」${c.reason ? "（" + c.reason + "）" : ""}`),
    ...(!applied.length && !pending.length ? ["未发现。"] : []), "",
    "## 其他提示", "", ...doc.notes, ...(warns || []), "页面上不是原文的文字只有模板用语「目录」「谢谢」。",
    "请在 PowerPoint 或 WPS 里放映检查一遍；预览软件可能替换字体。",
  ].join("\n") + "\n";
}
module.exports = { makeReport };
