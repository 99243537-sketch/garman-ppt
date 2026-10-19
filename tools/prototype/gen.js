// 按分页方案生成 PPTX（普通效果，矿物色彩 v2.3）
// 用法：node gen.js paras.json plan.json out.pptx
const fs = require("fs");
const pptxgen = require("pptxgenjs");
const { postProcess } = require("./post.js");

const [, , PARAS, PLAN, OUT] = process.argv;
const P = Object.fromEntries(JSON.parse(fs.readFileSync(PARAS, "utf8")).paras.map((p) => [p.id, p.text]));
const plan = JSON.parse(fs.readFileSync(PLAN, "utf8"));
const T = { amz: "70C6D6", amzSoft: "DDF1F2", amzPale: "EFF8F9", amzDeep: "1B667A", lapis: "122947", van: "B04D2F", white: "FFFFFF", ink: "243335", muted: "53686A", line: "C8D5D4" };
const W = 13.333, M = 0.6, FONT = "Microsoft YaHei";
const ex = (ref) => { if (!P[ref[0]] || !P[ref[0]].includes(ref[1])) throw new Error("摘句不在原文中：" + ref.join(" ")); return ref[1]; };
const body = (ids) => (ids || []).map((i) => P[i]).join("\n");

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; pres.title = plan.footer; pres.author = ""; pres.company = "";
pres.theme = { headFontFace: FONT, bodyFontFace: FONT };
const ANIM = [];
let n = 0;
const nm = (g, p) => (g ? `@${g}|${++n}` : `${p}-${++n}`);
const txt = (s, t, o = {}) => { const { g, ...r } = o; s.addText(t, Object.assign({ isTextBox: true, margin: 0, fontSize: 16, fontFace: FONT, color: T.ink, valign: "top", objectName: nm(g, "text") }, r)); };
const box = (s, x, y, w, h, o = {}) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: o.fill || T.white }, line: { color: o.line || T.line, width: 0.75 }, objectName: nm(o.g, "card") });
const chip = (s, x, y, label, o = {}) => {
  const w = label.length > 1 ? 0.3 + 0.24 * label.length : 0.46;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.46, rectRadius: 0.06, fill: { color: T.amz }, line: { color: T.amz, width: 0 }, objectName: nm(o.g, "chip") });
  txt(s, label, { g: o.g, x, y, w, h: 0.46, fontSize: 14, bold: true, color: T.lapis, align: "center", valign: "middle" });
};
const foot = (s, i, color) => {
  txt(s, plan.footer, { x: M, y: 6.98, w: 9, h: 0.3, fontSize: 10, color: color || T.muted, valign: "middle" });
  txt(s, String(i), { x: W - M - 0.6, y: 6.98, w: 0.6, h: 0.3, fontSize: 10, color: color || T.muted, align: "right", valign: "middle" });
};
const head = (s, kicker, title) => {
  txt(s, kicker, { x: M, y: 0.42, w: 11, h: 0.34, fontSize: 13, color: T.amzDeep, valign: "middle" });
  txt(s, title, { x: M, y: 0.78, w: W - 2 * M, h: 0.8, fontSize: 30, bold: true, color: T.lapis, valign: "middle" });
};
const slide = (bg, anim) => { const s = pres.addSlide(); s.background = { color: bg }; ANIM.push(anim || null); return s; };

plan.slides.forEach((d, i) => {
  const no = i + 1; let s;
  if (d.type === "cover") {
    s = slide(T.amz);
    s.addShape(pres.shapes.RECTANGLE, { x: 9.6, y: 0, w: W - 9.6, h: 7.5, fill: { color: T.lapis }, line: { type: "none" }, objectName: "bar" });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.9, y: 2.42, w: 0.08, h: 1.6, fill: { color: T.van }, line: { type: "none" }, objectName: "deco" });
    txt(s, ex(d.kicker), { x: 1.2, y: 1.55, w: 8.2, h: 0.5, fontSize: 18, color: T.lapis, valign: "middle" });
    txt(s, ex(d.title), { x: 1.2, y: 2.2, w: 8.2, h: 2.0, fontSize: 40, bold: true, color: T.lapis, valign: "middle", lineSpacingMultiple: 1.1 });
    txt(s, ex(d.sub), { x: 1.2, y: 4.4, w: 8.2, h: 0.6, fontSize: 22, color: T.lapis });
    s.addNotes(body(d.notes));
  } else if (d.type === "toc") {
    s = slide(T.amzPale);
    head(s, "", "目录");
    d.items.forEach((it, k) => {
      const y = 1.85 + k * 0.92;
      box(s, M, y, W - 2 * M, 0.76);
      chip(s, M + 0.25, y + 0.15, String(k + 1));
      txt(s, ex(it), { x: M + 1.0, y, w: W - 2 * M - 1.2, h: 0.76, fontSize: 20, bold: true, color: T.lapis, valign: "middle" });
    });
    foot(s, no); s.addNotes(body(d.notes));
  } else if (d.type === "section") {
    s = slide(T.lapis);
    txt(s, d.no, { x: 1.2, y: 2.0, w: 6, h: 1.1, fontSize: 60, bold: true, color: T.amz, valign: "bottom" });
    txt(s, ex(d.title), { x: 1.2, y: 3.2, w: 10.5, h: 1.1, fontSize: 44, bold: true, color: T.white, valign: "middle" });
    txt(s, ex(d.sub), { x: 1.2, y: 4.4, w: 10.5, h: 0.6, fontSize: 22, color: T.amzSoft });
    foot(s, no, T.amzSoft); s.addNotes(body(d.notes));
  } else if (d.type === "cards") {
    const k = d.cards.length;
    s = slide(T.amzPale, { kind: "fade", steps: d.cards.map((_, j) => [`C${j + 1}`]), end: d.conclusion ? "K" : null });
    head(s, ex(d.kicker), ex(d.title));
    const gap = 0.3, cw = (W - 2 * M - gap * (k - 1)) / k, ch = d.conclusion ? 3.7 : 4.3, y = 1.9;
    const hs = k >= 4 ? 19 : 21, bs = k >= 4 ? 15 : 16;
    d.cards.forEach((c, j) => {
      const x = M + j * (cw + gap), g = `C${j + 1}|${c.head[1]}`;
      box(s, x, y, cw, ch, { g });
      chip(s, x + 0.3, y + 0.3, c.no, { g });
      txt(s, ex(c.head), { g, x: x + 0.3, y: y + 0.95, w: cw - 0.6, h: 1.05, fontSize: hs, bold: true, color: T.lapis, lineSpacingMultiple: 1.1 });
      s.addShape(pres.shapes.LINE, { x: x + 0.3, y: y + 2.1, w: cw - 0.6, h: 0, line: { color: T.line, width: 0.75 }, objectName: nm(g, "rule") });
      txt(s, ex(c.body), { g, x: x + 0.3, y: y + 2.25, w: cw - 0.6, h: ch - 2.45, fontSize: bs, color: T.ink, lineSpacingMultiple: 1.3 });
    });
    if (d.conclusion) txt(s, ex(d.conclusion), { g: "K|结论", x: M, y: 5.85, w: W - 2 * M, h: 0.6, fontSize: 20, bold: true, color: T.van, valign: "middle" });
    foot(s, no);
    let t = d.intro ? body(d.intro) + "\n" : "";
    d.cards.forEach((c, j) => { t += `【点击 ${j + 1}】${body(c.notes)}\n`; });
    t += `【点击 ${k + 1} · 全部恢复】${d.end ? body(d.end) : ""}`;
    s.addNotes(t.trim());
  } else if (d.type === "end") {
    s = slide(T.amz);
    s.addShape(pres.shapes.RECTANGLE, { x: 9.6, y: 0, w: W - 9.6, h: 7.5, fill: { color: T.lapis }, line: { type: "none" }, objectName: "bar" });
    txt(s, d.text, { x: 1.2, y: 2.6, w: 8.2, h: 1.4, fontSize: 54, bold: true, color: T.lapis, valign: "middle" });
    s.addNotes(body(d.notes));
  }
});

(async () => {
  const raw = await pres.write({ outputType: "nodebuffer" });
  fs.writeFileSync(OUT, await postProcess(raw, ANIM));
  console.log("ok", OUT, plan.slides.length, "页");
})().catch((e) => { console.error(e); process.exit(1); });
