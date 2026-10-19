// 分页方案校验 + 排版生成（普通效果，赵盾矿物色彩 v2.3，微软雅黑）
const pptxgen = require("pptxgenjs");
const { postProcess } = require("./post.js");

const T = { amz: "70C6D6", amzSoft: "DDF1F2", amzPale: "EFF8F9", amzDeep: "1B667A", lapis: "122947", van: "B04D2F", white: "FFFFFF", ink: "243335", muted: "53686A", line: "C8D5D4" };
const W = 13.333, M = 0.6, FONT = "Microsoft YaHei";
const TYPES = ["cover", "toc", "section", "cards", "text", "end"];

// ---------- 文字测量（按微软雅黑估算，留 12% 余量） ----------
const em = (s) => [...s].reduce((a, c) => a + (/[\u0000-ÿ]/.test(c) ? (/[A-Z]/.test(c) ? 0.62 : c === " " ? 0.3 : 0.55) : 1), 0);
const lines = (s, pt, wIn) => Math.max(1, Math.ceil((em(s) * pt / 72) * 1.12 / wIn));
// 在 [min, max] 字号里找能放下的最大字号；放不下返回 null
function fit(s, wIn, hIn, max, min, ls = 1.25) {
  for (let pt = max; pt >= min; pt -= 1) if (lines(s, pt, wIn) * pt * ls / 72 <= hIn) return pt;
  return null;
}

// ---------- 版面 ----------
function cardBoxes(k, withConclusion, arrows) {
  const gap = arrows ? (k >= 4 ? 0.5 : 0.6) : k >= 4 ? 0.25 : 0.35, cw = (W - 2 * M - gap * (k - 1)) / k, ch = withConclusion ? 3.75 : 4.35;
  return Array.from({ length: k }, (_, j) => ({ x: M + j * (cw + gap), y: 1.85, w: cw, h: ch, gap }));
}
const CARD = { headTop: 0.9, headH: 1.25, ruleY: 2.25, bodyTop: 2.4, pad: 0.3 };

// ---------- 校验 ----------
function check(doc, plan) {
  const P = applyCorrections(doc, plan).P;
  const errs = [], warns = [];
  const at = (i, k) => `第 ${i + 1} 页${k ? "「" + k + "」" : ""}`;
  const ex = (ref, where) => {
    if (!Array.isArray(ref) || ref.length !== 2) { errs.push(`${where}：摘句格式应为 ["段落编号", "原文摘句"]`); return ""; }
    if (!P[ref[0]]) { errs.push(`${where}：没有段落 ${ref[0]}`); return ""; }
    if (!P[ref[0]].includes(ref[1])) errs.push(`${where}：「${ref[1]}」不是 ${ref[0]} 中的原文（必须逐字摘取，不能改写）`);
    return ref[1];
  };
  const used = [];
  const take = (ids, where) => (ids || []).forEach((id) => { if (!P[id]) errs.push(`${where}：备注引用了不存在的段落 ${id}`); used.push(id); });
  if (!plan || !Array.isArray(plan.slides) || !plan.slides.length) return { ok: false, errs: ["方案里没有 slides"], warns };
  if (plan.footer) ex(plan.footer, "页脚 footer");
  plan.slides.forEach((s, i) => {
    if (!TYPES.includes(s.type)) { errs.push(`${at(i)}：页面类型 ${s.type} 不存在，只能用 ${TYPES.join("、")}`); return; }
    const w = at(i, s.type);
    if (s.type === "cover") { ex(s.title, w + " 标题"); if (s.kicker) ex(s.kicker, w + " 小标题"); if (s.sub) ex(s.sub, w + " 副标题"); take(s.notes, w); }
    if (s.type === "section") { ex(s.title, w + " 标题"); if (s.sub) ex(s.sub, w + " 副标题"); take(s.notes, w); }
    if (s.type === "toc") {
      if (!s.items || s.items.length < 2 || s.items.length > 6) errs.push(`${w}：目录要 2–6 项`);
      (s.items || []).forEach((it, k) => { const t = ex(it, `${w} 第 ${k + 1} 项`); if (t && !fit(t, W - 2 * M - 1.2, 0.7, 20, 14, 1.1)) errs.push(`${w} 第 ${k + 1} 项太长，请换短一些的摘句`); });
      take(s.notes, w);
    }
    if (s.type === "text") {
      const t = ex(s.title, w + " 标题"); if (s.kicker) ex(s.kicker, w + " 小标题");
      if (t && em(t) > 26) errs.push(`${w}：标题超过 26 字，请换短一些的摘句`);
      if (!s.points || s.points.length < 1 || s.points.length > 3) errs.push(`${w}：正文页要 1–3 条摘句`);
      (s.points || []).forEach((p, k) => { const t2 = ex(p, `${w} 第 ${k + 1} 条`); if (t2 && em(t2) > 80) errs.push(`${w} 第 ${k + 1} 条超过 80 字，请摘更短的句子`); });
      take(s.notes, w);
    }
    if (s.type === "cards") {
      const t = ex(s.title, w + " 标题"); if (s.kicker) ex(s.kicker, w + " 小标题");
      if (t && em(t) > 26) errs.push(`${w}：标题超过 26 字，请换短一些的摘句`);
      const k = (s.cards || []).length;
      if (k < 2 || k > 5) { errs.push(`${w}：卡片要 2–5 张（现在 ${k} 张），多了请拆成两页`); return; }
      const boxes = cardBoxes(k, !!s.conclusion, !!s.arrows);
      take(s.intro, w);
      s.cards.forEach((c, j) => {
        const cw = boxes[j].w - 2 * CARD.pad, wc = `${w} 第 ${j + 1} 张卡片`;
        const h = ex(c.head, wc + " 标题"), b = c.body ? ex(c.body, wc + " 正文") : "";
        if (h && !fit(h, cw, CARD.headH, k >= 4 ? 19 : 21, 16, 1.1)) errs.push(`${wc}：标题太长放不下，请换更短的摘句`);
        if (b && !fit(b, cw, boxes[j].h - CARD.bodyTop - 0.2, k >= 4 ? 15 : 16, 13, 1.3)) errs.push(`${wc}：正文太长放不下，请换更短的摘句`);
        if (!c.no || em(String(c.no)) > 3) errs.push(`${wc}：编号 no 要 1–3 个字（如 "1"、"一"、"十二"）`);
        take(c.notes, wc);
      });
      if (s.conclusion) { const c = ex(s.conclusion, w + " 结论句"); if (c && em(c) > 40) errs.push(`${w}：结论句超过 40 字`); }
      take(s.end, w);
    }
    if (s.type === "end") take(s.notes, w);
  });
  // 备注：每段原文都要出现，且只出现一次，按原文顺序
  const ids = Object.keys(P);
  const miss = ids.filter((i) => !used.includes(i));
  const dup = [...new Set(used.filter((u, k) => used.indexOf(u) !== k))];
  if (miss.length) errs.push(`以下原文段落没有放进任何一页的备注：${miss.join("、")}`);
  if (dup.length) errs.push(`以下段落在备注里出现了不止一次：${dup.join("、")}`);
  const order = used.filter((u, k) => used.indexOf(u) === k);
  if (!miss.length && !dup.length && order.join() !== ids.join()) warns.push("备注里的段落顺序和原文不一致，请确认是有意调整。");
  (plan.corrections || []).forEach((c, k) => {
    const src = doc.paras.find((p) => p.id === c.para);
    if (!src || !src.text.includes(c.from)) errs.push(`修改清单第 ${k + 1} 条：「${c.from}」不在 ${c.para} 中`);
  });
  return { ok: !errs.length, errs, warns };
}

// 用户确认（accepted: true）的错别字修改，应用到原文
function applyCorrections(doc, plan) {
  const P = Object.fromEntries(doc.paras.map((p) => [p.id, p.text]));
  const applied = [];
  for (const c of (plan && plan.corrections) || []) if (c.accepted && P[c.para] && P[c.para].includes(c.from)) { P[c.para] = P[c.para].split(c.from).join(c.to); applied.push(c); }
  return { P, applied };
}

// ---------- 生成 ----------
async function build(doc, plan) {
  const { P } = applyCorrections(doc, plan);
  const ex = (ref) => ref[1];
  const body = (ids) => (ids || []).map((i) => P[i]).join("\n");
  const footer = plan.footer ? ex(plan.footer) : "";
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; pres.title = footer || "演示文稿"; pres.author = ""; pres.company = "";
  pres.theme = { headFontFace: FONT, bodyFontFace: FONT };
  const ANIM = [];
  let n = 0;
  const nm = (g, p) => (g ? `@${g}|${++n}` : `${p}-${++n}`);
  const txt = (s, t, o = {}) => { const { g, ...r } = o; s.addText(t, Object.assign({ isTextBox: true, margin: 0, fontSize: 16, fontFace: FONT, color: T.ink, valign: "top", objectName: nm(g, "text") }, r)); };
  const box = (s, x, y, w, h, o = {}) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: o.fill || T.white }, line: { color: T.line, width: 0.75 }, objectName: nm(o.g, "card") });
  const chip = (s, x, y, label, o = {}) => {
    const w = em(String(label)) > 1 ? 0.24 + 0.26 * em(String(label)) : 0.46;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.46, rectRadius: 0.06, fill: { color: T.amz }, line: { color: T.amz, width: 0 }, objectName: nm(o.g, "chip") });
    txt(s, String(label), { g: o.g, x, y, w, h: 0.46, fontSize: 14, bold: true, color: T.lapis, align: "center", valign: "middle" });
  };
  const foot = (s, i, color) => {
    if (footer) txt(s, footer, { x: M, y: 6.98, w: 10, h: 0.3, fontSize: 10, color: color || T.muted, valign: "middle" });
    txt(s, String(i), { x: W - M - 0.6, y: 6.98, w: 0.6, h: 0.3, fontSize: 10, color: color || T.muted, align: "right", valign: "middle" });
  };
  const head = (s, kicker, title) => {
    if (kicker) txt(s, kicker, { x: M, y: 0.42, w: 11.5, h: 0.34, fontSize: 13, color: T.amzDeep, valign: "middle" });
    txt(s, title, { x: M, y: 0.78, w: W - 2 * M, h: 0.8, fontSize: fit(title, W - 2 * M, 0.8, 30, 24, 1.1) || 24, bold: true, color: T.lapis, valign: "middle" });
  };
  const slide = (bg, anim) => { const s = pres.addSlide(); s.background = { color: bg }; ANIM.push(anim || null); return s; };
  const brand = (s) => s.addShape(pres.shapes.RECTANGLE, { x: 9.6, y: 0, w: W - 9.6, h: 7.5, fill: { color: T.lapis }, line: { type: "none" }, objectName: "bar" });

  plan.slides.forEach((d, i) => {
    const no = i + 1; let s;
    if (d.type === "cover") {
      s = slide(T.amz); brand(s);
      s.addShape(pres.shapes.RECTANGLE, { x: 0.9, y: 2.42, w: 0.08, h: 1.6, fill: { color: T.van }, line: { type: "none" }, objectName: "deco" });
      if (d.kicker) txt(s, ex(d.kicker), { x: 1.2, y: 1.55, w: 8.2, h: 0.5, fontSize: 18, color: T.lapis, valign: "middle" });
      const t = ex(d.title);
      txt(s, t, { x: 1.2, y: 2.2, w: 8.2, h: 2.0, fontSize: fit(t, 8.2, 2.0, 44, 28, 1.1) || 28, bold: true, color: T.lapis, valign: "middle", lineSpacingMultiple: 1.1 });
      if (d.sub) txt(s, ex(d.sub), { x: 1.2, y: 4.4, w: 8.2, h: 0.6, fontSize: 22, color: T.lapis });
      s.addNotes(body(d.notes));
    } else if (d.type === "toc") {
      s = slide(T.amzPale); head(s, "", "目录");
      const step = Math.min(0.92, 4.9 / d.items.length);
      d.items.forEach((it, k) => {
        const y = 1.85 + k * step, h = step - 0.16, t = ex(it);
        box(s, M, y, W - 2 * M, h); chip(s, M + 0.25, y + (h - 0.46) / 2, String(k + 1));
        txt(s, t, { x: M + 1.0, y, w: W - 2 * M - 1.2, h, fontSize: fit(t, W - 2 * M - 1.2, h, 20, 14, 1.1) || 14, bold: true, color: T.lapis, valign: "middle" });
      });
      foot(s, no); s.addNotes(body(d.notes));
    } else if (d.type === "section") {
      s = slide(T.lapis);
      if (d.no) txt(s, String(d.no), { x: 1.2, y: 2.0, w: 6, h: 1.1, fontSize: 60, bold: true, color: T.amz, valign: "bottom" });
      const t = ex(d.title);
      txt(s, t, { x: 1.2, y: 3.2, w: 10.5, h: 1.1, fontSize: fit(t, 10.5, 1.1, 44, 28, 1.1) || 28, bold: true, color: T.white, valign: "middle" });
      if (d.sub) txt(s, ex(d.sub), { x: 1.2, y: 4.4, w: 10.5, h: 0.6, fontSize: 22, color: T.amzSoft });
      foot(s, no, T.amzSoft); s.addNotes(body(d.notes));
    } else if (d.type === "text") {
      s = slide(T.amzPale); head(s, d.kicker ? ex(d.kicker) : "", ex(d.title));
      const k = d.points.length, h = Math.min(1.5, 4.4 / k);
      d.points.forEach((p, j) => {
        const y = 1.95 + j * (h + 0.2), t = ex(p);
        box(s, M, y, W - 2 * M, h);
        s.addShape(pres.shapes.RECTANGLE, { x: M + 0.3, y: y + 0.3, w: 0.08, h: h - 0.6, fill: { color: T.amzDeep }, line: { type: "none" }, objectName: "mark" });
        txt(s, t, { x: M + 0.6, y, w: W - 2 * M - 0.9, h, fontSize: fit(t, W - 2 * M - 0.9, h - 0.2, 22, 16, 1.3) || 16, color: T.ink, valign: "middle", lineSpacingMultiple: 1.3 });
      });
      foot(s, no); s.addNotes(body(d.notes));
    } else if (d.type === "cards") {
      const k = d.cards.length, boxes = cardBoxes(k, !!d.conclusion, !!d.arrows);
      const steps = d.cards.map((_, j) => (d.arrows && j > 0 ? [`A${j}`, `C${j + 1}`] : [`C${j + 1}`]));
      s = slide(T.amzPale, { kind: "fade", steps, end: d.conclusion ? "K" : null });
      head(s, d.kicker ? ex(d.kicker) : "", ex(d.title));
      d.cards.forEach((c, j) => {
        const { x, y, w, h, gap } = boxes[j], g = `C${j + 1}|${ex(c.head)}`, cw = w - 2 * CARD.pad;
        box(s, x, y, w, h, { g });
        chip(s, x + CARD.pad, y + 0.3, c.no, { g });
        const ht = ex(c.head);
        txt(s, ht, { g, x: x + CARD.pad, y: y + CARD.headTop, w: cw, h: CARD.headH, fontSize: fit(ht, cw, CARD.headH, k >= 4 ? 19 : 21, 16, 1.1) || 16, bold: true, color: T.lapis, valign: "top", lineSpacingMultiple: 1.1 });
        if (c.body) { s.addShape(pres.shapes.LINE, { x: x + CARD.pad, y: y + CARD.ruleY, w: cw, h: 0, line: { color: T.line, width: 0.75 }, objectName: nm(g, "rule") }); const bt = ex(c.body); txt(s, bt, { g, x: x + CARD.pad, y: y + CARD.bodyTop, w: cw, h: h - CARD.bodyTop - 0.2, fontSize: fit(bt, cw, h - CARD.bodyTop - 0.2, k >= 4 ? 15 : 16, 13, 1.3) || 13, color: T.ink, lineSpacingMultiple: 1.3 }); }
        if (d.arrows && j < k - 1) s.addShape(pres.shapes.RIGHT_ARROW, { x: x + w + gap * 0.18, y: y + h / 2 - 0.16, w: gap * 0.64, h: 0.32, fill: { color: T.amzDeep }, line: { color: T.amzDeep, width: 0 }, objectName: nm(`A${j + 1}|箭头`, "arrow") });
      });
      if (d.conclusion) txt(s, ex(d.conclusion), { g: "K|结论", x: M, y: 5.85, w: W - 2 * M, h: 0.6, fontSize: 20, bold: true, color: T.van, valign: "middle" });
      foot(s, no);
      let t = d.intro && d.intro.length ? body(d.intro) + "\n" : "";
      d.cards.forEach((c, j) => { t += `【点击 ${j + 1}】${body(c.notes)}\n`; });
      t += `【点击 ${k + 1} · 全部恢复】${body(d.end)}`;
      s.addNotes(t.trim());
    } else if (d.type === "end") {
      s = slide(T.amz); brand(s);
      txt(s, "谢谢", { x: 1.2, y: 2.6, w: 8.2, h: 1.4, fontSize: 54, bold: true, color: T.lapis, valign: "middle" });
      s.addNotes(body(d.notes));
    }
  });
  const raw = await pres.write({ outputType: "nodebuffer" });
  return postProcess(raw, ANIM);
}

module.exports = { check, build, applyCorrections, TYPES };
