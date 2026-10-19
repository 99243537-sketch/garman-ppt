"""天然矿物色 PPT 讲稿制作 · 分页方案服务（ppt-planner）

只用 Python 标准库。浏览器把文档拆成段落后发来，本服务调用 MiniMax 生成「分页方案」JSON 并原样返回。
- 不保存文档内容；用量库只记时间、访客、字数、耗时、是否成功。
- 每个访客（IP + visitor_id）每天 DAILY_LIMIT 次；同一份文档校验不通过时，可凭 session_id 免费修正 MAX_REPAIRS 次。

接口（Nginx 把 /ppt-api/ 转到本服务）：
  GET  /api/health
  POST /api/plan   {visitor_id, style, doc_name, paras:[{id,text,level}], session_id?, previous_plan?, errors?}
"""
import json, os, re, sqlite3, time, uuid, hashlib, threading, urllib.request, urllib.error
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
API_KEY = os.environ.get("MINIMAX_API_KEY", "")
API_BASE = os.environ.get("MINIMAX_BASE", "https://api.minimaxi.com/v1").rstrip("/")
MODEL = os.environ.get("MINIMAX_MODEL", "MiniMax-M2.7")
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8790"))
DAILY_LIMIT = int(os.environ.get("DAILY_LIMIT", "5"))
MAX_REPAIRS = int(os.environ.get("MAX_REPAIRS", "2"))
MAX_DOC_CHARS = int(os.environ.get("MAX_DOC_CHARS", "30000"))
MAX_OUTPUT_TOKENS = int(os.environ.get("MAX_OUTPUT_TOKENS", "24000"))
TIMEOUT = int(os.environ.get("REQUEST_TIMEOUT", "180"))
ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "https://www.zhaodun.work,https://zhaodun.work").split(",") if o.strip()]
DB = os.environ.get("USAGE_DB", str(HERE / "usage.db"))
PROMPT = (HERE / "prompt.md").read_text(encoding="utf-8")
lock = threading.Lock()


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


class PlanError(Exception):
    """给学员看的中文错误；code 供前端判断是否自动重试"""
    def __init__(self, code, msg, retryable=True):
        super().__init__(msg)
        self.code, self.msg, self.retryable = code, msg, retryable


MSG_PARSE = "大模型这次没有给出完整的分页方案，请再试一次"
MSG_TRUNC = "文档较长，大模型这次没写完分页方案，请再试一次；多次失败可以把文档拆成两份"
MSG_UPSTREAM = "大模型服务暂时不可用，请稍后再试"


def extract_json(text, truncated=False):
    text = re.sub(r"<think>[\s\S]*?</think>", "", text)
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    a, b = text.find("{"), text.rfind("}")
    if a < 0 or b <= a:
        raise PlanError("plan_truncated" if truncated else "plan_parse_failed", MSG_TRUNC if truncated else MSG_PARSE)
    raw = text[a:b + 1]
    for cand in (raw, re.sub(r",\s*([}\]])", r"\1", raw)):  # 第二次去掉多余的结尾逗号再试
        try:
            plan = json.loads(cand)
            if isinstance(plan, dict) and isinstance(plan.get("slides"), list):
                return plan
        except json.JSONDecodeError:
            pass
    raise PlanError("plan_truncated" if truncated else "plan_parse_failed", MSG_TRUNC if truncated else MSG_PARSE)


def call_model(messages):
    body = json.dumps({"model": MODEL, "messages": messages, "max_tokens": MAX_OUTPUT_TOKENS, "temperature": 1.0}).encode()
    req = urllib.request.Request(API_BASE + "/chat/completions", data=body, method="POST",
                                 headers={"Authorization": "Bearer " + API_KEY, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            data = json.loads(r.read().decode())
    except Exception as e:  # 网络、超时、HTTP 错误
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
        msgs.append({"role": "assistant", "content": json.dumps(req["previous_plan"], ensure_ascii=False)})
        msgs.append({"role": "user", "content": "程序校验没有通过，问题如下。请只修改有问题的地方，其余保持不变，然后输出完整的 JSON：\n- " + "\n- ".join(req["errors"][:30])})
    return msgs


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
        self.send_header("Content-Length", str(len(b)))
        self.cors()
        self.end_headers()
        self.wfile.write(b)

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.end_headers()

    def do_GET(self):
        if self.path.rstrip("/").endswith("/api/health"):
            return self.reply(200, {"ok": True, "model": MODEL, "daily_limit": DAILY_LIMIT, "key": bool(API_KEY)})
        self.reply(404, {"error": "not found"})

    def do_POST(self):
        if not self.path.rstrip("/").endswith("/api/plan"):
            return self.reply(404, {"error": "not found"})
        t0 = time.time()
        try:
            n = int(self.headers.get("Content-Length", "0"))
            if n > 2_000_000:
                return self.reply(413, {"error": "文档太大", "code": "too_large", "retryable": False})
            req = json.loads(self.rfile.read(n).decode())
            paras = req.get("paras") or []
            if not paras or not all(isinstance(p, dict) and "id" in p and "text" in p for p in paras):
                return self.reply(400, {"error": "没有读到文档段落", "code": "empty", "retryable": False})
            chars = sum(len(p["text"]) for p in paras)
            if chars > MAX_DOC_CHARS:
                return self.reply(400, {"error": f"文档太长（{chars} 字），目前最多支持 {MAX_DOC_CHARS} 字", "code": "too_long", "retryable": False})
            ip = self.headers.get("X-Real-IP") or self.headers.get("X-Forwarded-For", "").split(",")[0].strip() or self.client_address[0]
            who = who_of(ip, str(req.get("visitor_id", ""))[:64])
            with lock:
                c = db()
                sid, kind = req.get("session_id"), "plan"
                if req.get("errors"):
                    row = c.execute("select who, ts, repairs from sessions where id=?", (sid,)).fetchone() if sid else None
                    if not row or row[0] != who or time.time() - row[1] > 3600:
                        return self.reply(400, {"error": "这次制作已过期，请重新生成", "code": "session_expired", "retryable": False})
                    if row[2] >= MAX_REPAIRS:
                        return self.reply(429, {"error": "已经自动修正过多次仍未通过，请重新生成，或换一份文档", "code": "repair_exhausted", "retryable": False})
                    kind = "repair"  # 修正次数在成功后才 +1，失败不占用
                else:
                    if used_today(c, who) >= DAILY_LIMIT:
                        return self.reply(429, {"error": f"今天的 {DAILY_LIMIT} 次已经用完，请明天再来", "code": "daily_limit", "retryable": False})
                    sid = uuid.uuid4().hex
                    c.execute("insert into sessions values(?,?,?,0)", (sid, who, time.time()))
                c.commit()
                c.close()
            if not API_KEY:
                return self.reply(500, {"error": "服务器还没配置好，请联系网站管理员", "code": "server_config", "retryable": False})
            perr = None
            try:
                content, usage, finish = call_model(make_messages(req))
                plan = extract_json(content, truncated=(finish == "length"))
                ok, note = 1, f"tokens={usage.get('total_tokens', '')}"
            except PlanError as e:
                ok, plan, perr = 0, None, e
                note = e.code + ("" if e.__cause__ is None else ":" + type(e.__cause__).__name__)
            except Exception as e:  # noqa  其他意外
                ok, plan, perr = 0, None, PlanError("server_error", MSG_UPSTREAM)
                note = "server_error:" + type(e).__name__
            with lock:
                c = db()
                c.execute("insert into usage values(?,?,?,?,?,?,?,?)", (time.time(), today(), who, chars, kind, ok, round(time.time() - t0, 1), note))
                if ok and kind == "repair":
                    c.execute("update sessions set repairs=repairs+1 where id=?", (sid,))
                c.commit()
                left = max(0, DAILY_LIMIT - used_today(c, who))
                c.close()
            if not ok:
                return self.reply(502, {"error": perr.msg, "code": perr.code, "retryable": perr.retryable, "session_id": sid})
            self.reply(200, {"plan": plan, "session_id": sid, "remaining": left, "model": MODEL})
        except json.JSONDecodeError:
            self.reply(400, {"error": "请求格式不对，请刷新页面后重试", "code": "bad_request", "retryable": False})
        except Exception:  # noqa
            self.reply(500, {"error": "服务器出了点问题，请稍后再试", "code": "server_error", "retryable": True})


if __name__ == "__main__":
    db().close()
    print(f"ppt-planner on {HOST}:{PORT} model={MODEL} limit={DAILY_LIMIT}/day key={'yes' if API_KEY else 'NO'}", flush=True)
    ThreadingHTTPServer((HOST, PORT), H).serve_forever()
