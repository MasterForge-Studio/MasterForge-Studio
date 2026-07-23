// Read-only helpers for identifying configuration assets and reading explicit
// configuration references. Returned collections are defensive frozen copies.
(() => {
  "use strict";

  function getRegistry() {
    return window.MasterForgeConfigurationAssets || null;
  }

  function getConfigurationType(value) {
    const registry = getRegistry();
    if (!registry) return null;

    const candidate = typeof value === "string"
      ? value
      : value && typeof value === "object"
        ? value.configurationType ||
          value.entity_type ||
          value.entityType ||
          value.data_json?.configurationType ||
          null
        : null;

    return Object.values(registry.TYPES).includes(candidate) ? candidate : null;
  }

  function isConfigurationAsset(value) {
    return getConfigurationType(value) !== null;
  }

  function getConfigurationReferences(value) {
    if (!value || typeof value !== "object") return Object.freeze([]);

    const references = Array.isArray(value.configurationReferences)
      ? value.configurationReferences
      : Array.isArray(value.data_json?.configurationReferences)
        ? value.data_json.configurationReferences
        : [];

    return Object.freeze(references.map(reference =>
      reference && typeof reference === "object" && !Array.isArray(reference)
        ? Object.freeze({ ...reference })
        : reference
    ));
  }

  async function getAbilityPackReferences(packId) {
    const id = String(packId || "").trim();
    const factions = [];
    const hierarchyNodes = [];
    const future = [];

    if (!id || !window.dmAPI?.getEntitiesByType) {
      return Object.freeze({
        factions: Object.freeze(factions),
        hierarchyNodes: Object.freeze(hierarchyNodes),
        future: Object.freeze(future)
      });
    }

    let storedFactions = [];
    try {
      storedFactions = await window.dmAPI.getEntitiesByType("faction");
    } catch (error) {
      console.warn("Could not read Ability Pack faction references:", error);
    }
    const hierarchyApi = window.MasterForgeFactionHierarchy;

    (Array.isArray(storedFactions) ? storedFactions : []).forEach(faction => {
      const factionPackIds = Array.isArray(faction.data_json?.abilityPackIds)
        ? faction.data_json.abilityPackIds
        : [];

      if (factionPackIds.includes(id)) {
        factions.push(Object.freeze({
          entityType: "faction",
          entityId: faction.id,
          entityName: faction.name || faction.id,
          referenceLevel: "Faction",
          referenceType: "Ability Pack assignment"
        }));
      }

      const nodes = hierarchyApi
        ? hierarchyApi.normaliseFactionHierarchy(faction.data_json || {}).nodes
        : Array.isArray(faction.data_json?.factionHierarchy?.nodes)
          ? faction.data_json.factionHierarchy.nodes
          : [];

      nodes.forEach(node => {
        const nodePackIds = Array.isArray(node.abilityPackIds) ? node.abilityPackIds : [];
        if (!nodePackIds.includes(id)) return;
        hierarchyNodes.push(Object.freeze({
          entityType: "faction",
          entityId: faction.id,
          entityName: faction.name || faction.id,
          factionId: faction.id,
          factionName: faction.name || faction.id,
          nodeId: node.id,
          nodeName: node.name || node.id,
          referenceLevel: "Hierarchy Node",
          referenceType: "Ability Pack assignment"
        }));
      });
    });

    return Object.freeze({
      factions: Object.freeze(factions),
      hierarchyNodes: Object.freeze(hierarchyNodes),
      future: Object.freeze(future)
    });
  }

  window.MasterForgeConfigurationReferenceHelper = Object.freeze({
    getConfigurationType,
    isConfigurationAsset,
    getConfigurationReferences,
    getAbilityPackReferences
  });
})();
