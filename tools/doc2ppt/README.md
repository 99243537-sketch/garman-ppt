# doc2ppt 源码

- `src/cli.js`：命令入口（parse / check / build）
- `src/parse.js`：读 .docx / .md / .txt，合并 PDF 断行、清理多余空格，段落编号 P001…
- `src/core.js`：分页方案校验（摘句逐字、备注全覆盖、字数能否放下）+ 排版生成
- `src/themes.js`：13 套 Garman 自然色（由 `tools/palette/derive.py` 生成，勿手改）
- `src/glassbg.js`：每套配色的毛玻璃底图（由 `python3 make_glass.py src/glassbg.js` 生成，天河石沿用原图）
- `src/post.js`：主题色、中文字体、组合讲解单元、讲课动画时间轴

打包（无需联网安装依赖时，用环境里已有的 esbuild、pptxgenjs、jszip）：

```
esbuild src/cli.js --bundle --platform=node --target=node16 --format=cjs --outfile=../../skill/garman-ppt/scripts/doc2ppt.cjs
```
