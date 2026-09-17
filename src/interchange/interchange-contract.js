(() => {
  "use strict";

  const INTERCHANGE_MANIFEST_VERSION = 1;
  const EXTERNAL_PROVENANCE_VERSION = 1;
  const SOURCE_SYSTEM_MASTERFORGE_ATLAS = "masterforge-atlas";
  const SUPPORTED_EXTERNAL_ENTITY_TYPES = Object.freeze([
    "world", "region", "location", "settlement", "landmark", "route", "territory", "biome", "environment", "lair", "site",
    "npc", "creature", "faction", "item", "resource", "hazard", "quest", "encounter", "party"
  ]);

  function validateManifestVersion(value) {
    const version = Number(value);
    return version === INTERCHANGE_MANIFEST_VERSION
      ? { valid: true, version, errors: [] }
      : { valid: false, version: Number.isFinite(version) ? version : null, errors: [{ code: "UNSUPPORTED_MANIFEST_VERSION", message: `Expected interchange manifest version ${INTERCHANGE_MANIFEST_VERSION}.` }] };
  }

  const api = Object.freeze({ INTERCHANGE_MANIFEST_VERSION, EXTERNAL_PROVENANCE_VERSION, SOURCE_SYSTEM_MASTERFORGE_ATLAS, SUPPORTED_EXTERNAL_ENTITY_TYPES, validateManifestVersion });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.MasterForgeInterchangeContract = api;
})();
