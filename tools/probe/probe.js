// 天然矿物色 PPT 讲稿制作 · 兼容性测试技能
// 用法：node probe.cjs [输出目录]
// 作用：1）检查运行环境；2）生成一份 5 页测试稿，用来在 PowerPoint / WPS 里检查动画、毛玻璃和字体。
const fs = require("fs");
const path = require("path");
const os = require("os");
const pptxgen = require("pptxgenjs");
const JSZip = require("jszip");
const BG = require("./bg.js"); // 毛玻璃背景（base64 JPEG）

const VERSION = "probe-0.1.0";
const T = {
  amz: "70C6D6", amzSoft: "DDF1F2", amzPale: "EFF8F9", amzDeep: "1B667A", lapis: "122947", lapisBlue: "315F91",
  mal: "245F4D", pyro: "59652E", van: "B04D2F", gallery: "FAFBF9", white: "FFFFFF", ink: "243335", muted: "53686A", line: "C8D5D4",
};
const THEME = { dk1: T.ink, lt1: T.white, dk2: T.lapis, lt2: T.amzPale, accent1: T.amz, accent2: T.amzDeep, accent3: T.mal, accent4: T.pyro, accent5: T.van, accent6: T.lapisBlue, hlink: T.lapisBlue, folHlink: T.amzDeep };
const W = 13.333, M = 0.6, FONT = "Microsoft YaHei", MARK = "0A0B0C";
const FOOT = "兼容性测试稿 · 天然矿物色 PPT 讲稿制作";
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function log(...a) { console.log(...a); }

// ---------- 环境检查 ----------
function envCheck(outDir) {
  const r = { node: process.version, platform: `${os.platform()} ${os.release()}`, arch: os.arch(), outDir, writable: false };
  try { fs.mkdirSync(outDir, { recursive: true }); const f = path.join(outDir, ".probe-write-test"); fs.writeFileSync(f, "ok"); fs.unlinkSync(f); r.writable = true; } catch (e) { r.writeError = e.message; }
  const major = +process.version.slice(1).split(".")[0];
  r.nodeOk = major >= 16;
  return r;
}

// ---------- 组件 ----------
function build(env) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.title = "兼容性测试稿"; pres.author = "天然矿物色 PPT 讲稿制作"; pres.company = "";
  pres.theme = { headFontFace: FONT, bodyFontFace: FONT };
  const ANIM = []; // 每页一个点击序列（或 null）
  let n = 0;
  const nm = (g, p) => (g ? `@${g}|${++n}` : `${p}-${++n}`);
  const txt = (s, t, o = {}) => { const { g, ...r } = o; s.addText(t, Object.assign({ isTextBox: true, margin: 0, fontSize: 16, fontFace: FONT, color: T.ink, valign: "top", objectName: nm(g, "text") }, r)); };
  const card = (s, x, y, w, h, o = {}) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: o.fill || T.white, transparency: o.transparency || 0 }, line: { color: o.line || T.line, width: o.lineW ?? 0.75 }, objectName: nm(o.g, "card") });
  const chip = (s, x, y, label, o = {}) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 0.46, h: 0.46, rectRadius: 0.06, fill: { color: T.amz }, line: { color: T.amz, width: 0 }, objectName: nm(o.g, "chip") });
    txt(s, label, { g: o.g, x, y, w: 0.46, h: 0.46, fontSize: 14, bold: true, color: T.lapis, align: "center", valign: "middle" });
  };
  const arrow = (s, x, y, w, o = {}) => s.addShape(pres.shapes.RIGHT_ARROW, { x, y, w, h: 0.3, fill: { color: T.amzDeep }, line: { color: T.amzDeep, width: 0 }, objectName: nm(o.g, "arrow") });
  const head = (s, kicker, title, dark) => {
    txt(s, kicker, { x: M, y: 0.42, w: 11, h: 0.34, fontSize: 13, color: dark ? T.amz : T.amzDeep, valign: "middle" });
    txt(s, title, { x: M, y: 0.78, w: W - 2 * M, h: 0.8, fontSize: 30, bold: true, color: dark ? T.white : T.lapis, valign: "middle" });
  };
  const foot = (s, i, color) => {
    txt(s, FOOT, { x: M, y: 6.98, w: 8, h: 0.3, fontSize: 10, color: color || T.muted, valign: "middle" });
    txt(s, String(i), { x: W - M - 0.6, y: 6.98, w: 0.6, h: 0.3, fontSize: 10, color: color || T.muted, align: "right", valign: "middle" });
  };
  const slide = (bg, anim) => { const s = pres.addSlide(); s.background = typeof bg === "string" ? { color: bg } : bg; ANIM.push(anim || null); return s; };

  // 三张流程卡片（测试 A、B、C 共用位置）
  const COL = [[0.6, 1.9, 3.55, 3.55], [4.875, 1.9, 3.55, 3.55], [9.15, 1.9, 3.55, 3.55]];
  function flowCards(s, cards, concl, arrows) {
    cards.forEach(([no, t, b], i) => {
      const [x, y, w, h] = COL[i], g = `C${i + 1}|${t}`;
      card(s, x, y, w, h, { g });
      chip(s, x + 0.3, y + 0.3, no, { g });
      txt(s, t, { g, x: x + 0.3, y: y + 0.95, w: w - 0.6, h: 0.5, fontSize: 22, bold: true, color: T.lapis });
      txt(s, b, { g, x: x + 0.3, y: y + 1.6, w: w - 0.6, h: 1.75, fontSize: 16, color: T.ink, lineSpacingMultiple: 1.3 });
      if (arrows && i < 2) arrow(s, x + w + 0.12, y + h / 2 - 0.15, COL[i + 1][0] - x - w - 0.24, { g: `A${i + 1}|箭头 → ${cards[i + 1][1]}` });
    });
    txt(s, concl, { g: "K|结论", x: M, y: 5.8, w: W - 2 * M, h: 0.6, fontSize: 20, bold: true, color: T.van, valign: "middle" });
  }
  const CHECK_FADE = "\n\n—— 测试 A 检查要点 ——\n进入本页：三张卡片都不显示。点击 1：第一张出现。点击 2：箭头和第二张出现，第一张变淡。点击 3：箭头和第三张出现，第二张和前一个箭头变淡。点击 4：全部恢复正常，橙红结论句同时出现。";
  const CHECK_MASK = "\n\n—— 测试 B 检查要点 ——\n看起来应和第 2 页一样：逐张出现、上一张变淡、第 4 次点击全部恢复并出现结论。这一页用「盖一层半透明底色」实现，只用了最基本的出现 / 消失动画。第 2 页在 WPS 里不正常而这一页正常的话，以后就改用这个做法。";

  // ===== 第 1 页：封面 + 测试说明 =====
  let s = slide(T.amz, null);
  s.addShape(pres.shapes.RECTANGLE, { x: 9.6, y: 0, w: W - 9.6, h: 7.5, fill: { color: T.lapis }, line: { type: "none" }, objectName: "bar" });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.9, y: 2.42, w: 0.08, h: 1.0, fill: { color: T.van }, line: { type: "none" }, objectName: "deco" });
  txt(s, "兼容性测试稿 · " + VERSION, { x: 1.2, y: 1.55, w: 8.2, h: 0.5, fontSize: 18, color: T.lapis, valign: "middle" });
  txt(s, "iPhone 用户\nClaude 接入 GitHub 攻略", { x: 1.2, y: 2.1, w: 8.2, h: 1.7, fontSize: 44, bold: true, color: T.lapis, valign: "middle", lineSpacingMultiple: 1.05 });
  txt(s, "建仓库 · 认账号 · 连 GitHub · 授权仓库", { x: 1.2, y: 3.95, w: 8.2, h: 0.6, fontSize: 22, color: T.lapis, valign: "top" });
  txt(s, `测试内容：第 2 页变淡动画 · 第 3 页蒙层动画 · 第 4 页毛玻璃 · 第 5 页字体\n生成环境：Node ${env.node} · ${env.platform}`, { x: 1.2, y: 5.6, w: 8.2, h: 0.8, fontSize: 13, color: T.lapis, valign: "top", lineSpacingMultiple: 1.2 });
  s.addNotes("这份攻略讲 iPhone 用户怎样把 Claude 接入 GitHub，让 Claude 能直接往自己的仓库里提交代码、发布版本。整个过程手机上就能做完，大约十分钟。\n\n—— 测试说明 ——\n这是兼容性测试稿。请分别在 PowerPoint 和 WPS 里从头放映（F5），每页按备注里的「检查要点」核对，结果记在测试清单里。");

  // ===== 第 2 页：测试 A 变淡动画 · 四步主流程 =====
  s = slide(T.amzPale, { kind: "fade", steps: [["C1"], ["A1", "C2"], ["A2", "C3"]], end: "K" });
  head(s, "攻略 · 主流程（测试 A：变淡动画）", "三步把 Claude 接上 GitHub");
  flowCards(s, [
    ["1", "建一个空仓库", "GitHub 头像菜单 → Create new repository。填仓库名，选 Private，README 等都不勾。"],
    ["2", "连接 GitHub", "用浏览器打开 claude.ai 的「连接器」页，在「我的」里点 GitHub 集成 → 连接，再点 Authorize。"],
    ["3", "授权这个仓库", "打开 Claude 的 GitHub App 页，选 Only select repositories，勾上仓库，点 Install & Authorize。"],
  ], "最后告诉 Claude「用户名/仓库名」，它就能接入并提交代码。", true);
  foot(s, 2);
  s.addNotes("整个接入只有三步。\n【点击 1】第一步，先在 GitHub 上建一个空仓库：点头像菜单里的 Create new repository，填仓库名，可见性先选 Private，README、.gitignore、license 都不要勾，保持空仓库，再点 Create repository。\n【点击 2】第二步，在 Claude 里连接 GitHub。手机 App 的设置里没有这个入口，要用浏览器打开 claude.ai/customize/connectors，切到「我的」，找到 GitHub 集成，点连接，跳到 GitHub 后点 Authorize。状态打勾就是连上了。\n【点击 3】第三步，给 Claude 这个仓库的权限：打开 github.com/apps/claude，选 Only select repositories，只勾要用的仓库，点 Install & Authorize。GitHub 会再确认一次身份，用 GitHub Mobile 选数字，或者收邮件验证码。\n【点击 4 · 全部恢复】三步做完，回到和 Claude 的对话，告诉它「用户名/仓库名」，比如 99243537-sketch/mineral-ppt，它就能接入。" + CHECK_FADE);

  // ===== 第 3 页：测试 B 蒙层动画 · 先认准账号 =====
  s = slide(T.amzPale, { kind: "mask", steps: [["C1"], ["A1", "C2"], ["A2", "C3"]], end: "K" });
  head(s, "攻略 · 开始前（测试 B：蒙层动画）", "先认准 Claude 用的是哪个账号");
  flowCards(s, [
    ["1", "看 Claude 的邮箱", "Claude App → 设置 → 账户。用 Apple 登录的，显示的是 privaterelay 开头的隐藏地址。"],
    ["2", "查 Apple 账号", "iPhone 设置 → 最上面的名字 → 通过 Apple 登录 → Claude，地址对得上就是它。"],
    ["3", "浏览器同账号登录", "Safari 打开 claude.ai，点「使用 Apple 继续」；弹出的 Google 登录要关掉。"],
  ], "账号对不上，后面连好的 GitHub 就接不到这个对话里。", true);
  const pad = 0.04;
  s.addShape(pres.shapes.RECTANGLE, { x: COL[0][0] - pad, y: COL[0][1] - pad, w: COL[0][2] + 2 * pad, h: COL[0][3] + 2 * pad, fill: { color: T.amzPale, transparency: 50 }, line: { type: "none" }, objectName: "@M1|蒙层 · 第一张" });
  const a1x = COL[0][0] + COL[0][2] + 0.12;
  s.addShape(pres.shapes.RECTANGLE, { x: a1x - pad, y: COL[1][1] - pad, w: COL[1][0] + COL[1][2] - a1x + 2 * pad, h: COL[1][3] + 2 * pad, fill: { color: T.amzPale, transparency: 50 }, line: { type: "none" }, objectName: "@M2|蒙层 · 第二张" });
  foot(s, 3);
  s.addNotes("开始之前，先确认 Claude 用的是哪个账号。手里有好几个 Apple 账号的，这一步尤其要做。\n【点击 1】在 Claude App 里打开设置、账户，看登录的邮箱。用 Apple 登录的，显示的是 privaterelay.appleid.com 结尾的隐藏地址。\n【点击 2】到 iPhone 的设置里，点最上面自己的名字，进「通过 Apple 登录」，找到 Claude，看它的隐藏邮件地址。和上一步对得上，就是这个 Apple 账号。「媒体与购买项目」用另一个账号也没关系，不影响。这一页千万不要点「删除」。\n【点击 3】在 Safari 里打开 claude.ai，点「使用 Apple 继续」，用刚才确认的 Apple 账号登录。底部弹出的「使用 Google 账号登录」要点叉关掉。登录后能看到自己以前的对话，就说明账号对了。\n【点击 4 · 全部恢复】账号一定要对上：在别的账号里连 GitHub，这个对话是用不上的。" + CHECK_MASK);

  // ===== 第 4 页：测试 C 毛玻璃 · 常见问题 =====
  s = slide({ data: "image/jpeg;base64," + BG }, { kind: "fade", steps: [["C1"], ["C2"], ["C3"]], end: "K" });
  const glass = (runs, r, o = {}) => s.addText(runs, {
    shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.25, x: r[0], y: r[1], w: r[2], h: r[3],
    fill: { color: MARK }, line: { type: "none" }, margin: o.margin ?? [24, 20, 16, 20], // [左, 右, 下, 上]
    valign: o.valign || "middle", align: o.align || "left", fontFace: FONT, color: T.white,
    lineSpacingMultiple: o.ls || 1.3, objectName: o.g ? `@${o.g}|glass` : "glass",
  });
  const R = (t, o = {}) => ({ text: t, options: o });
  glass([R("攻略 · 常见问题（测试 C：毛玻璃）", { fontSize: 14, bold: true, color: T.amz, breakLine: true }), R("卡住了，先看这三条", { fontSize: 26, bold: true })], [0.6, 0.4, 9.4, 1.15], { ls: 1.1 });
  const G3 = [["App 里找不到入口", "手机 App 设置里没有连接 GitHub 的地方，改用浏览器打开 claude.ai 操作。"], ["提示找不到仓库", "要么仓库没建成，要么还没在 Claude 的 GitHub App 里勾选这个仓库。"], ["要求再验证身份", "正常的安全确认：用 GitHub Mobile 选对数字，或点邮件发验证码。"]];
  G3.forEach(([t, b], i) => glass([R(t, { fontSize: 22, bold: true, breakLine: true, paraSpaceAfter: 8 }), R(b, { fontSize: 16 })], [COL[i][0], 1.85, COL[i][2], 3.6], { g: `C${i + 1}|${t}`, valign: "top", margin: [22, 18, 16, 24], ls: 1.35 }));
  glass([R("密码和令牌（token）不要发在对话里，授权都在 GitHub 页面上完成。", { fontSize: 19, bold: true })], [0.6, 5.75, 12.1, 0.75], { g: "K|结论", align: "center", margin: [12, 12, 4, 4] });
  foot(s, 4, T.white);
  s.addNotes("最后是三个常见问题。\n【点击 1】在手机 App 的设置、连接器里找不到 GitHub：这是正常的，App 里没有这个入口。改用浏览器打开 claude.ai，到 customize/connectors 页面操作。\n【点击 2】告诉 Claude 仓库名后，它说找不到仓库：要么仓库其实没建成，可以打开 github.com/用户名/仓库名 看看；要么还没在 github.com/apps/claude 里勾选这个仓库。\n【点击 3】GitHub 要求再验证一次身份：这是正常的安全确认，叫 sudo mode。手机装了 GitHub App 的，点 Use GitHub Mobile，在 App 里选和网页上一样的数字；没装的，点 Send a code via email，收邮件验证码。\n【点击 4 · 全部恢复】还有一条要记住：GitHub 密码和访问令牌不要发在对话里，授权都在 GitHub 自己的页面上完成。\n\n—— 测试 C 检查要点 ——\n①玻璃框里透出的是背景色块，不是一块黑色或灰色；②框边有白色内发光；③框外沿有细白线；④框内白字清楚；⑤三块玻璃逐张出现、上一块变淡、第 4 次点击恢复并出现结论。LibreOffice 和导出的 PDF 都看不到内发光，以 PowerPoint 和 WPS 放映为准。");

  // ===== 第 5 页：测试 D 字体 =====
  s = slide(T.gallery, null);
  head(s, "测试 D · 字体", "本机有没有微软雅黑？替代字体效果如何？");
  const SAMPLE = "Claude 接入 GitHub 攻略 2026";
  const fonts = [["微软雅黑（默认）", "Microsoft YaHei"], ["思源黑体", "Source Han Sans SC"], ["等线", "DengXian"], ["黑体", "SimHei"], ["宋体（对照）", "SimSun"]];
  fonts.forEach(([label, face], i) => {
    const y = 1.85 + i * 0.85;
    txt(s, label, { x: M, y, w: 2.6, h: 0.7, fontSize: 15, color: T.muted, valign: "middle" });
    s.addShape(pres.shapes.RECTANGLE, { x: M + 2.7, y, w: 7.2, h: 0.7, fill: { color: T.white }, line: { color: T.line, width: 0.75 }, objectName: "box-" + i });
    txt(s, SAMPLE, { x: M + 2.85, y, w: 6.9, h: 0.7, fontSize: 24, fontFace: face, bold: i === 0, color: T.lapis, valign: "middle" });
  });
  txt(s, "每行文字应在白框里排成一行。某一行折行、超出框，或和第一行看起来一样（说明本机没有这种字体，被替换了），请记下来。", { x: M, y: 6.2, w: W - 2 * M, h: 0.6, fontSize: 14, color: T.ink });
  foot(s, 5);
  s.addNotes("这一页没有动画。\n第一行是默认字体微软雅黑。如果它看起来像宋体（有衬线、笔画细），说明这台电脑没有微软雅黑。\n后面几行是候选的替代字体，用来决定「信创电脑」选项用哪种字体。哪几行显示正常、哪几行被替换，都请记下来。");

  return { pres, ANIM };
}

// ---------- 后处理：主题色与中文字体、组合、动画、毛玻璃 ----------
const SLOTS = ["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"];

function groupUnits(xml) {
  const re = /<p:(sp|pic)\b[^>]*>[\s\S]*?<\/p:\1>/g;
  const els = []; let m;
  while ((m = re.exec(xml))) {
    const body = m[0];
    const nmm = body.match(/<p:cNvPr id="(\d+)" name="([^"]*)"/);
    if (!nmm || !nmm[2].startsWith("@")) continue;
    const [key, label] = nmm[2].slice(1).split("|");
    const off = body.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/), ext = body.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
    els.push({ start: m.index, end: m.index + body.length, body, key, label, x: +off[1], y: +off[2], w: +ext[1], h: +ext[2] });
  }
  if (!els.length) return { xml, ids: {} };
  const units = {};
  for (const e of els) (units[e.key] = units[e.key] || { label: e.label, els: [] }).els.push(e);
  let maxId = Math.max(...[...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map((a) => +a[1]));
  const ids = {}, repl = [];
  for (const [key, u] of Object.entries(units)) {
    const x0 = Math.min(...u.els.map((e) => e.x)), y0 = Math.min(...u.els.map((e) => e.y));
    const x1 = Math.max(...u.els.map((e) => e.x + e.w)), y1 = Math.max(...u.els.map((e) => e.y + e.h));
    const id = ++maxId; ids[key] = id; let k = 0;
    const kids = u.els.map((e) => e.body.replace(/(<p:cNvPr id="\d+" name=")[^"]*"/, (_, a) => `${a}${esc(key)} · ${esc(u.label)} · ${++k}"`)).join("");
    const g = `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${id}" name="${esc(key)} · ${esc(u.label)}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="${x0}" y="${y0}"/><a:ext cx="${x1 - x0}" cy="${y1 - y0}"/><a:chOff x="${x0}" y="${y0}"/><a:chExt cx="${x1 - x0}" cy="${y1 - y0}"/></a:xfrm></p:grpSpPr>${kids}</p:grpSp>`;
    u.els.forEach((e, i) => repl.push({ start: e.start, end: e.end, text: i === 0 ? g : "" }));
  }
  repl.sort((a, b) => b.start - a.start);
  for (const r of repl) xml = xml.slice(0, r.start) + r.text + xml.slice(r.end);
  return { xml, ids };
}

function buildTiming(anim, ids) {
  let n = 2; const nid = () => ++n;
  const sp = (k) => { if (!ids[k]) throw new Error("找不到组合：" + k); return ids[k]; };
  const vis = (k, v, cls, first) => { const a = nid(), b = nid();
    return `<p:par><p:cTn id="${a}" presetID="1" presetClass="${cls}" presetSubtype="0" fill="hold" nodeType="${first ? "clickEffect" : "withEffect"}"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:set><p:cBhvr><p:cTn id="${b}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="${sp(k)}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="${v}"/></p:to></p:set></p:childTnLst></p:cTn></p:par>`; };
  const appear = (k, first) => vis(k, "visible", "entr", first);
  const hide = (k, first) => vis(k, "hidden", "exit", first);
  const opacity = (k, v, first) => { const a = nid(), b = nid(), c = nid();
    return `<p:par><p:cTn id="${a}" presetID="9" presetClass="emph" presetSubtype="0" nodeType="${first ? "clickEffect" : "withEffect"}"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:set><p:cBhvr><p:cTn id="${b}" dur="indefinite"/><p:tgtEl><p:spTgt spid="${sp(k)}"/></p:tgtEl><p:attrNameLst><p:attrName>style.opacity</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="${v}"/></p:to></p:set><p:animEffect filter="image" prLst="opacity: ${v}"><p:cBhvr rctx="IE"><p:cTn id="${c}" dur="indefinite"/><p:tgtEl><p:spTgt spid="${sp(k)}"/></p:tgtEl></p:cBhvr></p:animEffect></p:childTnLst></p:cTn></p:par>`; };
  const click = (inner) => { const a = nid(), b = nid(); return `<p:par><p:cTn id="${a}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="${b}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${inner()}</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>`; };
  const clicks = [], faded = [], masks = [];
  anim.steps.forEach((keys, j) => clicks.push(click(() => {
    let s = keys.map((k, i) => appear(k, i === 0)).join("");
    if (j > 0) {
      if (anim.kind === "mask") { const mk = `M${j}`; s += appear(mk, false); masks.push(mk); }
      else { s += anim.steps[j - 1].map((k) => opacity(k, "0.5", false)).join(""); faded.push(...anim.steps[j - 1]); }
    }
    return s;
  })));
  clicks.push(click(() => {
    let s = "", first = true;
    if (anim.end) { s += appear(anim.end, true); first = false; }
    if (anim.kind === "mask") masks.forEach((k) => { s += hide(k, first); first = false; });
    else faded.forEach((k) => { s += opacity(k, "1", first); first = false; });
    return s;
  }));
  return `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>${clicks.join("")}</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`;
}

// 玻璃形状：幻灯片背景填充 + 白色内发光 + 细白边（1.2pt、透明度 75%）；白字加轻投影
const GLASS = '<a:ln w="15240"><a:solidFill><a:srgbClr val="FFFFFF"><a:alpha val="25000"/></a:srgbClr></a:solidFill></a:ln><a:effectLst><a:innerShdw blurRad="317500"><a:schemeClr val="bg1"/></a:innerShdw></a:effectLst>';
const TSH = '<a:effectLst><a:outerShdw blurRad="50800" dist="38100" dir="2700000" algn="tl" rotWithShape="0"><a:prstClr val="black"><a:alpha val="60000"/></a:prstClr></a:outerShdw></a:effectLst>';
function glassify(x) {
  return x.replace(/<p:sp>((?:(?!<\/p:sp>)[\s\S])*?)<\/p:sp>/g, (all, body) => {
    if (!body.includes(`val="${MARK}"`)) return all;
    body = body.replace(/(<p:spPr>[\s\S]*?<\/a:prstGeom>)[\s\S]*?(<\/p:spPr>)/, `$1${GLASS}$2`);
    body = body.replace(/(<a:rPr\b[^>]*>(?:(?!<\/a:rPr>)[\s\S])*?<a:srgbClr val="FFFFFF"\/><\/a:solidFill>)/g, `$1${TSH}`);
    return `<p:sp useBgFill="1">${body}</p:sp>`;
  });
}

async function postProcess(buf, ANIM) {
  const zip = await JSZip.loadAsync(buf);
  let th = await zip.file("ppt/theme/theme1.xml").async("string");
  const scheme = `<a:clrScheme name="赵盾矿物色彩 v2.3">` + SLOTS.map((k) => `<a:${k}><a:srgbClr val="${THEME[k]}"/></a:${k}>`).join("") + "</a:clrScheme>";
  th = th.replace(/<a:clrScheme\b[\s\S]*?<\/a:clrScheme>/, () => scheme)
    .replace(/<a:ea typeface=""\/>/g, `<a:ea typeface="${FONT}"/>`)
    .replace(/<a:font script="Hans" typeface="[^"]*"\/>/g, '<a:font script="Hans" typeface="微软雅黑"/>');
  zip.file("ppt/theme/theme1.xml", th);
  for (let i = 0; i < ANIM.length; i++) {
    const part = `ppt/slides/slide${i + 1}.xml`;
    let xml = await zip.file(part).async("string");
    xml = glassify(xml); // 先改玻璃（此时 <p:sp> 还没有属性）
    xml = xml.replace(/(<\/a:r>)<a:pPr\b[^>]*?(?:\/>|>(?:(?!<\/a:pPr>)[\s\S])*?<\/a:pPr>)/g, "$1"); // 删段中多余 pPr
    xml = xml.replace(/(<a:rPr\b[^>]*?)(\/?>)/g, (all, a, b) => (/\blang=/.test(a) ? all : `${a} lang="zh-CN" altLang="en-US"${b}`));
    xml = xml.replace(/<a:latin typeface="([^"]+)"[^>]*\/>(?!<a:ea)/g, (all, f) => `${all}<a:ea typeface="${f}"/>`); // 中文也指定同一字体
    const { xml: gx, ids } = groupUnits(xml);
    xml = gx;
    if (ANIM[i]) xml = xml.replace("</p:clrMapOvr>", "</p:clrMapOvr>" + buildTiming(ANIM[i], ids));
    else if (Object.keys(ids).length) throw new Error("有组合但没有动画：" + part);
    zip.file(part, xml);
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

(async () => {
  const outDir = path.resolve(process.argv[2] || process.cwd());
  log("== 天然矿物色 PPT 讲稿制作 · 兼容性测试 " + VERSION + " ==");
  const env = envCheck(outDir);
  log("Node 版本：" + env.node + (env.nodeOk ? "（可用）" : "（太旧，需要 16 或以上）"));
  log("系统：" + env.platform + " " + env.arch);
  log("输出目录：" + outDir + (env.writable ? "（可写）" : "（不可写：" + env.writeError + "）"));
  if (!env.nodeOk || !env.writable) { log("结果：环境检查未通过，未生成测试稿。"); process.exit(2); }
  const { pres, ANIM } = build(env);
  const raw = await pres.write({ outputType: "nodebuffer" });
  const out = await postProcess(raw, ANIM);
  const file = path.join(outDir, "矿物色PPT-兼容性测试稿.pptx");
  fs.writeFileSync(file, out);
  log("测试稿：" + file + "（" + Math.round(out.length / 1024) + " KB，5 页）");
  log("结果：环境检查通过，测试稿已生成。请把这个文件交给用户，在 PowerPoint 和 WPS 里分别放映检查。");
})().catch((e) => { console.error("出错：" + (e && e.stack || e)); process.exit(1); });
