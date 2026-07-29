"use strict";

const fs = require("fs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const main = fs.readFileSync("main.js", "utf8");
const preload = fs.readFileSync("preload.js", "utf8");
const renderer = fs.readFileSync("src/renderer.js", "utf8");

const occurrences = (source, token) => source.split(token).length - 1;

assert(
  preload.includes('downloadUpdate: () =>') &&
    preload.includes('ipcRenderer.invoke("updater:download")'),
  "preload download bridge matches updater IPC"
);
assert(
  preload.includes('openUpdateDownloadPage: () =>') &&
    preload.includes('ipcRenderer.invoke("updater:openDownloadPage")'),
  "preload browser fallback bridge matches updater IPC"
);
assert(
  occurrences(main, '"updater:download"') === 1,
  "updater download IPC has exactly one main handler"
);
assert(
  occurrences(main, '"updater:openDownloadPage"') === 1,
  "updater browser fallback IPC has exactly one main handler"
);
assert(
  main.includes("return await downloadAutomaticUpdate();"),
  "download IPC uses electron-updater primary path"
);
assert(
  main.includes("configureAutomaticUpdater();"),
  "electron-updater event logging and state publication are initialised"
);
[
  "checking-for-update",
  "update-available",
  "download-progress",
  "update-downloaded",
  '"error"'
].forEach(event => assert(main.includes(event), `updater event is wired: ${event}`));
assert(
  main.includes("await shell.openExternal(fallbackUrl)"),
  "automatic download failure opens confirmed browser fallback"
);
assert(
  main.includes('error?.name === "CancellationError"') &&
    main.includes("updaterDownloadCancelled = true"),
  "user cancellation does not trigger the browser fallback"
);
assert(
  renderer.includes('message: "Starting update download…"'),
  "renderer immediately shows an active download request"
);
assert(
  renderer.includes("Install and Restart"),
  "downloaded state exposes Install and Restart"
);
assert(
  renderer.includes('data-update-action="open-browser"'),
  "failed state exposes manual browser fallback"
);

console.log("Updater IPC fixtures passed.");
