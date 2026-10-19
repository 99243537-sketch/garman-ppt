// 天然矿物色 PPT 讲稿制作 · doc2ppt
// 用法：
//   node doc2ppt.cjs parse <文档.docx|.md|.txt> <工作目录>     → 工作目录/paras.json、paras.txt
//   node doc2ppt.cjs check <工作目录>                           → 校验 工作目录/plan.json
//   node doc2ppt.cjs build <工作目录> [输出.pptx]                → 校验通过后生成 PPTX 和 生成报告.md
const fs = require("fs");
const path = require("path");
const { parse } = require("./parse.js");
const { check, build, applyCorrections } = require("./core.js");
const VERSION = "0.2.1";
const log = (...a) => console.log(...a);
const die = (m, code = 1) => { console.error(m); process.exit(code); };
const readJSON = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { die(`读不了 ${f}：${e.message}`); } };

function printCheck(r) {
  r.errs.forEach((e) => log("✗ " + e));
  r.warns.forEach((e) => log("! " + e));
  log(r.ok ? "校验通过。" : `校验未通过：${r.errs.length} 个问题。请按上面的提示修改 plan.json 后再运行 check。`);
}

(async () => {
  const [cmd, a, b] = process.argv.slice(2);
  log(`== 天然矿物色 PPT 讲稿制作 · doc2ppt ${VERSION} ==`);
  if (+process.version.slice(1).split(".")[0] < 16) die("需要 Node.js 16 或以上，当前 " + process.version, 2);
  if (cmd === "parse") {
    if (!a || !b) die("用法：node doc2ppt.cjs parse <文档> <工作目录>");
    fs.mkdirSync(b, { recursive: true });
    const doc = await parse(a);
    fs.writeFileSync(path.join(b, "paras.json"), JSON.stringify(doc, null, 1));
    const txt = doc.paras.map((p) => `${p.id}${p.level ? ` [标题${p.level}]` : ""} ${p.text}`).join("\n");
    fs.writeFileSync(path.join(b, "paras.txt"), txt + "\n");
    log(`已读取《${doc.source}》：${doc.paras.length} 段，约 ${doc.paras.reduce((n, p) => n + p.text.length, 0)} 字。`);
    log(`段落编号见 ${path.join(b, "paras.txt")}`);
    if (doc.fixes.length) { log(`排版修正 ${doc.fixes.length} 条（未改任何字）：`); doc.fixes.forEach((f) => log("  - " + f)); }
    doc.notes.forEach((n) => log("提示：" + n));
  } else if (cmd === "check" || cmd === "build") {
    if (!a) die(`用法：node doc2ppt.cjs ${cmd} <工作目录>`);
    const doc = readJSON(path.join(a, "paras.json")), plan = readJSON(path.join(a, "plan.json"));
    const r = check(doc, plan);
    printCheck(r);
    if (!r.ok) process.exit(3);
    if (cmd === "check") return;
    const out = b || path.join(a, (doc.source || "演示文稿").replace(/\.[^.]+$/, "") + ".pptx");
    fs.writeFileSync(out, await build(doc, plan));
    const { applied } = applyCorrections(doc, plan);
    const pending = (plan.corrections || []).filter((c) => !c.accepted);
    const rep = [
      `# 生成报告：${doc.source}`, "",
      `- 文件：${path.basename(out)}，共 ${plan.slides.length} 页。生成工具 doc2ppt ${VERSION}。`,
      `- 原文 ${doc.paras.length} 段全部放进讲稿备注；页面上的每句话都能在原文中逐字找到。`,
      "- 卡片页带讲课动画：逐张出现、上一张变淡，最后一次点击全部恢复（有结论句时同时出现）。",
      "- 配色：赵盾矿物色彩系统 v2.3；字体：微软雅黑。", "",
      "## 排版修正（未改任何字）", "", ...(doc.fixes.length ? doc.fixes.map((f, k) => `${k + 1}. ${f}`) : ["无。"]), "",
      "## 错别字", "", ...(applied.length ? applied.map((c, k) => `${k + 1}. 已改：${c.para}「${c.from}」→「${c.to}」`) : []),
      ...(pending.length ? pending.map((c, k) => `${k + 1}. 待确认（未改）：${c.para}「${c.from}」→「${c.to}」${c.reason ? "（" + c.reason + "）" : ""}`) : []),
      ...(!applied.length && !pending.length ? ["未发现。"] : []), "",
      "## 其他提示", "", ...(doc.notes.length ? doc.notes : []), ...r.warns, "页面上不是原文的文字只有模板用语「目录」「谢谢」。",
      "请在 PowerPoint 或 WPS 里放映检查一遍；预览软件可能替换字体。",
    ];
    fs.writeFileSync(path.join(path.dirname(out), "生成报告.md"), rep.join("\n") + "\n");
    log(`已生成：${out}`);
    log(`生成报告：${path.join(path.dirname(out), "生成报告.md")}`);
  } else {
    log("用法：\n  node doc2ppt.cjs parse <文档> <工作目录>\n  node doc2ppt.cjs check <工作目录>\n  node doc2ppt.cjs build <工作目录> [输出.pptx]");
  }
})().catch((e) => die("出错：" + (e && e.stack || e)));
