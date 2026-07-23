const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
} = require("electron");

const path = require("path");
const fs = require("fs");

const {
  VERSION,
} = require("./src/version.js");

const PACKAGED_USER_DATA_FOLDER = `MasterForge Studio ${VERSION}`;

if (app.isPackaged) {
  app.setPath(
    "userData",
    path.join(app.getPath("appData"), PACKAGED_USER_DATA_FOLDER)
  );
} else {
  app.setName("MasterForge Studio Dev");

  app.setPath(
    "userData",
    path.join(app.getPath("appData"), "MasterForge Studio Dev")
  );
}

const dmDatabase = require("./src/database.js");

const {
  getOrCreateMachineId,
  activateLicence,
  saveLocalLicence,
  getActivationPlatform,
  readLocalLicence,
  getLocalLicenceState,
  validateStoredLicence,
  isWithinOfflineGracePeriod,
  OFFLINE_GRACE_DAYS,
} = require("./src/activation/activationManager.js");

const {
  fetchUpdateInfo,
  getUpdateStatus,
} = require("./src/update/updateManager.js");

function safePath(basePath, relativePath) {
  const resolved = path.resolve(
    basePath,
    relativePath
  );

  const resolvedBase = path.resolve(basePath);
  if (resolved !== resolvedBase && !resolved.startsWith(resolvedBase + path.sep)) {
    throw new Error(
      `Path traversal blocked: ${relativePath}`
    );
  }

  return resolved;
}

let win;

let isStudioUnlocked = false;
let activationScreenReason = null;

const settingsPath = path.join(app.getPath("userData"), "settings.json");
const { installContentPack } = require("./src/contentInstaller");

function defaultDataPath() {
  return path.join(app.getPath("userData"), "default-data");
}

function bundledDefaultsPath() {
  return app.isPackaged ? path.join(process.resourcesPath, "default-data") : path.join(__dirname, "default-data");
}

function isDevelopmentDataPath(candidate) {
  const normal = path.resolve(String(candidate || "")).replace(/\\/g, "/").toLowerCase();
  return /(^|\/)dev\/masterforge studio v[^/]+\/default-data(\/|$)/.test(normal);
}

function normaliseSettings(settings = {}) {
  const defaults = { dataPath: defaultDataPath(), dataPathSelectionMode: "application-user-data" };
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return defaults;
  const explicitlySelected = settings.dataPathSelectionMode === "user-selected";
  const selectedPath = String(settings.dataPath || "").trim();
  if (explicitlySelected && selectedPath && (!app.isPackaged || !isDevelopmentDataPath(selectedPath))) {
    return { ...settings, dataPath: path.resolve(selectedPath), dataPathSelectionMode: "user-selected" };
  }
  return { ...settings, ...defaults };
}

function readSettings() {
  if (!fs.existsSync(settingsPath)) {
    const settings = normaliseSettings();
    writeSettings(settings);
    return settings;
  }
  const stored = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  const settings = normaliseSettings(stored);
  if (JSON.stringify(settings) !== JSON.stringify(stored)) writeSettings(settings);
  return settings;
}

function writeSettings(settings) {
  ensureFolder(path.dirname(settingsPath));
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

function ensureFolder(folderPath) {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
}

function prepareApplicationData() {
  const settings = readSettings();
  const firstDataLaunch = !fs.existsSync(settings.dataPath);
  ensureFolder(settings.dataPath);
  if (firstDataLaunch) {
    const bundledDefaults = bundledDefaultsPath();
    for (const folder of ["themes", "rules"]) {
      const source = path.join(bundledDefaults, folder);
      if (fs.existsSync(source)) fs.cpSync(source, path.join(settings.dataPath, folder), { recursive: true });
    }
    console.log("Bundled defaults installed into application userData:", settings.dataPath);
  }
  return settings;
}

async function handleInitialLicenceState() {
  const licenceData =
    readLocalLicence(app);

  const licenceState =
    getLocalLicenceState(
      licenceData
    );

  console.log(
    "LOCAL LICENCE STATE:",
    licenceState
  );

  if (
    licenceState ===
    "valid_offline"
  ) {
    await unlockMasterForgeStudio();
    return;
  }

  if (
    licenceState ===
    "revalidation_required"
  ) {
    const machineId =
      getOrCreateMachineId(app);

    const validationResult =
      await validateStoredLicence({
        licenceToken:
          licenceData.licence_token,

        machineId,
        appVersion: VERSION,
      });

    if (validationResult?.valid) {
      const updatedLicence = {
        ...licenceData,

        machine_id: machineId,
        app_version: VERSION,
        platform:
          getActivationPlatform(),

        last_validated_at:
          validationResult.last_validated_at ||
          new Date().toISOString(),

        revalidate_at:
          validationResult.revalidate_at ||
          licenceData.revalidate_at,

        reactivate_at:
          validationResult.reactivate_at ||
          licenceData.reactivate_at,

        revalidate_after_days:
          validationResult.revalidate_after_days ||
          licenceData.revalidate_after_days ||
          30,

        reactivate_after_days:
          validationResult.reactivate_after_days ||
          licenceData.reactivate_after_days ||
          180,

        saved_at:
          new Date().toISOString(),
      };

      saveLocalLicence(
        app,
        updatedLicence
      );

      console.log(
        "Licence revalidated successfully."
      );

      await unlockMasterForgeStudio();
      return;
    }

    const validationError =
  validationResult?.error;

console.warn(
  "Licence revalidation failed:",
  validationError
);

const temporaryServerFailure =
  validationError === "network_error" ||
  validationError === "server_error";

if (
  temporaryServerFailure &&
  isWithinOfflineGracePeriod(
    licenceData
  )
) {
  console.warn(
    `MasterForge Studio is using its ${OFFLINE_GRACE_DAYS}-day offline grace period.`
  );

  await unlockMasterForgeStudio();
  return;
}

activationScreenReason =
  licenceState ===
  "reactivation_required"
    ? "reactivation_required"
    : null;

    activationScreenReason =
  validationError ||
  "server_error";

await win.loadFile(
  path.join(
    __dirname,
    "src",
    "activation.html"
  )
);

return;
  }

  await win.loadFile(
  path.join(
    __dirname,
    "src",
    "activation.html"
  )
);
}

function createWindow() {
  prepareApplicationData();
  win = new BrowserWindow({
    width: 1400,
    height: 850,
    minWidth: 1000,
    minHeight: 650,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  handleInitialLicenceState()
  .catch((error) => {
    console.error(
      "Startup licence check failed:",
      error
    );

    win.loadFile(
      path.join(
        __dirname,
        "src",
        "activation.html"
      )
    );
  });
}

async function unlockMasterForgeStudio() {
  if (isStudioUnlocked) {
    return true;
  }

  isStudioUnlocked = true;

  try {
    const settings = prepareApplicationData();

    const activeDb =
      dmDatabase.initialiseDatabase(
        settings.dataPath
      );

    console.log(
      "ACTIVE DATABASE:",
      activeDb
    );

    await win.loadFile(
      path.join(
        __dirname,
        "src",
        "index.html"
      )
    );

    return true;
  } catch (error) {
    isStudioUnlocked = false;

    console.error(
      "Unable to unlock MasterForge Studio:",
      error
    );

    throw error;
  }
}

ipcMain.handle(
  "activation:getScreenState",
  () => {
    const licenceData =
      readLocalLicence(app);

    return {
      reason: activationScreenReason,
      email:
        typeof licenceData?.email === "string"
          ? licenceData.email
          : ""
    };
  }
);

ipcMain.handle("activation:getMachineId", () => {
  try {
    const machineId = getOrCreateMachineId(app);

    return {
      success: true,
      machine_id: machineId,
    };
  } catch (error) {
    console.error("Unable to create machine ID:", error);

    return {
      success: false,
      error: "machine_id_error",
    };
  }
});

ipcMain.handle(
  "activation:activate",
  async (event, activationDetails) => {
    try {
      const machineId =
        getOrCreateMachineId(app);

      const result =
        await activateLicence({
          email:
            activationDetails?.email,

          accessKey:
            activationDetails?.access_key,

          machineId,
          appVersion: VERSION,
        });

      if (
        !result?.valid ||
        !result?.license_token
      ) {
        return {
          ...result,
          machine_id: machineId,
        };
      }

      const licenceData = {
        licence_token:
          result.license_token,

        email:
          String(
            activationDetails?.email || ""
          )
            .trim()
            .toLowerCase(),

        machine_id: machineId,
        app_version: VERSION,
        platform:
          getActivationPlatform(),

        last_validated_at:
          result.last_validated_at ||
          new Date().toISOString(),

        revalidate_at:
          result.revalidate_at ||
          null,

        reactivate_at:
          result.reactivate_at ||
          null,

        revalidate_after_days:
          result.revalidate_after_days ||
          30,

        reactivate_after_days:
          result.reactivate_after_days ||
          180,

        saved_at:
          new Date().toISOString(),
      };

      saveLocalLicence(
  app,
  licenceData
);

activationScreenReason = null;
await unlockMasterForgeStudio();

return {
  valid: true,
  machine_id: machineId,
  last_validated_at:
    licenceData.last_validated_at,
  revalidate_at:
    licenceData.revalidate_at,
  reactivate_at:
    licenceData.reactivate_at,
};
    } catch (error) {
      console.error(
        "Activation request failed:",
        error
      );

      return {
        valid: false,
        error: "server_error",
      };
    }
  }
);

ipcMain.handle("migration:jsonToDb", () => {
  const settings = readSettings();

  function readJsonSafe(relativePath, fallback) {
    const fullPath =
  safePath(
    settings.dataPath,
    relativePath
  );

    if (!fs.existsSync(fullPath)) {
      return fallback;
    }

    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  }

  const players = readJsonSafe("players/index.json", []);
  const characters = readJsonSafe("characters/index.json", []);

  players.forEach((player) => {
    dmDatabase.saveRecord("players", player.id, player);
  });

  characters.forEach((character) => {
    dmDatabase.saveRecord("characters", character.id, character);
  });

  return {
    playersImported: players.length,
    charactersImported: characters.length
  };
});

ipcMain.handle(
  "content:installPack",
  async (event, packPath) => {
    return installContentPack(
      dmDatabase,
      packPath
    );
  }
);

ipcMain.handle("content:listPacks", async () => {
  return dmDatabase.getRecords("content-packs");
});

ipcMain.handle("content:removePack", async (event, packId) => {
  dmDatabase.deleteRecordsByContentPack(packId);
  const packFolder = path.join(dmDatabase.getDataPath(), "content-packs", String(packId));
  const contentPacksRoot = path.join(dmDatabase.getDataPath(), "content-packs") + path.sep;
  if (packFolder.startsWith(contentPacksRoot) && fs.existsSync(packFolder)) {
    fs.rmSync(packFolder, { recursive: true, force: true });
  }
  return true;
});

ipcMain.handle("content:choosePackFile", async () => {
  const result = await dialog.showOpenDialog(win, {
    title: "Install MasterForge Content Pack",
    properties: ["openFile"],
    filters: [
      {
        name: "MasterForge Content Pack",
        extensions: ["mforge", "zip"]
      }
    ]
  });

  if (result.canceled || !result.filePaths[0]) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle("worlds:list", () => {
  return dmDatabase.getRecords("worlds");
});

ipcMain.handle("locations:list", (event, worldId) => {
  return dmDatabase.getRecords("locations", worldId);
});

ipcMain.handle("regions:list", (event, locationId) => {
  return dmDatabase.getRecords("regions", locationId);
});

ipcMain.handle("themes:listDb", () => {
  return dmDatabase.getRecords("themes");
});

ipcMain.handle("theme:list", () => {
  const fs = require("fs");
  const path = require("path");

  const themesPath = path.join(
    dmDatabase.getDataPath(),
    "themes"
  );

  if (!fs.existsSync(themesPath)) {
    return [];
  }

  return fs.readdirSync(themesPath)
    .filter(folder => {
      const fullPath = path.join(themesPath, folder);
      return fs.statSync(fullPath).isDirectory();
    })
    .map(folder => {
      const themeFolder = path.join(themesPath, folder);
      const manifestPath = path.join(themeFolder, "manifest.json");

      let manifest = {};

      if (fs.existsSync(manifestPath)) {
        try {
          manifest = JSON.parse(
            fs.readFileSync(manifestPath, "utf8")
          );
        } catch (err) {
          console.error("Invalid theme manifest:", manifestPath, err);
        }
      }

      return {
        id: manifest.id || folder,
        name: manifest.name || folder,
        version: manifest.version || "Unknown",
        author: manifest.author || "Unknown",
        description: manifest.description || "",
        background: manifest.background || "background.webp",
        css: manifest.css || "theme.css",
        preview: manifest.preview || "preview.webp",
        folder,
        path: themeFolder
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
});

ipcMain.handle("settings:getTheme", () => {
  return dmDatabase.getRecord("theme-settings");
});

ipcMain.handle("settings:saveTheme", (event, themeSettings) => {
  dmDatabase.saveRecord(
    "settings",
    "theme-settings",
    themeSettings
  );

  return true;
});

// =====================================================
// MasterForge Studio v0.3.0-alpha
// Relationship Engine IPC Handlers
// =====================================================

ipcMain.handle("entity:create", async (event, entity) => {
  return dmDatabase.createEntity(entity);
});

ipcMain.handle("entity:get", async (event, entityType, id) => {
  return dmDatabase.getEntity(entityType, id);
});

ipcMain.handle("entity:listByType", async (event, entityType) => {
  return dmDatabase.getEntitiesByType(entityType);
});

ipcMain.handle("entity:update", async (event, entityType, id, updates) => {
  return dmDatabase.updateEntity(entityType, id, updates);
});

ipcMain.handle("entity:delete", async (event, entityType, id) => {
  return dmDatabase.deleteEntity(entityType, id);
});

ipcMain.handle("relationship:create", async (event, relationship) => {
  return dmDatabase.createRelationship(relationship);
});

ipcMain.handle("relationship:update", async (event, payload) => {
  try {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("A relationship update payload is required.");
    }

    const id = String(payload.id || "").trim();
    const updates = payload.updates;

    if (!id) {
      throw new Error("Relationship ID is required.");
    }

    if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
      throw new Error("Relationship updates must be a plain object.");
    }

    const allowedFields = new Set([
      "notes",
      "strength",
      "data_json",
      "mergeDataJson"
    ]);
    const unsupportedFields = Object.keys(updates).filter(
      field => !allowedFields.has(field)
    );

    if (unsupportedFields.length) {
      throw new Error(
        `Unsupported relationship update fields: ${unsupportedFields.join(", ")}`
      );
    }

    return dmDatabase.updateRelationship(id, updates);
  } catch (error) {
    const message = error?.message || "Relationship update failed.";
    console.warn("Controlled relationship update failure:", message);
    throw new Error(message);
  }
});

ipcMain.handle("relationship:getForEntity", async (event, entityType, entityId) => {
  return dmDatabase.getEntityRelationships(entityType, entityId);
});

ipcMain.handle("relationship:delete", async (event, id) => {
  return dmDatabase.deleteRelationship(id);
});

ipcMain.handle("asset:add", async (event, asset) => {
  return dmDatabase.addAsset(asset);
});

ipcMain.handle("asset:getForEntity", async (event, entityType, entityId) => {
  return dmDatabase.getEntityAssets(entityType, entityId);
});

ipcMain.handle("settings:get", () => {
  return readSettings();
});

ipcMain.handle("settings:chooseDataPath", async () => {
  const result = await dialog.showOpenDialog(win, {
    properties: ["openDirectory", "createDirectory"],
    title: "Choose MasterForge Studio data folder"
  });

  if (result.canceled || !result.filePaths[0]) {
    return readSettings();
  }

  if (app.isPackaged && isDevelopmentDataPath(result.filePaths[0])) {
    throw new Error("Production builds cannot use a MasterForge development data directory.");
  }

  const settings = readSettings();
  settings.dataPath = result.filePaths[0];
  settings.dataPathSelectionMode = "user-selected";
  writeSettings(settings);
  ensureFolder(settings.dataPath);

  return settings;
});

ipcMain.handle("file:readJson", (event, relativePath, fallback = null) => {
  const settings = readSettings();
  const fullPath =
  safePath(
    settings.dataPath,
    relativePath
  );

  if (!fs.existsSync(fullPath)) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
});

ipcMain.handle("file:writeJson", (event, relativePath, data) => {
  const settings = readSettings();
  const fullPath =
  safePath(
    settings.dataPath,
    relativePath
  );
  ensureFolder(path.dirname(fullPath));

  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
  return true;
});

ipcMain.handle("file:listJson", (event, relativeFolder) => {
  const settings = readSettings();
  const folderPath = safePath(
  settings.dataPath,
  relativeFolder
);
  ensureFolder(folderPath);

  return fs
    .readdirSync(folderPath)
    .filter((file) => file.endsWith(".json"));
});

ipcMain.handle("campaign:listPartyRecords", event => {
  if (!win || win.isDestroyed() || event.sender !== win.webContents) {
    return {
      success: false,
      error: "The campaign party request did not come from the main Studio window."
    };
  }

  try {
    const settings = readSettings();
    const campaignsPath = safePath(
      settings.dataPath,
      "campaigns"
    );

    if (!fs.existsSync(campaignsPath)) {
      return { success: true, campaigns: [] };
    }

    const isSafeCampaignId = campaignId => {
      return (
        typeof campaignId === "string" &&
        campaignId.length > 0 &&
        campaignId !== "." &&
        campaignId !== ".." &&
        !campaignId.includes("/") &&
        !campaignId.includes("\\") &&
        !/[\u0000-\u001f]/.test(campaignId) &&
        path.basename(campaignId) === campaignId
      );
    };

    const readCampaignJson = (campaignId, fileName) => {
      const filePath = safePath(
        settings.dataPath,
        path.join("campaigns", campaignId, fileName)
      );

      if (!fs.existsSync(filePath)) return null;
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    };

    const campaigns = [];
    const entries = fs.readdirSync(campaignsPath, {
      withFileTypes: true
    });

    for (const entry of entries) {
      if (!entry.isDirectory() || !isSafeCampaignId(entry.name)) {
        continue;
      }

      try {
        const party = readCampaignJson(entry.name, "party.json");
        if (!party) continue;

        campaigns.push({
          campaignId: entry.name,
          campaign: readCampaignJson(entry.name, "campaign.json"),
          party
        });
      } catch (error) {
        console.warn(
          "Could not read campaign party record:",
          entry.name,
          error
        );
      }
    }

    return { success: true, campaigns };
  } catch (error) {
    console.error("Could not list campaign party records:", error);
    return {
      success: false,
      error: error?.message || "Campaign party records could not be listed."
    };
  }
});

ipcMain.handle("db:saveRecord", (event, collection, id, data, scope = "global") => {
  dmDatabase.saveRecord(collection, id, data, scope);
  return true;
});

ipcMain.handle("db:getRecord", (event, id) => {
  return dmDatabase.getRecord(id);
});

ipcMain.handle("db:getRecords", (event, collection, scope = "global") => {
  return dmDatabase.getRecords(collection, scope);
});

ipcMain.handle("db:getAllRecordsInCollection", (event, collection) => {
  return dmDatabase.getAllRecordsInCollection(collection);
});

ipcMain.handle("db:getRecordScopesForCollection", (event, collection) => {
  return dmDatabase.getRecordScopesForCollection(collection);
});

ipcMain.handle("db:deleteRecord", (event, id) => {
  dmDatabase.deleteRecord(id);
  return true;
});
ipcMain.handle("theme:getSettings", () => {
  const settings = readSettings();

  return {
    themeMode: settings.themeMode || "manual",
    manualTheme: settings.manualTheme || "merchant-vessel",
    locationThemes: settings.locationThemes || {
      "Chult": "lost-jungle-isle",
      "Ship": "merchant-vessel",
      "Sea Voyage": "merchant-vessel"
    },
    backgroundOpacity: settings.backgroundOpacity ?? 0.05,
    menusHidden: settings.menusHidden || false
  };
});

ipcMain.handle("theme:saveSettings", (event, themeSettings) => {
  const settings = readSettings();

  const updated = {
    ...settings,
    ...themeSettings
  };

  writeSettings(updated);
  return updated;
});


ipcMain.handle("theme:install", async () => {
  const result = await dialog.showOpenDialog(win, {
    properties: ["openFile"],
    title: "Install MasterForge Studio Theme",
    filters: [
      { name: "Theme Pack", extensions: ["json"] }
    ]
  });

  if (result.canceled || !result.filePaths[0]) {
    return null;
  }

  // Basic placeholder installer for now.
  // Later we can upgrade this to .zip theme packs.
  return {
    installed: false,
    message: "Theme installer placeholder ready. Zip support comes next."
  };
});

ipcMain.on("window:close", () => {
  app.quit();
});

ipcMain.on("window:minimize", () => {
  if (win) win.minimize();
});

ipcMain.handle("window:focusMain", event => {
  if (!win || win.isDestroyed()) {
    return false;
  }

  if (event.sender !== win.webContents) {
    return false;
  }

  if (win.isMinimized()) {
    win.restore();
  }

  win.show();
  win.focus();
  win.webContents.focus();

  return win.isFocused();
});

app.commandLine.appendSwitch("disable-http-cache");

app.whenReady().then(() => {
  console.log(
    "[MasterForge] Package version:",
    app.getVersion()
  );

  console.log(
    "[MasterForge] Internal version:",
    VERSION
  );

  createWindow();

 fetchUpdateInfo()
  .then(async (updateInfo) => {
    const updateStatus =
      getUpdateStatus(
        VERSION,
        updateInfo
      );

    console.log(
      "[MasterForge] Update information:",
      updateInfo
    );

    console.log(
      "[MasterForge] Update status:",
      updateStatus
    );

    if (
      updateStatus.status ===
      "update_available"
    ) {
      const settings = readSettings();

const reminderTime =
  settings.updateReminderAt
    ? new Date(settings.updateReminderAt).getTime()
    : 0;

const reminderStillActive =
  reminderTime > Date.now();

const versionWasSkipped =
  settings.skippedUpdateVersion ===
  updateStatus.latestVersion;

if (
  reminderStillActive ||
  versionWasSkipped
) {
  console.log(
    "[MasterForge] Optional update notification suppressed.",
    {
      reminderStillActive,
      versionWasSkipped,
    }
  );

  return;
}
      const result =
        await dialog.showMessageBox(win, {
          type: "info",
          title: "MasterForge Studio Update Available",
          message:
            `MasterForge Studio ${updateStatus.latestVersion} is available.`,
          detail:
            updateStatus.releaseNotes ||
            "A newer version of MasterForge Studio is available.",
          buttons: [
            "Download Update",
            "Remind Me Tomorrow",
            "Skip This Version",
          ],
          defaultId: 0,
          cancelId: 1,
          noLink: true,
        });

      console.log(
        "[MasterForge] Update dialog choice:",
        result.response
      );

      if (
  result.response === 0 &&
  updateStatus.downloadUrl
) {
  await shell.openExternal(
    updateStatus.downloadUrl
  );
}

if (result.response === 1) {
  const settings = readSettings();

  settings.updateReminderAt =
    new Date(
      Date.now() +
      24 * 60 * 60 * 1000
    ).toISOString();

  writeSettings(settings);

  console.log(
    "[MasterForge] Update reminder saved:",
    settings.updateReminderAt
  );
}

if (result.response === 2) {
  const settings = readSettings();

  settings.skippedUpdateVersion =
    updateStatus.latestVersion;

  writeSettings(settings);

  console.log(
    "[MasterForge] Skipped update version:",
    updateStatus.latestVersion
  );
}
    }

    if (
      updateStatus.status ===
      "update_required"
    ) {
      const result =
        await dialog.showMessageBox(win, {
          type: "warning",
          title: "MasterForge Studio Update Required",
          message:
            "This version of MasterForge Studio is no longer supported.",
          detail:
            `Installed version: ${updateStatus.installedVersion}\n` +
            `Minimum supported version: ${updateStatus.minimumSupportedVersion}\n\n` +
            (
              updateStatus.releaseNotes ||
              "Please install the latest version to continue."
            ),
          buttons: [
            "Download Required Update",
            "Close MasterForge Studio",
          ],
          defaultId: 0,
          cancelId: 1,
          noLink: true,
        });

      console.log(
        "[MasterForge] Required update choice:",
        result.response
      );

      if (
        result.response === 0 &&
        updateStatus.downloadUrl
      ) {
        await shell.openExternal(
          updateStatus.downloadUrl
        );
      }

      app.quit();
      return;
    }
  });
});
