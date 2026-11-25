const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
} = require("electron");

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { Readable, Transform } = require("stream");
const { pipeline } = require("stream/promises");

const {
  autoUpdater,
  CancellationToken,
} = require("electron-updater");

const {
  VERSION,
} = require("./src/version.js");

const PACKAGED_USER_DATA_FOLDER = "MasterForge Studio";
const LEGACY_USER_DATA_PREFIX = "MasterForge Studio ";

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

const {
  safePath,
  pickThemeSettings,
  assertJsonPath,
  isAllowedDownloadUrl,
  isAppFileUrl,
  isAllowedPermission,
} = require("./src/security/main-guards.js");

const APP_PAGE_ROOT = path.join(__dirname, "src");

// The only content-pack file the renderer may install: the one the user picked
// in the main-process file dialog.
let chosenContentPackPath = "";

let win;

let updaterDownloadInProgress = false;
let updaterDownloadCancelled = false;
let updaterReadyToInstall = false;
let updaterAbortController = null;
let updaterCancellationToken = null;
let updaterPartialPath = "";
let verifiedInstallerPath = "";
let installOnExitPath = "";
let updaterInstallMode = "";
let installerLaunchStarted = false;
let currentUpdateStatus = null;
let updaterUiState = {
  status: "idle",
  percent: 0,
  transferredBytes: 0,
  totalBytes: 0,
  message: "",
};

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = true;

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

function migrateLegacyVersionedUserData() {
  if (!app.isPackaged) {
    return {
      migrated: false,
      reason: "development_build",
    };
  }

  const appDataPath = app.getPath("appData");
  const permanentUserDataPath = app.getPath("userData");

  try {
    const legacyFolders = fs
      .readdirSync(appDataPath, {
        withFileTypes: true,
      })
      .filter(entry => {
        const folderName =
          String(entry.name || "");

        const lowerFolderName =
          folderName.toLowerCase();

        const isExcludedFolder =
          lowerFolderName.includes("backup") ||
          lowerFolderName.includes("old test") ||
          lowerFolderName.includes("pre-migration") ||
          lowerFolderName.endsWith(" dev");

        return (
          entry.isDirectory() &&
          folderName.startsWith(
            LEGACY_USER_DATA_PREFIX
          ) &&
          folderName !==
            PACKAGED_USER_DATA_FOLDER &&
          folderName !==
            "MasterForge Studio Dev" &&
          !isExcludedFolder
        );
      })
      .map(entry => {
        const folderPath = path.join(
          appDataPath,
          entry.name
        );

        return {
          name: entry.name,
          path: folderPath,
          modifiedAt:
            fs.statSync(folderPath).mtimeMs,
        };
      })
      .sort((a, b) => {
        return b.modifiedAt - a.modifiedAt;
      });

    const newestLegacyFolder =
      legacyFolders[0];

    if (!newestLegacyFolder) {
      return {
        migrated: false,
        reason: "no_legacy_folder_found",
      };
    }

    ensureFolder(permanentUserDataPath);

    console.log(
      "[MasterForge] Merging legacy user data without overwriting existing files:",
      {
        from: newestLegacyFolder.path,
        to: permanentUserDataPath,
      }
    );

    const ignoredFolderNames = new Set([
      "Cache",
      "Code Cache",
      "GPUCache",
      "DawnCache",
      "DawnGraphiteCache",
      "GrShaderCache",
      "ShaderCache",
      "Crashpad",
    ]);

    fs.cpSync(
      newestLegacyFolder.path,
      permanentUserDataPath,
      {
        recursive: true,
        force: false,
        errorOnExist: false,
        filter: sourcePath => {
          const relativePath = path.relative(
            newestLegacyFolder.path,
            sourcePath
          );

          if (!relativePath) {
            return true;
          }

          const firstFolder =
            relativePath.split(path.sep)[0];

          return !ignoredFolderNames.has(
            firstFolder
          );
        },
      }
    );

    const activationDirectory = path.join(
      permanentUserDataPath,
      "activation"
    );

    ensureFolder(activationDirectory);

    const legacyLicencePath = path.join(
      newestLegacyFolder.path,
      "licence.json"
    );

    const legacyMachineIdPath = path.join(
      newestLegacyFolder.path,
      "machine-id.json"
    );

    const migratedLicencePath = path.join(
      activationDirectory,
      "licence.json"
    );

    const migratedMachineIdPath = path.join(
      activationDirectory,
      "machine-id.json"
    );

    if (
      fs.existsSync(legacyLicencePath) &&
      !fs.existsSync(migratedLicencePath)
    ) {
      fs.copyFileSync(
        legacyLicencePath,
        migratedLicencePath
      );

      console.log(
        "[MasterForge] Legacy licence migrated:",
        {
          from: legacyLicencePath,
          to: migratedLicencePath,
        }
      );
    }

    if (
      fs.existsSync(legacyMachineIdPath) &&
      !fs.existsSync(migratedMachineIdPath)
    ) {
      fs.copyFileSync(
        legacyMachineIdPath,
        migratedMachineIdPath
      );

      console.log(
        "[MasterForge] Legacy machine ID migrated:",
        {
          from: legacyMachineIdPath,
          to: migratedMachineIdPath,
        }
      );
    }

    console.log(
      "[MasterForge] Legacy user data migrated:",
      {
        from: newestLegacyFolder.path,
        to: permanentUserDataPath,
      }
    );

    return {
      migrated: true,
      from: newestLegacyFolder.path,
      to: permanentUserDataPath,
    };
  } catch (error) {
    console.error(
      "[MasterForge] Legacy user-data migration failed:",
      error
    );

    return {
      migrated: false,
      reason: "migration_failed",
      error:
        error?.message ||
        String(error),
    };
  }
}

function configureAutomaticUpdater() {
  autoUpdater.on(
    "checking-for-update",
    () => {
      console.log(
        "[MasterForge Updater] Checking for update."
      );
      publishUpdaterState({
        status: "downloading",
        percent: 0,
        message: "Checking release metadata…",
      });
    }
  );

  autoUpdater.on(
    "update-available",
    updateInfo => {
      console.log(
        "[MasterForge Updater] Update available:",
        updateInfo?.version
      );
      publishUpdaterState({
        status: "downloading",
        version: updateInfo?.version || currentUpdateStatus?.latestVersion,
        message: "Update found. Starting download…",
      });
    }
  );

  autoUpdater.on(
    "update-not-available",
    updateInfo => {
      console.log(
        "[MasterForge Updater] No automatic update available:",
        updateInfo?.version
      );

      updaterDownloadInProgress = false;

      if (
        win &&
        !win.isDestroyed()
      ) {
        win.setProgressBar(-1);
      }
      if (updaterDownloadInProgress) {
        publishUpdaterState({
          status: "error",
          message: "The automatic updater did not find the expected release.",
          error: "The expected update was not available through the automatic update provider.",
        });
      }
    }
  );

  autoUpdater.on(
    "download-progress",
    progress => {
      const percent = Number(
        progress?.percent || 0
      );

      console.log(
        "[MasterForge Updater] Download progress:",
        `${percent.toFixed(1)}%`
      );
      publishUpdaterState({
        status: "downloading",
        percent,
        transferredBytes: Number(progress?.transferred || 0),
        totalBytes: Number(progress?.total || 0),
        message: `Downloading update… ${percent.toFixed(1)}%`,
      });

      if (
        win &&
        !win.isDestroyed()
      ) {
        win.setProgressBar(
          Math.max(
            0,
            Math.min(
              1,
              percent / 100
            )
          )
        );
      }
    }
  );

  autoUpdater.on(
    "update-downloaded",
    async updateInfo => {
      updaterDownloadInProgress = false;
      updaterReadyToInstall = true;
      updaterInstallMode = "electron-updater";

      if (
        win &&
        !win.isDestroyed()
      ) {
        win.setProgressBar(-1);
      }

      console.log(
        "[MasterForge Updater] Update downloaded:",
        updateInfo?.version
      );
      publishUpdaterState({
        status: "ready",
        version: updateInfo?.version || currentUpdateStatus?.latestVersion,
        percent: 100,
        message: "Update downloaded. Install and restart when ready.",
      });
    }
  );

  autoUpdater.on(
    "error",
    async error => {
      updaterDownloadInProgress = false;

      if (
        win &&
        !win.isDestroyed()
      ) {
        win.setProgressBar(-1);
      }

      console.error(
        "[MasterForge Updater] Automatic update failed:",
        error
      );
      if (updaterDownloadCancelled) {
        console.log("[MasterForge Updater] Download cancellation acknowledged.");
        return;
      }
      publishUpdaterState({
        status: "error",
        error: error?.message || "The update could not be downloaded automatically.",
        message: "Automatic download failed.",
      });
    }
  );
}

async function downloadAutomaticUpdate() {
  if (updaterReadyToInstall) {
    autoUpdater.quitAndInstall(
      false,
      true
    );

    return {
      success: true,
      status: "installing",
    };
  }

  if (updaterDownloadInProgress) {
    return {
      success: false,
      status: "download_in_progress",
    };
  }

  updaterDownloadInProgress = true;
  updaterDownloadCancelled = false;
  updaterCancellationToken = new CancellationToken();
  updaterInstallMode = "";

  try {
    console.log(
      "[MasterForge Updater] Starting automatic update check."
    );

    const updateCheck =
      await autoUpdater.checkForUpdates();

    if (!updateCheck?.updateInfo) {
      updaterDownloadInProgress = false;

      throw new Error(
        "The release metadata did not contain update information."
      );
    }

    console.log(
      "[MasterForge Updater] Downloading update:",
      updateCheck.updateInfo.version
    );

    await autoUpdater.downloadUpdate(
      updaterCancellationToken
    );

    return updaterUiState;
  } catch (error) {
    updaterDownloadInProgress = false;

    if (
      win &&
      !win.isDestroyed()
    ) {
      win.setProgressBar(-1);
    }

    console.error(
      "[MasterForge Updater] Could not start automatic download:",
      error
    );

    if (
      updaterDownloadCancelled ||
      error?.name === "CancellationError"
    ) {
      return publishUpdaterState({
        status: "available",
        percent: 0,
        transferredBytes: 0,
        totalBytes: 0,
        message: "Update download cancelled.",
      });
    }

    const fallbackUrl = String(currentUpdateStatus?.downloadUrl || "").trim();
    if (isAllowedDownloadUrl(fallbackUrl)) {
      try {
        await shell.openExternal(fallbackUrl);
        console.warn(
          "[MasterForge Updater] Automatic download failed; opened installer URL externally:",
          fallbackUrl
        );
        return publishUpdaterState({
          status: "error",
          externalFallbackOpened: true,
          fallbackUrl,
          error: error?.message || "Automatic download could not be started.",
          message: "Automatic download failed. The Windows Alpha installer page was opened in your browser.",
        });
      } catch (fallbackError) {
        console.error(
          "[MasterForge Updater] Browser fallback failed:",
          fallbackError
        );
        throw new Error(
          `${error?.message || "Automatic download failed."} Browser fallback also failed: ${fallbackError?.message || fallbackError}`
        );
      }
    }

    throw error;
  } finally {
    updaterCancellationToken = null;
    updaterDownloadCancelled = false;
  }
}

function publishUpdaterState(patch = {}) {
  updaterUiState = {
    ...updaterUiState,
    ...patch,
  };

  if (
    win &&
    !win.isDestroyed()
  ) {
    win.webContents.send(
      "updater:state",
      updaterUiState
    );
  }

  return updaterUiState;
}

function updateDownloadDirectory() {
  return path.join(
    app.getPath("temp"),
    "MasterForge Studio Updates"
  );
}

function cleanupStaleUpdateDownloads() {
  const updateDirectory =
    updateDownloadDirectory();

  if (!fs.existsSync(updateDirectory)) {
    return 0;
  }

  let removed = 0;
  for (
    const entry of fs.readdirSync(
      updateDirectory,
      { withFileTypes: true }
    )
  ) {
    if (
      entry.isFile() &&
      entry.name.endsWith(".part") &&
      removeFileIfPresent(
        path.join(
          updateDirectory,
          entry.name
        )
      )
    ) {
      removed += 1;
    }
  }

  if (removed) {
    console.log(
      `[MasterForge Updater] Removed ${removed} stale partial download${removed === 1 ? "" : "s"}.`
    );
  }

  return removed;
}

function removeFileIfPresent(filePath) {
  try {
    if (
      filePath &&
      fs.existsSync(filePath)
    ) {
      fs.rmSync(filePath, {
        force: true,
      });
      return true;
    }
  } catch (error) {
    console.warn(
      "[MasterForge Updater] Could not remove update file yet:",
      filePath,
      error?.message || error
    );
  }

  return false;
}

function calculateFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash =
      crypto.createHash("sha256");
    const input =
      fs.createReadStream(filePath);

    input.on("error", reject);
    input.on("data", chunk => {
      hash.update(chunk);
    });
    input.on("end", () => {
      resolve(hash.digest("hex"));
    });
  });
}

function launchInstaller(installerPath) {
  if (
    !installerPath ||
    !fs.existsSync(installerPath)
  ) {
    throw new Error(
      "The verified installer is no longer available."
    );
  }

  if (installerLaunchStarted) {
    return;
  }

  installerLaunchStarted = true;

  const child = spawn(
    installerPath,
    [],
    {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    }
  );

  child.on("error", error => {
    console.error(
      "[MasterForge Updater] Installer launch failed:",
      error
    );
  });
  child.unref();
}

async function downloadVerifiedUpdate() {
  if (updaterDownloadInProgress) {
    return publishUpdaterState({
      status: "downloading",
      message: "An update download is already in progress.",
    });
  }

  const updateStatus = currentUpdateStatus;
  const downloadUrl =
    String(updateStatus?.downloadUrl || "").trim();
  const expectedChecksum =
    String(updateStatus?.checksum || "")
      .trim()
      .toLowerCase()
      .replace(/^sha256:/, "");

  if (!downloadUrl) {
    throw new Error(
      "The update metadata does not contain an installer URL."
    );
  }

  if (!/^[a-f0-9]{64}$/.test(expectedChecksum)) {
    throw new Error(
      "The update metadata does not contain a valid SHA-256 checksum."
    );
  }

  const updateDirectory =
    updateDownloadDirectory();
  ensureFolder(updateDirectory);

  cleanupStaleUpdateDownloads();

  const safeVersion = String(
    updateStatus.latestVersion ||
    "update"
  ).replace(/[^a-z0-9.-]+/gi, "-");
  const installerPath = path.join(
    updateDirectory,
    `MasterForge-Studio-Setup-${safeVersion}-x64.exe`
  );
  const partialPath =
    `${installerPath}.part`;

  removeFileIfPresent(partialPath);
  removeFileIfPresent(installerPath);

  updaterDownloadInProgress = true;
  updaterReadyToInstall = false;
  verifiedInstallerPath = "";
  updaterPartialPath = partialPath;
  updaterAbortController =
    new AbortController();

  publishUpdaterState({
    status: "downloading",
    version: updateStatus.latestVersion,
    releaseNotes: updateStatus.releaseNotes,
    percent: 0,
    transferredBytes: 0,
    totalBytes: 0,
    message: "Downloading update…",
  });

  try {
    const response = await fetch(
      downloadUrl,
      {
        signal:
          updaterAbortController.signal,
      }
    );

    if (
      !response.ok ||
      !response.body
    ) {
      throw new Error(
        `Installer download failed with HTTP ${response.status}.`
      );
    }

    const totalBytes = Number(
      response.headers.get(
        "content-length"
      ) || 0
    );
    let transferredBytes = 0;

    const progressStream =
      new Transform({
        transform(
          chunk,
          encoding,
          callback
        ) {
          transferredBytes +=
            chunk.length;

          const percent =
            totalBytes > 0
              ? transferredBytes /
                totalBytes *
                100
              : 0;

          publishUpdaterState({
            status: "downloading",
            percent,
            transferredBytes,
            totalBytes,
            message:
              totalBytes > 0
                ? `Downloading update… ${percent.toFixed(1)}%`
                : `Downloading update… ${transferredBytes} bytes`,
          });

          callback(null, chunk);
        },
      });

    await pipeline(
      Readable.fromWeb(response.body),
      progressStream,
      fs.createWriteStream(
        partialPath,
        { flags: "wx" }
      )
    );

    publishUpdaterState({
      status: "verifying",
      percent: 100,
      transferredBytes,
      totalBytes:
        totalBytes ||
        transferredBytes,
      message:
        "Verifying installer checksum…",
    });

    const actualChecksum =
      await calculateFileSha256(
        partialPath
      );

    if (
      actualChecksum !==
      expectedChecksum
    ) {
      removeFileIfPresent(
        partialPath
      );

      throw new Error(
        "Installer checksum verification failed. The downloaded file was deleted."
      );
    }

    fs.renameSync(
      partialPath,
      installerPath
    );

    updaterPartialPath = "";
    verifiedInstallerPath =
      installerPath;
    updaterReadyToInstall = true;

    return publishUpdaterState({
      status: "ready",
      installerPath,
      checksum: actualChecksum,
      message:
        "The installer is verified and ready.",
    });
  } catch (error) {
    removeFileIfPresent(
      partialPath
    );
    updaterPartialPath = "";

    if (
      error?.name ===
      "AbortError"
    ) {
      return publishUpdaterState({
        status: "available",
        percent: 0,
        transferredBytes: 0,
        totalBytes: 0,
        message:
          "Update download cancelled.",
      });
    }

    console.error(
      "[MasterForge Updater] Verified download failed:",
      error
    );

    publishUpdaterState({
      status: "error",
      error:
        error?.message ||
        "The update could not be downloaded.",
      message:
        error?.message ||
        "The update could not be downloaded.",
    });

    throw error;
  } finally {
    updaterDownloadInProgress = false;
    updaterAbortController = null;
  }
}

function prepareApplicationData() {
  migrateLegacyVersionedUserData();
  cleanupStaleUpdateDownloads();

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
  const settings =
    prepareApplicationData();
  const savedBounds =
    settings.windowBounds || {};
  const validDimension = (
    value,
    fallback
  ) => Number.isFinite(Number(value))
    ? Number(value)
    : fallback;

  win = new BrowserWindow({
    width: validDimension(
      savedBounds.width,
      1400
    ),
    height: validDimension(
      savedBounds.height,
      850
    ),
    ...(Number.isFinite(Number(savedBounds.x))
      ? { x: Number(savedBounds.x) }
      : {}),
    ...(Number.isFinite(Number(savedBounds.y))
      ? { y: Number(savedBounds.y) }
      : {}),
    minWidth: 1000,
    minHeight: 650,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false
    }
  });

  // Keep the window on the app's own pages: no remote navigation, no new
  // windows, no webviews and only the browser permissions the app needs.
  win.webContents.on("will-navigate", (event, url) => {
    if (!isAppFileUrl(url, APP_PAGE_ROOT)) {
      event.preventDefault();
      console.warn("[MasterForge] Blocked navigation outside the app:", url);
    }
  });
  win.webContents.on("will-redirect", (event, url) => {
    if (!isAppFileUrl(url, APP_PAGE_ROOT)) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    console.warn("[MasterForge] Blocked new window:", url);
    return { action: "deny" };
  });
  win.webContents.on("will-attach-webview", event => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(isAllowedPermission(permission));
  });
  win.webContents.session.setPermissionCheckHandler((webContents, permission) =>
    isAllowedPermission(permission)
  );

  if (settings.windowMaximized) {
    win.maximize();
  }

  win.on("close", () => {
    const currentSettings =
      readSettings();
    const maximized =
      win.isMaximized();
    const bounds = maximized
      ? win.getNormalBounds()
      : win.getBounds();

    writeSettings({
      ...currentSettings,
      windowBounds: bounds,
      windowMaximized: maximized,
    });
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

ipcMain.handle("app:getVersion", () => {
  return app.getVersion();
});

ipcMain.handle("app:getRuntimeInfo", () => ({
  version: VERSION,
  isPackaged: app.isPackaged,
  channel: app.isPackaged ? "installed" : "development",
}));

ipcMain.handle(
  "updater:getState",
  () => updaterUiState
);

ipcMain.handle(
  "updater:download",
  async () => {
    try {
      return await downloadAutomaticUpdate();
    } catch (error) {
      return publishUpdaterState({
        status: "error",
        success: false,
        error: error?.message || "The update could not be downloaded.",
        message: "Download failed. Try again or open the installer page in your browser.",
      });
    }
  }
);

ipcMain.handle(
  "updater:openDownloadPage",
  async () => {
    const downloadUrl = String(currentUpdateStatus?.downloadUrl || "").trim();
    if (!isAllowedDownloadUrl(downloadUrl)) {
      throw new Error("No confirmed installer URL on an approved MasterForge download host is available.");
    }
    await shell.openExternal(downloadUrl);
    console.log("[MasterForge Updater] Opened installer URL externally:", downloadUrl);
    return publishUpdaterState({
      status: "error",
      externalFallbackOpened: true,
      fallbackUrl: downloadUrl,
      message: "The Windows Alpha installer page was opened in your browser.",
      error: "",
    });
  }
);

ipcMain.handle(
  "updater:installNow",
  () => {
    if (!updaterReadyToInstall) {
      throw new Error(
        "No downloaded update is ready."
      );
    }

    if (updaterInstallMode === "electron-updater") {
      console.log("[MasterForge Updater] Installing downloaded update now.");
      setImmediate(() => autoUpdater.quitAndInstall(false, true));
      return publishUpdaterState({
        status: "installing",
        message: "Restarting to install the update…",
      });
    }

    if (!verifiedInstallerPath) {
      throw new Error("No verified installer is ready.");
    }
    launchInstaller(
      verifiedInstallerPath
    );
    installOnExitPath = "";
    app.quit();

    return true;
  }
);

ipcMain.handle(
  "updater:installOnExit",
  () => {
    if (!updaterReadyToInstall) {
      throw new Error(
        "No downloaded update is ready."
      );
    }

    if (updaterInstallMode === "electron-updater") {
      autoUpdater.autoInstallOnAppQuit = true;
      return publishUpdaterState({
        status: "install-on-exit",
        message: "The downloaded update will install when MasterForge Studio closes.",
      });
    }

    if (!verifiedInstallerPath) {
      throw new Error("No verified installer is ready.");
    }
    installOnExitPath =
      verifiedInstallerPath;

    return publishUpdaterState({
      status: "install-on-exit",
      message:
        "The verified installer will launch when MasterForge Studio closes.",
    });
  }
);

ipcMain.handle(
  "updater:cancel",
  () => {
    if (updaterCancellationToken) {
      updaterDownloadCancelled = true;
      updaterCancellationToken.cancel();
    }
    if (updaterAbortController) {
      updaterAbortController.abort();
    }

    removeFileIfPresent(
      updaterPartialPath
    );
    updaterPartialPath = "";
    installOnExitPath = "";

    if (verifiedInstallerPath) {
      removeFileIfPresent(
        verifiedInstallerPath
      );
    }

    verifiedInstallerPath = "";
    updaterReadyToInstall = false;
    updaterInstallMode = "";

    return publishUpdaterState({
      status:
        currentUpdateStatus
          ? "available"
          : "idle",
      percent: 0,
      transferredBytes: 0,
      totalBytes: 0,
      message:
        "Update cancelled.",
    });
  }
);

ipcMain.handle(
  "updater:remindTomorrow",
  () => {
    const settings = readSettings();
    settings.updateReminderAt =
      new Date(
        Date.now() +
        24 * 60 * 60 * 1000
      ).toISOString();
    writeSettings(settings);
    publishUpdaterState({
      status: "dismissed",
      message:
        "Update reminder postponed until tomorrow.",
    });
    return true;
  }
);

ipcMain.handle(
  "updater:skipVersion",
  () => {
    if (!currentUpdateStatus?.latestVersion) {
      return false;
    }

    const settings = readSettings();
    settings.skippedUpdateVersion =
      currentUpdateStatus.latestVersion;
    writeSettings(settings);
    publishUpdaterState({
      status: "dismissed",
      message:
        "This update version was skipped.",
    });
    return true;
  }
);

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
    // Only install the file the user chose in the dialog, never an arbitrary
    // path supplied by the renderer.
    if (!chosenContentPackPath || path.resolve(String(packPath || "")) !== chosenContentPackPath) {
      throw new Error("Choose the content pack with the Install Content Pack dialog first.");
    }
    chosenContentPackPath = "";
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
    chosenContentPackPath = "";
    return null;
  }

  chosenContentPackPath = path.resolve(result.filePaths[0]);
  return result.filePaths[0];
});

const ATLAS_PREVIEW_MAX_FILE_BYTES = 5 * 1024 * 1024;

ipcMain.handle("interchange:chooseAtlasPackage", async () => {
  const result = await dialog.showOpenDialog(win, {
    title: "Choose MasterForge Atlas Package",
    properties: ["openFile"],
    filters: [{ name: "JSON package", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePaths[0]) return { cancelled: true };

  const filePath = result.filePaths[0];
  try {
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) return { cancelled: false, error: { code: "ATLAS_PACKAGE_NOT_FILE", message: "The selected package is not a file." } };
    if (stats.size > ATLAS_PREVIEW_MAX_FILE_BYTES) {
      return { cancelled: false, fileName: path.basename(filePath), size: stats.size, error: { code: "ATLAS_PACKAGE_TOO_LARGE", message: "The selected package exceeds the 5 MB preview limit." } };
    }
    return { cancelled: false, fileName: path.basename(filePath), size: stats.size, text: fs.readFileSync(filePath, "utf8") };
  } catch (error) {
    return { cancelled: false, fileName: path.basename(filePath), error: { code: "ATLAS_PACKAGE_READ_FAILED", message: "The selected package could not be read." } };
  }
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
// MasterForge Studio
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
    assertJsonPath(relativePath)
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

  // Only theme keys may come from the renderer. The data folder can only be
  // changed through settings:chooseDataPath (a main-process folder dialog).
  const updated = {
    ...settings,
    ...pickThemeSettings(themeSettings)
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

ipcMain.handle(
  "window:toggleMaximize",
  () => {
    if (!win || win.isDestroyed()) {
      return false;
    }

    if (win.isMaximized()) {
      win.unmaximize();
      return false;
    }

    win.maximize();
    return true;
  }
);

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

  configureAutomaticUpdater();
  createWindow();

  fetchUpdateInfo()
  .then(updateInfo => {
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
      ![
        "update_available",
        "update_required",
      ].includes(updateStatus.status)
    ) {
      return;
    }

    currentUpdateStatus =
      updateStatus;

    if (
      updateStatus.status ===
      "update_available"
    ) {
      const settings = readSettings();
      const reminderTime =
        settings.updateReminderAt
          ? new Date(
              settings.updateReminderAt
            ).getTime()
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
    }

    publishUpdaterState({
      status: "available",
      required:
        updateStatus.status ===
        "update_required",
      version:
        updateStatus.latestVersion,
      minimumSupportedVersion:
        updateStatus.minimumSupportedVersion,
      releaseNotes:
        updateStatus.releaseNotes,
      percent: 0,
      transferredBytes: 0,
      totalBytes: 0,
      message:
        updateStatus.status ===
        "update_required"
          ? "This MasterForge Studio version requires an update."
          : "A MasterForge Studio update is available.",
    });
  });
});

app.on("before-quit", () => {
  if (
    installOnExitPath &&
    !installerLaunchStarted
  ) {
    try {
      launchInstaller(
        installOnExitPath
      );
    } catch (error) {
      console.error(
        "[MasterForge Updater] Could not launch the installer on exit:",
        error
      );
    }
  }
});
