const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const os = require("os");
const crypto = require("crypto");

const FORMAT = "masterforge-content-pack";
const FORMAT_VERSION = "1.0.0";
const SUPPORTED_COLLECTIONS = new Set([
  "systems", "worlds", "campaigns", "regions", "locations", "factions",
  "parties", "party-groups", "characters", "npcs", "creatures", "relationships",
  "planned-encounters", "sessions", "narration", "items", "quests", "tables"
]);
const ASSET_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".mp3", ".ogg", ".wav", ".pdf", ".md"]);
const ENTITY_MIRROR_TYPES = Object.freeze({
  campaigns: "campaign", worlds: "world", regions: "region", locations: "location",
  parties: "party", characters: "pc", npcs: "npc", creatures: "creature",
  factions: "faction", items: "item"
});

function assertSafeRelative(relativePath) {
  const normal = String(relativePath || "").replace(/\\/g, "/");
  if (!normal || path.posix.isAbsolute(normal) || normal.split("/").includes("..") || /^[a-z]:/i.test(normal)) {
    throw new Error(`Unsafe content-pack path: ${relativePath}`);
  }
  return normal;
}

function readJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
  catch (error) { throw new Error(`Invalid JSON in ${path.basename(filePath)}: ${error.message}`); }
}

function validateManifest(manifest) {
  if (manifest.format !== FORMAT || manifest.formatVersion !== FORMAT_VERSION) throw new Error(`Unsupported content-pack format. Expected ${FORMAT} ${FORMAT_VERSION}.`);
  for (const key of ["packId", "name", "version", "author", "minimumAppVersion", "systemId", "collections"]) {
    if (!manifest[key]) throw new Error(`Content-pack manifest is missing ${key}.`);
  }
  if (!/^[a-z0-9][a-z0-9._-]+$/i.test(manifest.packId)) throw new Error("Content-pack packId contains unsupported characters.");
  if (manifest.installMode !== "copy-with-new-local-ids") throw new Error("Only copy-with-new-local-ids packs are supported.");
  for (const collection of Object.keys(manifest.collections)) if (!SUPPORTED_COLLECTIONS.has(collection)) throw new Error(`Unsupported canonical collection: ${collection}`);
}

function extractArchive(packPath, target) {
  const zip = new AdmZip(packPath);
  for (const entry of zip.getEntries()) assertSafeRelative(entry.entryName);
  zip.extractAllTo(target, true);
  if (fs.existsSync(path.join(target, "manifest.json"))) return target;
  const roots = fs.readdirSync(target).map(name => path.join(target, name)).filter(item => fs.statSync(item).isDirectory() && fs.existsSync(path.join(item, "manifest.json")));
  if (roots.length !== 1) throw new Error("Archive must contain exactly one content-pack manifest.");
  return roots[0];
}

function localId(packId, packRecordId) {
  return `pack-${crypto.createHash("sha256").update(`${packId}:${packRecordId}`).digest("hex").slice(0, 24)}`;
}

function rewriteReferences(value, idMap) {
  if (Array.isArray(value)) return value.map(item => rewriteReferences(item, idMap));
  if (!value || typeof value !== "object") return typeof value === "string" && idMap.has(value) ? idMap.get(value) : value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteReferences(item, idMap)]));
}

function canonicalContext(data = {}) {
  return {
    campaignId: String(data.campaignId || data.campaign || data.scope?.campaignId || ""),
    worldId: String(data.worldId || data.world || data.scope?.worldId || ""),
    regionId: String(data.regionId || data.region || data.scope?.regionId || ""),
    locationId: String(data.locationId || data.location || data.scope?.locationId || "")
  };
}

function normaliseCanonicalRecord(collection, data) {
  const context = canonicalContext(data);
  if (context.campaignId) { data.campaignId = context.campaignId; data.campaign = context.campaignId; }
  if (context.worldId) { data.worldId = context.worldId; data.world = context.worldId; }
  if (context.regionId) { data.regionId = context.regionId; data.region = context.regionId; }
  if (context.locationId) { data.locationId = context.locationId; data.location = context.locationId; }
  data.scope = { ...(data.scope || {}), ...Object.fromEntries(Object.entries(context).filter(([, value]) => value)) };
  if (ENTITY_MIRROR_TYPES[collection]) data.entityId = data.id;
  if (collection === "campaigns") {
    data.primaryWorldId = data.primaryWorldId || context.worldId;
    data.currentWorldId = data.currentWorldId || context.worldId;
    data.currentRegionId = data.currentRegionId || context.regionId;
    data.currentLocationId = data.currentLocationId || context.locationId;
  }
  if (collection === "relationships") {
    data.from_type = data.from_type || data.sourceEntityType;
    data.from_id = data.from_id || data.sourceEntityId;
    data.relationship = data.relationship || data.relationshipType;
    data.to_type = data.to_type || data.targetEntityType;
    data.to_id = data.to_id || data.targetEntityId;
  }
  return data;
}

function hydrateOwnershipChains(prepared) {
  const byId = new Map(prepared.map(item => [item.id, item.data]));
  for (const item of prepared) {
    const data = item.data;
    const location = byId.get(data.locationId || data.location);
    const region = byId.get(data.regionId || data.region || location?.regionId);
    const campaign = byId.get(data.campaignId || data.campaign);
    data.worldId = data.worldId || data.world || location?.worldId || region?.worldId || campaign?.worldId || "";
    data.regionId = data.regionId || data.region || location?.regionId || campaign?.regionId || "";
    normaliseCanonicalRecord(item.collection, data);
  }
}

function canonicalRecordScope(collection, data) {
  const context = canonicalContext(data);
  if (collection === "worlds") return "global";
  if (collection === "regions") return context.worldId || "global";
  if (collection === "locations") return context.regionId || "global";
  return context.campaignId || context.worldId || context.regionId || context.locationId || "global";
}

function resolveEntryPoint(manifest, idMap, prepared) {
  const declared = manifest.entryPoint || {};
  const campaignSourceId = declared.campaignId || manifest.entryCampaignId || "";
  const campaign = prepared.find(item => item.collection === "campaigns" && item.packScopedId === campaignSourceId)?.data;
  const source = {
    campaignId: campaignSourceId,
    worldId: declared.worldId || campaign?.worldId || "",
    regionId: declared.regionId || campaign?.regionId || "",
    locationId: declared.locationId || campaign?.locationId || campaign?.currentLocationId || ""
  };
  const resolved = Object.fromEntries(Object.entries(source).map(([key, value]) => [key, idMap.get(value) || value]));
  if (Object.values(resolved).some(value => !value)) throw new Error("Content-pack entryPoint must identify a campaign, world, region and location.");
  return resolved;
}

function validatePreparedImport(prepared, entryPoint) {
  const byId = new Map(prepared.map(item => [item.id, item]));
  const expected = { campaignId: "campaigns", worldId: "worlds", regionId: "regions", locationId: "locations" };
  let checked = 0;
  const broken = [];
  for (const item of prepared) {
    const context = canonicalContext(item.data);
    for (const [field, collection] of Object.entries(expected)) {
      if (!context[field]) continue;
      checked += 1;
      if (byId.get(context[field])?.collection !== collection) broken.push(`${item.collection}:${item.packScopedId}.${field}`);
    }
    if (item.collection === "parties") for (const id of item.data.characters || []) { checked += 1; if (byId.get(id)?.collection !== "characters") broken.push(`${item.collection}:${item.packScopedId}.characters`); }
    if (item.collection === "planned-encounters") for (const participant of item.data.participants || []) {
      const sourceCollection = { pc: "characters", npc: "npcs", creature: "creatures", party: "parties", party_group: "party-groups" }[participant.sourceType];
      if (!sourceCollection) continue;
      checked += 1;
      if (byId.get(participant.sourceId)?.collection !== sourceCollection) broken.push(`${item.collection}:${item.packScopedId}.participants:${participant.sourceId}`);
    }
    if (item.collection === "relationships") {
      for (const endpoint of [item.data.from_id, item.data.to_id]) { checked += 1; if (!byId.has(endpoint)) broken.push(`${item.collection}:${item.packScopedId}.endpoint:${endpoint}`); }
    }
  }
  for (const [field, collection] of Object.entries(expected)) { checked += 1; if (byId.get(entryPoint[field])?.collection !== collection) broken.push(`entryPoint.${field}`); }
  const campaign = byId.get(entryPoint.campaignId)?.data;
  const region = byId.get(entryPoint.regionId)?.data;
  const location = byId.get(entryPoint.locationId)?.data;
  const contextChains = Number(campaign?.worldId === entryPoint.worldId) + Number(region?.worldId === entryPoint.worldId) + Number(location?.worldId === entryPoint.worldId && location?.regionId === entryPoint.regionId);
  if (contextChains !== 3) broken.push("entryPoint.contextChain");
  if (broken.length) throw new Error(`Import integrity failed (${broken.length} broken references): ${broken.join(", ")}`);
  return { referencesValidated: checked, brokenReferences: 0, contextChainsValidated: contextChains };
}

function prepareImport(packRoot, manifest) {
  const records = [];
  const seen = new Set();
  for (const [collection, relativePath] of Object.entries(manifest.collections)) {
    const safe = assertSafeRelative(relativePath);
    const fullPath = path.resolve(packRoot, safe);
    if (!fullPath.startsWith(path.resolve(packRoot) + path.sep) || !fs.existsSync(fullPath)) throw new Error(`Missing collection file: ${safe}`);
    const content = readJson(fullPath);
    if (!Array.isArray(content)) throw new Error(`${safe} must contain a JSON array.`);
    for (const record of content) {
      if (!record || typeof record !== "object" || Array.isArray(record) || !String(record.id || "").trim()) throw new Error(`${safe} contains a record without an id.`);
      const packScopedId = String(record.id);
      if (seen.has(packScopedId)) throw new Error(`Duplicate pack-scoped record id: ${packScopedId}`);
      seen.add(packScopedId);
      records.push({ collection, packScopedId, record });
    }
  }
  const idMap = new Map(records.map(item => [item.packScopedId, localId(manifest.packId, item.packScopedId)]));
  const prepared = records.map(item => {
    const declaredContext = manifest.recordContexts?.[item.packScopedId] || {};
    const data = normaliseCanonicalRecord(item.collection, rewriteReferences({ ...item.record, ...declaredContext }, idMap));
    data.id = idMap.get(item.packScopedId);
    data.contentPack = manifest.packId;
    data.contentPackRecordId = item.packScopedId;
    return { ...item, id: data.id, data, scope: "global" };
  });
  hydrateOwnershipChains(prepared);
  prepared.forEach(item => { item.scope = canonicalRecordScope(item.collection, item.data); });
  const entryPoint = resolveEntryPoint(manifest, idMap, prepared);
  const integrity = validatePreparedImport(prepared, entryPoint);
  return { prepared, idMap, entryPoint, integrity };
}

function copyAssets(packRoot, manifest, destination) {
  const copied = [];
  for (const relativePath of Object.values(manifest.assets || {})) {
    const safe = assertSafeRelative(relativePath);
    const source = path.resolve(packRoot, safe);
    if (!source.startsWith(path.resolve(packRoot) + path.sep) || !fs.existsSync(source)) throw new Error(`Missing asset: ${safe}`);
    if (!ASSET_EXTENSIONS.has(path.extname(source).toLowerCase())) throw new Error(`Unsupported asset type: ${safe}`);
    const target = path.join(destination, safe);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    copied.push(safe);
  }
  return copied;
}

function installContentPackFromFolder(db, packRoot) {
  const manifestPath = path.join(packRoot, "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new Error("Invalid MasterForge pack: manifest.json is missing.");
  const manifest = readJson(manifestPath);
  validateManifest(manifest);
  const packId = manifest.packId;
  const existing = (db.getRecords("content-packs") || []).find(pack => (pack.packId || pack.id) === packId);
  if (existing) throw new Error(`${manifest.name} ${existing.version} is already installed. Remove it before reinstalling or updating.`);
  const { prepared, idMap, entryPoint, integrity } = prepareImport(packRoot, manifest);
  for (const item of prepared) if (db.getRecord(item.id)) throw new Error(`Local record collision detected for ${item.packScopedId}.`);

  const destination = path.join(db.getDataPath(), "content-packs", packId);
  const staging = `${destination}.installing-${Date.now()}`;
  const installedAt = new Date().toISOString();
  try {
    fs.mkdirSync(staging, { recursive: true });
    const assetsInstalled = copyAssets(packRoot, manifest, staging);
    for (const item of prepared) db.saveRecord(item.collection, item.id, item.data, item.scope);
    let entityMirrorsCreated = 0;
    for (const item of prepared) {
      const entityType = ENTITY_MIRROR_TYPES[item.collection];
      if (!entityType) continue;
      const context = canonicalContext(item.data);
      db.createEntity({
        id: item.id, entity_type: entityType, name: item.data.name || item.id,
        description: item.data.description || "", source_pack: packId,
        data_json: { source: "content-pack", sourceCollection: item.collection, sourceId: item.id, scope: context, currentPosition: { mode: "location", worldId: context.worldId, regionId: context.regionId, locationId: context.locationId, entityType: "", entityId: "", notes: "" } }
      });
      entityMirrorsCreated += 1;
    }
    for (const item of prepared.filter(record => record.collection === "relationships")) {
      db.createRelationship({
        id: item.id, from_type: item.data.from_type, from_id: item.data.from_id,
        relationship: item.data.relationship, to_type: item.data.to_type, to_id: item.data.to_id,
        strength: item.data.strength ?? 1, notes: item.data.notes || "", data_json: { sourcePack: packId }
      });
    }
    const registry = {
      ...manifest, id: packId, packId, installed: installedAt, installedDate: installedAt,
      suppliedRecordCounts: Object.fromEntries([...SUPPORTED_COLLECTIONS].map(collection => [collection, prepared.filter(item => item.collection === collection).length]).filter(([, count]) => count)),
      localRecordMappings: Object.fromEntries(idMap), entryPoint, assetsInstalled, updateHistory: [],
      integrity: { ...integrity, entityMirrorsCreated }
    };
    db.saveRecord("content-packs", packId, registry, "global");
    if (fs.existsSync(destination)) throw new Error("Content-pack destination already exists.");
    fs.renameSync(staging, destination);
    if (db.registerContentPack) db.registerContentPack({ id: packId, name: manifest.name, version: manifest.version, author: manifest.author, installed_at: installedAt });
    return registry;
  } catch (error) {
    db.deleteRecordsByContentPack(packId);
    if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
    throw new Error(`Content-pack installation rolled back: ${error.message}`);
  }
}

function installContentPack(db, packPath) {
  let tempFolder = null;
  try {
    const isArchive = /\.(zip|mforge)$/i.test(packPath);
    if (isArchive) tempFolder = fs.mkdtempSync(path.join(os.tmpdir(), "masterforge-pack-"));
    const packRoot = isArchive ? extractArchive(packPath, tempFolder) : packPath;
    return installContentPackFromFolder(db, packRoot);
  } finally {
    if (tempFolder && fs.existsSync(tempFolder)) fs.rmSync(tempFolder, { recursive: true, force: true });
  }
}

module.exports = { installContentPack, installContentPackFromFolder, validateManifest, prepareImport, rewriteReferences, assertSafeRelative };
