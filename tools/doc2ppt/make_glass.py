# 毛玻璃底图（每套配色一组）：plain = 模糊色块背景（底部压暗保证页脚白字）；dark = 整张按需压暗（玻璃框用 srcRect 裁取对应区域作填充）
# 用法：python3 make_glass.py src/glassbg.js   （读 src/themes.js；天河石沿用 glassbg.js 里已有的底图，不重画）
import io, base64, json, sys, re, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
W, H = 1600, 900
def lin(c):
    c = c / 255.0; return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def lum(a):
    l = lin(a); return 0.2126 * l[..., 0] + 0.7152 * l[..., 1] + 0.0722 * l[..., 2]
def darken(a, t):
    t = t[..., None]; return a * (1 - t) + (a * 0.15 + LAPIS * 0.35) * t
def need(a, ok):
    lo = np.zeros(a.shape[:2]); hi = np.ones(a.shape[:2])
    for _ in range(14):
        m = (lo + hi) / 2; g = ok(lum(darken(a, m))); hi = np.where(g, m, hi); lo = np.where(g, lo, m)
    return hi
def make(TH, blobs=None):
  global LAPIS
  hx = lambda h: tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
  LAPIS = np.array(hx(TH["base"]), float)
  # 色块：主色、深字色、点睛、柔底、深字色、主色（天河石原图用矿物色）
  blobs = blobs or [hx(TH[k]) for k in ("main", "deep", "accent", "soft", "deep", "main")]
  base = Image.new("RGB", (W, H), hx(TH["base"])); d = ImageDraw.Draw(base); s = W / 1920
  for c, b in zip(blobs, [(-200,-150,900,700),(700,100,1700,900),(1300,-200,2200,600),(200,600,900,1200),(1100,650,2100,1300),(1500,300,1900,700)]):
    d.ellipse([v * s for v in b], fill=c)
  a = np.asarray(base.filter(ImageFilter.GaussianBlur(100)), float)
  a = darken(a, np.full(a.shape[:2], 0.10))
  # 页脚区域（底部 0.6 英寸）渐变压暗，白色页脚 ≥ 4.5:1
  ppi = W / 13.333; y0, y1 = int(6.35 * ppi), int(6.9 * ppi)
  tf = need(a[int(6.9 * ppi):], lambda L: L <= 0.15).max()
  ramp = np.clip((np.arange(H) - y0) / (y1 - y0), 0, 1) * tf
  plain = darken(a, np.repeat(ramp[:, None], W, 1))
  t = Image.fromarray((np.maximum(need(a, lambda L: L <= 0.09), 0.15) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(21)).filter(ImageFilter.GaussianBlur(20))
  dark = darken(a, np.maximum(np.asarray(t, float) / 255, 0.15))
  return plain, dark, ppi
def jpg(x):
    b = io.BytesIO(); Image.fromarray(x.clip(0, 255).astype(np.uint8)).save(b, "JPEG", quality=86); return base64.b64encode(b.getvalue()).decode()

out = sys.argv[1]
THEMES = json.loads(re.search(r"const THEMES = (\{.*?\});\n", open(os.path.join(os.path.dirname(out), "themes.js"), encoding="utf8").read(), re.S).group(1))
old = {}
if os.path.exists(out):
    old = json.loads(re.search(r"module\.exports=(.*);", open(out, encoding="utf8").read(), re.S).group(1))
    if "plain" in old: old = {"天河石": old}  # 0.2.x 只有一组底图
res = {}
for name, TH in THEMES.items():
    if name in old: res[name] = old[name]; print(name, "沿用已有底图"); continue
    plain, dark, ppi = make(TH)
    print(name, "白字对比度（玻璃内最亮处）", round(1.05 / (np.percentile(lum(dark), 99.5) + 0.05), 2), "页脚", round(1.05 / (np.percentile(lum(plain[int(6.95*ppi):]), 99.5) + 0.05), 2))
    res[name] = {"plain": jpg(plain), "dark": jpg(dark)}
open(out, "w", encoding="utf8").write("module.exports=" + json.dumps(res, ensure_ascii=False) + ";\n")
