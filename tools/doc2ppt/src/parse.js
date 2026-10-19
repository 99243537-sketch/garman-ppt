// 读文档 → 带编号的段落（P001…），并记录排版修正（不改字）

const JSZip = require("jszip");

const unxml = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

async function readDocx(data) {
  const zip = await JSZip.loadAsync(data);
  const xml = await zip.file("word/document.xml").async("string");
  const body = xml.slice(xml.indexOf("<w:body"));
  // 样式 id → 名称（id 可能是数字，只有名称才能判断是不是标题）
  const sx = zip.file("word/styles.xml") ? await zip.file("word/styles.xml").async("string") : "";
  const names = {};
  for (const m of sx.matchAll(/<w:style\b[^>]*w:styleId="([^"]+)"[^>]*>[\s\S]*?<w:name w:val="([^"]+)"/g)) names[m[1]] = m[2];
  const out = [];
  let tables = 0, images = 0;
  tables = (body.match(/<w:tbl>/g) || []).length;
  // 只统计真正的图片：宽、高都超过 0.2 英寸（182880 EMU），排除装饰线、页面边框
  images = [...body.matchAll(/<wp:extent cx="(\d+)" cy="(\d+)"/g)].filter((m) => +m[1] > 182880 && +m[2] > 182880).length;
  for (const m of body.matchAll(/<w:p\b[^>]*?(?:\/>|>([\s\S]*?)<\/w:p>)/g)) {
    const inner = m[1] || "";
    const style = (inner.match(/<w:pStyle w:val="([^"]+)"/) || [])[1] || "";
    let t = "";
    for (const r of inner.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g)) t += r[1] !== undefined ? unxml(r[1]) : r[0] === "<w:tab/>" ? "\t" : "\n";
    t = t.trim();
    if (!t) continue;
    const lvl = /^(heading|标题)\s*(\d)$/i.exec(names[style] || style);
    out.push({ text: t, level: lvl ? +lvl[2] : 0 });
  }
  return { paras: out, tables, images };
}

function readText(name, data) {
  const raw = (typeof data === "string" ? data : new TextDecoder("utf-8").decode(data)).replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const md = /\.(md|markdown)$/i.test(name);
  const out = [];
  for (let line of raw.split("\n")) {
    line = line.trim();
    if (!line) continue;
    let level = 0;
    if (md) {
      const h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h) { level = h[1].length; line = h[2]; }
      line = line.replace(/^[-*+]\s+/, "").replace(/^\d+\.\s+/, "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
    }
    out.push({ text: line, level });
  }
  return { paras: out, tables: 0, images: 0 };
}

const END = /[。！？；：…”」』）)》.!?;:]$/;
const HEAD = /^([一二三四五六七八九十]+、|（[一二三四五六七八九十]+）|\d+[.、]|第[一二三四五六七八九十\d]+[章节部分])/;

function clean(list) {
  const out = [];
  list.forEach((p, i) => {
    const prev = out[out.length - 1];
    // PDF 转换断行：上一段没有结尾标点、含逗号或句号（是正文而非标题），本段不是标题 → 合并
    if (prev && !prev.level && !p.level && !END.test(prev.text) && /[，。]/.test(prev.text) && !HEAD.test(p.text)) {
      prev.text += p.text; prev.orig.push(i + 1); return;
    }
    out.push({ text: p.text, level: p.level, orig: [i + 1] });
  });
  const fixes = [];
  const paras = out.map((p, k) => {
    const id = "P" + String(k + 1).padStart(3, "0");
    if (p.orig.length > 1) fixes.push(`${id}：原文中被断成 ${p.orig.length} 段（原第 ${p.orig.join("、")} 段），已合并为一段`);
    const t0 = p.text;
    let t = t0.replace(/[ \t\u3000]*([，、。；：！？）》」])[ \t\u3000]*/g, "$1").replace(/([（《「])[ \t\u3000]+/g, "$1");
    t = t.replace(/([\u4e00-\u9fff])[ \t\u3000]{3,}([\u4e00-\u9fff])/g, "$1$2");
    if (t !== t0) fixes.push(`${id}：删除多余空格（「${t0.slice(0, 16)}…」）`);
    return { id, level: p.level, text: t };
  });
  return { paras, fixes };
}

// 浏览器和 Node 共用：name 为文件名，data 为 ArrayBuffer / Buffer
async function parseData(name, data) {
  const ext = (name.match(/\.[^.]+$/) || [""])[0].toLowerCase();
  let r;
  if (ext === ".docx") r = await readDocx(data);
  else if (ext === ".md" || ext === ".txt" || ext === ".markdown") r = readText(name, data);
  else throw new Error("暂不支持的文件格式：" + (ext || "未知") + "（支持 .docx、.md、.txt；.doc 请先另存为 .docx）");
  const { paras, fixes } = clean(r.paras);
  const notes = [];
  if (r.tables) notes.push(`原文有 ${r.tables} 个表格，表格内容未上页面，请自行补充。`);
  if (r.images) notes.push(`原文有 ${r.images} 张图片，未上页面，请自行补充。`);
  return { source: name.split(/[\\/]/).pop(), paras, fixes, notes };
}

async function parse(file) {
  return parseData(file.split(/[\\/]/).pop(), require("fs").readFileSync(file));
}

module.exports = { parse, parseData };
