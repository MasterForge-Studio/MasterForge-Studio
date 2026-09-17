(() => {
  "use strict";

  function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
    return value;
  }
  function text(value) { return typeof value === "string" || typeof value === "number" ? String(value).trim() : ""; }
  function dependenciesOf(options) {
    const contract = options.contract || (typeof require === "function" ? require("./interchange-contract.js") : globalThis.MasterForgeInterchangeContract);
    const provenance = options.provenance || (typeof require === "function" ? require("./external-provenance.js") : globalThis.MasterForgeExternalProvenance);
    return { contract, provenance };
  }
  function externalIdentity(source, identity, provenance) {
    const raw = isObject(identity) ? identity : {};
    return provenance.createExternalIdentity({
      sourceSystem: source.system, sourceWorkspaceId: source.workspaceId,
      sourceEntityType: raw.type || raw.entityType || raw.sourceEntityType,
      sourceEntityId: raw.id || raw.entityId || raw.sourceEntityId
    });
  }
  function issue(code, message, details = {}) { return { code, message, ...details }; }

  function parseAtlasPackage(rawPackage, options = {}) {
    const { contract, provenance } = dependenciesOf(options);
    const errors = [], warnings = [];
    if (!isObject(rawPackage)) return { valid: false, manifestVersion: null, source: {}, selection: [], entities: [], relationships: [], geography: [], ecology: [], assets: [], dependencies: [], extensions: {}, warnings, errors: [issue("INVALID_PACKAGE_SHAPE", "Atlas package must be an object.")] };
    const input = clone(rawPackage);
    const versionCheck = contract.validateManifestVersion(input.manifestVersion);
    if (!versionCheck.valid) errors.push(...versionCheck.errors);
    const source = isObject(input.source) ? clone(input.source) : {};
    source.system = text(source.system).toLowerCase(); source.workspaceId = text(source.workspaceId);
    if (source.system !== contract.SOURCE_SYSTEM_MASTERFORGE_ATLAS) errors.push(issue("INVALID_SOURCE_SYSTEM", "Atlas parser requires source.system to be masterforge-atlas."));
    if (!source.workspaceId) errors.push(issue("MISSING_SOURCE_WORKSPACE_ID", "Atlas package source.workspaceId is required."));
    else if (source.system === contract.SOURCE_SYSTEM_MASTERFORGE_ATLAS) {
      const sourceValidation = provenance.validateExternalIdentity({ sourceSystem: source.system, sourceWorkspaceId: source.workspaceId, sourceEntityType: "package", sourceEntityId: "00000000-0000-4000-8000-000000000000" });
      const workspaceError = sourceValidation.errors.find(item => item.field === "sourceWorkspaceId");
      if (workspaceError) errors.push(workspaceError);
    }
    const supported = new Set(contract.SUPPORTED_EXTERNAL_ENTITY_TYPES);
    const entityKeys = new Set();
    const entities = [];
    for (const [index, raw] of (Array.isArray(input.entities) ? input.entities : []).entries()) {
      if (!isObject(raw)) { errors.push(issue("MALFORMED_PACKAGE_ENTITY", "Package entity must be an object.", { index })); continue; }
      const identity = externalIdentity(source, raw.identity || raw.externalIdentity || raw, provenance);
      const validation = provenance.validateExternalIdentity(identity || {});
      if (!validation.valid) { errors.push(issue("MALFORMED_PACKAGE_ENTITY_IDENTITY", "Package entity has invalid external identity.", { index, validationErrors: validation.errors })); continue; }
      const key = provenance.getExternalIdentityKey(identity);
      if (entityKeys.has(key)) errors.push(issue("DUPLICATE_PACKAGE_EXTERNAL_IDENTITY", "Package contains the same external entity identity more than once.", { index, identity }));
      entityKeys.add(key);
      const entityType = identity.sourceEntityType;
      const entityWarnings = [];
      if (!supported.has(entityType)) entityWarnings.push(issue("UNSUPPORTED_EXTERNAL_ENTITY_TYPE", `External entity type ${entityType} is not supported.`, { entityType }));
      entities.push({
        externalIdentity: identity, sourceRevision: text(raw.revision || raw.sourceRevision), sourceHash: text(raw.contentHash || raw.sourceHash),
        entityType, name: text(raw.name), payload: clone(isObject(raw.data) ? raw.data : isObject(raw.payload) ? raw.payload : {}),
        visibility: clone(raw.visibility ?? "gm"), dependencies: clone(Array.isArray(raw.dependencies) ? raw.dependencies : []),
        supported: supported.has(entityType), warnings: entityWarnings, rawExtensions: Object.fromEntries(Object.entries(raw).filter(([key]) => !["identity", "externalIdentity", "revision", "sourceRevision", "contentHash", "sourceHash", "name", "data", "payload", "visibility", "dependencies"].includes(key)).map(([key, value]) => [key, clone(value)]))
      });
      warnings.push(...entityWarnings.map(value => ({ ...value, index })));
    }
    const relationships = [];
    const relationshipIds = new Set();
    for (const [index, raw] of (Array.isArray(input.relationships) ? input.relationships : []).entries()) {
      if (!isObject(raw)) { errors.push(issue("MALFORMED_PACKAGE_RELATIONSHIP", "Package relationship must be an object.", { index })); continue; }
      const id = text(raw.id);
      if (id && relationshipIds.has(id)) errors.push(issue("DUPLICATE_PACKAGE_RELATIONSHIP_ID", `Relationship ID ${id} appears more than once.`, { index, id }));
      if (id) relationshipIds.add(id);
      const sourceIdentity = externalIdentity(source, raw.source || raw.sourceExternalIdentity, provenance);
      const targetIdentity = externalIdentity(source, raw.target || raw.targetExternalIdentity, provenance);
      const sourceValid = provenance.validateExternalIdentity(sourceIdentity || {}).valid, targetValid = provenance.validateExternalIdentity(targetIdentity || {}).valid;
      if (!sourceValid || !targetValid) { errors.push(issue("MALFORMED_RELATIONSHIP_ENDPOINT", "Relationship requires valid source and target external identities.", { index, id: id || null })); continue; }
      if (!text(raw.type || raw.relationshipType)) { errors.push(issue("MISSING_RELATIONSHIP_TYPE", "Relationship type is required.", { index, id: id || null })); continue; }
      relationships.push({ id, type: text(raw.type || raw.relationshipType).toLowerCase(), sourceExternalIdentity: sourceIdentity, targetExternalIdentity: targetIdentity, metadata: clone(isObject(raw.metadata) ? raw.metadata : {}), visibility: clone(raw.visibility ?? "gm"), sourceRevision: text(raw.revision || raw.sourceRevision), sourceHash: text(raw.contentHash || raw.sourceHash), rawExtensions: Object.fromEntries(Object.entries(raw).filter(([key]) => !["id", "type", "relationshipType", "source", "sourceExternalIdentity", "target", "targetExternalIdentity", "metadata", "visibility", "revision", "sourceRevision", "contentHash", "sourceHash"].includes(key)).map(([key, value]) => [key, clone(value)])) });
    }
    const dependencies = [];
    for (const [index, raw] of (Array.isArray(input.dependencies) ? input.dependencies : []).entries()) {
      if (!isObject(raw)) { errors.push(issue("MALFORMED_DEPENDENCY", "Dependency must be an object.", { index })); continue; }
      const identity = externalIdentity(source, raw.identity || raw.target || raw, provenance);
      if (!provenance.validateExternalIdentity(identity || {}).valid) { errors.push(issue("MALFORMED_DEPENDENCY_REFERENCE", "Dependency requires a valid external identity.", { index })); continue; }
      const requiredBy = raw.requiredBy || raw.source || raw.for;
      dependencies.push({ externalIdentity: identity, requiredByExternalIdentity: requiredBy ? externalIdentity(source, requiredBy, provenance) : null, class: ["required", "optional", "contextual"].includes(text(raw.class).toLowerCase()) ? text(raw.class).toLowerCase() : "contextual", reason: text(raw.reason), depth: Number.isFinite(Number(raw.depth)) ? Number(raw.depth) : null, visibility: clone(raw.visibility ?? "gm"), rawExtensions: Object.fromEntries(Object.entries(raw).filter(([key]) => !["identity", "target", "requiredBy", "source", "for", "class", "reason", "depth", "visibility", "type", "id"].includes(key)).map(([key, value]) => [key, clone(value)])) });
    }
    const knownTop = new Set(["manifestVersion", "source", "selection", "entities", "relationships", "geography", "ecology", "assets", "dependencies"]);
    const selection = [];
    for (const [index, value] of (Array.isArray(input.selection) ? input.selection : []).entries()) {
      if (!isObject(value)) { errors.push(issue("MALFORMED_SELECTION_REFERENCE", "Selection entry must be an object.", { index })); continue; }
      const identity = externalIdentity(source, value.identity || value, provenance);
      if (!provenance.validateExternalIdentity(identity || {}).valid) { errors.push(issue("MALFORMED_SELECTION_REFERENCE", "Selection entry requires a valid external identity.", { index })); continue; }
      selection.push({ ...clone(value), externalIdentity: identity });
    }
    const supportedAssetMimes = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "audio/mpeg", "audio/ogg", "audio/wav", "application/pdf", "text/markdown"]);
    const assets = (Array.isArray(input.assets) ? input.assets : []).filter(isObject).map(asset => {
      const mimeType = text(asset.mimeType).toLowerCase();
      const previewKind = !asset.assetId || !mimeType ? "missing_metadata" : !supportedAssetMimes.has(mimeType) ? "unsupported" : asset.data || asset.embedded ? "embedded" : asset.path || asset.url ? "referenced" : "missing_metadata";
      return { ...clone(asset), previewKind };
    });
    const limits = { maxEntities: 250, maxRelationships: 500, maxTotalReferences: 1000, ...(options.limits || {}) };
    if (entities.length > limits.maxEntities) errors.push(issue("PACKAGE_ENTITY_LIMIT_EXCEEDED", `Package contains ${entities.length} entities; limit is ${limits.maxEntities}.`));
    if (relationships.length > limits.maxRelationships) errors.push(issue("PACKAGE_RELATIONSHIP_LIMIT_EXCEEDED", `Package contains ${relationships.length} relationships; limit is ${limits.maxRelationships}.`));
    const references = entities.length + relationships.length * 2 + dependencies.length;
    if (references > limits.maxTotalReferences) errors.push(issue("PACKAGE_REFERENCE_LIMIT_EXCEEDED", `Package contains ${references} graph references; limit is ${limits.maxTotalReferences}.`));
    return {
      valid: errors.length === 0, manifestVersion: Number.isFinite(Number(input.manifestVersion)) ? Number(input.manifestVersion) : null, source,
      selection, entities, relationships, geography: clone(Array.isArray(input.geography) ? input.geography : []), ecology: clone(Array.isArray(input.ecology) ? input.ecology : []),
      assets, dependencies, extensions: Object.fromEntries(Object.entries(input).filter(([key]) => !knownTop.has(key)).map(([key, value]) => [key, clone(value)])), warnings, errors
    };
  }

  const api = Object.freeze({ parseAtlasPackage });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.MasterForgeAtlasPackageParser = api;
})();
