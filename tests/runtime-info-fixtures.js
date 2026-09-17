"use strict";

const fs = require("fs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const main = fs.readFileSync("main.js", "utf8");
const preload = fs.readFileSync("preload.js", "utf8");
const html = fs.readFileSync("src/index.html", "utf8");
const renderer = fs.readFileSync("src/renderer.js", "utf8");

assert(main.includes('ipcMain.handle("app:getRuntimeInfo"'), "runtime IPC is registered");
assert(main.includes("version: VERSION"), "runtime IPC propagates the package-backed VERSION");
assert(main.includes("isPackaged: app.isPackaged"), "runtime IPC uses Electron packaging state");
assert(
  main.includes('channel: app.isPackaged ? "installed" : "development"'),
  "runtime IPC distinguishes installed and development channels"
);
assert(main.includes('ipcMain.handle("app:getVersion"'), "legacy version IPC remains available");
assert(
  preload.includes('getRuntimeInfo: () =>') && preload.includes('ipcRenderer.invoke("app:getRuntimeInfo")'),
  "preload exposes the runtime IPC"
);
assert(html.includes("data-masterforge-runtime"), "persistent navigation runtime target exists");
assert(html.includes("data-masterforge-version"), "Home version target remains available");
assert(renderer.includes("await window.dmAPI.getRuntimeInfo()"), "renderer fetches runtime information once");
assert(renderer.includes("runtime.isPackaged !== false"), "DEV badge follows authoritative packaging state");
assert(renderer.includes("`v${version}`"), "installed and development displays receive the runtime version");
assert(renderer.includes("if (!version) return;"), "missing versions retain the neutral fallback");

console.log("Runtime information fixtures passed.");
