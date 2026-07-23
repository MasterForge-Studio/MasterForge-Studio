// MasterForge Inheritance Engine
// Read-only, deterministic feature resolution. Nothing in this module writes data.
(() => {
  "use strict";

  const VERSION = 1;
  const PRECEDENCE = Object.freeze({
    personal: 400,
    relationshipProfile: 300,
    hierarchyNode: 200,
    faction: 100,
    gameSystem: 0
  });
  const DEFAULT_OPTIONS = Object.freeze({
    visibilityMode: "gm",
    includeInactive: false,
    includeHidden: false,
    includeDiagnostics: true
  });
  const MEMBERSHIP_TYPES = new Set(["member_of", "secretly_member_of"]);

  function optionsWithDefaults(options = {}) {
    return {
      ...DEFAULT_OPTIONS,
      ...options,
      visibilityMode: options.visibilityMode === "public" ? "public" : "gm"
    };
  }

  function normaliseName(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function deterministicFeatureId(entity, section, item, index) {
    const name = normaliseName(typeof item === "string" ? item : item?.name || item?.title || "unnamed")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unnamed";
    return `personal:${entity.entity_type || entity.type || "entity"}:${entity.id || "unknown"}:${section}:${name}:${index}`;
  }

  function adaptFeature(entity, section, item, index, featureType, category) {
    const source = typeof item === "string" ? { name: item, description: item } : (item && typeof item === "object" ? item : {});
    const id = String(source.id || source.featureId || deterministicFeatureId(entity, section, source, index));
    return {
      id,
      featureType,
      name: String(source.name || source.title || `${category || featureType} ${index + 1}`),
      description: String(source.description || source.text || source.notes || ""),
      category: String(source.category || category || ""),
      active: source.active !== false,
      tags: safeArray(source.tags).map(String),
      sourceData: { ...source }
    };
  }

  const PERSONAL_SECTIONS = Object.freeze([
    Object.freeze({ keys: ["traits"], section: "traits", featureType: "trait", category: "Trait" }),
    Object.freeze({ keys: ["actions"], section: "actions", featureType: "ability", category: "Action" }),
    Object.freeze({ keys: ["bonusActions", "bonus_actions"], section: "bonus-actions", featureType: "ability", category: "Bonus Action" }),
    Object.freeze({ keys: ["reactions"], section: "reactions", featureType: "ability", category: "Reaction" }),
    Object.freeze({ keys: ["legendaryActions", "legendary_actions"], section: "legendary-actions", featureType: "ability", category: "Legendary Action" }),
    Object.freeze({ keys: ["lairActions", "lair_actions"], section: "lair-actions", featureType: "ability", category: "Lair Action" }),
    Object.freeze({ keys: ["features", "personalFeatures"], section: "features", featureType: "trait", category: "Feature" }),
    Object.freeze({ keys: ["abilities", "personalAbilities"], section: "abilities", featureType: "ability", category: "Ability" })
  ]);

  function adaptGenericPersonalFeatures(entity = {}, sourceRecord = entity) {
    const records = [sourceRecord, sourceRecord?.data_json, sourceRecord?.data_json?.character].filter(Boolean);
    const found = [];
    PERSONAL_SECTIONS.forEach(definition => {
      let items = [];
      for (const record of records) {
        const key = definition.keys.find(candidate => Array.isArray(record?.[candidate]));
        if (key) { items = record[key]; break; }
      }
      items.forEach((item, index) => found.push(adaptFeature(entity, definition.section, item, index, definition.featureType, definition.category)));
    });
    return found;
  }

  function adaptNpcPersonalFeatures(record = {}, entity = record) {
    return adaptGenericPersonalFeatures(entity, record);
  }

  function adaptCreaturePersonalFeatures(record = {}, entity = record) {
    return adaptGenericPersonalFeatures(entity, record);
  }

  function adaptPcPersonalFeatures(record = {}, entity = record) {
    return adaptGenericPersonalFeatures(entity, record);
  }

  function emptySources() {
    return {
      faction: [], hierarchyNode: [], relationshipProfile: [], personal: [],
      equipment: [], progression: [], gameSystem: []
    };
  }

  function sourceSummary(feature) {
    return Object.freeze({
      sourceType: feature.sourceType,
      sourceId: feature.sourceId,
      sourceName: feature.sourceName,
      factionId: feature.factionId,
      factionName: feature.factionName,
      hierarchyNodeId: feature.hierarchyNodeId,
      hierarchyNodeName: feature.hierarchyNodeName,
      relationshipId: feature.relationshipId,
      secret: feature.secret === true,
      precedence: feature.precedence
    });
  }

  function comparableFeature(feature) {
    return JSON.stringify({
      id: feature.id, featureType: feature.featureType, name: feature.name,
      description: feature.description, category: feature.category,
      active: feature.active, tags: feature.tags, sourceData: feature.sourceData
    });
  }

  function compareCandidates(left, right) {
    return Number(right.precedence || 0) - Number(left.precedence || 0) ||
      Number(right._primary === true) - Number(left._primary === true) ||
      Number(left.secret === true) - Number(right.secret === true) ||
      String(left.factionName || "").localeCompare(String(right.factionName || "")) ||
      String(left.relationshipId || "").localeCompare(String(right.relationshipId || "")) ||
      String(left._packId || "").localeCompare(String(right._packId || "")) ||
      String(left.id || "").localeCompare(String(right.id || "")) ||
      String(left.sourceId || "").localeCompare(String(right.sourceId || ""));
  }

  function publicFeature(feature) {
    const { _primary, _packId, _eligible, ...result } = feature;
    return result;
  }

  function resolveFeatureCandidates(candidates = [], options = {}) {
    const settings = optionsWithDefaults(options);
    const sorted = candidates.map(item => ({ ...item, tags: [...safeArray(item.tags)], duplicateSources: [...safeArray(item.duplicateSources)] })).sort(compareCandidates);
    const effective = [];
    const conflicts = [];
    const warnings = [];
    const winners = new Map();

    sorted.forEach(candidate => {
      if (candidate._eligible === false || (!settings.includeInactive && candidate.active === false)) return;
      const winner = winners.get(candidate.id);
      if (!winner) {
        winners.set(candidate.id, candidate);
        effective.push(candidate);
        return;
      }
      if (comparableFeature(winner) === comparableFeature(candidate)) {
        winner.duplicateSources.push(sourceSummary(candidate));
        return;
      }
      candidate.overriddenBy = `${winner.sourceType}:${winner.sourceId}`;
      const sameTier = winner.precedence === candidate.precedence;
      conflicts.push({
        featureId: candidate.id,
        winner: sourceSummary(winner),
        overridden: sourceSummary(candidate),
        unresolvedSameTier: sameTier
      });
      if (sameTier) warnings.push({ code: "same-tier-conflict", featureId: candidate.id, message: `Conflicting ${candidate.featureType} ${candidate.name} has equal precedence; deterministic source ordering selected the winner.`, unresolvedSameTier: true });
    });

    const names = new Map();
    sorted.forEach(feature => {
      const key = `${feature.featureType}:${normaliseName(feature.name)}`;
      if (!normaliseName(feature.name)) return;
      const prior = names.get(key);
      if (prior && prior.id !== feature.id) warnings.push({ code: "possible-duplicate-name", featureIds: [prior.id, feature.id], message: `Possible duplicate ${feature.featureType} name: ${feature.name}.` });
      else if (!prior) names.set(key, feature);
    });

    return {
      grouped: sorted.map(publicFeature),
      effective: effective.map(publicFeature),
      conflicts,
      warnings
    };
  }

  function makeResolvedFeature(raw, context) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      ...source,
      id: String(source.id || context.fallbackId),
      featureType: context.featureType,
      name: String(source.name || source.title || "Unnamed feature"),
      description: String(source.description || source.text || source.rulesText || ""),
      category: String(source.category || context.category || ""),
      active: source.active !== false && context.sourceActive !== false,
      tags: safeArray(source.tags).map(String),
      sourceType: context.sourceType,
      sourceId: context.sourceId,
      sourceName: context.sourceName,
      factionId: context.factionId || null,
      factionName: context.factionName || null,
      hierarchyNodeId: context.hierarchyNodeId || null,
      hierarchyNodeName: context.hierarchyNodeName || null,
      relationshipId: context.relationshipId || null,
      secret: context.secret === true,
      hidden: context.hidden === true,
      precedence: context.precedence,
      inherited: context.inherited !== false,
      overriddenBy: null,
      duplicateSources: [],
      _primary: context.primary === true,
      _packId: context.packId || "",
      _eligible: context.eligible !== false
    };
  }

  async function loadPersonalRecord(entity) {
    const collection = entity.entity_type === "npc" ? "npcs" : entity.entity_type === "creature" ? "creatures" : null;
    if (collection && window.dmAPI?.getAllRecordsInCollection) {
      try {
        const records = await window.dmAPI.getAllRecordsInCollection(collection);
        const sourceId = entity.data_json?.npcId || entity.data_json?.creatureId || entity.id;
        return safeArray(records).find(item => item.id === sourceId || item.entityId === entity.id) || entity;
      } catch (_) { return entity; }
    }
    if (entity.entity_type === "pc" && window.dmStorage?.getCharacters) {
      try {
        const records = await window.dmStorage.getCharacters();
        return safeArray(records).find(item => item.id === (entity.data_json?.characterId || entity.id)) || entity;
      } catch (_) { return entity; }
    }
    return entity;
  }

  async function getMemberships(entity) {
    const engine = window.MasterForgeRelationshipEngine;
    if (!engine?.getRelationshipsForEntity) return [];
    const relationships = await engine.getRelationshipsForEntity(entity.entity_type, entity.id);
    return safeArray(relationships).filter(item =>
      item.sourceEntityType === entity.entity_type && item.sourceEntityId === entity.id &&
      item.targetEntityType === "faction" && MEMBERSHIP_TYPES.has(item.relationshipType)
    );
  }

  async function collectResolution(entity, options) {
    const settings = optionsWithDefaults(options);
    const sources = emptySources();
    const candidates = [];
    const warnings = [];
    const diagnostics = { memberships: [], excluded: [], missingPacks: [], missingHierarchyNodes: [] };
    const metadataKeys = window.MasterForgeRelationshipMetadata?.KEYS || {};
    const personalRecord = await loadPersonalRecord(entity);
    const adapter = entity.entity_type === "npc" ? adaptNpcPersonalFeatures : entity.entity_type === "creature" ? adaptCreaturePersonalFeatures : entity.entity_type === "pc" ? adaptPcPersonalFeatures : adaptGenericPersonalFeatures;
    adapter(personalRecord, entity).forEach((feature, index) => {
      const resolved = makeResolvedFeature(feature, {
        fallbackId: deterministicFeatureId(entity, "personal", feature, index), featureType: feature.featureType,
        category: feature.category, sourceType: "personal", sourceId: entity.id, sourceName: "Personal",
        precedence: PRECEDENCE.personal, inherited: false
      });
      candidates.push(resolved);
      sources.personal.push(sourceSummary(resolved));
    });

    let memberships = [];
    try { memberships = await getMemberships(entity); }
    catch (error) { warnings.push({ code: "membership-load-failed", message: `Memberships could not be loaded: ${error?.message || error}` }); }
    const visibleMemberships = memberships.filter(rel => !(settings.visibilityMode === "public" && rel.relationshipType === "secretly_member_of"));
    if (visibleMemberships.filter(rel => rel.data_json?.[metadataKeys.PRIMARY_FACTION] === true).length > 1) warnings.push({ code: "multiple-primary-memberships", message: "Several visible faction memberships are marked primary; all continue to resolve." });

    let packs = [];
    try { packs = await window.dmAPI.getEntitiesByType("ability_pack"); }
    catch (error) { warnings.push({ code: "pack-library-load-failed", message: `Ability Packs could not be loaded: ${error?.message || error}` }); }
    const packMap = new Map(safeArray(packs).map(pack => [pack.id, pack]));
    const factionMap = new Map();

    for (const relationship of visibleMemberships) {
      const secret = relationship.relationshipType === "secretly_member_of";
      let faction = factionMap.get(relationship.targetEntityId);
      try {
        if (!faction) {
          faction = await window.dmAPI.getEntity("faction", relationship.targetEntityId);
          if (faction) factionMap.set(relationship.targetEntityId, faction);
        }
      }
      catch (error) { warnings.push({ code: "faction-load-failed", message: `A faction could not be loaded: ${error?.message || error}` }); continue; }
      if (!faction) { warnings.push({ code: "missing-faction", message: `Membership faction ${relationship.targetEntityId} is missing.` }); continue; }
      const primary = relationship.data_json?.[metadataKeys.PRIMARY_FACTION] === true;
      const membershipSource = { factionId: faction.id, factionName: faction.name || faction.id, relationshipId: relationship.id, secret, primary };
      sources.faction.push(Object.freeze({ ...membershipSource, sourceType: "faction", sourceId: faction.id, sourceName: faction.name || faction.id }));
      diagnostics.memberships.push({ ...membershipSource, relationshipType: relationship.relationshipType });

      safeArray(faction.data_json?.traits).forEach((trait, index) => {
        if (!trait || typeof trait !== "object" || !String(trait.name || "").trim()) warnings.push({ code: "malformed-feature", factionId: faction.id, message: `A malformed faction trait at index ${index} was normalised and resolution continued.` });
        candidates.push(makeResolvedFeature(trait, {
          fallbackId: `faction:${faction.id}:trait:${normaliseName(trait?.name)}:${index}`, featureType: "trait",
          category: trait?.category || "Trait", sourceType: "faction", sourceId: faction.id, sourceName: faction.name || faction.id,
          ...membershipSource, precedence: PRECEDENCE.faction
        }));
      });

      const addPack = (packId, sourceContext) => {
        const pack = packMap.get(packId);
        if (!pack) {
          const warning = { code: "missing-ability-pack", packId, factionId: faction.id, hierarchyNodeId: sourceContext.hierarchyNodeId || null, message: `An assigned Ability Pack is missing from ${sourceContext.sourceName}.` };
          warnings.push(warning); diagnostics.missingPacks.push(warning); return;
        }
        const packData = pack.data_json && typeof pack.data_json === "object" ? pack.data_json : {};
        const active = packData.active !== false && sourceContext.sourceActive !== false;
        const common = { ...sourceContext, sourceId: pack.id, sourceName: pack.name || pack.id, packId: pack.id, sourceActive: active };
        safeArray(packData.traits).forEach((trait, index) => {
          if (!trait || typeof trait !== "object" || !String(trait.name || "").trim()) warnings.push({ code: "malformed-feature", packId: pack.id, message: `A malformed trait in ${pack.name || pack.id} was normalised and resolution continued.` });
          candidates.push(makeResolvedFeature(trait, { ...common, fallbackId: `pack:${pack.id}:trait:${index}`, featureType: "trait", category: trait?.category || "Trait" }));
        });
        safeArray(packData.abilities).forEach((ability, index) => {
          if (!ability || typeof ability !== "object" || !String(ability.name || "").trim()) warnings.push({ code: "malformed-feature", packId: pack.id, message: `A malformed ability in ${pack.name || pack.id} was normalised and resolution continued.` });
          candidates.push(makeResolvedFeature(ability, { ...common, fallbackId: `pack:${pack.id}:ability:${index}`, featureType: "ability", category: ability?.category || ability?.type || "Ability" }));
        });
        if (!active) diagnostics.excluded.push({ reason: "inactive", sourceType: sourceContext.sourceType, sourceId: pack.id });
      };

      safeArray(faction.data_json?.abilityPackIds).forEach(packId => addPack(packId, {
        sourceType: "factionAbilityPack", factionId: faction.id, factionName: faction.name || faction.id,
        sourceName: faction.name || faction.id,
        relationshipId: relationship.id, secret, primary, precedence: PRECEDENCE.faction,
        eligible: true
      }));

      const rankId = relationship.data_json?.[metadataKeys.FACTION_RANK_ID];
      if (rankId) {
        const hierarchy = window.MasterForgeFactionHierarchy?.normaliseFactionHierarchy
          ? window.MasterForgeFactionHierarchy.normaliseFactionHierarchy(faction.data_json || {})
          : faction.data_json?.factionHierarchy || { nodes: [] };
        const node = safeArray(hierarchy.nodes).find(item => item.id === rankId);
        if (!node) {
          const warning = { code: "missing-hierarchy-node", factionId: faction.id, relationshipId: relationship.id, nodeId: rankId, message: `The assigned hierarchy node is missing from ${faction.name || faction.id}.` };
          warnings.push(warning); diagnostics.missingHierarchyNodes.push(warning);
        } else {
          const hidden = node.hidden === true;
          const inactive = node.active === false;
          const eligible = (!hidden || (settings.visibilityMode === "gm" && settings.includeHidden)) && (!inactive || settings.includeInactive);
          if (hidden && settings.visibilityMode === "public") {
            diagnostics.excluded.push({ reason: "hidden-hierarchy" });
            continue;
          }
          sources.hierarchyNode.push(Object.freeze({ ...membershipSource, sourceType: "hierarchyNode", sourceId: node.id, sourceName: node.name || node.id, hierarchyNodeId: node.id, hierarchyNodeName: node.name || node.id, hidden, active: !inactive }));
          if (!eligible) diagnostics.excluded.push({ reason: hidden ? "hidden" : "inactive", sourceType: "hierarchyNode", sourceId: node.id });
          safeArray(node.abilityPackIds).forEach(packId => addPack(packId, {
            sourceType: "hierarchyAbilityPack", factionId: faction.id, factionName: faction.name || faction.id,
            sourceName: node.name || node.id,
            hierarchyNodeId: node.id, hierarchyNodeName: node.name || node.id, relationshipId: relationship.id,
            secret, hidden, primary, precedence: PRECEDENCE.hierarchyNode, sourceActive: !inactive, eligible
          }));
        }
      }
    }
    return { sources, candidates, warnings, diagnostics };
  }

  async function resolveForEntityRecord(entity, options = {}) {
    const settings = optionsWithDefaults(options);
    const base = {
      entity: { type: entity?.entity_type || entity?.type || "", id: entity?.id || "", name: entity?.name || entity?.id || "" },
      sources: emptySources(), grouped: { traits: [], abilities: [] }, effective: { traits: [], abilities: [] },
      conflicts: [], warnings: [], diagnostics: {}
    };
    if (!entity?.id) { base.warnings.push({ code: "invalid-entity", message: "A stored entity record with an ID is required." }); return base; }
    const collected = await collectResolution(entity, settings);
    const traitResult = resolveFeatureCandidates(collected.candidates.filter(item => item.featureType === "trait"), settings);
    const abilityResult = resolveFeatureCandidates(collected.candidates.filter(item => item.featureType === "ability"), settings);
    return {
      entity: base.entity,
      sources: collected.sources,
      grouped: { traits: traitResult.grouped, abilities: abilityResult.grouped },
      effective: { traits: traitResult.effective, abilities: abilityResult.effective },
      conflicts: [...traitResult.conflicts, ...abilityResult.conflicts],
      warnings: [...collected.warnings, ...traitResult.warnings, ...abilityResult.warnings],
      diagnostics: settings.includeDiagnostics ? collected.diagnostics : {}
    };
  }

  async function resolveForEntity(entityType, entityId, options = {}) {
    const entity = await window.dmAPI.getEntity(entityType, entityId);
    if (!entity) return resolveForEntityRecord({ entity_type: entityType, id: entityId, name: entityId }, options);
    return resolveForEntityRecord(entity, options);
  }

  async function getInheritanceSources(entityType, entityId, options = {}) {
    return (await resolveForEntity(entityType, entityId, options)).sources;
  }

  function clearCache() {
    // No cache in Slice 4. Kept as a stable API for future cache implementations.
  }

  function runPureDiagnostic() {
    const base = { featureType: "trait", name: "Test", description: "Same", category: "Trait", active: true, tags: [], secret: false, hidden: false, inherited: true, overriddenBy: null, duplicateSources: [], _eligible: true };
    const result = resolveFeatureCandidates([
      { ...base, id: "same", sourceType: "personal", sourceId: "entity", sourceName: "Personal", precedence: 400 },
      { ...base, id: "same", sourceType: "faction", sourceId: "f1", sourceName: "Faction", precedence: 100 },
      { ...base, id: "conflict", description: "Winner", sourceType: "hierarchyAbilityPack", sourceId: "p1", sourceName: "Pack", precedence: 200 },
      { ...base, id: "conflict", description: "Loser", sourceType: "factionAbilityPack", sourceId: "p1", sourceName: "Pack", precedence: 100 },
      { ...base, id: "other-name", sourceType: "faction", sourceId: "f2", sourceName: "Faction 2", precedence: 100 }
    ]);
    const checks = [
      { name: "same-ID duplicate deduplicates", passed: result.effective.filter(item => item.id === "same").length === 1 },
      { name: "duplicate provenance retained", passed: result.effective.find(item => item.id === "same")?.duplicateSources.length === 1 },
      { name: "higher precedence wins", passed: result.effective.find(item => item.id === "conflict")?.description === "Winner" },
      { name: "conflict recorded", passed: result.conflicts.some(item => item.featureId === "conflict") },
      { name: "same-name warning", passed: result.warnings.some(item => item.code === "possible-duplicate-name") }
    ];
    return { passed: checks.every(check => check.passed), checks, result };
  }

  window.MasterForgeInheritanceEngine = Object.freeze({
    VERSION, PRECEDENCE, DEFAULT_OPTIONS,
    resolveForEntity, resolveForEntityRecord, getInheritanceSources, clearCache,
    adaptNpcPersonalFeatures, adaptCreaturePersonalFeatures, adaptPcPersonalFeatures, adaptGenericPersonalFeatures,
    resolveFeatureCandidates, runPureDiagnostic
  });
})();
