(() => {
  "use strict";

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function text(value) { return String(value ?? "").trim(); }
  function ownershipSummary(type) {
    const shared = { atlasOwned: [], studioOwned: ["session/runtime state"], shared: ["name", "public summary", "public tags"] };
    if (type === "creature") return { ...shared, atlasOwned: ["geography", "habitat placement", "range", "ecology placement"], studioOwned: ["mechanics", "combat capabilities", "session/runtime state"] };
    if (type === "faction") return { ...shared, atlasOwned: ["geographic presence", "territory", "location links"], studioOwned: ["hierarchy", "campaign secrets", "runtime state"] };
    if (["world", "region", "location", "settlement", "landmark", "route", "territory", "biome", "environment", "lair", "site"].includes(type)) return { ...shared, atlasOwned: ["geography hierarchy", "placement", "environment"], studioOwned: ["campaign overlays", "session/runtime state"] };
    if (type === "npc") return { ...shared, atlasOwned: ["geographic presence"], studioOwned: ["mechanics", "capabilities", "campaign secrets", "session/runtime state"] };
    if (type === "item") return { ...shared, atlasOwned: ["geographic placement"], studioOwned: ["mechanics", "capabilities", "campaign secrets", "runtime state"] };
    return shared;
  }
  function detectDependencyCycles(dependencies, provenance, maxDepth) {
    const graph = new Map(), warnings = [], errors = [];
    for (const dependency of dependencies) {
      const from = provenance.getExternalIdentityKey(dependency.requiredByExternalIdentity), to = provenance.getExternalIdentityKey(dependency.externalIdentity);
      if (from && to) { if (!graph.has(from)) graph.set(from, []); graph.get(from).push(to); }
    }
    const visited = new Set(), active = new Set();
    function visit(key, depth, path) {
      if (depth > maxDepth) { errors.push({ code: "PACKAGE_DEPENDENCY_DEPTH_EXCEEDED", message: `Dependency graph exceeds depth ${maxDepth}.`, path: [...path, key] }); return; }
      if (active.has(key)) { warnings.push({ code: "PACKAGE_DEPENDENCY_CYCLE", message: "Dependency graph contains a cycle.", path: [...path, key] }); return; }
      if (visited.has(key)) return;
      active.add(key);
      for (const next of graph.get(key) || []) visit(next, depth + 1, [...path, key]);
      active.delete(key); visited.add(key);
    }
    for (const key of graph.keys()) visit(key, 0, []);
    return { warnings, errors };
  }

  async function buildAtlasImportPreview(parsedPackage, dependencies = {}, options = {}) {
    const provenance = dependencies.provenance || (typeof require === "function" ? require("./external-provenance.js") : globalThis.MasterForgeExternalProvenance);
    const matchModule = dependencies.matchModule || (typeof require === "function" ? require("./external-entity-match.js") : globalThis.MasterForgeExternalEntityMatch);
    const relationshipTypes = dependencies.relationshipTypes || (typeof globalThis !== "undefined" ? globalThis.MasterForgeRelationshipTypes : null);
    const matchExternal = dependencies.findExistingEntityForExternalIdentity || matchModule.findExistingEntityForExternalIdentity;
    const parsed = clone(parsedPackage || {});
    const warnings = [...(parsed.warnings || [])], errors = [...(parsed.errors || [])];
    const entityList = Array.isArray(parsed.entities) ? parsed.entities : [];
    const dependencyList = Array.isArray(parsed.dependencies) ? parsed.dependencies : [];
    const matchCache = new Map();
    const readDependencies = { provenance, listEntities: dependencies.listEntities, listRecords: dependencies.listRecords };
    async function match(identity) {
      const key = provenance.getExternalIdentityKey(identity);
      if (!key) return { match: "none", entity: null, record: null, candidates: [], warnings: [] };
      if (!matchCache.has(key)) matchCache.set(key, Promise.resolve(matchExternal(identity, readDependencies)));
      return matchCache.get(key);
    }
    const graph = detectDependencyCycles(dependencyList, provenance, options.maxDependencyDepth ?? 2);
    warnings.push(...graph.warnings); errors.push(...graph.errors);
    const incomingByKey = new Map(entityList.map(entity => [provenance.getExternalIdentityKey(entity.externalIdentity), entity]));
    const entityPreviews = [];
    for (const entity of entityList) {
      const localMatch = entity.supported === false ? { match: "none", entity: null, record: null, candidates: [], warnings: [] } : await match(entity.externalIdentity);
      const incomingProvenance = { ...entity.externalIdentity, sourceRevision: entity.sourceRevision, sourceHash: entity.sourceHash };
      const existingProvenance = localMatch.record?.externalProvenance || localMatch.entity?.externalProvenance || localMatch.entity?.data_json?.externalProvenance || localMatch.entity?.data_json?.externalIdentity || null;
      let sourceComparison = localMatch.match === "exact" ? provenance.compareExternalRevision(existingProvenance, incomingProvenance) : localMatch.match === "ambiguous" ? "unknown" : "different_identity";
      let proposedAction = entity.supported === false ? "unsupported" : localMatch.match === "ambiguous" ? "manual_review" : localMatch.match === "none" ? "create" : sourceComparison === "same" ? "unchanged" : sourceComparison === "changed" ? "update" : "manual_review";
      const entityKey = provenance.getExternalIdentityKey(entity.externalIdentity);
      const relevantDependencies = dependencyList.filter(item => !item.requiredByExternalIdentity || provenance.getExternalIdentityKey(item.requiredByExternalIdentity) === entityKey);
      entityPreviews.push({
        externalIdentity: clone(entity.externalIdentity), entityType: entity.entityType, name: entity.name, match: localMatch.match,
        sourceComparison, proposedAction, existingEntity: clone(localMatch.entity), existingRecord: clone(localMatch.record),
        sourceRevision: entity.sourceRevision, sourceHash: entity.sourceHash, normalizedPayload: clone(entity.payload), ownershipSummary: ownershipSummary(entity.entityType),
        visibility: clone(entity.visibility), dependencySummary: { total: relevantDependencies.length, required: relevantDependencies.filter(item => item.class === "required").length, optional: relevantDependencies.filter(item => item.class === "optional").length, contextual: relevantDependencies.filter(item => item.class === "contextual").length },
        warnings: [...(entity.warnings || []), ...(localMatch.warnings || [])]
      });
    }
    const previewByKey = new Map(entityPreviews.map(entity => [provenance.getExternalIdentityKey(entity.externalIdentity), entity]));
    const dependencyPreviews = [];
    for (const dependency of dependencyList) {
      const key = provenance.getExternalIdentityKey(dependency.externalIdentity), packaged = previewByKey.get(key);
      let state = "missing", existingEntity = null, existingRecord = null;
      if (packaged?.proposedAction === "unsupported") state = "unsupported";
      else if (packaged) state = "present_in_package";
      else {
        const local = await match(dependency.externalIdentity);
        if (local.match === "exact") { state = "existing_in_studio"; existingEntity = clone(local.entity); existingRecord = clone(local.record); }
        else if (local.match === "ambiguous") state = "ambiguous";
        else if (!new Set(["world", "region", "location", "settlement", "landmark", "route", "territory", "biome", "environment", "lair", "site", "npc", "creature", "faction", "item", "resource", "hazard", "quest", "encounter", "party"]).has(dependency.externalIdentity.sourceEntityType)) state = "unsupported";
      }
      const preview = { ...clone(dependency), state, existingEntity, existingRecord };
      dependencyPreviews.push(preview);
      if (dependency.class === "required" && ["missing", "ambiguous", "unsupported"].includes(state)) warnings.push({ code: "REQUIRED_DEPENDENCY_UNRESOLVED", message: `Required dependency is ${state}.`, externalIdentity: clone(dependency.externalIdentity) });
    }
    async function endpoint(identity) {
      const key = provenance.getExternalIdentityKey(identity), packaged = previewByKey.get(key);
      if (packaged) return packaged.proposedAction === "unsupported" ? "unsupported" : packaged.match === "ambiguous" ? "ambiguous" : "available";
      const local = await match(identity);
      return local.match === "exact" ? "available" : local.match === "ambiguous" ? "ambiguous" : "missing";
    }
    const relationshipPreviews = [];
    for (const relationship of Array.isArray(parsed.relationships) ? parsed.relationships : []) {
      const sourceState = await endpoint(relationship.sourceExternalIdentity), targetState = await endpoint(relationship.targetExternalIdentity);
      const typeSupported = typeof dependencies.isRelationshipTypeSupported === "function" ? dependencies.isRelationshipTypeSupported(relationship.type) : relationshipTypes?.has?.(relationship.type) === true;
      let proposedAction = sourceState === "available" && targetState === "available" && typeSupported ? "create_candidate" : [sourceState, targetState].includes("ambiguous") ? "manual_review" : "skip";
      relationshipPreviews.push({ ...clone(relationship), sourceState, targetState, typeSupported, proposedAction, warnings: proposedAction === "create_candidate" ? [] : [{ code: "RELATIONSHIP_NOT_READY", message: "Relationship endpoints or type are not ready for future apply." }] });
    }
    const totals = { create: 0, update: 0, unchanged: 0, manualReview: 0, unsupported: 0, skipped: 0 };
    for (const entity of entityPreviews) ({ create: () => totals.create++, update: () => totals.update++, unchanged: () => totals.unchanged++, manual_review: () => totals.manualReview++, unsupported: () => totals.unsupported++, skip: () => totals.skipped++ }[entity.proposedAction] || (() => totals.skipped++))();
    const typeCounts = Object.fromEntries([...new Set(entityList.map(item => item.entityType))].sort().map(type => [type, entityList.filter(item => item.entityType === type).length]));
    const assetSummary = { embedded: 0, referenced: 0, unsupported: 0, missingMetadata: 0 };
    for (const asset of parsed.assets || []) { if (asset.previewKind === "embedded") assetSummary.embedded++; else if (asset.previewKind === "referenced") assetSummary.referenced++; else if (asset.previewKind === "unsupported") assetSummary.unsupported++; else assetSummary.missingMetadata++; }
    return {
      packageSummary: { manifestVersion: parsed.manifestVersion, source: clone(parsed.source), selection: clone(parsed.selection || []), compiledByType: typeCounts, geographyRecords: (parsed.geography || []).length, ecologyRecords: (parsed.ecology || []).length, assets: assetSummary },
      entities: entityPreviews, relationships: relationshipPreviews, dependencies: dependencyPreviews, totals, warnings, errors,
      valid: parsed.valid === true && errors.length === 0
    };
  }

  const api = Object.freeze({ buildAtlasImportPreview });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.MasterForgeAtlasImportPreview = api;
})();
