// 浏览器入口：window.Doc2PPT
const { parseData } = require("./parse.js");
const { check, build, applyCorrections } = require("./core.js");
const { makeReport } = require("./report.js");
const { VERSION } = require("./version.js");
window.Doc2PPT = {
  VERSION, parseData, check, applyCorrections,
  build: (doc, plan) => build(doc, plan, { browser: true }),
  report: (doc, plan, fileName, warns) => makeReport(doc, plan, fileName, warns, VERSION),
};
