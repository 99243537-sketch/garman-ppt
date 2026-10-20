// GarmanPPT · doc2ppt
// 用法：
//   node doc2ppt.cjs parse <文档.docx|.md|.txt> <工作目录>     → 工作目录/paras.json、paras.txt
//   node doc2ppt.cjs check <工作目录>                           → 校验 工作目录/plan.json
//   node doc2ppt.cjs build <工作目录> [输出.pptx]                → 校验通过后生成 PPTX 和 生成报告.md
const fs = require("fs");
const path = require("path");
const { parse } = require("./parse.js");
const { check, build } = require("./core.js");
const { makeReport } = require("./report.js");
const { VERSION } = require("./version.js");
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
  log(`== GarmanPPT · doc2ppt ${VERSION} ==`);
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
    const rep = makeReport(doc, plan, path.basename(out), r.warns, VERSION);
    fs.writeFileSync(path.join(path.dirname(out), "生成报告.md"), rep);
    log(`已生成：${out}`);
    log(`生成报告：${path.join(path.dirname(out), "生成报告.md")}`);
  } else {
    log("用法：\n  node doc2ppt.cjs parse <文档> <工作目录>\n  node doc2ppt.cjs check <工作目录>\n  node doc2ppt.cjs build <工作目录> [输出.pptx]");
  }
})().catch((e) => die("出错：" + (e && e.stack || e)));
