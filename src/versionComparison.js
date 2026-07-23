function normaliseVersion(version) {
  const value = String(version || "").trim().toLowerCase().replace(/^v(?=\d)/, "");
  const match = value.match(/^(\d+)\.(\d+)\.(\d+)(?:[-.]?(alpha|beta|rc)(?:[-.]?(\d+))?)?$/);
  if (!match) return null;
  return {
    canonical: `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}${match[4] ? `-${match[4]}${match[5] ? `.${Number(match[5])}` : ""}` : ""}`,
    parts: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] || "",
    prereleaseNumber: match[5] ? Number(match[5]) : 0,
  };
}

function compareVersions(versionA, versionB) {
  const a = normaliseVersion(versionA);
  const b = normaliseVersion(versionB);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) {
    if (a.parts[index] !== b.parts[index]) return a.parts[index] < b.parts[index] ? -1 : 1;
  }
  if (a.prerelease === b.prerelease) {
    if (a.prereleaseNumber === b.prereleaseNumber) return 0;
    return a.prereleaseNumber < b.prereleaseNumber ? -1 : 1;
  }
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  const rank = { alpha: 0, beta: 1, rc: 2 };
  return rank[a.prerelease] < rank[b.prerelease] ? -1 : 1;
}

function evaluateVersionSupport(receivedVersion, currentVersion, minimumVersion) {
  const received = normaliseVersion(receivedVersion);
  const current = normaliseVersion(currentVersion);
  const minimum = normaliseVersion(minimumVersion);
  if (!received || !current || !minimum) return { supported: false, reason: "invalid_version_configuration", received, current, minimum };
  const versusMinimum = compareVersions(received.canonical, minimum.canonical);
  const versusCurrent = compareVersions(received.canonical, current.canonical);
  return {
    supported: versusMinimum >= 0 && versusCurrent <= 0,
    reason: versusMinimum < 0 ? "below_minimum_supported_version" : versusCurrent > 0 ? "above_current_build_version" : "supported",
    received: received.canonical, current: current.canonical, minimum: minimum.canonical, versusMinimum, versusCurrent,
  };
}

module.exports = { normaliseVersion, compareVersions, evaluateVersionSupport };
