const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

let db = null;
let currentDataPath = null;


/*
==================================================
 MASTERFORGE CORE DEFAULTS

Only things that belong to the application itself.
No worlds.
No adventures.
No campaign data.
==================================================
*/

const DEFAULT_THEMES = [

  {
    id: "merchant-vessel",
    name: "Merchant Vessel",
    type: "built-in",
    description:
      "Dark ship wood, brass trim, parchment panels and sea-map atmosphere."
  },

  {
    id: "lost-jungle-isle",
    name: "Lost Jungle Isle",
    type: "built-in",
    description:
      "Ancient stone, jungle foliage, explorer gold and dinosaur island energy."
  }

];



/*
==================================================
 INITIALISE DATABASE
==================================================
*/

function initialiseDatabase(dataPath) {
  currentDataPath = dataPath;
  

  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(
      dataPath,
      { recursive: true }
    );
  }

  
  const dbPath =
    path.join(
      dataPath,
      "masterforge-studio.db"
    );


  db =
    new Database(dbPath);

  db.pragma("foreign_keys = ON");

  /*
  -----------------------------
  UNIVERSAL RECORD STORAGE

  Everything lives here:

  worlds
  locations
  regions
  npcs
  factions
  loot
  encounters
  campaigns
  players
  notes
  -----------------------------
  */

  db.prepare(`

    CREATE TABLE IF NOT EXISTS records (

      id TEXT PRIMARY KEY,

      collection TEXT NOT NULL,

      scope TEXT DEFAULT 'global',

      data_json TEXT NOT NULL,

      created_at TEXT NOT NULL,

      updated_at TEXT NOT NULL

    )

  `).run();

    // =====================================================
  // MasterForge Studio v0.3.0-alpha
  // Relationship Engine Foundation Tables
  // =====================================================

  db.prepare(`
    CREATE TABLE IF NOT EXISTS entities (
      id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      data_json TEXT DEFAULT '{}',
      source_pack TEXT DEFAULT NULL,
      is_persistent INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      PRIMARY KEY (entity_type, id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS relationships (
      id TEXT PRIMARY KEY,
      from_type TEXT NOT NULL,
      from_id TEXT NOT NULL,
      relationship TEXT NOT NULL,
      to_type TEXT NOT NULL,
      to_id TEXT NOT NULL,
      strength INTEGER DEFAULT 1,
      notes TEXT DEFAULT '',
      data_json TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (from_type, from_id)
        REFERENCES entities(entity_type, id)
        ON DELETE CASCADE,

      FOREIGN KEY (to_type, to_id)
        REFERENCES entities(entity_type, id)
        ON DELETE CASCADE
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      asset_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      name TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (entity_type, entity_id)
        REFERENCES entities(entity_type, id)
        ON DELETE CASCADE
    )
  `).run();

  // Relationship Engine indexes

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_entities_type
    ON entities(entity_type)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_entities_name
    ON entities(name)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_relationships_from
    ON relationships(from_type, from_id)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_relationships_to
    ON relationships(to_type, to_id)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_relationships_relationship
    ON relationships(relationship)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_assets_entity
    ON assets(entity_type, entity_id)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_assets_type
    ON assets(asset_type)
  `).run();

  // Auto-update timestamps

  db.prepare(`
    CREATE TRIGGER IF NOT EXISTS trg_entities_updated_at
    AFTER UPDATE ON entities
    FOR EACH ROW
    BEGIN
      UPDATE entities
      SET updated_at = CURRENT_TIMESTAMP
      WHERE entity_type = OLD.entity_type
      AND id = OLD.id;
    END
  `).run();

  db.prepare(`
    CREATE TRIGGER IF NOT EXISTS trg_relationships_updated_at
    AFTER UPDATE ON relationships
    FOR EACH ROW
    BEGIN
      UPDATE relationships
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = OLD.id;
    END
  `).run();

  db.prepare(`
    CREATE TRIGGER IF NOT EXISTS trg_assets_updated_at
    AFTER UPDATE ON assets
    FOR EACH ROW
    BEGIN
      UPDATE assets
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = OLD.id;
    END
  `).run();

  db.prepare(`

    CREATE INDEX IF NOT EXISTS idx_records_collection_scope

    ON records(collection, scope)

  `).run();



  /*
  -----------------------------
  CONTENT PACK REGISTRY

  Tracks installed DLC/modules
  -----------------------------
  */


  db.prepare(`

    CREATE TABLE IF NOT EXISTS installed_packs (

      id TEXT PRIMARY KEY,

      name TEXT NOT NULL,

      version TEXT,

      author TEXT,

      installed_at TEXT

    )

  `).run();
    // =====================================================
  // MasterForge Studio v0.3.0-alpha
  // Relationship Engine Foundation Tables
  // =====================================================

  db.prepare(`
    CREATE TABLE IF NOT EXISTS entities (
      id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      data_json TEXT DEFAULT '{}',
      source_pack TEXT DEFAULT NULL,
      is_persistent INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      PRIMARY KEY (entity_type, id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS relationships (
      id TEXT PRIMARY KEY,
      from_type TEXT NOT NULL,
      from_id TEXT NOT NULL,
      relationship TEXT NOT NULL,
      to_type TEXT NOT NULL,
      to_id TEXT NOT NULL,
      strength INTEGER DEFAULT 1,
      notes TEXT DEFAULT '',
      data_json TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (from_type, from_id)
        REFERENCES entities(entity_type, id)
        ON DELETE CASCADE,

      FOREIGN KEY (to_type, to_id)
        REFERENCES entities(entity_type, id)
        ON DELETE CASCADE
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      asset_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      name TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (entity_type, entity_id)
        REFERENCES entities(entity_type, id)
        ON DELETE CASCADE
    )
  `).run();

  // Helpful indexes for fast lookups later

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_entities_type
    ON entities(entity_type)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_entities_name
    ON entities(name)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_relationships_from
    ON relationships(from_type, from_id)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_relationships_to
    ON relationships(to_type, to_id)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_relationships_relationship
    ON relationships(relationship)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_assets_entity
    ON assets(entity_type, entity_id)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_assets_type
    ON assets(asset_type)
  `).run();

  // Keep updated_at fresh when rows are edited

  db.prepare(`
    CREATE TRIGGER IF NOT EXISTS trg_entities_updated_at
    AFTER UPDATE ON entities
    FOR EACH ROW
    BEGIN
      UPDATE entities
      SET updated_at = CURRENT_TIMESTAMP
      WHERE entity_type = OLD.entity_type
      AND id = OLD.id;
    END
  `).run();

  db.prepare(`
    CREATE TRIGGER IF NOT EXISTS trg_relationships_updated_at
    AFTER UPDATE ON relationships
    FOR EACH ROW
    BEGIN
      UPDATE relationships
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = OLD.id;
    END
  `).run();

  db.prepare(`
    CREATE TRIGGER IF NOT EXISTS trg_assets_updated_at
    AFTER UPDATE ON assets
    FOR EACH ROW
    BEGIN
      UPDATE assets
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = OLD.id;
    END
  `).run();


  seedMasterForgeDefaults();


  return dbPath;

}





/*
==================================================
 SAVE RECORD
==================================================
*/


function saveRecord(
  collection,
  id,
  data,
  scope = "global"
) {


  const now =
    new Date().toISOString();



  const existing =
    db.prepare(`

      SELECT id FROM records
      WHERE id = ?

    `).get(id);



  if (existing) {


    db.prepare(`

      UPDATE records

      SET

      collection = ?,

      scope = ?,

      data_json = ?,

      updated_at = ?

      WHERE id = ?

    `).run(

      collection,

      scope,

      JSON.stringify(data),

      now,

      id

    );


  } else {


    db.prepare(`

      INSERT INTO records

      (
        id,
        collection,
        scope,
        data_json,
        created_at,
        updated_at
      )

      VALUES (?,?,?,?,?,?)

    `).run(

      id,

      collection,

      scope,

      JSON.stringify(data),

      now,

      now

    );

  }

}





/*
==================================================
 GET SINGLE RECORD
==================================================
*/


function getRecord(id) {


  const row =
    db.prepare(`

      SELECT data_json

      FROM records

      WHERE id = ?

    `).get(id);



  if (!row)
    return null;



  return JSON.parse(
    row.data_json
  );

}






/*
==================================================
 GET COLLECTION
==================================================
*/


function getRecords(collection, scope = "global") {

  if (!db) {
    return [];
  }

  const rows = db.prepare(`
    SELECT id, data_json
    FROM records
    WHERE collection = ?
    AND scope = ?
    ORDER BY id ASC
  `).all(collection, scope);

  return rows.map(row => ({
    id: row.id,
    ...JSON.parse(row.data_json)
  }));

}
function getAllRecordsInCollection(collection) {
  if (!db) {
    return [];
  }

  const rows = db.prepare(`
    SELECT id, collection, scope, data_json
    FROM records
    WHERE collection = ?
    ORDER BY scope ASC, id ASC
  `).all(collection);

  return rows.map(row => ({
    id: row.id,
    collection: row.collection,
    scope: row.scope,
    ...JSON.parse(row.data_json)
  }));
}
function getRecordScopesForCollection(collection) {
  if (!db) {
    return [];
  }

  return db.prepare(`
    SELECT collection, scope, COUNT(*) as count
    FROM records
    WHERE collection = ?
    GROUP BY collection, scope
    ORDER BY collection ASC, scope ASC
  `).all(collection);
}




/*
==================================================
 DELETE RECORD
==================================================
*/


function deleteRecord(id) {


  db.prepare(`

    DELETE FROM records

    WHERE id = ?

  `).run(id);


}







/*
==================================================
 SAVE DEFAULTS WITHOUT OVERWRITE
==================================================
*/


function saveDefaultRecord(
  collection,
  id,
  data,
  scope = "global"
) {


  const existing =
    getRecord(id);



  if (existing)
    return;



  saveRecord(
    collection,
    id,
    data,
    scope
  );


}

function nowIso() {
  return new Date().toISOString();
}

function toJson(value) {
  if (value === undefined || value === null) {
    return "{}";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

function fromJson(value) {
  if (!value) {
    return {};
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return {};
  }
}




/*
==================================================
 INSTALL CONTENT PACK RECORD
==================================================
*/


function registerContentPack(pack) {

  if (!db) {
    console.warn(
      "registerContentPack skipped: database not initialised"
    );
    return;
  }

  db.prepare(`
    INSERT OR REPLACE INTO installed_packs
    (
      id,
      name,
      version,
      author,
      installed_at
    )
    VALUES (?,?,?,?,?)
  `).run(
    pack.id,
    pack.name,
    pack.version || "1.0.0",
    pack.author || "Unknown",
    new Date().toISOString()
  );

}


/*
==================================================
 GET INSTALLED PACKS
==================================================
*/


function getInstalledPacks() {

  if (!db) {
    return [];
  }

  return db.prepare(`
    SELECT *
    FROM installed_packs
    ORDER BY installed_at ASC
  `).all();

}
/*
==================================================
 CORE SEED DATA
==================================================
*/


function seedMasterForgeDefaults() {


  DEFAULT_THEMES.forEach(
    theme => {

      saveDefaultRecord(
        "themes",
        theme.id,
        theme
      );

    }
  );



  saveDefaultRecord(

    "settings",

    "theme-settings",

    {

      themeMode: "manual",

      manualTheme:
        "merchant-vessel",

      locationThemes: {},

      backgroundOpacity: 0.05,

      menusHidden: false

    }

  );


}

function deleteRecordsByContentPack(packId) {

  db.prepare(`DELETE FROM relationships WHERE json_extract(data_json, '$.sourcePack') = ?`).run(packId);
  db.prepare(`DELETE FROM entities WHERE source_pack = ?`).run(packId);

  // Remove all records installed by this pack
  db.prepare(`
    DELETE FROM records
    WHERE json_extract(data_json, '$.contentPack') = ?
  `).run(packId);


  // Remove the pack registration itself
  db.prepare(`
    DELETE FROM records
    WHERE collection = 'content-packs'
    AND id = ?
  `).run(packId);

  db.prepare(`
    DELETE FROM installed_packs
    WHERE id = ?
  `).run(packId);

}

function getDataPath(){

return currentDataPath;

}

function createEntity(entity) {
  const id = entity.id;
  const entityType = entity.entity_type;
  const name = entity.name;

  if (!id) {
    throw new Error("createEntity requires an id");
  }

  if (!entityType) {
    throw new Error("createEntity requires an entity_type");
  }

  if (!name) {
    throw new Error("createEntity requires a name");
  }

  const description = entity.description || "";
  const dataJson = toJson(entity.data_json || {});
  const sourcePack = entity.source_pack || null;
  const isPersistent = entity.is_persistent === false ? 0 : 1;
  const timestamp = nowIso();

  db.prepare(`
    INSERT INTO entities (
      id,
      entity_type,
      name,
      description,
      data_json,
      source_pack,
      is_persistent,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    entityType,
    name,
    description,
    dataJson,
    sourcePack,
    isPersistent,
    timestamp,
    timestamp
  );

  return getEntity(entityType, id);
}

function getEntity(entityType, id) {
  const row = db.prepare(`
    SELECT *
    FROM entities
    WHERE entity_type = ?
    AND id = ?
  `).get(entityType, id);

  if (!row) {
    return null;
  }

  return {
    ...row,
    data_json: fromJson(row.data_json),
    is_persistent: Boolean(row.is_persistent)
  };
}

function getEntitiesByType(entityType) {
  const rows = db.prepare(`
    SELECT *
    FROM entities
    WHERE entity_type = ?
    ORDER BY name ASC
  `).all(entityType);

  return rows.map((row) => ({
    ...row,
    data_json: fromJson(row.data_json),
    is_persistent: Boolean(row.is_persistent)
  }));
}

function updateEntity(entityType, id, updates) {
  const existing = getEntity(entityType, id);

  if (!existing) {
    throw new Error(`Entity not found: ${entityType}:${id}`);
  }

  const name = updates.name ?? existing.name;
  const description = updates.description ?? existing.description;
  const dataJson = updates.data_json !== undefined
    ? toJson(updates.data_json)
    : toJson(existing.data_json);

  const sourcePack = updates.source_pack ?? existing.source_pack;
  const isPersistent = updates.is_persistent !== undefined
    ? updates.is_persistent ? 1 : 0
    : existing.is_persistent ? 1 : 0;

  db.prepare(`
    UPDATE entities
    SET
      name = ?,
      description = ?,
      data_json = ?,
      source_pack = ?,
      is_persistent = ?
    WHERE entity_type = ?
    AND id = ?
  `).run(
    name,
    description,
    dataJson,
    sourcePack,
    isPersistent,
    entityType,
    id
  );

  return getEntity(entityType, id);
}

function deleteEntity(entityType, id) {
  const result = db.prepare(`
    DELETE FROM entities
    WHERE entity_type = ?
    AND id = ?
  `).run(entityType, id);

  return result.changes > 0;
}

function createRelationship(relationshipRecord) {
  const id = relationshipRecord.id;
  const fromType = relationshipRecord.from_type;
  const fromId = relationshipRecord.from_id;
  const relationship = relationshipRecord.relationship;
  const toType = relationshipRecord.to_type;
  const toId = relationshipRecord.to_id;

  if (!id) {
    throw new Error("createRelationship requires an id");
  }

  if (!fromType || !fromId) {
    throw new Error("createRelationship requires from_type and from_id");
  }

  if (!relationship) {
    throw new Error("createRelationship requires a relationship");
  }

  if (!toType || !toId) {
    throw new Error("createRelationship requires to_type and to_id");
  }

  const strength = relationshipRecord.strength ?? 1;
  const notes = relationshipRecord.notes || "";
  const dataJson = toJson(relationshipRecord.data_json || {});
  const timestamp = nowIso();

  db.prepare(`
    INSERT INTO relationships (
      id,
      from_type,
      from_id,
      relationship,
      to_type,
      to_id,
      strength,
      notes,
      data_json,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    fromType,
    fromId,
    relationship,
    toType,
    toId,
    strength,
    notes,
    dataJson,
    timestamp,
    timestamp
  );

  return getRelationship(id);
}

function getRelationship(id) {
  const row = db.prepare(`
    SELECT *
    FROM relationships
    WHERE id = ?
  `).get(id);

  if (!row) {
    return null;
  }

  return {
    ...row,
    data_json: fromJson(row.data_json)
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

function mergeRelationshipMetadata(existing, patch) {
  if (!isPlainObject(existing) || !isPlainObject(patch)) {
    throw new Error("Relationship metadata must be a plain object.");
  }

  return {
    ...existing,
    ...patch
  };
}

function updateRelationship(id, updates = {}) {
  const relationshipId = String(id || "").trim();

  if (!relationshipId) {
    throw new Error("updateRelationship requires an id");
  }

  if (!isPlainObject(updates)) {
    throw new Error("Relationship updates must be a plain object.");
  }

  const allowedFields = new Set([
    "notes",
    "strength",
    "data_json",
    "mergeDataJson"
  ]);
  const suppliedFields = Object.keys(updates);
  const unsupportedFields = suppliedFields.filter(
    field => !allowedFields.has(field)
  );

  if (unsupportedFields.length) {
    throw new Error(
      `Unsupported relationship update fields: ${unsupportedFields.join(", ")}`
    );
  }

  if (!suppliedFields.some(field => field !== "mergeDataJson")) {
    throw new Error("At least one relationship update field is required.");
  }

  const existing = getRelationship(relationshipId);

  if (!existing) {
    throw new Error(`Relationship not found: ${relationshipId}`);
  }

  if (
    updates.strength !== undefined &&
    updates.strength !== null &&
    (
      typeof updates.strength !== "number" ||
      !Number.isFinite(updates.strength)
    )
  ) {
    throw new Error("Relationship strength must be a finite number or null.");
  }

  if (
    updates.notes !== undefined &&
    updates.notes !== null &&
    typeof updates.notes !== "string"
  ) {
    throw new Error("Relationship notes must be a string or null.");
  }

  const mergeDataJson = updates.mergeDataJson !== false;
  let dataJson = existing.data_json || {};

  if (updates.data_json !== undefined) {
    if (updates.data_json === null) {
      if (mergeDataJson) {
        throw new Error(
          "Null relationship metadata is only valid when mergeDataJson is false."
        );
      }

      dataJson = {};
    } else if (!isPlainObject(updates.data_json)) {
      throw new Error("Relationship data_json must be a plain object or null.");
    } else {
      dataJson = mergeDataJson
        ? mergeRelationshipMetadata(existing.data_json || {}, updates.data_json)
        : updates.data_json;
    }
  }

  db.prepare(`
    UPDATE relationships
    SET
      strength = ?,
      notes = ?,
      data_json = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    updates.strength !== undefined ? updates.strength : existing.strength,
    updates.notes !== undefined ? updates.notes : existing.notes,
    toJson(dataJson),
    nowIso(),
    relationshipId
  );

  return getRelationship(relationshipId);
}

function deleteRelationship(id) {
  const result = db.prepare(`
    DELETE FROM relationships
    WHERE id = ?
  `).run(id);

  return result.changes > 0;
}

function getEntityRelationships(entityType, entityId) {
  const rows = db.prepare(`
    SELECT *
    FROM relationships
    WHERE
      (from_type = ? AND from_id = ?)
      OR
      (to_type = ? AND to_id = ?)
    ORDER BY relationship ASC
  `).all(entityType, entityId, entityType, entityId);

  return rows.map((row) => ({
    ...row,
    data_json: fromJson(row.data_json)
  }));
}

function addAsset(asset) {
  const id = asset.id;
  const entityType = asset.entity_type;
  const entityId = asset.entity_id;
  const assetType = asset.asset_type;
  const filePath = asset.file_path;

  if (!id) {
    throw new Error("addAsset requires an id");
  }

  if (!entityType || !entityId) {
    throw new Error("addAsset requires entity_type and entity_id");
  }

  if (!assetType) {
    throw new Error("addAsset requires asset_type");
  }

  if (!filePath) {
    throw new Error("addAsset requires file_path");
  }

  const name = asset.name || "";
  const timestamp = nowIso();

  db.prepare(`
    INSERT INTO assets (
      id,
      entity_type,
      entity_id,
      asset_type,
      file_path,
      name,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    entityType,
    entityId,
    assetType,
    filePath,
    name,
    timestamp,
    timestamp
  );

  return getAsset(id);
}

function getAsset(id) {
  return db.prepare(`
    SELECT *
    FROM assets
    WHERE id = ?
  `).get(id) || null;
}

function getEntityAssets(entityType, entityId) {
  return db.prepare(`
    SELECT *
    FROM assets
    WHERE entity_type = ?
    AND entity_id = ?
    ORDER BY asset_type ASC, name ASC
  `).all(entityType, entityId);
}


module.exports = {
  initialiseDatabase,
  saveRecord,
    getRecord,
  getRecords,
  getAllRecordsInCollection,
  getRecordScopesForCollection,
  deleteRecord,
  deleteRecordsByContentPack,
  getDataPath,
  registerContentPack,
  getInstalledPacks,
  createEntity,
  getEntity,
  getEntitiesByType,
  updateEntity,
  deleteEntity,

  createRelationship,
  getRelationship,
  updateRelationship,
  deleteRelationship,
  getEntityRelationships,

  addAsset,
  getAsset,
  getEntityAssets,
};
