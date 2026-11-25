"use strict";

// Security guards for the main process: settings allow-list, data-folder
// containment, JSON-only writes, download hosts, navigation and permissions.
// Run from anywhere: node tests/main-guards-fixtures.js

const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.join(__dirname, "..");
const guards = require(path.join(root, "src", "security", "main-guards.js"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function throws(fn, message) {
  let threw = false;
  try { fn(); } catch { threw = true; }
  assert(threw, message);
}

// --- theme settings allow-list ------------------------------------------
const picked = guards.pickThemeSettings({
  themeMode: "manual",
  manualTheme: "gothic-mists",
  backgroundOpacity: 4,
  menusHidden: true,
  locationThemes: { Chult: "lost-jungle-isle", Bad: 42 },
  dataPath: "C:\\Users\\Someone\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup",
  dataPathSelectionMode: "user-selected",
  windowBounds: { x: 0 }
});
assert(!("dataPath" in picked), "theme settings never carry dataPath");
assert(!("dataPathSelectionMode" in picked), "theme settings never carry dataPathSelectionMode");
assert(!("windowBounds" in picked), "theme settings drop unrelated keys");
assert(picked.manualTheme === "gothic-mists" && picked.themeMode === "manual", "theme keys are kept");
assert(picked.backgroundOpacity === 1, "opacity is clamped to 0..1");
assert(picked.menusHidden === true, "menusHidden boolean kept");
assert(picked.locationThemes.Chult === "lost-jungle-isle" && !("Bad" in picked.locationThemes), "location themes keep string values only");
assert(Object.keys(guards.pickThemeSettings(null)).length === 0, "null input gives no settings");
assert(Object.keys(guards.pickThemeSettings(["dataPath"])).length === 0, "array input gives no settings");

// --- JSON-only writes -------------------------------------------------------
assert(guards.assertJsonPath("players/index.json") === "players/index.json", ".json paths allowed");
throws(() => guards.assertJsonPath("x.bat"), ".bat writes refused");
throws(() => guards.assertJsonPath("startup.json.cmd"), "double extension refused");
throws(() => guards.assertJsonPath(null), "non-string path refused");

// --- data-folder containment -----------------------------------------------
const base = fs.mkdtempSync(path.join(os.tmpdir(), "mf-guards-"));
const outside = fs.mkdtempSync(path.join(os.tmpdir(), "mf-outside-"));
try {
  fs.mkdirSync(path.join(base, "players"));
  assert(guards.safePath(base, "players/index.json") === path.join(base, "players", "index.json"), "normal path resolves inside base");
  assert(guards.safePath(base, "") === path.resolve(base), "empty path is the base folder");
  throws(() => guards.safePath(base, "../escape.json"), "parent traversal refused");
  throws(() => guards.safePath(base, path.join(outside, "x.json")), "absolute path outside refused");
  throws(() => guards.safePath(base, "a\0b.json"), "NUL byte refused");

  let linked = false;
  try {
    fs.symlinkSync(outside, path.join(base, "link"), "junction");
    linked = true;
  } catch {
    console.log("SKIP junction check (could not create a junction here)");
  }
  if (linked) {
    throws(() => guards.safePath(base, "link/evil.json"), "junction pointing outside the data folder refused");
  }
} finally {
  fs.rmSync(base, { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });
}

// --- download host allow-list ----------------------------------------------
assert(guards.isAllowedDownloadUrl("https://github.com/MasterForge-Studio/MasterForge-Studio/releases/download/v0.3.6-alpha/MasterForge-Studio-Setup-0.3.6-alpha-x64.exe"), "GitHub release URL allowed");
assert(guards.isAllowedDownloadUrl("https://masterforgestudio.com/alpha-download/"), "MasterForge site allowed");
assert(!guards.isAllowedDownloadUrl("http://github.com/x"), "plain http refused");
assert(!guards.isAllowedDownloadUrl("https://evil.example/installer.exe"), "unknown host refused");
assert(!guards.isAllowedDownloadUrl("https://github.com.evil.example/x"), "look-alike host refused");
assert(!guards.isAllowedDownloadUrl("https://user:pass@github.com/x"), "credentials in URL refused");
assert(!guards.isAllowedDownloadUrl("file:///C:/Windows/System32/calc.exe"), "file URL refused");
assert(!guards.isAllowedDownloadUrl(""), "empty URL refused");

// --- navigation ----------------------------------------------------------
const appRoot = path.join(root, "src");
assert(guards.isAppFileUrl(pathToFileURL(path.join(appRoot, "index.html")).href, appRoot), "app page allowed");
assert(guards.isAppFileUrl(pathToFileURL(path.join(appRoot, "activation.html")).href + "#x", appRoot), "app page with hash allowed");
assert(!guards.isAppFileUrl("https://masterforgestudio.com/", appRoot), "remote navigation refused");
assert(!guards.isAppFileUrl(pathToFileURL(path.join(os.tmpdir(), "evil.html")).href, appRoot), "local file outside the app refused");
assert(!guards.isAppFileUrl("javascript:alert(1)", appRoot), "javascript URL refused");

// --- permissions ---------------------------------------------------------
assert(guards.isAllowedPermission("clipboard-sanitized-write"), "clipboard write allowed");
for (const permission of ["media", "geolocation", "notifications", "openExternal", "fullscreen"]) {
  assert(!guards.isAllowedPermission(permission), `${permission} refused`);
}

// --- wiring in main.js ---------------------------------------------------
const main = fs.readFileSync(path.join(root, "main.js"), "utf8");
assert(main.includes("...pickThemeSettings(themeSettings)"), "theme:saveSettings uses the allow-list");
assert(main.includes("assertJsonPath(relativePath)"), "file:writeJson is limited to .json");
assert(main.includes("setWindowOpenHandler") && main.includes('action: "deny"'), "new windows denied");
assert(main.includes('"will-navigate"'), "navigation guard installed");
assert(main.includes("setPermissionRequestHandler"), "permission handler installed");
assert(main.includes("isAllowedDownloadUrl(fallbackUrl)") && main.includes("isAllowedDownloadUrl(downloadUrl)"), "both browser download paths use the host allow-list");
assert(main.includes("chosenContentPackPath"), "content-pack install limited to the dialog choice");
assert(!/function safePath\(/.test(main), "main.js uses the shared safePath guard");

console.log("Main-process guard fixtures passed.");
