# 测试技能的源码

- `probe.js`：测试脚本源码；`bg.js`（毛玻璃背景 base64）由 `make_bg.py` 生成。
- 打包：`python3 make_bg.py bg.jpg '<玻璃框坐标 JSON>'` → 生成 `bg.js` → `esbuild probe.js --bundle --platform=node --target=node16 --format=cjs --outfile=probe.cjs`
- 产物放到 `skill-probe/garman-ppt-probe/scripts/probe.cjs`。
