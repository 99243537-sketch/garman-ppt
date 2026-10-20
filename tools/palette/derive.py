# Garman 自然色 · 推色脚本
# 每套配色只给三个色相（主色、点睛、深底）和少量参数，其余颜色按 Garman 结构推出，并检查对比度。
# 用法：python3 derive.py ../doc2ppt/src/themes.js
import math, json, sys

def lin(c): return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def gam(c): return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
def oklch2rgb(L, C, h):
    a, b = C * math.cos(math.radians(h)), C * math.sin(math.radians(h))
    l_ = L + 0.3963377774 * a + 0.2158037573 * b; m_ = L - 0.1055613458 * a - 0.0638541728 * b; s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    return (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
def hexof(L, C, h):
    while True:  # 超出色域就降彩度
        r = oklch2rgb(L / 100, C, h)
        if all(-1e-4 <= x <= 1.0001 for x in r) or C <= 0: break
        C -= 0.002
    return "".join("%02X" % round(max(0, min(1, gam(max(0, x)))) * 255) for x in r)
def Y(hx): r, g, b = [lin(int(hx[i:i + 2], 16) / 255) for i in (0, 2, 4)]; return 0.2126 * r + 0.7152 * g + 0.0722 * b
def cr(a, b): ya, yb = sorted([Y(a), Y(b)]); return (yb + 0.05) / (ya + 0.05)

# 明度骨架（OKLCH 明度）：浅底 97、柔底 94、主色 78、深字 48、深底 28、正文 31、灰字 50、分隔线 86
def derive(H, A, B, cm=0.09, ca=0.14, cb=0.065, Lm=78):
    pale = hexof(97, 0.010, H); La = 54
    while cr(hexof(La, ca, A), pale) < 4.6: La -= 1  # 点睛色太亮就压暗，保证结论文字可读
    return {"main": hexof(Lm, cm, H), "soft": hexof(94, 0.021, H), "pale": pale, "deep": hexof(48, 0.08, H),
            "base": hexof(28, cb, B), "accent": hexof(La, ca, A), "white": "FFFFFF",
            "ink": hexof(31, 0.02, H), "muted": hexof(50, 0.025, H), "line": hexof(86, 0.014, H)}

CHECKS = [("正文/浅底", "ink", "pale", 7), ("标题/浅底", "base", "pale", 7), ("眉题/浅底", "deep", "pale", 4.5),
          ("结论/浅底", "accent", "pale", 4.5), ("页脚/浅底", "muted", "pale", 4.5), ("封面标题/主色", "base", "main", 4.5),
          ("章节标题/深底", "white", "base", 7), ("章节编号/深底", "main", "base", 3)]

# 名称: (类别, 档位, 气质与适用, 推色参数)；天河石为 v2.3 原值，不推
THEMES = {
  "天河石": ("矿物", "雅致", "青蓝配钒铅矿橙红，冷静理性；默认，适合工作汇报、公文", None),
  "鹦鹉螺": ("贝壳", "雅致", "象牙米白配赭红，中性温和；适合人文、历史、任何不想抢眼的场合", dict(H=85, A=35, B=260, cm=0.04, ca=0.13, cb=0.008, Lm=80)),
  "鲍鱼壳": ("贝壳", "雅致", "珠光蓝绿配虹彩紫，清新；适合科技、海洋、环保", dict(H=195, A=310, B=60, cm=0.085, ca=0.14, cb=0.035)),
  "翠鸟":   ("鸟类", "鲜明", "明亮天蓝配栗橙，响亮有活力；适合教学、活动、少儿", dict(H=238, A=50, B=255, cm=0.13, cb=0.07, Lm=76)),
  "红嘴蓝鹊": ("鸟类", "鲜明", "宝蓝配红嘴，醒目；适合宣传、活动", dict(H=268, A=28, B=268, cm=0.11, cb=0.06, Lm=76)),
  "鸢尾":   ("花卉", "雅致", "淡紫配姜黄，柔和优雅；适合文艺、艺术、读书", dict(H=305, A=85, B=295)),
  "梅花":   ("花卉", "雅致", "梅粉配苔青、墨枝深底，温婉；适合节庆、冬季、传统文化", dict(H=355, A=160, B=350, cb=0.015)),
  "栾树":   ("果实", "雅致", "珊瑚粉配叶绿、林荫墨绿，温暖有生气；适合社区、民生、秋季", dict(H=31, A=140, B=145, cm=0.10, ca=0.13, cb=0.07)),
  "槭枫":   ("树叶", "雅致", "枫红橙配松绿，热烈而沉稳；适合年终总结、秋季", dict(H=38, A=170, B=25, cm=0.11, cb=0.06)),
  "乌桕":   ("树叶", "雅致", "杏橙配秋空蓝、枝干深底，明朗；适合乡村、文旅、秋季", dict(H=55, A=243, B=70, cm=0.10, ca=0.12, cb=0.015)),
  "黄金宝螺": ("贝壳", "鲜明", "赤橙配紫晕，饱满喜庆；适合庆典、活动", dict(H=45, A=320, B=40, cm=0.15, cb=0.008, Lm=76)),
  "银杏":   ("树叶", "鲜明", "金黄配秋空蓝，明亮温暖；适合校园、秋季", dict(H=95, A=260, B=75, cm=0.15, cb=0.02, Lm=86)),
  "吉丁虫": ("昆虫", "雅致", "豆绿配紫红，自然清新；适合农业、健康、环保", dict(H=130, A=350, B=165)),
}
V23 = {"main": "70C6D6", "soft": "DDF1F2", "pale": "EFF8F9", "deep": "1B667A", "base": "122947", "accent": "B04D2F", "white": "FFFFFF", "ink": "243335", "muted": "53686A", "line": "C8D5D4"}

out, ok = {}, True
for name, (kind, tier, desc, p) in THEMES.items():
    P = dict(V23) if p is None else derive(**p)
    bad = [f"{n} {cr(P[a], P[b]):.1f}" for n, a, b, m in CHECKS if cr(P[a], P[b]) < m]
    print(f"{name:5s} {tier} 主{P['main']} 点睛{P['accent']} 深底{P['base']}", "对比度全部达标" if not bad else "✗ " + "、".join(bad))
    ok = ok and not bad
    out[name] = {"kind": kind, "tier": tier, "desc": desc, **P}
if not ok: sys.exit("有配色对比度不达标")
js = "// Garman 自然色：由 tools/palette/derive.py 生成，请勿手改\n// 角色：main 主色 / soft 柔底 / pale 浅底 / deep 深字 / base 深底 / accent 点睛 / ink 正文 / muted 灰字 / line 分隔线\n"
js += "const THEMES = " + json.dumps(out, ensure_ascii=False, indent=1) + ";\nconst DEFAULT_THEME = \"天河石\";\nmodule.exports = { THEMES, DEFAULT_THEME };\n"
open(sys.argv[1], "w", encoding="utf8").write(js)
