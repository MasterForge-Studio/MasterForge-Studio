(() => {
  "use strict";

  const SUPPORTED_SOURCE_COLLECTIONS = new Set([
    "npcs", "creatures", "items", "characters", "locations", "settlements",
    "quests", "events", "encounters", "parties", "party-groups"
  ]);
  const PUBLIC_OMIT_KEYS = new Set([
    "dmSecrets", "gmSecrets", "gmNotes", "secret", "secrets", "secretNotes",
    "privateNotes", "hiddenNotes", "gm", "gmOnly"
  ]);

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
    return value;
  }

  function isGmOnlyValue(value) {
    return isObject(value) && (
      value.secret === true || value.hidden === true || value.gmOnly === true ||
      ["gm", "hidden", "secret"].includes(String(value.visibility || "").toLowerCase())
    );
  }

  // Visibility filtering happens here, before any future presentation markup exists.
  function publicProjection(value) {
    if (Array.isArray(value)) return value.filter(item => !isGmOnlyValue(item)).map(publicProjection);
    if (!isObject(value)) return value;
    return Object.fromEntries(Object.entries(value)
      .filter(([key, item]) => !PUBLIC_OMIT_KEYS.has(key) && !isGmOnlyValue(item))
      .map(([key, item]) => [key, publicProjection(item)]));
  }

  function warning(code, message, details = {}) {
    return { code, message, ...details };
  }

  function normaliseReference(reference = {}) {
    const entityType = String(reference.entityType || reference.type || "").trim().toLowerCase();
    const entityId = String(reference.entityId || reference.id || "").trim();
    if (!entityType || !entityId) throw new TypeError("A canonical entity reference requires entityType and entityId.");
    return { entityType, entityId };
  }

  function normaliseRelationship(raw = {}) {
    return {
      raw,
      id: String(raw.id || ""),
      type: String(raw.relationshipType || raw.relationship_type || raw.relationship || "").trim(),
      sourceEntityType: String(raw.sourceEntityType || raw.source_entity_type || raw.from_type || "").trim().toLowerCase(),
      sourceEntityId: String(raw.sourceEntityId || raw.source_entity_id || raw.from_id || "").trim(),
      targetEntityType: String(raw.targetEntityType || raw.target_entity_type || raw.to_type || "").trim().toLowerCase(),
      targetEntityId: String(raw.targetEntityId || raw.target_entity_id || raw.to_id || "").trim(),
      metadata: clone(raw.data_json || raw.metadata || {}),
      visibility: String(raw.visibility || raw.data_json?.visibility || "gm").toLowerCase(),
      status: String(raw.status || "active"),
      notes: String(raw.notes || "")
    };
  }

  function isSecretRelationship(relationship) {
    const metadata = relationship.metadata || {};
    return relationship.type === "secretly_member_of" || relationship.visibility === "gm" || relationship.visibility === "hidden" || relationship.visibility === "secret" ||
      relationship.raw.secret === true || relationship.raw.hidden === true || relationship.raw.gmOnly === true ||
      metadata.secret === true || metadata.hidden === true || metadata.gmOnly === true || metadata.visibility === "gm" || metadata.visibility === "secret";
  }

  function sourcePointer(entity) {
    const data = isObject(entity?.data_json) ? entity.data_json : {};
    if (data.sourceCollection || data.sourceId) {
      return { collection: String(data.sourceCollection || "").trim(), id: String(data.sourceId || "").trim() };
    }
    if (entity.entity_type === "npc" && (data.npcId || data.source === "npc-builder")) {
      return { collection: "npcs", id: String(data.npcId || entity.id) };
    }
    if (entity.entity_type === "creature" && (data.creatureId || data.source === "creature-builder")) {
      return { collection: "creatures", id: String(data.creatureId || entity.id) };
    }
    if (entity.entity_type === "item" && (data.itemId || data.source === "item-builder")) {
      return { collection: "items", id: String(data.itemId || entity.id) };
    }
    return null;
  }

  function attributionOf(canonical, entity) {
    const data = isObject(entity?.data_json) ? entity.data_json : {};
    return {
      canonicalSource: canonical?.canonicalSource || canonical?.source || data.canonicalSource || "",
      sourceTitle: canonical?.sourceTitle || data.sourceTitle || "",
      sourceReference: canonical?.sourceReference || data.sourceReference || ""
    };
  }

  function externalProvenanceOf(canonical, entity) {
    const value = canonical?.externalProvenance || canonical?.data_json?.externalProvenance || entity?.data_json?.externalProvenance || null;
    return isObject(value) ? clone(value) : null;
  }

  function createCanonicalEntityResolver(dependencies = {}) {
    if (typeof dependencies.getEntity !== "function") throw new TypeError("getEntity read dependency is required.");

    async function resolveCanonicalEntityReference(inputReference, options = {}) {
      // This resolver accepts read adapters only; it never saves, migrates, or snapshots data.
      const reference = normaliseReference(inputReference);
      const visibilityMode = options.visibilityMode === "public" ? "public" : "gm";
      const includeRelationships = options.includeRelationships === true;
      const includeResolvedCapabilities = options.includeResolvedCapabilities === true;
      const warnings = [];
      const entityCache = new Map();
      const getEntity = async (type, id) => {
        const key = `${type}:${id}`;
        if (!entityCache.has(key)) entityCache.set(key, Promise.resolve(dependencies.getEntity(type, id)));
        return entityCache.get(key);
      };

      let storedEntity = null;
      try { storedEntity = await getEntity(reference.entityType, reference.entityId); }
      catch (error) {
        return { reference, entity: null, source: { kind: "entity", collection: null, id: reference.entityId }, canonical: null, relationships: [], resolvedCapabilities: null, visibilityMode, attribution: { canonicalSource: "", sourceTitle: "", sourceReference: "" }, warnings: [warning("ENTITY_READ_FAILED", `The referenced entity could not be read: ${error?.message || error}`, reference)] };
      }
      if (!storedEntity) {
        return { reference, entity: null, source: { kind: "entity", collection: null, id: reference.entityId }, canonical: null, relationships: [], resolvedCapabilities: null, visibilityMode, attribution: { canonicalSource: "", sourceTitle: "", sourceReference: "" }, warnings: [warning("ENTITY_NOT_FOUND", "The referenced entity could not be found.", reference)] };
      }

      const entity = clone(storedEntity);
      // Mirrors remain navigation identities; canonical content comes from their source record.
      const pointer = sourcePointer(entity);
      let source = { kind: "entity", collection: null, id: entity.id };
      let canonical = clone(entity);

      if (pointer) {
        source = { kind: "record", collection: pointer.collection || null, id: pointer.id || entity.id };
        if (!pointer.collection || !SUPPORTED_SOURCE_COLLECTIONS.has(pointer.collection)) {
          warnings.push(warning("UNSUPPORTED_SOURCE_COLLECTION", `Source collection ${pointer.collection || "(missing)"} is not supported.`, { collection: pointer.collection || null, id: pointer.id || null }));
        } else if (!pointer.id || typeof dependencies.getRecord !== "function") {
          warnings.push(warning("SOURCE_RECORD_NOT_FOUND", "The canonical source record could not be read.", source));
        } else {
          try {
            const record = await dependencies.getRecord(pointer.collection, pointer.id);
            if (record) canonical = clone(record);
            else warnings.push(warning("SOURCE_RECORD_NOT_FOUND", `Canonical source ${pointer.collection}:${pointer.id} was not found.`, source));
          } catch (error) {
            warnings.push(warning("SOURCE_RECORD_NOT_FOUND", `Canonical source ${pointer.collection}:${pointer.id} could not be read: ${error?.message || error}`, source));
          }
        }
      }

      if (reference.entityType === "faction" && isObject(canonical.data_json?.factionLore) && typeof dependencies.projectFactionLore === "function") {
        canonical.data_json.factionLore = clone(dependencies.projectFactionLore(canonical.data_json.factionLore, { visibilityMode }));
      }
      if (reference.entityType === "item" && pointer?.collection === "items" && typeof dependencies.projectItemForVisibility === "function") {
        canonical = clone(dependencies.projectItemForVisibility(canonical, visibilityMode));
      }
      if (visibilityMode === "public") canonical = publicProjection(canonical);

      const relationships = [];
      if (includeRelationships && typeof dependencies.getRelationshipsForEntity === "function") {
        let rawRelationships = [];
        try { rawRelationships = await dependencies.getRelationshipsForEntity(reference.entityType, reference.entityId); }
        catch (error) { warnings.push(warning("RELATIONSHIP_READ_FAILED", `Relationships could not be read: ${error?.message || error}`, reference)); }
        for (const raw of Array.isArray(rawRelationships) ? rawRelationships : []) {
          const relationship = normaliseRelationship(raw);
          const outgoing = relationship.sourceEntityType === reference.entityType && relationship.sourceEntityId === reference.entityId;
          const incoming = relationship.targetEntityType === reference.entityType && relationship.targetEntityId === reference.entityId;
          if (!outgoing && !incoming) continue;
          const secret = isSecretRelationship(relationship);
          if (visibilityMode === "public" && secret) continue;
          const otherType = outgoing ? relationship.targetEntityType : relationship.sourceEntityType;
          const otherId = outgoing ? relationship.targetEntityId : relationship.sourceEntityId;
          let other = null;
          try { other = otherType && otherId ? await getEntity(otherType, otherId) : null; }
          catch (_) { other = null; }
          if (!other) warnings.push(warning("RELATIONSHIP_ENDPOINT_MISSING", `Relationship ${relationship.id || relationship.type} points to a missing entity.`, { relationshipId: relationship.id, entityType: otherType, entityId: otherId }));
          relationships.push({
            id: relationship.id,
            type: relationship.type,
            label: relationship.type.replaceAll("_", " "),
            direction: outgoing ? "outgoing" : "incoming",
            sourceEntityId: relationship.sourceEntityId,
            targetEntityId: relationship.targetEntityId,
            otherEntity: other ? { id: other.id, type: other.entity_type || otherType, name: other.name || other.id } : { id: otherId, type: otherType, name: otherId },
            metadata: visibilityMode === "public" ? publicProjection(relationship.metadata) : clone(relationship.metadata),
            secret,
            visibility: relationship.visibility,
            status: relationship.status,
            notes: visibilityMode === "public" ? "" : relationship.notes
          });
        }
      }

      let resolvedCapabilities = null;
      if (includeResolvedCapabilities && ["npc", "creature"].includes(reference.entityType)) {
        const resolver = reference.entityType === "creature" && typeof dependencies.resolveCombatProfile === "function"
          ? dependencies.resolveCombatProfile
          : dependencies.resolveCapabilities;
        if (typeof resolver === "function") {
          try {
            resolvedCapabilities = clone(await resolver(entity, canonical, { visibilityMode, includeHidden: visibilityMode === "gm" }));
            if (visibilityMode === "public") resolvedCapabilities = publicProjection(resolvedCapabilities);
          } catch (error) {
            warnings.push(warning("CAPABILITY_RESOLUTION_FAILED", `Capabilities could not be resolved: ${error?.message || error}`, reference));
          }
        }
      }

      source.externalProvenance = externalProvenanceOf(canonical, entity);
      return { reference, entity: visibilityMode === "public" ? publicProjection(entity) : entity, source, canonical, relationships, resolvedCapabilities, visibilityMode, attribution: attributionOf(canonical, entity), warnings };
    }

    return Object.freeze({ resolveCanonicalEntityReference });
  }

  async function resolveCanonicalEntityReference(reference, options = {}, dependencies = {}) {
    return createCanonicalEntityResolver(dependencies).resolveCanonicalEntityReference(reference, options);
  }

  const api = Object.freeze({ createCanonicalEntityResolver, resolveCanonicalEntityReference });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.MasterForgeCanonicalEntityResolver = api;
})();
