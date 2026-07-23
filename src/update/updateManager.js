const UPDATE_INFO_URL =
  "https://masterforgestudio.com/wp-json/masterforge/v1/update-info";
const { compareVersions } = require("../versionComparison");

/**
 * Fetch current update information from the MasterForge website.
 *
 * This function never throws.
 * If the website is unavailable, it returns a safe failure object
 * so startup is not blocked.
 */
async function fetchUpdateInfo() {
  try {
    const response = await fetch(UPDATE_INFO_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: "server_error",
        status: response.status,
      };
    }

    const data = await response.json();

    if (!data?.success) {
      return {
        success: false,
        error: "invalid_response",
      };
    }

    return {
      success: true,
      latestVersion:
        String(data.latest_version || "").trim(),

      minimumSupportedVersion:
        String(
          data.minimum_supported_version || ""
        ).trim(),

      downloadUrl:
        String(data.download_url || "").trim(),

      releaseNotes:
        String(data.release_notes || "").trim(),

      platform:
        String(data.platform || "").trim(),
    };
  } catch (error) {
    console.warn(
      "[MasterForge] Update check unavailable:",
      error.message
    );

    return {
      success: false,
      error: "network_error",
    };
  }
}

/**
 * Compare two semantic-style version strings.
 *
 * Returns:
 * -1 when versionA is older
 *  0 when versions match
 *  1 when versionA is newer
 */
/**
 * Work out whether the installed build is current,
 * optionally outdated, or no longer supported.
 */
function getUpdateStatus(
  installedVersion,
  updateInfo
) {
  if (!updateInfo?.success) {
    return {
      status: "unavailable",
      installedVersion,
      updateInfo,
    };
  }

  const latestVersion =
    updateInfo.latestVersion;

  const minimumSupportedVersion =
    updateInfo.minimumSupportedVersion;

  const minimumComparison = minimumSupportedVersion ? compareVersions(installedVersion, minimumSupportedVersion) : null;
  const latestComparison = latestVersion ? compareVersions(installedVersion, latestVersion) : null;
  console.info("[MasterForge Version] Update comparison:", { installedVersion, latestVersion, minimumSupportedVersion, minimumComparison, latestComparison });

  if ((minimumSupportedVersion && minimumComparison === null) || (latestVersion && latestComparison === null)) {
    return { status: "unavailable", installedVersion, updateInfo, error: "invalid_version_configuration" };
  }

  if (
    minimumSupportedVersion &&
    minimumComparison < 0
  ) {
    return {
      status: "update_required",
      installedVersion,
      latestVersion,
      minimumSupportedVersion,
      downloadUrl: updateInfo.downloadUrl,
      releaseNotes: updateInfo.releaseNotes,
    };
  }

  if (
    latestVersion &&
    latestComparison < 0
  ) {
    return {
      status: "update_available",
      installedVersion,
      latestVersion,
      minimumSupportedVersion,
      downloadUrl: updateInfo.downloadUrl,
      releaseNotes: updateInfo.releaseNotes,
    };
  }

  return {
    status: "up_to_date",
    installedVersion,
    latestVersion,
    minimumSupportedVersion,
  };
}

module.exports = {
  fetchUpdateInfo,
  compareVersions,
  getUpdateStatus,
};
