(() => {
  "use strict";

  const FACTION_LORE_VERSION = 1;
  const PUBLIC_DEFAULTS = Object.freeze({
    identity: "", symbol: "", symbolImage: "", motto: "", concept: "", goals: Object.freeze([]),
    motivation: "", methods: Object.freeze([]), structure: "",
    internalTensions: Object.freeze([]), resources: Object.freeze([]), history: "",
    founding: "", turningPoints: Object.freeze([]), currentTrajectory: "",
    currentStatus: "", playerHooks: Object.freeze([])
  });
  const GM_DEFAULTS = Object.freeze({
    secrets: Object.freeze([]), hiddenGoals: Object.freeze([]),
    hiddenHistory: "", futurePlans: ""
  });

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function cloneValue(value) {
    if (Array.isArray(value)) return value.map(cloneValue);
    if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]));
    return value;
  }

  function normaliseString(value) {
    return typeof value === "string" ? value : "";
  }

  function normaliseStringArray(value) {
    return Array.isArray(value) ? value.filter(item => typeof item === "string") : [];
  }

  function normaliseSection(rawSection, defaults) {
    const source = isPlainObject(rawSection) ? rawSection : {};
    const result = cloneValue(source);
    Object.entries(defaults).forEach(([key, fallback]) => {
      result[key] = Array.isArray(fallback)
        ? normaliseStringArray(source[key])
        : normaliseString(source[key]);
    });
    return result;
  }

  function getDefaultFactionLore() {
    return {
      version: FACTION_LORE_VERSION,
      public: normaliseSection({}, PUBLIC_DEFAULTS),
      gm: normaliseSection({}, GM_DEFAULTS)
    };
  }

  function normaliseFactionLore(rawLore) {
    const source = isPlainObject(rawLore) ? rawLore : {};
    return {
      ...cloneValue(source),
      version: Number.isFinite(Number(source.version)) ? Number(source.version) : FACTION_LORE_VERSION,
      public: normaliseSection(source.public, PUBLIC_DEFAULTS),
      gm: normaliseSection(source.gm, GM_DEFAULTS)
    };
  }

  function copyFactionLore(lore) {
    return normaliseFactionLore(lore);
  }

  function projectFactionLore(rawLore, { visibilityMode = "public" } = {}) {
    const lore = normaliseFactionLore(rawLore);
    const projection = { version: lore.version, public: cloneValue(lore.public) };
    if (visibilityMode === "gm") projection.gm = cloneValue(lore.gm);
    return projection;
  }

  const api = Object.freeze({ FACTION_LORE_VERSION, getDefaultFactionLore, normaliseFactionLore, copyFactionLore, projectFactionLore });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.MasterForgeFactionLore = api;
})();
