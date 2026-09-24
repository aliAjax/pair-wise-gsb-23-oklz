import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import App from "../src/App";

const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const html = renderToStaticMarkup(React.createElement(App));
const checks = [
  "洁净室擦拭放行看板",
  "放行看板",
  "采样台账",
  "资料维护",
  "CR-1201",
  "CR-2203",
  "CR-3105",
  "CR-4302",
  "已放行",
  "待处理",
  "待采样",
];
let failed = 0;
for (const c of checks) {
  if (!html.includes(c)) { console.error("缺少内容:", c); failed++; }
  else console.log("✓ 含", c);
}
console.log(failed === 0 ? `SSR 冒烟通过（${html.length} 字符）` : `SSR 冒烟失败 ${failed} 项`);
process.exit(failed === 0 ? 0 : 1);
