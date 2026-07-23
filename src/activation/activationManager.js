const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ACTIVATION_ENDPOINT =
  "https://masterforgestudio.com/wp-json/masterforge/v1/validate-key";

const LICENCE_VALIDATION_ENDPOINT =
  "https://masterforgestudio.com/wp-json/masterforge/v1/validate-license";

const OFFLINE_GRACE_DAYS = 7;

function getSharedActivationDirectory(app) {
  return path.join(
    app.getPath("appData"),
    "MasterForge Studio",
    "activation"
  );
}

/**
 * Returns the path used to store the local MasterForge licence.
 *
 * The Electron app instance is passed in so this module remains easy to test
 * and does not initialise Electron by itself.
 */
function getLicenceFilePath(app) {
  return path.join(
    getSharedActivationDirectory(app),
    "licence.json"
  );
}

/**
 * Reads the locally stored licence.
 *
 * Returns null when:
 * - no licence file exists
 * - the file is empty
 * - the JSON is damaged or invalid
 *
 * It does not throw for ordinary licence-file problems.
 */
function readLocalLicence(app) {
  const licencePath = getLicenceFilePath(app);

  if (!fs.existsSync(licencePath)) {
    return null;
  }

  try {
    const rawLicence = fs.readFileSync(licencePath, "utf8").trim();

    if (!rawLicence) {
      return null;
    }

    return JSON.parse(rawLicence);
  } catch (error) {
    console.error("Unable to read local licence file:", error);
    return null;
  }
}

/**
 * Saves licence information locally.
 *
 * The userData directory is created when necessary.
 * Campaign and user-created data are not touched.
 */
function saveLocalLicence(app, licenceData) {
  if (!licenceData || typeof licenceData !== "object") {
    throw new TypeError("Licence data must be an object.");
  }

  const licencePath = getLicenceFilePath(app);
  const licenceDirectory = path.dirname(licencePath);

  fs.mkdirSync(licenceDirectory, {
    recursive: true,
  });

  fs.writeFileSync(
    licencePath,
    JSON.stringify(licenceData, null, 2),
    {
      encoding: "utf8",
      mode: 0o600,
    }
  );

  return licencePath;
}

/**
 * Removes only the local licence file.
 *
 * This must never remove campaign databases, settings, exports or user data.
 */
function removeLocalLicence(app) {
  const licencePath = getLicenceFilePath(app);

  if (!fs.existsSync(licencePath)) {
    return false;
  }

  fs.unlinkSync(licencePath);
  return true;
}

/**
 * Returns the path used to store this installation's machine ID.
 */
function getMachineIdFilePath(app) {
  return path.join(
    getSharedActivationDirectory(app),
    "machine-id.json"
  );
}

/**
 * Returns a stable ID for this MasterForge Studio installation.
 *
 * A secure random UUID is generated on first launch and then reused.
 * This avoids relying on changeable details such as the computer name,
 * network adapter or Windows username.
 */
function getOrCreateMachineId(app) {
  const machineIdPath = getMachineIdFilePath(app);

  try {
    if (fs.existsSync(machineIdPath)) {
      const rawData = fs.readFileSync(machineIdPath, "utf8").trim();

      if (rawData) {
        const storedData = JSON.parse(rawData);

        if (
          storedData &&
          typeof storedData.machine_id === "string" &&
          storedData.machine_id.trim()
        ) {
          return storedData.machine_id.trim();
        }
      }
    }
  } catch (error) {
    console.error("Unable to read stored machine ID:", error);
  }

  const machineId = crypto.randomUUID();
  const machineIdDirectory = path.dirname(machineIdPath);

  fs.mkdirSync(machineIdDirectory, {
    recursive: true,
  });

  fs.writeFileSync(
    machineIdPath,
    JSON.stringify(
      {
        machine_id: machineId,
        created_at: new Date().toISOString(),
      },
      null,
      2
    ),
    {
      encoding: "utf8",
      mode: 0o600,
    }
  );

  return machineId;
}

/**
 * Converts Electron/Node platform names into the values expected
 * by the MasterForge activation API.
 */
function getActivationPlatform() {
  switch (process.platform) {
    case "win32":
      return "windows";

    case "darwin":
      return "mac";

    case "linux":
      return "linux";

    default:
      return process.platform;
  }
}

/**
 * Sends a first-activation or full-reactivation request.
 *
 * This function does not save the licence locally yet.
 * It only communicates with the WordPress activation API.
 */
async function activateLicence({
  email,
  accessKey,
  machineId,
  appVersion,
}) {
  const cleanEmail =
    typeof email === "string"
      ? email.trim().toLowerCase()
      : "";

  const cleanAccessKey =
    typeof accessKey === "string"
      ? accessKey.trim().toUpperCase()
      : "";

  if (!cleanEmail) {
    return {
      valid: false,
      error: "invalid_email",
    };
  }

  if (!cleanAccessKey) {
    return {
      valid: false,
      error: "invalid_key",
    };
  }

  if (!machineId) {
    return {
      valid: false,
      error: "machine_id_error",
    };
  }

  try {
    console.info("[MasterForge Activation] Request version:", { endpoint: "validate-key", app_version: String(appVersion || ""), platform: getActivationPlatform() });
    const response = await fetch(ACTIVATION_ENDPOINT, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },

      body: JSON.stringify({
        email: cleanEmail,
        access_key: cleanAccessKey,
        machine_id: machineId,
        app_version: appVersion,
        platform: getActivationPlatform(),
      }),
    });

    let responseData;

    try {
      responseData = await response.json();
    } catch (error) {
      console.error(
        "Activation server returned invalid JSON:",
        error
      );

      return {
        valid: false,
        error: "server_error",
      };
    }

    console.info("[MasterForge Activation] Response:", { endpoint: "validate-key", status: response.status, valid: Boolean(responseData?.valid), error: responseData?.error || null, rejection_reason: responseData?.rejection_reason || null, version_diagnostics: responseData?.version_diagnostics || null });

    if (!response.ok) {
      return {
        valid: false,
        error:
          responseData?.error ||
          "server_error",
      };
    }

    return responseData;
  } catch (error) {
    console.error(
      "Unable to contact activation server:",
      error
    );

    return {
      valid: false,
      error: "network_error",
    };
  }
}

  /**
 * Revalidates a stored MasterForge Studio licence token.
 *
 * Used for routine startup checks and the 30-day online
 * revalidation cycle.
 */
async function validateStoredLicence({
  licenceToken,
  machineId,
  appVersion,
}) {
  if (
    typeof licenceToken !== "string" ||
    !licenceToken.trim()
  ) {
    return {
      valid: false,
      error: "invalid_license_token",
    };
  }

  if (!machineId) {
    return {
      valid: false,
      error: "machine_id_error",
    };
  }

  try {
    console.info("[MasterForge Activation] Request version:", { endpoint: "validate-license", app_version: String(appVersion || ""), platform: getActivationPlatform() });
    const response = await fetch(
      LICENCE_VALIDATION_ENDPOINT,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },

        body: JSON.stringify({
          license_token:
            licenceToken.trim(),

          machine_id: machineId,
          app_version: appVersion,
          platform: getActivationPlatform(),
        }),
      }
    );

    let responseData;

    try {
      responseData =
        await response.json();
    } catch (error) {
      console.error(
        "Licence server returned invalid JSON:",
        error
      );

      return {
        valid: false,
        error: "server_error",
      };
    }

    console.info("[MasterForge Activation] Response:", { endpoint: "validate-license", status: response.status, valid: Boolean(responseData?.valid), error: responseData?.error || null, rejection_reason: responseData?.rejection_reason || null, version_diagnostics: responseData?.version_diagnostics || null });

    if (!response.ok) {
      return {
        valid: false,
        error:
          responseData?.error ||
          "server_error",
      };
    }

    return responseData;
  } catch (error) {
    console.error(
      "Unable to contact licence server:",
      error
    );

    return {
      valid: false,
      error: "network_error",
    };
  }
}

/**
 * Works out what should happen with a locally stored licence.
 *
 * Returns:
 * - "missing" when no usable licence exists
 * - "reactivation_required" after the six-month deadline
 * - "revalidation_required" after the 30-day deadline
 * - "valid_offline" when the stored licence can unlock the app
 */
function getLocalLicenceState(
  licenceData,
  now = new Date()
) {
  if (
    !licenceData ||
    typeof licenceData !== "object" ||
    typeof licenceData.licence_token !== "string" ||
    !licenceData.licence_token.trim()
  ) {
    return "missing";
  }

  const currentTime = now.getTime();

  const reactivateTime =
    licenceData.reactivate_at
      ? new Date(
          licenceData.reactivate_at
        ).getTime()
      : NaN;

  if (
    Number.isFinite(reactivateTime) &&
    currentTime >= reactivateTime
  ) {
    return "reactivation_required";
  }

  const revalidateTime =
    licenceData.revalidate_at
      ? new Date(
          licenceData.revalidate_at
        ).getTime()
      : NaN;

  if (
    Number.isFinite(revalidateTime) &&
    currentTime >= revalidateTime
  ) {
    return "revalidation_required";
  }

  return "valid_offline";
}

/**
 * Checks whether a licence is still inside the temporary
 * offline grace period after its normal revalidation date.
 */
function isWithinOfflineGracePeriod(
  licenceData,
  now = new Date()
) {
  if (
    !licenceData ||
    !licenceData.revalidate_at
  ) {
    return false;
  }

  const revalidateTime =
    new Date(
      licenceData.revalidate_at
    ).getTime();

  if (!Number.isFinite(revalidateTime)) {
    return false;
  }

  const graceDuration =
    OFFLINE_GRACE_DAYS *
    24 *
    60 *
    60 *
    1000;

  return (
    now.getTime() <
    revalidateTime + graceDuration
  );
}

module.exports = {
  getLicenceFilePath,
  readLocalLicence,
  saveLocalLicence,
  removeLocalLicence,
  getMachineIdFilePath,
  getOrCreateMachineId,
  getActivationPlatform,
  activateLicence,
  validateStoredLicence,
  getLocalLicenceState,
  isWithinOfflineGracePeriod,
  OFFLINE_GRACE_DAYS,
};
