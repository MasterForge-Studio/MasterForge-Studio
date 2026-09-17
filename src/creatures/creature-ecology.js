(() => {
  "use strict";

  const VERSION = 1;
  const NARRATIVE_FIELDS = Object.freeze(["behaviour", "temperament", "diet", "socialStructure", "activityCycle", "reproductiveNotes", "ecologyNotes"]);
  const HABITAT_FIELDS = Object.freeze(["biomes", "terrain", "climate", "elevation", "waterProximity", "temperature", "humidity", "settlementProximity", "activityPeriod", "seasonality"]);

  function isPlainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
  function cloneValue(value) {
    if (Array.isArray(value)) return value.map(cloneValue);
    if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]));
    return value;
  }
  function normaliseString(value) { return typeof value === "string" ? value : ""; }
  function normaliseStringArray(value) { return Array.isArray(value) ? value.filter(item => typeof item === "string").map(item => item.trim()).filter(Boolean) : []; }

  function createDefaultCreatureEcology() {
    return {
      version: VERSION,
      behaviour: "", temperament: "", diet: "", socialStructure: "",
      activityCycle: "", reproductiveNotes: "", ecologyNotes: "",
      habitatPreferences: Object.fromEntries(HABITAT_FIELDS.map(key => [key, []]))
    };
  }

  function normaliseCreatureEcology(value) {
    const source = isPlainObject(value) ? value : {};
    const habitatSource = isPlainObject(source.habitatPreferences) ? source.habitatPreferences : {};
    const result = cloneValue(source);
    result.version = Number.isFinite(Number(source.version)) ? Number(source.version) : VERSION;
    NARRATIVE_FIELDS.forEach(key => { result[key] = normaliseString(source[key]); });
    result.habitatPreferences = cloneValue(habitatSource);
    HABITAT_FIELDS.forEach(key => { result.habitatPreferences[key] = normaliseStringArray(habitatSource[key]); });
    return result;
  }

  function cloneCreatureEcology(value) { return normaliseCreatureEcology(value); }

  const api = Object.freeze({ VERSION, NARRATIVE_FIELDS, HABITAT_FIELDS, createDefaultCreatureEcology, normaliseCreatureEcology, cloneCreatureEcology });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.MasterForgeCreatureEcology = api;
})();
