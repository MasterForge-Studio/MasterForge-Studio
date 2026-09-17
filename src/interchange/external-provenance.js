(() => {
  "use strict";

  const VERSION = 1;
  const ATLAS = "masterforge-atlas";
  const IDENTITY_FIELDS = Object.freeze(["sourceSystem", "sourceWorkspaceId", "sourceEntityType", "sourceEntityId"]);
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
    return value;
  }
  function text(value) { return typeof value === "string" || typeof value === "number" ? String(value).trim() : ""; }
  function identitySource(value) {
    if (!isObject(value)) return null;
    return isObject(value.externalProvenance) ? value.externalProvenance
      : isObject(value.externalIdentity) ? value.externalIdentity
      : isObject(value.data_json?.externalProvenance) ? value.data_json.externalProvenance
      : isObject(value.data_json?.externalIdentity) ? value.data_json.externalIdentity
      : value;
  }
  function createExternalIdentity(value) {
    const source = identitySource(value);
    if (!source) return null;
    const identity = Object.fromEntries(IDENTITY_FIELDS.map(field => [field, ["sourceSystem", "sourceEntityType"].includes(field) ? text(source[field]).toLowerCase() : text(source[field])]));
    return IDENTITY_FIELDS.every(field => identity[field]) ? identity : null;
  }
  function normalizeExternalProvenance(value) {
    const source = identitySource(value);
    if (!source || !IDENTITY_FIELDS.some(field => text(source[field]))) return null;
    return {
      ...clone(source), version: Number.isFinite(Number(source.version)) ? Number(source.version) : VERSION,
      sourceSystem: text(source.sourceSystem).toLowerCase(), sourceWorkspaceId: text(source.sourceWorkspaceId),
      sourceEntityType: text(source.sourceEntityType).toLowerCase(), sourceEntityId: text(source.sourceEntityId),
      sourceRevision: text(source.sourceRevision), sourceHash: text(source.sourceHash), importedAt: text(source.importedAt), lastSeenAt: text(source.lastSeenAt)
    };
  }
  function validateExternalIdentity(value) {
    const source = identitySource(value) || {};
    const errors = [];
    for (const field of IDENTITY_FIELDS) if (!text(source[field])) errors.push({ code: `MISSING_${field.replace(/([A-Z])/g, "_$1").toUpperCase()}`, field, message: `${field} is required.` });
    if (text(source.sourceSystem).toLowerCase() === ATLAS) {
      if (text(source.sourceWorkspaceId) && !UUID.test(text(source.sourceWorkspaceId))) errors.push({ code: "MALFORMED_ATLAS_WORKSPACE_ID", field: "sourceWorkspaceId", message: "Atlas workspace identity must be a UUID." });
      if (text(source.sourceEntityId) && !UUID.test(text(source.sourceEntityId))) errors.push({ code: "MALFORMED_ATLAS_ENTITY_ID", field: "sourceEntityId", message: "Atlas entity identity must be a UUID." });
    }
    return { valid: errors.length === 0, identity: createExternalIdentity(source), errors };
  }
  function getExternalIdentityKey(value) {
    const identity = createExternalIdentity(value);
    return identity ? IDENTITY_FIELDS.map(field => identity[field]).join("::") : "";
  }
  function isSameExternalIdentity(a, b) { const left = getExternalIdentityKey(a), right = getExternalIdentityKey(b); return Boolean(left && right && left === right); }
  function hasExternalProvenance(value) { return Boolean(createExternalIdentity(value)); }
  function isAtlasProvenance(value) { return createExternalIdentity(value)?.sourceSystem === ATLAS; }
  function compareExternalRevision(current, incoming) {
    if (!isSameExternalIdentity(current, incoming)) return "different_identity";
    const left = normalizeExternalProvenance(current), right = normalizeExternalProvenance(incoming);
    const hashKnown = Boolean(left.sourceHash && right.sourceHash), revisionKnown = Boolean(left.sourceRevision && right.sourceRevision);
    if (hashKnown && left.sourceHash !== right.sourceHash) return "changed";
    if (revisionKnown && left.sourceRevision !== right.sourceRevision) return "changed";
    if ((left.sourceHash && !right.sourceHash) || (!left.sourceHash && right.sourceHash) || (left.sourceRevision && !right.sourceRevision) || (!left.sourceRevision && right.sourceRevision)) return "unknown";
    return hashKnown || revisionKnown ? "same" : "unknown";
  }
  function hasSourceChanged(current, incoming) { return compareExternalRevision(current, incoming); }
  function toExternalIdentity(value) { return createExternalIdentity(value); }
  function canAdoptExternalIdentity(localEntity, incomingIdentity) {
    const validation = validateExternalIdentity(incomingIdentity);
    if (!validation.valid) return { allowed: false, status: "invalid_identity", identity: null, errors: validation.errors };
    const existing = createExternalIdentity(localEntity);
    if (!existing) return { allowed: true, status: "can_adopt", identity: validation.identity, errors: [] };
    if (isSameExternalIdentity(existing, validation.identity)) return { allowed: true, status: "already_adopted", identity: existing, errors: [] };
    return { allowed: false, status: "identity_conflict", identity: existing, errors: [{ code: "EXTERNAL_IDENTITY_CONFLICT", message: "The local entity already claims a different external identity." }] };
  }

  const api = Object.freeze({ VERSION, IDENTITY_FIELDS, createExternalIdentity, normalizeExternalProvenance, validateExternalIdentity, getExternalIdentityKey, isSameExternalIdentity, hasExternalProvenance, isAtlasProvenance, compareExternalRevision, hasSourceChanged, toExternalIdentity, canAdoptExternalIdentity });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.MasterForgeExternalProvenance = api;
})();
