// =====================================================
// MasterForge Studio
// Universal Entity Relationship Engine
// =====================================================
console.log("🔥 URE FILE LOADED");
(() => {
  "use strict";

  const ENGINE_NAME = "MasterForge Universal Relationship Engine";
  const ENGINE_VERSION = "0.1.0-alpha";

  /**
   * These values are temporary compatibility rules.
   *
   * They will eventually be loaded from the
   * relationship_types database table.
   */
  const LEGACY_MOVE_WITH_RELATIONSHIP_KEYS = new Set([
    "aboard",
    "inside",
    "contained_in",
    "stored_in",
    "carried_by",
    "located_in",
    "operates_from",
    "stationed_at",
    "assigned_to"
  ]);

  const CURRENT_LOCATION_RELATIONSHIP_KEYS = new Set([
  "aboard",
  "inside",
  "contained_in",
  "stored_in",
  "carried_by",
  "located_in",
  "stationed_at",
  "assigned_to"
]);

  /**
   * Entity types currently able to inherit movement
   * through a relationship.
   *
   * This is deliberately broader than the current NPC-only
   * implementation while remaining compatible with Alpha.
   */
  const LEGACY_MOVABLE_ENTITY_TYPES = new Set([
    "world",
    "campaign",
    "party",
    "party_group",
    "pc",
    "npc",
    "creature",
    "faction",
    "organisation",
    "location",
    "vehicle",
    "ship",
    "settlement",
    "landmark",
    "item",
    "loot",
    "quest",
    "event",
    "encounter"
  ]);

  function requireApiMethod(methodName) {
    if (!window.dmAPI) {
      throw new Error(
        `${ENGINE_NAME}: window.dmAPI is unavailable.`
      );
    }

    if (typeof window.dmAPI[methodName] !== "function") {
      throw new Error(
        `${ENGINE_NAME}: dmAPI.${methodName} is unavailable.`
      );
    }

    return window.dmAPI[methodName];
  }

  function normaliseKey(value = "") {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replaceAll("-", "_")
      .replaceAll(" ", "_");
  }

  function createEntityReference(entityType, entityId) {
    const type = normaliseKey(entityType);
    const id = String(entityId || "").trim();

    if (!type) {
      throw new Error("Entity type is required.");
    }

    if (!id) {
      throw new Error("Entity ID is required.");
    }

    return {
      entityType: type,
      entityId: id,
      key: `${type}:${id}`
    };
  }

  function normaliseRelationshipRecord(relationship = {}) {
    return {
      ...relationship,

      id: String(relationship.id || "").trim(),

      sourceEntityType: normaliseKey(
        relationship.source_entity_type ||
        relationship.sourceEntityType ||
        relationship.from_type
      ),

      sourceEntityId: String(
        relationship.source_entity_id ||
        relationship.sourceEntityId ||
        relationship.from_id ||
        ""
      ).trim(),

      relationshipType: normaliseKey(
        relationship.relationship_type ||
        relationship.relationshipType ||
        relationship.relationship
      ),

      targetEntityType: normaliseKey(
        relationship.target_entity_type ||
        relationship.targetEntityType ||
        relationship.to_type
      ),

      targetEntityId: String(
        relationship.target_entity_id ||
        relationship.targetEntityId ||
        relationship.to_id ||
        ""
      ).trim(),

      campaignId:
        relationship.campaign_id ??
        relationship.campaignId ??
        null,

      visibility:
        relationship.visibility ||
        "gm",

      status:
        relationship.status ||
        "active",

      startDate:
        relationship.start_date ||
        relationship.startDate ||
        null,

      endDate:
        relationship.end_date ||
        relationship.endDate ||
        null,

      notes:
        relationship.notes ||
        ""
    };
  }

  function validateRelationshipInput(input = {}) {
    const relationship = normaliseRelationshipRecord(input);
    const errors = [];

    if (!relationship.sourceEntityType) {
      errors.push("Source entity type is required.");
    }

    if (!relationship.sourceEntityId) {
      errors.push("Source entity ID is required.");
    }

    if (!relationship.relationshipType) {
      errors.push("Relationship type is required.");
    }

    if (!relationship.targetEntityType) {
      errors.push("Target entity type is required.");
    }

    if (!relationship.targetEntityId) {
      errors.push("Target entity ID is required.");
    }

    const sameEntity =
      relationship.sourceEntityType === relationship.targetEntityType &&
      relationship.sourceEntityId === relationship.targetEntityId;

    if (sameEntity) {
      errors.push("An entity cannot relate to itself.");
    }

    return {
      valid: errors.length === 0,
      errors,
      relationship
    };
  }

  async function getEntity(entityType, entityId) {
    const reference = createEntityReference(entityType, entityId);
    const getEntityApi = requireApiMethod("getEntity");

    return getEntityApi(
      reference.entityType,
      reference.entityId
    );
  }

  async function getRelationshipsForEntity(entityType, entityId) {
    const reference = createEntityReference(entityType, entityId);
    const getRelationshipsApi =
      requireApiMethod("getEntityRelationships");

    const relationships = await getRelationshipsApi(
      reference.entityType,
      reference.entityId
    );

    return Array.isArray(relationships)
      ? relationships.map(normaliseRelationshipRecord)
      : [];
  }

  function relationshipMatchesEntity(
    relationship,
    entityType,
    entityId
  ) {
    const record = normaliseRelationshipRecord(relationship);
    const reference = createEntityReference(entityType, entityId);

    return (
      (
        record.sourceEntityType === reference.entityType &&
        record.sourceEntityId === reference.entityId
      ) ||
      (
        record.targetEntityType === reference.entityType &&
        record.targetEntityId === reference.entityId
      )
    );
  }

  function getRelationshipDirection(
    relationship,
    entityType,
    entityId
  ) {
    const record = normaliseRelationshipRecord(relationship);
    const reference = createEntityReference(entityType, entityId);

    if (
      record.sourceEntityType === reference.entityType &&
      record.sourceEntityId === reference.entityId
    ) {
      return "outgoing";
    }

    if (
      record.targetEntityType === reference.entityType &&
      record.targetEntityId === reference.entityId
    ) {
      return "incoming";
    }

    return null;
  }

  async function relationshipExists(input = {}) {
    const validation = validateRelationshipInput(input);

    if (!validation.valid) {
      throw new Error(validation.errors.join(" "));
    }

    const candidate = validation.relationship;

    const relationships = await getRelationshipsForEntity(
      candidate.sourceEntityType,
      candidate.sourceEntityId
    );

    return relationships.some(existing => {
      return (
        existing.sourceEntityType === candidate.sourceEntityType &&
        existing.sourceEntityId === candidate.sourceEntityId &&
        existing.relationshipType === candidate.relationshipType &&
        existing.targetEntityType === candidate.targetEntityType &&
        existing.targetEntityId === candidate.targetEntityId &&
        String(existing.campaignId || "") ===
          String(candidate.campaignId || "") &&
        existing.status !== "ended"
      );
    });
  }

  function createLegacyRelationshipPayload(input = {}) {
    const record = normaliseRelationshipRecord(input);

    return {
      id: record.id,
      from_type: record.sourceEntityType,
      from_id: record.sourceEntityId,
      relationship: record.relationshipType,
      to_type: record.targetEntityType,
      to_id: record.targetEntityId,
      campaign_id: record.campaignId,
      visibility: record.visibility,
      status: record.status,
      start_date: record.startDate,
      end_date: record.endDate,
      notes: record.notes,
      data_json: {
        ...(record.data_json || {}),
        ...(record.metadata || {})
      }
    };
  }

  async function createRelationship(input = {}) {
  const validation =
    validateRelationshipInput(input);

  if (!validation.valid) {
    throw new Error(
      validation.errors.join(" ")
    );
  }

  const relationship =
    normaliseRelationshipRecord(input);

  const alreadyExists =
    await relationshipExists({
      sourceEntityType:
        relationship.sourceEntityType,

      sourceEntityId:
        relationship.sourceEntityId,

      relationshipType:
        relationship.relationshipType,

      targetEntityType:
        relationship.targetEntityType,

      targetEntityId:
        relationship.targetEntityId
    });

  if (alreadyExists) {
    throw new Error(
      "That relationship already exists."
    );
  }

  const payload =
    createLegacyRelationshipPayload(
      relationship
    );

  return window.dmAPI.createRelationship(
    payload
  );
}

  async function deleteRelationship(relationshipId) {
  const id =
    String(relationshipId || "").trim();

  if (!id) {
    throw new Error(
      "Relationship ID is required."
    );
  }

  const deleteApi =
    requireApiMethod(
      "deleteRelationship"
    );

  const result =
    await deleteApi(id);

  return {
    deleted: true,
    relationshipId: id,
    result
  };
}

  function isPlainObject(value) {
    return (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
    );
  }

  async function updateRelationshipMetadata(relationshipId, updates = {}) {
    const id = String(relationshipId || "").trim();

    if (!id) {
      throw new Error("Relationship ID is required.");
    }

    if (!isPlainObject(updates)) {
      throw new Error("Relationship updates must be a plain object.");
    }

    const supportedFields = [
      "notes",
      "strength",
      "data_json",
      "mergeDataJson"
    ];
    const safeUpdates = {};

    supportedFields.forEach(field => {
      if (updates[field] !== undefined) {
        safeUpdates[field] = updates[field];
      }
    });

    if (!Object.keys(safeUpdates).some(field => field !== "mergeDataJson")) {
      throw new Error("At least one supported relationship update is required.");
    }

    if (
      safeUpdates.data_json !== undefined &&
      safeUpdates.data_json !== null &&
      !isPlainObject(safeUpdates.data_json)
    ) {
      throw new Error("Relationship data_json must be a plain object or null.");
    }

    if (
      safeUpdates.data_json === null &&
      safeUpdates.mergeDataJson !== false
    ) {
      throw new Error(
        "Null relationship metadata is only valid when mergeDataJson is false."
      );
    }

    if (
      safeUpdates.strength !== undefined &&
      safeUpdates.strength !== null &&
      (
        typeof safeUpdates.strength !== "number" ||
        !Number.isFinite(safeUpdates.strength)
      )
    ) {
      throw new Error("Relationship strength must be a finite number or null.");
    }

    if (
      safeUpdates.notes !== undefined &&
      safeUpdates.notes !== null &&
      typeof safeUpdates.notes !== "string"
    ) {
      throw new Error("Relationship notes must be a string or null.");
    }

    const updateApi = requireApiMethod("updateRelationship");
    const updated = await updateApi(id, safeUpdates);

    if (!updated) {
      throw new Error(`Relationship not found: ${id}`);
    }

    return updated;
  }

  function shouldRelationshipMoveWithEntity(relationship) {
    const record = normaliseRelationshipRecord(relationship);

    return LEGACY_MOVE_WITH_RELATIONSHIP_KEYS.has(
      record.relationshipType
    );
  }

  function canEntityTypeInheritMovement(entityType) {
    return LEGACY_MOVABLE_ENTITY_TYPES.has(
      normaliseKey(entityType)
    );
  }

  function getLegacyRelationshipKey(relationship = {}) {
  const record = normaliseRelationshipRecord(relationship);

  return (
    record.id ||
    [
      record.sourceEntityType,
      record.sourceEntityId,
      record.relationshipType,
      record.targetEntityType,
      record.targetEntityId,
      record.campaignId || "global"
    ].join(":")
  );
}

function toLegacyRelationshipRecord(relationship = {}) {
  const record = normaliseRelationshipRecord(relationship);

  return {
    ...relationship,

    id: record.id,

    from_type: record.sourceEntityType,
    from_id: record.sourceEntityId,

    relationship: record.relationshipType,

    to_type: record.targetEntityType,
    to_id: record.targetEntityId,

    campaign_id: record.campaignId,
    visibility: record.visibility,
    status: record.status,

    start_date: record.startDate,
    end_date: record.endDate,

    notes: record.notes
  };
}

function deduplicateRelationships(relationships = []) {
  const byKey = new Map();

  for (const relationship of relationships) {
    if (!relationship) continue;

    const legacyRecord =
      toLegacyRelationshipRecord(relationship);

    const key =
      getLegacyRelationshipKey(legacyRecord);

    byKey.set(key, legacyRecord);
  }

  return [...byKey.values()];
}

async function getLegacyRelationshipsForEntity(
  entityType,
  entityId
) {
  const relationships =
    await getRelationshipsForEntity(
      entityType,
      entityId
    );

  return deduplicateRelationships(relationships);
}

function isCurrentLocationRelationship(value = "") {
  return CURRENT_LOCATION_RELATIONSHIP_KEYS.has(
    normaliseKey(value)
  );
}

function getDefaultLocationRelationshipType(locationState = {}) {
  const targetType =
    normaliseKey(locationState.entityType);

  if (targetType === "ship" || targetType === "vehicle") {
    return "aboard";
  }

  if (
    targetType === "settlement" ||
    targetType === "location"
  ) {
    return "located_in";
  }

  if (
    targetType === "faction" ||
    targetType === "organisation"
  ) {
    return "assigned_to";
  }

  return "inside";
}

async function removeCurrentLocationRelationships(options = {}) {
  const {
    entityType,
    entityId,
    keepTargetType = "",
    keepTargetId = "",
    keepRelationshipType = ""
  } = options;

  const sourceType =
    normaliseKey(entityType);

  const sourceId =
    String(entityId || "").trim();

  if (!sourceType || !sourceId) {
    throw new Error(
      "Entity type and entity ID are required."
    );
  }

  const relationships =
    await getLegacyRelationshipsForEntity(
      sourceType,
      sourceId
    );

  const removable =
    relationships.filter(relationship => {
      const isOutgoing =
        normaliseKey(relationship.from_type) === sourceType &&
        String(relationship.from_id || "") === sourceId;

      if (!isOutgoing) {
        return false;
      }

      if (
        !isCurrentLocationRelationship(
          relationship.relationship
        )
      ) {
        return false;
      }

      const isKeptTarget =
        keepTargetType &&
        keepTargetId &&
        normaliseKey(relationship.to_type) ===
          normaliseKey(keepTargetType) &&
        String(relationship.to_id || "") ===
          String(keepTargetId);

      const isKeptRelationship =
        !keepRelationshipType ||
        normaliseKey(relationship.relationship) ===
          normaliseKey(keepRelationshipType);

      return !(isKeptTarget && isKeptRelationship);
    });

  const deleted = [];
  const failed = [];

  for (const relationship of removable) {
    if (!relationship.id) {
      continue;
    }

    try {
      await deleteRelationship(
        relationship.id
      );

      deleted.push(relationship.id);
    } catch (error) {
      failed.push({
        relationship,
        error
      });
    }
  }

  return {
    removedCount: deleted.length,
    deleted,
    failed
  };
}

async function syncCurrentLocationRelationship(options = {}) {
  const {
    entityType,
    entityId,
    locationState,
    relationshipType = "",
    replaceExisting = true,
    campaignId = "",
    notes = ""
  } = options;

  const sourceType =
    normaliseKey(entityType);

  const sourceId =
    String(entityId || "").trim();

  if (!sourceType || !sourceId) {
    throw new Error(
      "Entity type and entity ID are required."
    );
  }

  const state =
    locationState || {};

  const hasEntityLocation =
    state.mode === "entity" &&
    state.entityType &&
    state.entityId;

  if (!hasEntityLocation) {
    if (!replaceExisting) {
      return {
        created: false,
        removedCount: 0,
        reason: "No entity location supplied."
      };
    }

    const cleanup =
      await removeCurrentLocationRelationships({
        entityType: sourceType,
        entityId: sourceId
      });

    return {
      created: false,
      removedCount: cleanup.removedCount,
      cleanup,
      reason:
        "Entity no longer has a containing entity."
    };
  }

  const resolvedRelationshipType =
    normaliseKey(
      relationshipType ||
      getDefaultLocationRelationshipType(state)
    );

  let cleanup = {
    removedCount: 0,
    deleted: [],
    failed: []
  };

  if (replaceExisting) {
    cleanup =
      await removeCurrentLocationRelationships({
        entityType: sourceType,
        entityId: sourceId,
        keepTargetType: state.entityType,
        keepTargetId: state.entityId,
        keepRelationshipType:
          resolvedRelationshipType
      });
  }

  const exists =
    await relationshipExists({
      sourceEntityType: sourceType,
      sourceEntityId: sourceId,
      relationshipType:
        resolvedRelationshipType,
      targetEntityType:
        state.entityType,
      targetEntityId:
        state.entityId
    });

  if (exists) {
    return {
      created: false,
      alreadyExists: true,
      relationshipType:
        resolvedRelationshipType,
      removedCount:
        cleanup.removedCount,
      cleanup
    };
  }

  const relationship =
    await createRelationship({
      id: [
        "relationship",
        sourceType,
        sourceId,
        resolvedRelationshipType,
        state.entityType,
        state.entityId
      ].join("-"),

      sourceEntityType:
        sourceType,

      sourceEntityId:
        sourceId,

      relationshipType:
        resolvedRelationshipType,

      targetEntityType:
        state.entityType,

      targetEntityId:
        state.entityId,

      campaignId,
      visibility: "gm",
      status: "active",
      notes
    });

  return {
    created: true,
    relationship,
    relationshipType:
      resolvedRelationshipType,
    removedCount:
      cleanup.removedCount,
    cleanup
  };
}

// =====================================================
// RELATIONSHIP TREE METADATA
// =====================================================

const DEFAULT_RELATIONSHIP_TREE_META = {
  role: "",
  group: "",
  rank: null,
  layer: null,
  displayMode: "branch",
  equalWithGroup: false
};

function normaliseOptionalNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function getRelationshipMetadata(relationship = {}) {
  const metadata =
    relationship.metadata ||
    relationship.meta ||
    relationship.relationship_metadata ||
    relationship.relationshipMetadata ||
    relationship.data_json ||
    relationship.data ||
    {};

  return {
    ...DEFAULT_RELATIONSHIP_TREE_META,

    role:
      String(
        metadata.relationshipRole ||
        metadata.role ||
        ""
      ).trim(),

    group:
      normaliseKey(
        metadata.relationshipGroup ||
        metadata.group ||
        ""
      ),

    rank:
      normaliseOptionalNumber(
        metadata.relationshipRank ??
        metadata.rank
      ),

    layer:
      normaliseOptionalNumber(
        metadata.relationshipLayer ??
        metadata.layer
      ),

    displayMode:
      normaliseKey(
        metadata.displayMode ||
        metadata.relationshipDisplayMode ||
        "branch"
      ) || "branch",

    equalWithGroup:
      metadata.equalWithGroup === true ||
      metadata.isEqual === true ||
      metadata.equal === true
  };
}

function getRelationshipTreeGroupKey(
  relationship = {},
  direction = ""
) {
  const record =
    normaliseRelationshipRecord(
      relationship
    );

  const metadata =
    getRelationshipMetadata(
      relationship
    );

  if (metadata.group) {
    return `group:${metadata.group}`;
  }

  return [
    "relationship",
    record.relationshipType || "linked",
    normaliseKey(direction || "unknown")
  ].join(":");
}

function getRelationshipTreeGroupLabel(
  relationship = {},
  fallbackLabel = ""
) {
  const record =
    normaliseRelationshipRecord(
      relationship
    );

  const metadata =
    getRelationshipMetadata(
      relationship
    );

  if (metadata.role) {
    return metadata.role;
  }

  if (metadata.group) {
    return metadata.group
      .replaceAll("_", " ")
      .replace(/\b\w/g, letter =>
        letter.toUpperCase()
      );
  }

  if (fallbackLabel) {
    return fallbackLabel;
  }

  return String(
    record.relationshipType ||
    "Linked"
  )
    .replaceAll("_", " ")
    .replace(/\b\w/g, letter =>
      letter.toUpperCase()
    );
}

function sortRelationshipTreeItems(items = []) {
  return [...items].sort((a, b) => {
    const aMeta =
      getRelationshipMetadata(
        a.relationship || a
      );

    const bMeta =
      getRelationshipMetadata(
        b.relationship || b
      );

    const aLayer =
      aMeta.layer ??
      Number.MAX_SAFE_INTEGER;

    const bLayer =
      bMeta.layer ??
      Number.MAX_SAFE_INTEGER;

    if (aLayer !== bLayer) {
      return aLayer - bLayer;
    }

    const aRank =
      aMeta.rank ??
      Number.MIN_SAFE_INTEGER;

    const bRank =
      bMeta.rank ??
      Number.MIN_SAFE_INTEGER;

    if (aRank !== bRank) {
      return bRank - aRank;
    }

    const aName =
      a.entity?.name ||
      a.name ||
      a.entityId ||
      "";

    const bName =
      b.entity?.name ||
      b.name ||
      b.entityId ||
      "";

    return String(aName).localeCompare(
      String(bName)
    );
  });
}

function groupRelationshipTreeItems(items = []) {
  const groupsByKey = new Map();

  for (const item of items) {
    const relationship =
      item.relationship ||
      item;

    const direction =
      item.direction ||
      "";

    const metadata =
      getRelationshipMetadata(
        relationship
      );

    const key =
      getRelationshipTreeGroupKey(
        relationship,
        direction
      );

    if (!groupsByKey.has(key)) {
      groupsByKey.set(key, {
        key,

        label:
          getRelationshipTreeGroupLabel(
            relationship,
            item.label || ""
          ),

        role: metadata.role,
        group: metadata.group,
        rank: metadata.rank,
        layer: metadata.layer,
        displayMode:
          metadata.displayMode,

        equalWithGroup:
          metadata.equalWithGroup,

        items: []
      });
    }

    const group =
      groupsByKey.get(key);

    group.items.push({
      ...item,
      treeMeta: metadata
    });

    if (metadata.equalWithGroup) {
      group.equalWithGroup = true;
    }

    if (
      metadata.layer !== null &&
      (
        group.layer === null ||
        metadata.layer < group.layer
      )
    ) {
      group.layer =
        metadata.layer;
    }

    if (
      metadata.rank !== null &&
      (
        group.rank === null ||
        metadata.rank > group.rank
      )
    ) {
      group.rank =
        metadata.rank;
    }
  }

  return [...groupsByKey.values()]
    .sort((a, b) => {
      const aLayer =
        a.layer ??
        Number.MAX_SAFE_INTEGER;

      const bLayer =
        b.layer ??
        Number.MAX_SAFE_INTEGER;

      if (aLayer !== bLayer) {
        return aLayer - bLayer;
      }

      const aRank =
        a.rank ??
        Number.MIN_SAFE_INTEGER;

      const bRank =
        b.rank ??
        Number.MIN_SAFE_INTEGER;

      if (aRank !== bRank) {
        return bRank - aRank;
      }

      return String(a.label)
        .localeCompare(
          String(b.label)
        );
    })
    .map(group => ({
      ...group,
      items:
        sortRelationshipTreeItems(
          group.items
        )
    }));
}

const engine = {
  name: ENGINE_NAME,
  version: ENGINE_VERSION,

  normaliseKey,
  normaliseRelationshipRecord,
  validateRelationshipInput,

  getRelationshipMetadata,
  getRelationshipTreeGroupKey,
  getRelationshipTreeGroupLabel,
  sortRelationshipTreeItems,
  groupRelationshipTreeItems,

  createEntityReference,
  getEntity,
  getRelationshipsForEntity,
  getLegacyRelationshipsForEntity,

  getLegacyRelationshipKey,
  toLegacyRelationshipRecord,
  deduplicateRelationships,

  relationshipMatchesEntity,
  getRelationshipDirection,
  relationshipExists,

  isCurrentLocationRelationship,
  getDefaultLocationRelationshipType,
  removeCurrentLocationRelationships,
  syncCurrentLocationRelationship,

  createRelationship,
  updateRelationshipMetadata,
  deleteRelationship,

  shouldRelationshipMoveWithEntity,
  canEntityTypeInheritMovement,

  compatibility: {
  moveWithRelationshipKeys:
    LEGACY_MOVE_WITH_RELATIONSHIP_KEYS,

  movableEntityTypes:
    LEGACY_MOVABLE_ENTITY_TYPES,

  currentLocationRelationshipKeys:
    CURRENT_LOCATION_RELATIONSHIP_KEYS
}
};

window.MasterForgeRelationshipEngine = engine;

  console.log(
    `${ENGINE_NAME} v${ENGINE_VERSION} loaded.`
  );
})();
