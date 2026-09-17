(() => {
  "use strict";

  const SUPPORTED_TYPES = Object.freeze(["npc", "creature", "faction", "item"]);

  function normaliseReference(value = {}) {
    const entityType = String(value.entityType || value.entity_type || "").trim().toLowerCase();
    const entityId = String(value.entityId || value.id || "").trim();
    if (!SUPPORTED_TYPES.includes(entityType) || !entityId) return null;
    return { entityType, entityId };
  }

  function referenceKey(reference) {
    return `${reference.entityType}:${reference.entityId}`;
  }

  function isPinned(entity = {}) {
    return entity.visibility?.pinned === true || entity.data_json?.visibility?.pinned === true;
  }

  function createReferenceIndex(entities = []) {
    return (Array.isArray(entities) ? entities : []).map(entity => {
      const reference = normaliseReference(entity);
      if (!reference) return null;
      return {
        ...reference,
        name: String(entity.name || entity.id),
        description: String(entity.description || ""),
        pinned: isPinned(entity),
        scope: { ...(entity.data_json?.scope || entity.scope || {}) }
      };
    }).filter(Boolean);
  }

  function filterReferenceIndex(index = [], { entityType = "all", search = "", campaignId = "", worldId = "" } = {}) {
    const term = String(search).trim().toLowerCase();
    return index.filter(entry => {
      if (entityType !== "all" && entry.entityType !== entityType) return false;
      if (campaignId && entry.scope.campaignId && entry.scope.campaignId !== campaignId) return false;
      if (worldId && entry.scope.worldId && entry.scope.worldId !== worldId) return false;
      if (!term) return true;
      return [entry.name, entry.entityType, entry.description].join(" ").toLowerCase().includes(term);
    });
  }

  function groupReferenceIndex(index = []) {
    return { pinned: index.filter(entry => entry.pinned), results: index.filter(entry => !entry.pinned) };
  }

  function createReferenceBrowser(options = {}) {
    if (typeof options.resolveCanonicalEntityReference !== "function") throw new TypeError("A canonical resolver is required.");
    const maxOpenTabs = Math.max(1, Number(options.maxOpenTabs) || 8);
    const maxRecent = Math.max(1, Number(options.maxRecent) || 30);
    const now = typeof options.now === "function" ? options.now : () => Date.now();
    const openTabs = [];
    const recent = [];
    let activeTab = null;

    function recordRecent(reference) {
      const key = referenceKey(reference);
      const existing = recent.findIndex(item => referenceKey(item) === key);
      if (existing >= 0) recent.splice(existing, 1);
      recent.unshift({ ...reference, openedAt: now() });
      recent.splice(maxRecent);
    }

    async function openReference(value, resolverOptions = {}) {
      const reference = normaliseReference(value);
      if (!reference) throw new TypeError("A supported entityType and entityId are required.");
      const key = referenceKey(reference);
      const existing = openTabs.findIndex(item => referenceKey(item) === key);
      if (existing < 0) {
        if (openTabs.length >= maxOpenTabs) openTabs.shift();
        openTabs.push(reference);
      }
      activeTab = key;
      recordRecent(reference);
      const resolved = await options.resolveCanonicalEntityReference(reference, { visibilityMode: "gm", includeRelationships: true, includeResolvedCapabilities: true, ...resolverOptions });
      return { reference: { ...reference }, resolved };
    }

    async function resolveActive(resolverOptions = {}) {
      const reference = openTabs.find(item => referenceKey(item) === activeTab);
      if (!reference) return null;
      return options.resolveCanonicalEntityReference(reference, { visibilityMode: "gm", includeRelationships: true, includeResolvedCapabilities: true, ...resolverOptions });
    }

    function activateReference(value) {
      const reference = normaliseReference(value);
      const key = reference && referenceKey(reference);
      if (!key || !openTabs.some(item => referenceKey(item) === key)) return false;
      activeTab = key;
      return true;
    }

    function closeReference(value) {
      const reference = normaliseReference(value);
      const key = reference && referenceKey(reference);
      const index = openTabs.findIndex(item => referenceKey(item) === key);
      if (index < 0) return false;
      const wasActive = activeTab === key;
      openTabs.splice(index, 1);
      if (wasActive) {
        const fallback = openTabs[Math.min(index, openTabs.length - 1)] || null;
        activeTab = fallback ? referenceKey(fallback) : null;
      }
      return true;
    }

    function getState() {
      return {
        openTabs: openTabs.map(item => ({ ...item })),
        activeTab,
        recent: recent.map(item => ({ ...item }))
      };
    }

    return Object.freeze({ openReference, resolveActive, activateReference, closeReference, getState });
  }

  const api = Object.freeze({ SUPPORTED_TYPES, normaliseReference, createReferenceIndex, filterReferenceIndex, groupReferenceIndex, createReferenceBrowser });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.MasterForgeReferenceBrowser = api;
})();
