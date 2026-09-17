(() => {
  "use strict";

  function text(value) { return String(value ?? "").trim(); }
  function recordPointer(entity = {}) {
    const data = entity.data_json || {};
    if (data.sourceCollection && data.sourceId) return { collection: text(data.sourceCollection), id: text(data.sourceId) };
    if (data.npcId) return { collection: "npcs", id: text(data.npcId) };
    if (data.creatureId) return { collection: "creatures", id: text(data.creatureId) };
    if (data.itemId) return { collection: "items", id: text(data.itemId) };
    return null;
  }
  function recordCollection(record = {}) { return text(record.collection || record._collection || record.sourceCollection); }
  function links(entity, record) {
    const pointer = recordPointer(entity);
    if (pointer) return pointer.id === text(record.id) && (!recordCollection(record) || pointer.collection === recordCollection(record));
    return text(entity.id) === text(record.id) && text(entity.entity_type) === text(record.entity_type || record.type || recordCollection(record).replace(/s$/, ""));
  }

  async function findExistingEntityForExternalIdentity(inputIdentity, dependencies = {}) {
    const provenance = dependencies.provenance || (typeof globalThis !== "undefined" ? globalThis.MasterForgeExternalProvenance : null);
    if (!provenance?.validateExternalIdentity) throw new TypeError("External provenance dependency is required.");
    const validation = provenance.validateExternalIdentity(inputIdentity);
    if (!validation.valid) return { match: "none", entity: null, record: null, candidates: [], warnings: validation.errors };
    const entities = typeof dependencies.listEntities === "function" ? await dependencies.listEntities() : [];
    const records = typeof dependencies.listRecords === "function" ? await dependencies.listRecords() : [];
    const matchingEntities = (Array.isArray(entities) ? entities : []).filter(value => provenance.isSameExternalIdentity(value, validation.identity));
    const matchingRecords = (Array.isArray(records) ? records : []).filter(value => provenance.isSameExternalIdentity(value, validation.identity));
    const remainingRecords = new Set(matchingRecords);
    const candidates = matchingEntities.map(entity => {
      const record = matchingRecords.find(value => remainingRecords.has(value) && links(entity, value)) || null;
      if (record) remainingRecords.delete(record);
      return { entity, record };
    });
    for (const record of remainingRecords) candidates.push({ entity: null, record });
    if (!candidates.length) return { match: "none", entity: null, record: null, candidates: [], warnings: [] };
    if (candidates.length > 1) return { match: "ambiguous", entity: null, record: null, candidates, warnings: [{ code: "DUPLICATE_EXTERNAL_IDENTITY", message: "More than one Studio object claims this external identity." }] };
    return { match: "exact", entity: candidates[0].entity, record: candidates[0].record, candidates, warnings: [] };
  }

  const api = Object.freeze({ findExistingEntityForExternalIdentity });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.MasterForgeExternalEntityMatch = api;
})();
