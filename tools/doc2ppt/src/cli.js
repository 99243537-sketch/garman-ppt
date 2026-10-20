// GarmanPPT · doc2ppt
// 用法：
//   node doc2ppt.cjs parse <文档.docx|.md|.txt> <工作目录>     → 工作目录/paras.json、paras.txt
//   node doc2ppt.cjs check <工作目录>                           → 校验 工作目录/plan.json
//   node doc2ppt.cjs build <工作目录> [输出.pptx] [--theme 配色]  → 校验通过后生成 PPTX 和 生成报告.md
//     --theme 银杏：只换配色重新生成，不改 plan.json；--theme 银杏,鸢尾,天河石：一次生成多个配色版本供对比
const fs = require("fs");
const path = require("path");
const { parse } = require("./parse.js");
const { check, build } = require("./core.js");
const { makeReport } = require("./report.js");
const { VERSION } = require("./version.js");
const { THEMES } = require("./themes.js");
const log = (...a) => console.log(...a);
const die = (m, code = 1) => { console.error(m); process.exit(code); };
const readJSON = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { die(`读不了 ${f}：${e.message}`); } };

function printCheck(r) {
  r.errs.forEach((e) => log("✗ " + e));
  r.warns.forEach((e) => log("! " + e));
  log(r.ok ? "校验通过。" : `校验未通过：${r.errs.length} 个问题。请按上面的提示修改 plan.json 后再运行 check。`);
}

(async () => {
  const argv = process.argv.slice(2), ti = argv.indexOf("--theme");
  const themeArg = ti >= 0 ? argv.splice(ti, 2)[1] || "" : null;
  const [cmd, a, b] = argv;
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
    const themes = themeArg === null ? [plan.theme] : themeArg.split(/[,，、\s]+/).filter(Boolean);
    if (themeArg !== null) {
      if (!themes.length) die("--theme 后面要写配色名称，如 --theme 银杏 或 --theme 银杏,鸢尾,天河石");
      const bad = themes.filter((t) => !THEMES[t]);
      if (bad.length) die(`配色「${bad.join("、")}」不存在，只能用：${Object.keys(THEMES).join("、")}`);
    }
    const plans = themes.map((t) => (t === undefined ? plan : Object.assign({}, plan, { theme: t })));
    let r;
    for (const p of plans) { r = check(doc, p); if (!r.ok) break; }
    printCheck(r);
    if (!r.ok) process.exit(3);
    if (cmd === "check") return;
    const out = b || path.join(a, (doc.source || "演示文稿").replace(/\.[^.]+$/, "") + ".pptx");
    const outs = plans.length > 1 ? plans.map((p) => out.replace(/(\.pptx)?$/i, `-${p.theme}.pptx`)) : [out];
    for (let k = 0; k < plans.length; k++) { fs.writeFileSync(outs[k], await build(doc, plans[k])); log(`已生成：${outs[k]}`); }
    const rp = plans.length > 1 ? Object.assign({}, plan, { theme: themes.join("、") }) : plans[0];
    const rep = makeReport(doc, rp, outs.map((o) => path.basename(o)).join("、"), r.warns, VERSION);
    fs.writeFileSync(path.join(path.dirname(out), "生成报告.md"), rep);
    log(`生成报告：${path.join(path.dirname(out), "生成报告.md")}`);
  } else {
    log("用法：\n  node doc2ppt.cjs parse <文档> <工作目录>\n  node doc2ppt.cjs check <工作目录>\n  node doc2ppt.cjs build <工作目录> [输出.pptx] [--theme 银杏,鸢尾,天河石]");
  }
})().catch((e) => die("出错：" + (e && e.stack || e)));
