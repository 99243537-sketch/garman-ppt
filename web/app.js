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

  async function askModel(body) {
    const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    let j = {}; try { j = await r.json(); } catch (e) { /* 非 JSON */ }
    if (!r.ok) throw new Error(j.error || `服务暂时不可用（${r.status}）`);
    if (typeof j.remaining === "number") $("left").textContent = `今天还可以生成 ${j.remaining} 次`;
    return j;
  }

  $("go").onclick = async () => {
    $("go").disabled = true; show("s-progress", true); show("s-done", false); show("s-corr", false); msg("");
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
        if (round > 2) throw new Error("自动修正两次后仍未通过校验：" + r.errs.slice(0, 3).join("；") + "。请稍后重试。");
        msg(`校验发现 ${r.errs.length} 处问题，正在让大模型修正（第 ${round} 次）…`);
        j = await askModel(Object.assign({}, base, { session_id: j.session_id, previous_plan: plan, errors: r.errs }));
        plan = j.plan; plan.style = style;
      }
      msg("校验通过。");
      if ((plan.corrections || []).length) return askCorrections();
      await finish();
    } catch (e) {
      msg(e.message || String(e), true); $("go").disabled = false;
    }
  };

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
    if (!r.ok) { msg("确认错别字后校验未通过：" + r.errs[0], true); return; }
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
