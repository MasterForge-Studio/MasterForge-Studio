// =====================================================
// MasterForge Studio
// Main-process input guards (no Electron dependency, so they can be
// unit-tested with plain Node: see tests/main-guards-fixtures.js).
// =====================================================

const fs = require("fs");
const path = require("path");
const { fileURLToPath } = require("url");

// Keys the renderer may change through theme:saveSettings. Everything else in
// settings.json (dataPath, dataPathSelectionMode, window bounds, updater
// reminders) is owned by the main process.
const THEME_SETTING_KEYS = Object.freeze([
  "themeMode",
  "manualTheme",
  "locationThemes",
  "backgroundOpacity",
  "menusHidden",
]);

const MAX_THEME_ID_LENGTH = 120;
const MAX_LOCATION_THEMES = 500;

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function cleanThemeId(value) {
  return typeof value === "string" && value.length <= MAX_THEME_ID_LENGTH
    ? value
    : undefined;
}

// Returns only the recognised, type-checked theme keys from renderer input.
function pickThemeSettings(input) {
  if (!isPlainObject(input)) return {};
  const picked = {};

  if (typeof input.themeMode === "string" && input.themeMode.length <= 40) {
    picked.themeMode = input.themeMode;
  }

  const manualTheme = cleanThemeId(input.manualTheme);
  if (manualTheme !== undefined) picked.manualTheme = manualTheme;

  if (isPlainObject(input.locationThemes)) {
    const entries = Object.entries(input.locationThemes)
      .filter(([key, value]) =>
        typeof key === "string" &&
        key.length <= MAX_THEME_ID_LENGTH &&
        cleanThemeId(value) !== undefined)
      .slice(0, MAX_LOCATION_THEMES);
    picked.locationThemes = Object.fromEntries(entries);
  }

  const opacity = Number(input.backgroundOpacity);
  if (input.backgroundOpacity !== undefined && Number.isFinite(opacity)) {
    picked.backgroundOpacity = Math.min(1, Math.max(0, opacity));
  }

  if (typeof input.menusHidden === "boolean") picked.menusHidden = input.menusHidden;

  return picked;
}

// Resolves relativePath inside basePath and refuses anything that escapes it,
// including through an existing symlink or junction.
function safePath(basePath, relativePath) {
  if (typeof relativePath !== "string" || relativePath.includes("\0")) {
    throw new Error("A relative data path is required.");
  }

  const resolvedBase = path.resolve(basePath);
  const resolved = path.resolve(resolvedBase, relativePath);

  if (resolved !== resolvedBase && !resolved.startsWith(resolvedBase + path.sep)) {
    throw new Error(`Path traversal blocked: ${relativePath}`);
  }

  // Compare real paths for the deepest part that already exists, so a link
  // inside the data folder cannot point the write somewhere else.
  const realBase = fs.existsSync(resolvedBase) ? fs.realpathSync(resolvedBase) : resolvedBase;
  let existing = resolved;
  while (!fs.existsSync(existing) && existing !== resolvedBase) {
    const parent = path.dirname(existing);
    if (parent === existing) break;
    existing = parent;
  }
  if (fs.existsSync(existing)) {
    const realExisting = fs.realpathSync(existing);
    if (realExisting !== realBase && !realExisting.startsWith(realBase + path.sep)) {
      throw new Error(`Path traversal blocked: ${relativePath}`);
    }
  }

  return resolved;
}

function assertJsonPath(relativePath) {
  if (typeof relativePath !== "string" || path.extname(relativePath).toLowerCase() !== ".json") {
    throw new Error("Only .json data files can be written.");
  }
  return relativePath;
}

// Hosts the app may open in the user's browser for a manual installer download.
const DOWNLOAD_HOSTS = Object.freeze([
  "github.com",
  "masterforgestudio.com",
  "www.masterforgestudio.com",
]);

function isAllowedDownloadUrl(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  return DOWNLOAD_HOSTS.includes(url.hostname.toLowerCase());
}

// True only for file: URLs inside the app's own folder (the src directory).
function isAppFileUrl(value, appRoot) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    return false;
  }
  if (url.protocol !== "file:") return false;
  let filePath;
  try {
    filePath = path.resolve(fileURLToPath(url));
  } catch {
    return false;
  }
  const root = path.resolve(appRoot);
  return filePath.startsWith(root + path.sep);
}

// Browser permissions the renderer is allowed to use; everything else is denied.
const ALLOWED_PERMISSIONS = Object.freeze(["clipboard-sanitized-write"]);

function isAllowedPermission(permission) {
  return ALLOWED_PERMISSIONS.includes(permission);
}

module.exports = {
  THEME_SETTING_KEYS,
  DOWNLOAD_HOSTS,
  pickThemeSettings,
  safePath,
  assertJsonPath,
  isAllowedDownloadUrl,
  isAppFileUrl,
  isAllowedPermission,
};
