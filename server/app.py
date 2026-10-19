"""天然矿物色 PPT 讲稿制作 · 分页方案服务（ppt-planner）

只用 Python 标准库。浏览器把文档拆成段落后发来，本服务调用 MiniMax 生成「分页方案」JSON。
- 不保存文档内容：段落只在内存里用于调用大模型；分页结果在内存里保留 JOB_TTL 秒供浏览器取走，不写硬盘。
- 用量库只记时间、访客（哈希）、字数、耗时、是否成功、失败原因。
- 每个访客每天 DAILY_LIMIT 次；全站每天 GLOBAL_DAILY_LIMIT 次；全站同时最多 MAX_CONCURRENT 个在调用大模型，其余排队。
- 同一访客同时只能有 1 份在做；同一份文档校验不通过时，可凭 session_id 免费修正 MAX_REPAIRS 次。

为什么要排队取结果：网站前面有 Cloudflare，一个请求超过 100 秒就会被断开（524），
而大模型分页可能要 2–3 分钟。所以改成「提交 → 马上拿到任务号 → 浏览器每隔几秒来取结果」。

接口（Nginx 把 /ppt-api/ 转到本服务）：
  GET  /api/health
  POST /api/jobs        {visitor_id, style, doc_name, paras:[{id,text,level}], session_id?, previous_plan?, errors?}
                        → 202 {job_id, session_id, position}
  GET  /api/jobs/<id>?v=<visitor_id>
                        → {status: queued|running|done|error, position?, secs?, plan?, remaining?, error?, code?, retryable?}
  POST /api/plan        旧接口（同步等待），保留给浏览器里还缓存着旧网页的用户
"""
import json, os, re, sqlite3, time, uuid, hashlib, threading, queue, urllib.request, urllib.parse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load_env(path):
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env(HERE / ".env")
E = os.environ.get
API_KEY = E("MINIMAX_API_KEY", "")
API_BASE = E("MINIMAX_BASE", "https://api.minimaxi.com/v1").rstrip("/")
MODEL = E("MINIMAX_MODEL", "MiniMax-M2.7")
HOST = E("HOST", "127.0.0.1")
PORT = int(E("PORT", "8790"))
DAILY_LIMIT = int(E("DAILY_LIMIT", "5"))                 # 每个访客每天
GLOBAL_DAILY_LIMIT = int(E("GLOBAL_DAILY_LIMIT", "200"))  # 全站每天（防刷、控制费用）
MAX_CONCURRENT = int(E("MAX_CONCURRENT", "3"))           # 同时调用大模型的最多几份
MAX_QUEUE = int(E("MAX_QUEUE", "20"))                    # 排队 + 进行中最多几份，再多就请稍后再来
MAX_REPAIRS = int(E("MAX_REPAIRS", "2"))
MAX_DOC_CHARS = int(E("MAX_DOC_CHARS", "30000"))
MAX_OUTPUT_TOKENS = int(E("MAX_OUTPUT_TOKENS", "24000"))
TIMEOUT = int(E("REQUEST_TIMEOUT", "240"))
JOB_TTL = int(E("JOB_TTL", "600"))                       # 结果在内存里保留多久（秒）
ORIGINS = [o.strip() for o in E("ALLOWED_ORIGINS", "https://www.zhaodun.work,https://zhaodun.work").split(",") if o.strip()]
DB = E("USAGE_DB", str(HERE / "usage.db"))
PROMPT = (HERE / "prompt.md").read_text(encoding="utf-8")

lock = threading.Lock()   # 保护数据库和 JOBS
JOBS = {}                 # job_id → 任务（只在内存）
Q = queue.Queue()


def db():
    c = sqlite3.connect(DB)
    c.execute("create table if not exists usage(ts real, day text, who text, chars int, kind text, ok int, secs real, note text)")
    c.execute("create table if not exists sessions(id text primary key, who text, ts real, repairs int)")
    return c


def who_of(ip, visitor):
    return hashlib.sha256(f"{ip}|{visitor}".encode()).hexdigest()[:16]  # 不存原始 IP


def today():
    return time.strftime("%Y-%m-%d", time.localtime())


def used_today(c, who):
    return c.execute("select count(*) from usage where day=? and who=? and kind='plan' and ok=1", (today(), who)).fetchone()[0]


def used_today_all(c):
    return c.execute("select count(*) from usage where day=? and kind='plan' and ok=1", (today(),)).fetchone()[0]


def active():
    return [j for j in JOBS.values() if j["status"] in ("queued", "running")]


class PlanError(Exception):
    """给学员看的中文错误；code 供前端判断，retryable 表示值得再试一次"""
    def __init__(self, code, msg, retryable=True, http=502):
        super().__init__(msg)
        self.code, self.msg, self.retryable, self.http = code, msg, retryable, http

    def body(self):
        return {"error": self.msg, "code": self.code, "retryable": self.retryable}


MSG_PARSE = "大模型这次没有给出完整的分页方案，请再试一次"
MSG_TRUNC = "文档较长，大模型这次没写完分页方案，请再试一次；多次失败可以把文档拆成两份"
MSG_UPSTREAM = "大模型服务暂时不可用，请稍后再试"


def extract_json(text, truncated=False):
    text = re.sub(r"<think>[\s\S]*?</think>", "", text)
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    a, b = text.find("{"), text.rfind("}")
    err = PlanError("plan_truncated", MSG_TRUNC) if truncated else PlanError("plan_parse_failed", MSG_PARSE)
    if a < 0 or b <= a:
        raise err
    raw = text[a:b + 1]
    for cand in (raw, re.sub(r",\s*([}\]])", r"\1", raw)):  # 第二次去掉多余的结尾逗号再试
        try:
            plan = json.loads(cand)
            if isinstance(plan, dict) and (isinstance(plan.get("slides"), list) or isinstance(plan.get("fix"), list)):
                return plan
        except json.JSONDecodeError:
            pass
    raise err


def call_model(messages):
    body = json.dumps({"model": MODEL, "messages": messages, "max_tokens": MAX_OUTPUT_TOKENS, "temperature": 1.0}).encode()
    req = urllib.request.Request(API_BASE + "/chat/completions", data=body, method="POST",
                                 headers={"Authorization": "Bearer " + API_KEY, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            data = json.loads(r.read().decode())
    except Exception as e:  # 网络、超时、HTTP 错误（含 MiniMax 限流 429）
        raise PlanError("upstream_error", MSG_UPSTREAM) from e
    if (data.get("base_resp") or {}).get("status_code", 0) not in (0, None) or not data.get("choices"):
        raise PlanError("upstream_error", MSG_UPSTREAM)
    ch = data["choices"][0]
    return ch["message"].get("content") or "", data.get("usage", {}), ch.get("finish_reason")


def paras_text(paras):
    return "\n".join(f"{p['id']}{' [标题' + str(p['level']) + ']' if p.get('level') else ''} {p['text']}" for p in paras)


def make_messages(req):
    style = "毛玻璃（style 写 \"glass\"）" if req.get("style") == "glass" else "普通（style 写 \"normal\"）"
    user = f"文档：《{req.get('doc_name', '未命名')}》\n效果：{style}\n\n段落：\n{paras_text(req['paras'])}"
    msgs = [{"role": "system", "content": PROMPT}, {"role": "user", "content": user}]
    if req.get("errors") and req.get("previous_plan"):
        msgs.append({"role": "assistant", "content": json.dumps(req["previous_plan"], ensure_ascii=False, separators=(",", ":"))})
        msgs.append({"role": "user", "content": ("程序校验没有通过，问题如下：\n- " + "\n- ".join(str(x) for x in req["errors"][:30]) +
            "\n\n请只修改有问题的页，不要重写整份方案。只输出一个紧凑的 JSON：\n"
            '{"fix":[{"page":页码,"slide":{这一页修改后的完整内容}}]}\n'
            "页码从 1 开始，与上面的「第 N 页」一致；没问题的页不要输出。页脚有问题时加上 \"footer\"。"
            "只有必须增加或删除页面时，才输出完整方案（含 slides）。")})
    return msgs


# ---------- 受理：校验请求、检查各种限额，通过后建任务 ----------
def admit(req, ip):
    if not isinstance(req, dict):
        raise PlanError("bad_request", "请求格式不对，请刷新页面后重试", False, 400)
    paras = req.get("paras") or []
    if not isinstance(paras, list) or not paras or not all(isinstance(p, dict) and isinstance(p.get("id"), str) and isinstance(p.get("text"), str) for p in paras):
        raise PlanError("empty", "没有读到文档段落", False, 400)
    chars = sum(len(p["text"]) for p in paras)
    if chars > MAX_DOC_CHARS:
        raise PlanError("too_long", f"文档太长（{chars} 字），目前最多支持 {MAX_DOC_CHARS} 字，可以拆成几份分别制作", False, 400)
    if not API_KEY:
        raise PlanError("server_config", "服务器还没配置好，请联系网站管理员", False, 500)
    visitor = str(req.get("visitor_id", ""))[:64]
    who = who_of(ip, visitor)
    with lock:
        mine = [j for j in active() if j["who"] == who or (visitor and j["visitor"] == visitor)]
        if mine:
            j = mine[0]
            kind_now = "repair" if req.get("errors") else "plan"
            if j["visitor"] == visitor and j["doc"] == str(req.get("doc_name", ""))[:100] and j["chars"] == chars and j["kind"] == kind_now:
                # 同一份文档、同一步：多半是页面没收到上次的回复（网络抖动、刷新），直接接上原来的任务
                return j
            secs = round(time.time() - j["created"])
            raise PlanError("busy_self", f"你还有一份《{j['doc']}》正在制作（已等待 {secs} 秒），请等它完成后再试，通常 1–3 分钟", True, 409)
        if len(active()) >= MAX_QUEUE:
            raise PlanError("busy_queue", "现在使用的人太多，请过几分钟再试", True, 503)
        c = db()
        try:
            sid, kind = req.get("session_id"), "plan"
            if req.get("errors"):
                row = c.execute("select who, ts, repairs from sessions where id=?", (sid,)).fetchone() if sid else None
                if not row or row[0] != who or time.time() - row[1] > 3600:
                    raise PlanError("session_expired", "这次制作已过期，请重新生成", False, 400)
                if row[2] >= MAX_REPAIRS:
                    raise PlanError("repair_exhausted", "已经自动修正过多次仍未通过，请重新生成，或换一份文档", False, 429)
                kind = "repair"  # 修正不计入每日次数；修正次数在成功后才 +1
            else:
                mine = sum(1 for j in active() if j["who"] == who and j["kind"] == "plan")
                if used_today(c, who) + mine >= DAILY_LIMIT:
                    raise PlanError("daily_limit", f"今天的 {DAILY_LIMIT} 次已经用完，请明天再来", False, 429)
                allp = sum(1 for j in active() if j["kind"] == "plan")
                if used_today_all(c) + allp >= GLOBAL_DAILY_LIMIT:
                    raise PlanError("global_limit", "今天全站的制作名额已经用完，请明天再来", False, 429)
                sid = uuid.uuid4().hex
                c.execute("insert into sessions values(?,?,?,0)", (sid, who, time.time()))
                c.commit()
        finally:
            c.close()
        job = {"id": uuid.uuid4().hex, "who": who, "visitor": visitor, "kind": kind, "sid": sid, "chars": chars, "doc": str(req.get("doc_name", ""))[:100],
               "status": "queued", "created": time.time(), "started": None, "finished": None,
               "req": req, "result": None, "done": threading.Event()}
        JOBS[job["id"]] = job
    Q.put(job["id"])
    return job


def position(job):
    if job["status"] != "queued":
        return 0
    return sum(1 for j in JOBS.values() if j["status"] == "queued" and j["created"] < job["created"])


# ---------- 后台：MAX_CONCURRENT 个工人依次处理队列 ----------
def run(job):
    t0 = time.time()
    try:
        content, usage, finish = call_model(make_messages(job["req"]))
        plan = extract_json(content, truncated=(finish == "length"))
        ok, note, perr = 1, f"tokens={usage.get('total_tokens', '')}", None
    except PlanError as e:
        ok, plan, perr = 0, None, e
        note = e.code + ("" if e.__cause__ is None else ":" + type(e.__cause__).__name__)
    except Exception as e:  # noqa  其他意外
        ok, plan, perr = 0, None, PlanError("server_error", MSG_UPSTREAM)
        note = "server_error:" + type(e).__name__
    with lock:
        c = db()
        c.execute("insert into usage values(?,?,?,?,?,?,?,?)", (time.time(), today(), job["who"], job["chars"], job["kind"], ok, round(time.time() - t0, 1), note))
        if ok and job["kind"] == "repair":
            c.execute("update sessions set repairs=repairs+1 where id=?", (job["sid"],))
        c.commit()
        left = max(0, DAILY_LIMIT - used_today(c, job["who"]))
        c.close()
        if ok:
            job["result"] = {"status": "done", "plan": plan, "session_id": job["sid"], "remaining": left, "model": MODEL}
        else:
            job["result"] = dict(perr.body(), status="error", session_id=job["sid"])
        job["status"] = "done" if ok else "error"
        job["finished"] = time.time()
        job["req"] = None  # 用完即丢，不留原文


def worker():
    while True:
        jid = Q.get()
        job = JOBS.get(jid)
        if not job:
            continue
        with lock:
            job["status"], job["started"] = "running", time.time()
        try:
            run(job)
        finally:
            job["done"].set()


def janitor():
    while True:
        time.sleep(30)
        now = time.time()
        with lock:
            for jid in [k for k, j in JOBS.items() if j["finished"] and now - j["finished"] > JOB_TTL]:
                del JOBS[jid]


def status_of(job):
    if job["status"] in ("done", "error"):
        return job["result"]
    s = {"status": job["status"], "secs": round(time.time() - (job["started"] or job["created"]))}
    if job["status"] == "queued":
        s["position"] = position(job)
    return s


class H(BaseHTTPRequestHandler):
    server_version = "ppt-planner"

    def log_message(self, *a):  # 不把请求内容写进日志
        pass

    def cors(self):
        o = self.headers.get("Origin", "")
        if o in ORIGINS:
            self.send_header("Access-Control-Allow-Origin", o)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")

    def reply(self, code, obj):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(b)))
        self.cors()
        self.end_headers()
        self.wfile.write(b)

    def ip(self):
        return (self.headers.get("CF-Connecting-IP") or self.headers.get("X-Real-IP")
                or self.headers.get("X-Forwarded-For", "").split(",")[0].strip() or self.client_address[0])

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.end_headers()

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        path = u.path.rstrip("/")
        if path.endswith("/api/health"):
            with lock:
                a = active()
                return self.reply(200, {"ok": True, "model": MODEL, "key": bool(API_KEY), "daily_limit": DAILY_LIMIT,
                                        "running": sum(1 for j in a if j["status"] == "running"),
                                        "queued": sum(1 for j in a if j["status"] == "queued")})
        m = re.search(r"/api/jobs/([0-9a-f]{32})$", path)
        if m:
            v = urllib.parse.parse_qs(u.query).get("v", [""])[0][:64]
            with lock:
                job = JOBS.get(m.group(1))
                if not job or job["visitor"] != v:
                    return self.reply(404, {"status": "error", "code": "job_lost", "retryable": True,
                                            "error": "这次制作的结果找不到了（可能服务器刚刚重启），请再试一次，不扣次数"})
                return self.reply(200, status_of(job))
        self.reply(404, {"error": "not found"})

    def read_json(self):
        n = int(self.headers.get("Content-Length", "0") or 0)
        if n > 2_000_000:
            raise PlanError("too_large", "文档太大，请拆成几份分别制作", False, 413)
        try:
            return json.loads(self.rfile.read(n).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            raise PlanError("bad_request", "请求格式不对，请刷新页面后重试", False, 400)

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path.rstrip("/")
        try:
            if path.endswith("/api/jobs"):
                job = admit(self.read_json(), self.ip())
                with lock:
                    pos = position(job)
                return self.reply(202, {"job_id": job["id"], "session_id": job["sid"], "position": pos})
            if path.endswith("/api/plan"):  # 旧接口：同步等待结果
                job = admit(self.read_json(), self.ip())
                job["done"].wait(TIMEOUT + 600)
                r = job["result"] or PlanError("server_error", MSG_UPSTREAM).body()
                return self.reply(200 if r.get("status") == "done" else 502, r)
            self.reply(404, {"error": "not found"})
        except PlanError as e:
            self.reply(e.http, e.body())
        except Exception:  # noqa
            self.reply(500, {"error": "服务器出了点问题，请稍后再试", "code": "server_error", "retryable": True})


if __name__ == "__main__":
    db().close()
    for _ in range(MAX_CONCURRENT):
        threading.Thread(target=worker, daemon=True).start()
    threading.Thread(target=janitor, daemon=True).start()
    print(f"ppt-planner on {HOST}:{PORT} model={MODEL} limit={DAILY_LIMIT}/day global={GLOBAL_DAILY_LIMIT}/day "
          f"concurrent={MAX_CONCURRENT} key={'yes' if API_KEY else 'NO'}", flush=True)
    ThreadingHTTPServer((HOST, PORT), H).serve_forever()
