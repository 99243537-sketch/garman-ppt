#!/usr/bin/env node
// GarmanPPT 讲述规则自检（references/content-rules.md）。只读 plan.json 和 paras.txt，不生成、不改动 PPT。
// 用法：node scripts/lint-plan.cjs <工作目录>
// ✗ 必须改；! 是提醒。另把各页标题和连接句（bridge）汇总成 <工作目录>/串讲词.md。
"use strict";
const fs = require("fs");
const path = require("path");

const dir = process.argv[2];
if (!dir) { console.log("用法：node scripts/lint-plan.cjs <工作目录>"); process.exit(2); }
const read = (f) => fs.readFileSync(path.join(dir, f), "utf8");
let plan;
try { plan = JSON.parse(read("plan.json")); } catch (e) { console.log(`✗ 读不了 plan.json：${e.message}`); process.exit(1); }

// 原文段落：优先读 parse 生成的 paras.json，没有就读 paras.txt；再应用用户已确认的错别字修改（与 doc2ppt 一致）
const P = {};
try {
  for (const p of JSON.parse(read("paras.json")).paras) P[p.id] = p.text;
} catch (e) {
  let parasTxt;
  try { parasTxt = read("paras.txt"); } catch (e2) { console.log("✗ 找不到 paras.json / paras.txt，请先运行 parse"); process.exit(1); }
  for (const line of parasTxt.split(/\r?\n/)) {
    const m = /^(P\d+) (?:\[[^\]]*\] )?(.*)$/.exec(line);
    if (m) P[m[1]] = m[2];
  }
}
for (const c of plan.corrections || []) if (c.accepted && P[c.para] && P[c.para].includes(c.from)) P[c.para] = P[c.para].split(c.from).join(c.to);

const errs = [], warns = [];
const slides = Array.isArray(plan.slides) ? plan.slides : [];
const at = (i, s) => `第 ${i + 1} 页「${s.type}」`;
const txt = (ref) => (Array.isArray(ref) && typeof ref[1] === "string" ? ref[1] : "");
const len = (s) => [...s].reduce((a, c) => a + (/[\u0000-ÿ]/.test(c) ? 0.5 : 1), 0);
// 与 doc2ppt 相同的开头序号
const ORD = /^\s*(?:第[一二三四五六七八九十百零〇两\d]+[章节部篇讲课单元]分?\s*[、，,.．:：]?|[（(][一二三四五六七八九十百零〇\d]+[)）]\s*[、.．]?|[一二三四五六七八九十百零〇]+\s*[、.．]|\d{1,3}\s*[、．]|\d{1,3}\s*[.)）](?!\d)|[①-⑳]|[A-Za-z]\s*[、.．](?![A-Za-z\d]))\s*/;
const bare = (t) => (t || "").replace(ORD, "").replace(/[\s。，、；：！？,.;:!?“”"'‘’（）()《》]/g, "");

// 标签式标题：只是一个话题名，看不出结论
const LABEL = /^(?:主要|基本|总体|工作|研究|项目|存在的?|下一步|今后|当前|有关|相关|具体|重点)?(?:背景|结果|讨论|概述|概况|简介|介绍|引言|前言|总结|小结|结论|方法|方式|目标|目的|现状|问题|对策|措施|做法|成效|成绩|成果|进展|打算|计划|展望|建议|意见|情况|内容|思路|要求|附录|其他|分析|原因|意义|方案|安排|任务|经验|体会|启示|数据|案例|特点|优势|不足|挑战|机遇|工作)(?:与|和|及)?(?:展望|建议|对策|措施|讨论|分析|计划)?$/;

// 1. 一件事 takeaway
const tk = txt(plan.takeaway);
if (!tk) errs.push("缺少顶层 takeaway：先回答「听众明天必须记住的一件事是什么」，从原文摘一句写进 takeaway");
else {
  if (!P[plan.takeaway[0]]) errs.push(`takeaway：没有段落 ${plan.takeaway[0]}`);
  else if (!P[plan.takeaway[0]].includes(tk)) errs.push(`takeaway：「${tk}」不是 ${plan.takeaway[0]} 中的原文（必须逐字摘取）`);
  const cover = slides.find((s) => s.type === "cover");
  if (!cover) errs.push("没有封面页 cover");
  else if (txt(cover.sub) !== tk) errs.push(`封面副标题 sub 要用 takeaway 同一句「${tk}」`);
  const endIdx = slides.map((s) => s.type).lastIndexOf("end");
  const before = endIdx > 0 ? slides[endIdx - 1] : slides[slides.length - 1];
  const has = before && before.type === "text" && (txt(before.title) === tk || (before.points || []).some((p) => txt(p) === tk));
  if (!has) errs.push(`结尾页「谢谢」之前要有一页 text 回顾页，标题或要点里出现 takeaway「${tk}」`);
}

// 逐页检查
const titles = [];
let concl = 0, cardsPages = 0;
slides.forEach((s, i) => {
  const w = at(i, s), title = txt(s.title), kicker = txt(s.kicker);
  if (s.type !== "end") titles.push({ i, type: s.type, title: s.type === "toc" ? "目录" : title, bridge: s.bridge });

  // 2. 结论性标题
  if (s.type === "cards" || s.type === "text") {
    if (LABEL.test(bare(title))) errs.push(`${w}：标题「${title}」是标签，不是结论。把它放到 kicker，标题换成这一页的结论句`);
    else if (len(bare(title)) < 6) warns.push(`${w}：标题「${title}」很短，确认一周后只看标题能看懂这页`);
  }
  if (s.type === "section" && LABEL.test(bare(title))) warns.push(`${w}：章节名「${title}」是标签。过渡页可以保留，有现成的结论句更好`);

  // 4. 减法：重复标签
  if (kicker && title && (bare(kicker) === bare(title) || bare(kicker).endsWith(bare(title)) && len(bare(title)) >= 4 && bare(kicker).length - bare(title).length <= 2))
    errs.push(`${w}：kicker「${kicker}」和标题重复，删掉 kicker 或换标题`);

  // 3. 一页一观点、短语化
  if (s.type === "text") {
    const n = (s.points || []).length;
    if (n >= 3) warns.push(`${w}：${n} 条要点，确认说的是同一件事，否则拆页`);
    (s.points || []).forEach((p, k) => {
      const t = txt(p);
      if (len(t) > 40) warns.push(`${w} 第 ${k + 1} 条：${Math.round(len(t))} 字，要点宜用短语（≤ 40 字），整句留在备注`);
      if (/[。；！？!?;].+/.test(t)) warns.push(`${w} 第 ${k + 1} 条：跨了不止一句，考虑只摘一句`);
    });
  }
  if (s.type === "cards") {
    cardsPages++;
    if (s.conclusion) concl++;
    const k = (s.cards || []).length;
    if (k >= 5) warns.push(`${w}：${k} 张卡片，确认都在支撑同一个标题，否则拆页`);
    (s.cards || []).forEach((c, j) => {
      const h = txt(c.head), b = txt(c.body), wc = `${w} 第 ${j + 1} 张卡片`;
      if (len(bare(h)) > 16) warns.push(`${wc}：标题 ${Math.round(len(bare(h)))} 字，宜用 ≤ 16 字的短语`);
      if (b && len(b) > 30) warns.push(`${wc}：正文 ${Math.round(len(b))} 字，宜用 ≤ 30 字的短语，整句留在备注`);
      if (b && /[。；！？!?;].+/.test(b)) warns.push(`${wc}：正文跨了不止一句，考虑只摘一句`);
      if (b && h && (bare(b).includes(bare(h)) || bare(h).includes(bare(b)))) errs.push(`${wc}：正文和标题重复，删掉 body`);
    });
  }

  // 6. 排版：全大写、Markdown 记号、网址
  const shown = [title, kicker, txt(s.sub), txt(s.conclusion), ...(s.points || []).map(txt), ...(s.items || []).map(txt),
    ...(s.cards || []).flatMap((c) => [txt(c.head), txt(c.body)])].filter(Boolean);
  for (const t of shown) {
    if (/\b[A-Z]{2,}(?:\s+[A-Z]{2,}){2,}\b|\b[A-Z]{7,}\b/.test(t)) warns.push(`${w}：「${t}」含全大写英文，换一句或只摘其中一截`);
    if (/\*\*|__|<\/?[ibu]>/.test(t)) warns.push(`${w}：「${t}」含格式记号，换一句`);
    if (/https?:\/\/|www\./i.test(t)) warns.push(`${w}：「${t}」含网址，网址放备注`);
  }

  // 8. 连接句
  if (s.type !== "end") {
    if (typeof s.bridge !== "string" || !s.bridge.trim()) errs.push(`${w}：缺少连接句 bridge（这一页怎么接到下一页，一句话）`);
    else if (len(s.bridge) > 40) warns.push(`${w}：连接句 ${Math.round(len(s.bridge))} 字，宜 ≤ 40 字`);
  }
});
if (cardsPages >= 3 && concl === cardsPages) warns.push(`每个卡片页都有结论句（共 ${concl} 页）。结论句用唯一的强调色，只留在真正需要总括的页面`);

// 输出
console.log("== GarmanPPT · 讲述规则自检 ==");
if (tk) console.log(`一件事：${tk}`);
console.log("\n标题串读（一周后只看这些，能不能看懂）：");
titles.forEach((t) => console.log(`  ${String(t.i + 1).padStart(2)}. ${t.title || "（无标题）"}`));
console.log("");
errs.forEach((e) => console.log("✗ " + e));
warns.forEach((e) => console.log("! " + e));

const md = ["# 串讲词", "", "> 连接句由智能体撰写，不是原文，不在页面和 PPT 备注里。演讲前对着它顺一遍逻辑。", ""];
if (tk) md.push(`**听众要记住的一件事：** ${tk}`, "");
md.push("| 页 | 标题 | 连接句（讲到下一页） |", "|---|---|---|");
titles.forEach((t) => md.push(`| ${t.i + 1} | ${(t.title || "").replace(/\|/g, "｜")} | ${(t.bridge || "（缺）").replace(/\|/g, "｜")} |`));
fs.writeFileSync(path.join(dir, "串讲词.md"), md.join("\n") + "\n");

console.log(errs.length ? `\n自检未通过：${errs.length} 处必须修改，${warns.length} 条提醒。` : `\n自检通过${warns.length ? `，${warns.length} 条提醒请看一眼` : ""}。已写出 串讲词.md`);
process.exit(errs.length ? 1 : 0);
