# 生成测试用毛玻璃背景：按矿物配色合成抽象色块 → 模糊 → 玻璃框下局部压暗（算法同规范包 bg3.py）
import sys, json, base64, io
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 1920, 1080
PPI = W / 13.333
LAPIS = np.array([0x12, 0x29, 0x47], float)

def lin(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

def lum(rgb):
    l = lin(rgb)
    return 0.2126 * l[..., 0] + 0.7152 * l[..., 1] + 0.0722 * l[..., 2]

def ratio(a, b):
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)

def darken(a, t):
    t = t[..., None]
    return a * (1 - t) + (a * 0.15 + LAPIS * 0.35) * t

def need(a, f, ok):
    lo = np.zeros(a.shape[:2]); hi = np.ones(a.shape[:2])
    for _ in range(14):
        m = (lo + hi) / 2
        good = ok(lum(f(a, m)))
        hi = np.where(good, m, hi); lo = np.where(good, lo, m)
    return hi

def smooth(t, grow=25, blur=25):
    im = Image.fromarray((t * 255).astype(np.uint8))
    im = im.filter(ImageFilter.MaxFilter(grow | 1)).filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(im, float) / 255

# 1. 抽象「矿石」色块
base = Image.new("RGB", (W, H), (0x12, 0x29, 0x47))
d = ImageDraw.Draw(base)
blobs = [((0x70, 0xC6, 0xD6), (-200, -150, 900, 700)), ((0x1B, 0x66, 0x7A), (700, 100, 1700, 900)),
         ((0x24, 0x5F, 0x4D), (1300, -200, 2200, 600)), ((0xDD, 0xF1, 0xF2), (200, 600, 900, 1200)),
         ((0x31, 0x5F, 0x91), (1100, 650, 2100, 1300)), ((0x70, 0xC6, 0xD6), (1500, 300, 1900, 700))]
for c, box in blobs:
    d.ellipse(box, fill=c)
img = base.filter(ImageFilter.GaussianBlur(120))
a = np.asarray(img, float)
a = darken(a, np.full(a.shape[:2], 0.10))  # 整体压暗约 10%

# 2. 玻璃框下局部压暗，保证白字 ≥ 4.5:1
panels = json.loads(sys.argv[2])
t = smooth(need(a, darken, lambda L: L <= 0.09))
t = np.maximum(t, 0.15)
glass = darken(a, t)
mask = Image.new("L", (W, H), 0)
dr = ImageDraw.Draw(mask)
for x, y, w, h in panels:
    dr.rounded_rectangle([x * PPI, y * PPI, (x + w) * PPI, (y + h) * PPI], radius=0.25 * PPI, fill=255)
m = np.asarray(mask.filter(ImageFilter.GaussianBlur(3)), float)[..., None] / 255
out = (a * (1 - m) + glass * m).clip(0, 255).astype(np.uint8)
buf = io.BytesIO()
Image.fromarray(out).save(buf, "JPEG", quality=88)
open(sys.argv[1], "wb").write(buf.getvalue())

# 对比度报告
o = out.astype(float)
for x, y, w, h in panels:
    i = 0.25
    reg = lum(o[int((y + i) * PPI):int((y + h - i) * PPI), int((x + i) * PPI):int((x + w - i) * PPI)])
    print("panel", (x, y, w, h), "白字对比度", round(ratio(1.0, np.percentile(reg, 99.5)), 2))
print("bytes", len(buf.getvalue()))
