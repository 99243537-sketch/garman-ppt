// 天然矿物色 PPT 讲稿制作 · 网页版
(function () {
  const BASE = (window.PPT_API || "/ppt-api") + "/api";
  const D = window.Doc2PPT;
  const $ = (id) => document.getElementById(id);
  const KEY = "ppt_state_v1", KEEP = 24 * 3600 * 1000;
  let file = null, st = null, out = null, busy = false;

  // ---------- 小工具 ----------
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* 存不下就算了，不影响制作 */ } },
    clear() { try { localStorage.removeItem(KEY); } catch (e) { } },
  };
  const save = () => { if (st) { st.t = Date.now(); store.set(st); } };
  function visitorId() {
    try { let v = localStorage.getItem("ppt_vid"); if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("ppt_vid", v); } return v; }
    catch (e) { return window.__vid || (window.__vid = Math.random().toString(36).slice(2)); }
  }
  const show = (id, on) => $(id).classList.toggle("hide", !on);
  const step = (k) => [...$("steps").children].forEach((li, i) => { li.className = i < k ? "done" : i === k ? "doing" : ""; });
  const msg = (t, err) => { $("msg").textContent = t || ""; $("msg").className = err ? "err" : "fix"; };
  const ready = () => { $("go").disabled = busy || !(file && $("agree").checked); };
  const sleep = (ms) => new Promise((ok) => {
    // 手机锁屏/切走后回来，立刻去取一次结果，不等计时器
    const t = setTimeout(done, ms);
    function done() { clearTimeout(t); document.removeEventListener("visibilitychange", vis); ok(); }
    function vis() { if (document.visibilityState === "visible") done(); }
    document.addEventListener("visibilitychange", vis);
  });
  const docName = () => (st && st.doc ? st.doc.source : "");
  $("ver").textContent = D.VERSION;

  // 给学员看的错误：只显示中文；英文异常一律换成友好提示
  const FRIENDLY = "网络或服务暂时出了点问题，请稍后再试";
  const friendly = (t) => (t && /[一-鿿]/.test(t) ? t : FRIENDLY);
  function fail(text, code, retryable) { const e = new Error(friendly(text)); e.code = code || "unknown"; e.retryable = retryable !== false; return e; }

  // 制作途中刷新/关闭前提醒（进度已暂存，刷新后也能接着做）
  window.addEventListener("beforeunload", (e) => { if (busy) { e.preventDefault(); e.returnValue = ""; } });

  // ---------- 在微信等 App 里打开：无法下载文件 ----------
  (function () {
    const ua = navigator.userAgent;
    const app = /MicroMessenger/i.test(ua) ? "微信" : /\bQQ\//.test(ua) ? "QQ" : /DingTalk/i.test(ua) ? "钉钉" : /Weibo/i.test(ua) ? "微博" : /Lark|Feishu/i.test(ua) ? "飞书" : "";
    if (app) { $("inapp").innerHTML = `你正在${app}里打开本页，${app}里通常<b>无法下载文件</b>。请点右上角「···」，选择「在浏览器中打开」后再制作。`; show("inapp", true); }
  })();

  // ---------- 效果图点开看大图 ----------
  document.querySelectorAll(".thumbs img").forEach((im) => im.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); $("big").src = im.src; show("lightbox", true); }));
  $("lightbox").onclick = () => show("lightbox", false);

  // ---------- 选择文件 ----------
  $("drop").onclick = () => $("file").click();
  $("file").onchange = (e) => pick(e.target.files[0]);
  ["dragover", "dragenter"].forEach((t) => $("drop").addEventListener(t, (e) => { e.preventDefault(); $("drop").classList.add("on"); }));
  ["dragleave", "drop"].forEach((t) => $("drop").addEventListener(t, (e) => { e.preventDefault(); $("drop").classList.remove("on"); }));
  $("drop").addEventListener("drop", (e) => pick(e.dataTransfer.files[0]));
  $("agree").onchange = ready;
  const NOT = { ".doc": "旧版 .doc 文件请用 Word 或 WPS 打开，「另存为」.docx 后再上传。", ".wps": "WPS 文档请在 WPS 里「另存为」Word 文档（.docx）后再上传。",
    ".pdf": "PDF 请先转成 Word（.docx）再上传；如果是扫描件，需要先识别成文字。", ".pages": "Pages 文稿请「导出为 Word」后再上传。", ".rtf": "请用 Word 或 WPS 打开后「另存为」.docx 再上传。" };
  function pick(f) {
    if (!f) return;
    const ext = (f.name.match(/\.[^.]+$/) || [""])[0].toLowerCase();
    if (![".docx", ".md", ".txt", ".markdown"].includes(ext)) { alert(NOT[ext] || "只支持 .docx、.md、.txt 文件。"); $("file").value = ""; return; }
    if (f.size > 50 * 1024 * 1024) { alert("文件超过 50MB，太大了。可以删掉文档里的大图片后再试。"); $("file").value = ""; return; }
    file = f; $("fname").textContent = "已选择：" + f.name; ready();
  }

  // 读文件：.txt/.md 自动识别编码（Windows 记事本常存成 GBK），.docx 打不开给中文提示
  async function readDoc(f) {
    const buf = await f.arrayBuffer();
    let data = buf;
    if (/\.(txt|md|markdown)$/i.test(f.name)) {
      const b = new Uint8Array(buf);
      if (b[0] === 0xff && b[1] === 0xfe) data = new TextDecoder("utf-16le").decode(buf);
      else if (b[0] === 0xfe && b[1] === 0xff) data = new TextDecoder("utf-16be").decode(buf);
      else { try { data = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch (e) { data = new TextDecoder("gb18030").decode(buf); } }
    }
    let doc;
    try { doc = await D.parseData(f.name, data); }
    catch (e) { throw fail(/[一-鿿]/.test(e.message || "") ? e.message : "这个文件打不开，可能已加密或已损坏。请用 Word 或 WPS 打开，「另存为」一个新的 .docx 再试。", "bad_file", false); }
    if (!doc.paras.length) throw fail("文档里没有读到文字。如果是扫描件或图片，需要先转成可编辑的文字。", "empty", false);
    const chars = doc.paras.reduce((n, p) => n + p.text.length, 0);
    if (chars > 30000) throw fail(`文档太长（${chars} 字），目前最多支持 30000 字，可以拆成几份分别制作。`, "too_long", false);
    return doc;
  }

  // ---------- 和服务器打交道：提交任务 → 每隔几秒取结果 ----------
  async function http(method, url, body) {
    let r;
    try { r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, cache: "no-store" }); }
    catch (e) { throw fail("", "network", true); }
    let j = null; try { j = await r.json(); } catch (e) { /* 网关返回的不是 JSON（如 Cloudflare 错误页） */ }
    return { r, j: j || {} };
  }
  async function submit(body) {
    const { r, j } = await http("POST", BASE + "/jobs", body);
    if (!r.ok || !j.job_id) throw fail(j.error, j.code || "http_" + r.status, j.retryable !== undefined ? j.retryable : r.status >= 500);
    return j;
  }
  async function poll(jobId) {
    const t0 = Date.now(); let misses = 0;
    for (;;) {
      if (Date.now() - t0 > 12 * 60 * 1000) throw fail("等了太久还没有结果，请再试一次", "timeout", true);
      let r, j;
      try { ({ r, j } = await http("GET", `${BASE}/jobs/${jobId}?v=${encodeURIComponent(visitorId())}`)); }
      catch (e) { r = null; }
      if (!r || (r.status >= 500 && !j.status)) {         // 网络抖一下：继续等，连续 2 分钟都不通才算失败
        if (++misses > 40) throw fail("网络连接不上服务器，请检查网络后再试", "network", true);
        msg("网络不太稳定，正在重新连接…"); await sleep(3000); continue;
      }
      misses = 0;
      if (j.status === "done") { if (typeof j.remaining === "number") $("left").textContent = `今天还可以生成 ${j.remaining} 次`; return j; }
      if (j.status === "error" || !r.ok) throw fail(j.error, j.code || "http_" + r.status, j.retryable !== undefined ? j.retryable : true);
      if (j.status === "queued") msg(j.position > 0 ? `排队中，前面还有 ${j.position} 份，请稍候…` : "排队中，下一个就轮到你…");
      else msg(`大模型正在分页，已等待 ${j.secs || 0} 秒（通常 1–3 分钟，可以锁屏，回来会接着等）`);
      await sleep(3000);
    }
  }
  // 一次完整的请求：提交（或接着取上次没取完的结果）
  async function askOnce(req) {
    if (!st.job) { const j = await submit(Object.assign(baseBody(), req)); st.job = { id: j.job_id, req }; save(); if (j.position > 0) msg(`排队中，前面还有 ${j.position} 份，请稍候…`); }
    try { const j = await poll(st.job.id); st.job = null; save(); if (!j.plan || !Array.isArray(j.plan.slides)) throw fail("", "plan_parse_failed", true); return j; }
    catch (e) { if (e.code !== "network") { st.job = null; save(); } throw e; }  // 只是网络断了：任务还在，下次接着取
  }
  // 可重试的错误（没写完、解析失败、网络、服务器重启）自动再试一次；失败的请求不计入每日次数
  async function askModel(req) {
    try { return await askOnce(req); }
    catch (e) {
      if (!e.retryable) throw e;
      msg(e.code === "job_lost" ? "上次的结果找不到了，正在重新提交…" : "大模型这次没有给出完整的分页方案，正在自动重试…");
      return await askOnce(req);
    }
  }
  const baseBody = () => ({ visitor_id: visitorId(), style: st.style, doc_name: st.doc.source, paras: st.doc.paras });

  // ---------- 摘句只差标点、空格、全半角时，程序自己对齐到原文（用的仍是原文，不改字） ----------
  const PUN = /[\s\p{P}\p{S}]/u;
  function norm(s) {
    let t = "", off = 0; const map = [];
    for (const ch of s) {
      if (!PUN.test(ch)) {
        const c = ch.charCodeAt(0) >= 0xff01 && ch.charCodeAt(0) <= 0xff5e ? String.fromCharCode(ch.charCodeAt(0) - 0xfee0) : ch;
        t += c.toLowerCase(); map.push(off);
      }
      off += ch.length;
    }
    return { t, map };
  }
  function snapOne(P, e) {
    if (!P || typeof e !== "string" || P.includes(e)) return null;
    const a = norm(P), b = norm(e);
    if ([...b.t].length < 4) return null;
    const i = a.t.indexOf(b.t);
    if (i < 0 || a.t.indexOf(b.t, i + 1) >= 0) return null;   // 找不到或不唯一：交给大模型改
    const ci = [...a.t.slice(0, i)].length, n = [...b.t].length;
    let s = a.map[ci], last = a.map[ci + n - 1], end = last + [...P.slice(last)][0].length;
    if (PUN.test([...e].pop()) && P[end] && PUN.test(P[end]) && !/\s/.test(P[end])) end += 1;  // 原摘句带着句末标点
    const out = P.slice(s, end).trim();
    return out && P.includes(out) ? out : null;
  }
  function snap(doc, plan) {
    const P = Object.fromEntries(doc.paras.map((p) => [p.id, p.text]));
    let n = 0;
    const walk = (o) => {
      if (Array.isArray(o)) {
        if (o.length === 2 && typeof o[0] === "string" && /^P\d+$/.test(o[0]) && typeof o[1] === "string" && !/^P\d+$/.test(o[1])) {
          const f = snapOne(P[o[0]], o[1]); if (f) { o[1] = f; n++; }
        } else o.forEach(walk);
      } else if (o && typeof o === "object") Object.values(o).forEach(walk);
    };
    walk(plan.slides); walk(plan.footer);
    return n;
  }

  // ---------- 主流程（可以从任何一步接着做） ----------
  $("go").onclick = async () => {
    if (!file) return;
    st = { name: file.name, style: document.querySelector('input[name="style"]:checked').value, doc: null, plan: null, job: null, round: 0, stage: "making" };
    out = null; show("resume", false);
    await run();
  };
  async function run() {
    busy = true; ready();
    show("s-progress", true); show("s-done", false); show("s-corr", false); show("retry", false); msg("");
    try {
      step(0);
      if (!st.doc) {
        st.doc = await readDoc(file);
        save();
      }
      msg(`读到 ${st.doc.paras.length} 段，约 ${st.doc.paras.reduce((n, p) => n + p.text.length, 0)} 字。`);
      step(1);
      if (!st.plan) {
        const j = await askModel(st.job ? st.job.req : {});
        st.plan = j.plan; st.plan.style = st.style; st.sid = j.session_id; st.round = 0; save();
      }
      step(2);
      if (st.job) {  // 刷新前正在等大模型修正：接着取结果
        const j = await askModel(st.job.req);
        st.plan = j.plan; st.plan.style = st.style; save();
      }
      for (;;) {
        (st.plan.corrections || []).forEach((c) => { c.accepted = false; });  // 错别字一律先设为未确认
        snap(st.doc, st.plan);
        const r = D.check(st.doc, st.plan);
        if (r.ok) break;
        if (st.round >= 2) throw fail("大模型的分页方案两次修正后仍有问题，请再试一次；多次失败可以换一份文档", "check_failed", true);
        st.round += 1; save();
        msg(`校验发现 ${r.errs.length} 处问题，正在让大模型修正（第 ${st.round} 次）…`);
        const j = await askModel({ session_id: st.sid, previous_plan: st.plan, errors: r.errs });
        st.plan = j.plan; st.plan.style = st.style; save();
      }
      msg("校验通过。");
      if ((st.plan.corrections || []).length) { st.stage = "corr"; save(); busy = false; ready(); return askCorrections(); }
      await finish();
    } catch (e) {
      busy = false; ready();
      msg(friendly(e && e.message), true);
      const again = !e || e.retryable !== false;
      show("retry", again);
      // 不能再试的错误（文件打不开、次数用完等）：清掉暂存
      if (!again) { st = null; store.clear(); }
      else if (e.code === "check_failed") { st.plan = null; st.round = 0; save(); }
    }
  }
  $("retry").onclick = () => { show("retry", false); if (st) run(); else $("go").click(); };

  function askCorrections() {
    const box = $("corr"); box.innerHTML = "";
    st.plan.corrections.forEach((c, i) => {
      const l = document.createElement("label");
      const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = true; cb.dataset.i = i;
      l.append(cb, ` ${c.para}：「${c.from}」→「${c.to}」${c.reason ? "（" + c.reason + "）" : ""}`);
      box.appendChild(l);
    });
    show("s-progress", true); step(2); msg("请确认下面的错别字。");
    show("s-corr", true);
  }
  $("corr-ok").onclick = async () => {
    const plan = st.plan;
    $("corr").querySelectorAll("input").forEach((cb) => { plan.corrections[cb.dataset.i].accepted = cb.checked; });
    // 已确认的错别字：页面摘句里出现的原写法也一并改正，保证摘句仍能对上改正后的原文
    plan.corrections.filter((c) => c.accepted).forEach((c) => {
      const fixRef = (ref) => { if (ref[0] === c.para) ref[1] = ref[1].split(c.from).join(c.to); };
      const walk = (o) => { if (Array.isArray(o)) { if (o.length === 2 && typeof o[0] === "string" && /^P\d+$/.test(o[0]) && typeof o[1] === "string" && !/^P\d+$/.test(o[1])) fixRef(o); else o.forEach(walk); } else if (o && typeof o === "object") Object.values(o).forEach(walk); };
      walk(plan.slides); walk(plan.footer);
    });
    const r = D.check(st.doc, plan);
    if (!r.ok) { msg("确认错别字后出了点问题，请取消勾选这些错别字再试一次", true); return; }
    show("s-corr", false);
    busy = true;
    try { await finish(); } catch (e) { msg(FRIENDLY, true); } finally { busy = false; ready(); }
  };

  const outName = () => docName().replace(/\.[^.]+$/, "") + (st.plan.style === "glass" ? "（毛玻璃）" : "") + ".pptx";
  async function finish() {
    step(3); msg("正在排版生成…");
    out = { blob: await D.build(st.doc, st.plan), name: outName() };
    st.stage = "done"; save();
    showDone();
  }
  function showDone() {
    step(4); msg(""); show("s-progress", true); show("s-corr", false);
    $("summary").textContent = `已生成《${outName()}》，共 ${st.plan.slides.length} 页。原文 ${st.doc.paras.length} 段全部放进讲稿备注；排版修正 ${st.doc.fixes.length} 条，详见生成报告。`;
    show("s-done", true); busy = false; ready();
  }

  function download(blob, name) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  $("dl").onclick = async () => { if (!out) out = { blob: await D.build(st.doc, st.plan), name: outName() }; download(out.blob, out.name); };
  $("dl-rep").onclick = () => download(new Blob([D.report(st.doc, st.plan, outName(), D.check(st.doc, st.plan).warns)], { type: "text/markdown;charset=utf-8" }), "生成报告.md");
  $("again").onclick = () => { st = null; out = null; store.clear(); show("s-done", false); show("s-progress", false); file = null; $("fname").textContent = ""; $("file").value = ""; ready(); window.scrollTo(0, 0); };

  // ---------- 打开页面时：有没做完的就提示接着做 ----------
  (function () {
    const s = store.get();
    if (!s || !s.doc || Date.now() - (s.t || 0) > KEEP) { store.clear(); return; }
    st = s;
    const name = s.doc.source;
    if (s.stage === "done") {
      $("resume-text").textContent = `上次生成的《${name}》还可以重新下载（24 小时内有效）。`;
      $("resume-go").textContent = "查看并下载";
    } else {
      $("resume-text").textContent = `上次的《${name}》还没做完，可以接着做${s.plan ? "（不用重新分页，不扣次数）" : ""}。`;
      $("resume-go").textContent = "接着做";
    }
    show("resume", true);
    $("resume-go").onclick = () => {
      show("resume", false);
      if (st.stage === "done") return showDone();
      if (st.stage === "corr") { askCorrections(); return; }
      run();
    };
    $("resume-no").onclick = () => { st = null; store.clear(); show("resume", false); };
  })();
})();
