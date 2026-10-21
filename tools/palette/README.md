# Garman 自然色 · 推色脚本

`derive.py` 按《Garman 色彩规范 v3》（docs/Garman色彩规范-v3.md）推出每套配色的 10 个角色色，检查对比度，生成 `tools/doc2ppt/src/themes.js`：

```
python3 derive.py ../doc2ppt/src/themes.js
```

生成后按 `tools/doc2ppt/README.md` 重新打包 `skill/garman-ppt/scripts/doc2ppt.cjs`。
