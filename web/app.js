// 天然矿物色 PPT 讲稿制作 · 网页版
(function () {
  const API = (window.PPT_API || "/ppt-api") + "/api/plan";
  const D = window.Doc2PPT;
  const $ = (id) => document.getElementById(id);
  let file = null, doc = null, plan = null, out = null, report = "";

  function visitorId() {
    try { let v = localStorage.getItem("ppt_vid"); if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("ppt_vid", v); } return v; }
    catch (e) { return "anon"; }
  }
  const show = (id, on) => $(id).classList.toggle("hide", !on);
  const step = (k) => [...$("steps").children].forEach((li, i) => { li.className = i < k ? "done" : i === k ? "doing" : ""; });
  const msg = (t, err) => { $("msg").textContent = t || ""; $("msg").className = err ? "err" : "fix"; };
  const ready = () => { $("go").disabled = !(file && $("agree").checked); };
  $("ver").textContent = D.VERSION;

  // 选择文件
  $("drop").onclick = () => $("file").click();
  $("file").onchange = (e) => pick(e.target.files[0]);
  ["dragover", "dragenter"].forEach((t) => $("drop").addEventListener(t, (e) => { e.preventDefault(); $("drop").classList.add("on"); }));
  ["dragleave", "drop"].forEach((t) => $("drop").addEventListener(t, (e) => { e.preventDefault(); $("drop").classList.remove("on"); }));
  $("drop").addEventListener("drop", (e) => pick(e.dataTransfer.files[0]));
  $("agree").onchange = ready;
  function pick(f) {
    if (!f) return;
    if (!/\.(docx|md|txt|markdown)$/i.test(f.name)) { alert("只支持 .docx、.md、.txt 文件。.doc 请先另存为 .docx。"); return; }
    file = f; $("fname").textContent = "已选择：" + f.name; ready();
  }

  // 给学员看的错误：只显示中文；英文异常（网络、浏览器内部错误）一律换成友好提示
  const FRIENDLY = "网络或服务暂时出了点问题，请稍后再试";
  const friendly = (t) => (t && /[\u4e00-\u9fff]/.test(t) ? t : FRIENDLY);
  function fail(text, code, retryable) { const e = new Error(friendly(text)); e.code = code || "unknown"; e.retryable = retryable !== false; return e; }

  async function askOnce(body) {
    let r;
    try { r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
    catch (e) { throw fail("", "network", true); }
    let j = {}; try { j = await r.json(); } catch (e) { /* 网关返回的不是 JSON（如 504 超时页面） */ }
    if (!r.ok) throw fail(j.error, j.code || "http_" + r.status, j.retryable !== undefined ? j.retryable : r.status >= 500);
    if (!j.plan || !Array.isArray(j.plan.slides)) throw fail("", "plan_parse_failed", true);
    if (typeof j.remaining === "number") $("left").textContent = `今天还可以生成 ${j.remaining} 次`;
    return j;
  }
  // 可重试的错误（模型没写完、解析失败、网络）自动再试一次；失败的请求不计入每日次数
  async function askModel(body) {
    try { return await askOnce(body); }
    catch (e) {
      if (!e.retryable) throw e;
      msg("大模型这次没有给出完整的分页方案，正在自动重试…");
      return await askOnce(body);
    }
  }

  $("go").onclick = async () => {
    $("go").disabled = true; show("s-progress", true); show("s-done", false); show("s-corr", false); show("retry", false); msg("");
    const style = document.querySelector('input[name="style"]:checked').value;
    try {
      step(0);
      doc = await D.parseData(file.name, await file.arrayBuffer());
      if (!doc.paras.length) throw new Error("文档里没有读到文字。");
      msg(`读到 ${doc.paras.length} 段，约 ${doc.paras.reduce((n, p) => n + p.text.length, 0)} 字。`);
      step(1);
      const base = { visitor_id: visitorId(), style, doc_name: doc.source, paras: doc.paras };
      let j = await askModel(base);
      plan = j.plan; plan.style = style;
      step(2);
      for (let round = 1; ; round++) {
        // 模型提出的错别字一律先设为未确认
        (plan.corrections || []).forEach((c) => { c.accepted = false; });
        const r = D.check(doc, plan);
        if (r.ok) break;
        if (round > 2) throw fail("大模型的分页方案两次修正后仍有问题，请再试一次；多次失败可以换一份文档", "check_failed", true);
        msg(`校验发现 ${r.errs.length} 处问题，正在让大模型修正（第 ${round} 次）…`);
        j = await askModel(Object.assign({}, base, { session_id: j.session_id, previous_plan: plan, errors: r.errs }));
        plan = j.plan; plan.style = style;
      }
      msg("校验通过。");
      if ((plan.corrections || []).length) return askCorrections();
      await finish();
    } catch (e) {
      msg(friendly(e && e.message), true);
      show("retry", !e || e.retryable !== false);
      $("go").disabled = false;
    }
  };
  $("retry").onclick = () => { show("retry", false); $("go").click(); };

  function askCorrections() {
    const box = $("corr"); box.innerHTML = "";
    plan.corrections.forEach((c, i) => {
      const l = document.createElement("label");
      const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = true; cb.dataset.i = i;
      l.append(cb, ` ${c.para}：「${c.from}」→「${c.to}」${c.reason ? "（" + c.reason + "）" : ""}`);
      box.appendChild(l);
    });
    show("s-corr", true);
  }
  $("corr-ok").onclick = async () => {
    $("corr").querySelectorAll("input").forEach((cb) => { plan.corrections[cb.dataset.i].accepted = cb.checked; });
    // 已确认的错别字：页面摘句里出现的原写法也一并改正，保证摘句仍能对上改正后的原文
    plan.corrections.filter((c) => c.accepted).forEach((c) => {
      const fixRef = (ref) => { if (Array.isArray(ref) && ref[0] === c.para) ref[1] = ref[1].split(c.from).join(c.to); };
      const walk = (o) => { if (Array.isArray(o)) { if (o.length === 2 && typeof o[0] === "string" && /^P\d+$/.test(o[0]) && typeof o[1] === "string") fixRef(o); else o.forEach(walk); } else if (o && typeof o === "object") Object.values(o).forEach(walk); };
      walk(plan.slides); walk(plan.footer);
    });
    const r = D.check(doc, plan);
    if (!r.ok) { msg("确认错别字后出了点问题，请取消勾选这些错别字再试一次", true); return; }
    show("s-corr", false);
    await finish();
  };

  async function finish() {
    step(3); msg("正在排版生成…");
    const name = doc.source.replace(/\.[^.]+$/, "") + (plan.style === "glass" ? "（毛玻璃）" : "") + ".pptx";
    out = { blob: await D.build(doc, plan), name };
    report = D.report(doc, plan, name, D.check(doc, plan).warns);
    step(4); msg("");
    $("summary").textContent = `已生成《${name}》，共 ${plan.slides.length} 页。原文 ${doc.paras.length} 段全部放进讲稿备注；排版修正 ${doc.fixes.length} 条，详见生成报告。`;
    show("s-done", true); $("go").disabled = false;
  }

  function save(blob, name) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  $("dl").onclick = () => save(out.blob, out.name);
  $("dl-rep").onclick = () => save(new Blob([report], { type: "text/markdown;charset=utf-8" }), "生成报告.md");
  $("again").onclick = () => { show("s-done", false); show("s-progress", false); file = null; $("fname").textContent = ""; $("file").value = ""; ready(); window.scrollTo(0, 0); };
})();
