const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("dmAPI", {
  getMachineId: () => ipcRenderer.invoke("activation:getMachineId"),

  getActivationScreenState: () =>
  ipcRenderer.invoke(
    "activation:getScreenState"
  ),
  
  activateLicence: (
  email,
  accessKey
) =>
  ipcRenderer.invoke(
    "activation:activate",
    {
      email,
      access_key: accessKey,
    }
  ),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  chooseDataPath: () => ipcRenderer.invoke("settings:chooseDataPath"),
  listWorlds: () => ipcRenderer.invoke("worlds:list"),

  migrateJsonToDb: () => ipcRenderer.invoke("migration:jsonToDb"),
  
listLocations: (worldId) =>
  ipcRenderer.invoke("locations:list", worldId),

listRegions: (locationId) =>
  ipcRenderer.invoke("regions:list", locationId),

installContentPack: (packPath) =>
  ipcRenderer.invoke(
    "content:installPack",
    packPath
  ),
listDbThemes: () => ipcRenderer.invoke("themes:listDb"),

listContentPacks: () =>
  ipcRenderer.invoke("content:listPacks"),

removeContentPack: (packId) =>
  ipcRenderer.invoke(
    "content:removePack",
    packId
  ),
  // =====================================================
  // Relationship Engine API
  // =====================================================

  createEntity: (entity) =>
    ipcRenderer.invoke("entity:create", entity),

  getEntity: (entityType, id) =>
    ipcRenderer.invoke("entity:get", entityType, id),

  getEntitiesByType: (entityType) =>
    ipcRenderer.invoke("entity:listByType", entityType),

  updateEntity: (entityType, id, updates) =>
    ipcRenderer.invoke("entity:update", entityType, id, updates),

  deleteEntity: (entityType, id) =>
    ipcRenderer.invoke("entity:delete", entityType, id),

  createRelationship: (relationship) =>
    ipcRenderer.invoke("relationship:create", relationship),

  updateRelationship: (id, updates) =>
    ipcRenderer.invoke("relationship:update", { id, updates }),

  getEntityRelationships: (entityType, entityId) =>
    ipcRenderer.invoke("relationship:getForEntity", entityType, entityId),

  deleteRelationship: (id) =>
    ipcRenderer.invoke("relationship:delete", id),

  addAsset: (asset) =>
    ipcRenderer.invoke("asset:add", asset),

  getEntityAssets: (entityType, entityId) =>
    ipcRenderer.invoke("asset:getForEntity", entityType, entityId),
  
chooseContentPackFile: () =>
  ipcRenderer.invoke("content:choosePackFile"),

getDbThemeSettings: () =>
  ipcRenderer.invoke("settings:getTheme"),

saveDbThemeSettings: (settings) =>
  ipcRenderer.invoke("settings:saveTheme", settings),

  readJson: (relativePath, fallback) =>
    ipcRenderer.invoke("file:readJson", relativePath, fallback),

  writeJson: (relativePath, data) =>
    ipcRenderer.invoke("file:writeJson", relativePath, data),

  listJson: (relativeFolder) =>
    ipcRenderer.invoke("file:listJson", relativeFolder),

  listCampaignPartyRecords: () =>
    ipcRenderer.invoke("campaign:listPartyRecords"),

  saveRecord: (collection, id, data, scope = "global") =>
    ipcRenderer.invoke("db:saveRecord", collection, id, data, scope),

  getRecord: (id) =>
    ipcRenderer.invoke("db:getRecord", id),

  getRecords: (collection, scope = "global") =>
    ipcRenderer.invoke("db:getRecords", collection, scope),

  getAllRecordsInCollection: (collection) =>
  ipcRenderer.invoke("db:getAllRecordsInCollection", collection),

getRecordScopesForCollection: (collection) =>
  ipcRenderer.invoke("db:getRecordScopesForCollection", collection),

  deleteRecord: (id) =>
    ipcRenderer.invoke("db:deleteRecord", id),
  
  installTheme: () => ipcRenderer.invoke("theme:install"),
  listThemes: () => ipcRenderer.invoke("theme:list"),
  saveThemeSettings: (settings) => ipcRenderer.invoke("theme:saveSettings", settings),
  getThemeSettings: () => ipcRenderer.invoke("theme:getSettings"),

  closeWindow: () => ipcRenderer.send("window:close"),
  minimizeWindow: () => ipcRenderer.send("window:minimize"),

  focusMainWindow: () =>
    ipcRenderer.invoke("window:focusMain")

  
});
