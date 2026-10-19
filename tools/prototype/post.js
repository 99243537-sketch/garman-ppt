const JSZip = require("jszip");
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const FONT = "Microsoft YaHei", MARK = "0A0B0C";
const THEME = { dk1: "243335", lt1: "FFFFFF", dk2: "122947", lt2: "EFF8F9", accent1: "70C6D6", accent2: "1B667A", accent3: "245F4D", accent4: "59652E", accent5: "B04D2F", accent6: "315F91", hlink: "315F91", folHlink: "1B667A" };
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
  // 1. 取出每块局部压暗图的图片关系 id，并删除这些临时图片
  const rid = {};
  x = x.replace(/<p:pic>(?:(?!<\/p:pic>)[\s\S])*?<\/p:pic>/g, (all) => {
    const m = all.match(/name="patch#p(\d+)"/); if (!m) return all;
    rid[m[1]] = all.match(/r:embed="([^"]+)"/)[1]; return "";
  });
  // 2. 玻璃框：图片填充（局部压暗图）+ 白色内发光 + 细白边；白字加轻投影
  return x.replace(/<p:sp>((?:(?!<\/p:sp>)[\s\S])*?)<\/p:sp>/g, (all, body) => {
    if (!body.includes(`val="${MARK}"`)) return all;
    const m = body.match(/glass#p(\d+)/);
    const fill = m && rid[m[1]] ? `<a:blipFill><a:blip r:embed="${rid[m[1]]}"/><a:stretch><a:fillRect/></a:stretch></a:blipFill>` : "<a:noFill/>";
    body = body.replace(/(<p:spPr>[\s\S]*?<\/a:prstGeom>)[\s\S]*?(<\/p:spPr>)/, `$1${fill}${GLASS}$2`);
    body = body.replace(/(<a:rPr\b[^>]*>(?:(?!<\/a:rPr>)[\s\S])*?<a:srgbClr val="FFFFFF"\/><\/a:solidFill>)/g, `$1${TSH}`);
    return `<p:sp>${body}</p:sp>`;
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


module.exports = { postProcess };
