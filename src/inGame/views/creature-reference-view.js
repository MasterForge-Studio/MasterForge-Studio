(() => {
  "use strict";

  const BROWSER_TYPES = new Set(["npc", "creature", "faction", "item"]);
  const ACTION_CATEGORIES = new Set(["actions", "bonus-actions", "reactions", "legendary-actions", "lair-actions", "mythic-actions"]);
  const SPELL_CATEGORIES = new Set(["spellcasting", "innate-spellcasting"]);
  const TRAIT_CATEGORIES = new Set(["traits", "features", "abilities", "passive-abilities"]);
  const ECOLOGY_RELATIONSHIP_TYPES = new Set(["preys_on", "hunted_by", "symbiotic_with", "parasitic_on", "competes_with", "domesticated_by", "scavenges_from", "avoids", "attracted_to"]);
  const HABITAT_FIELDS = Object.freeze([
    ["biomes", "Biomes"], ["terrain", "Terrain"], ["climate", "Climate"], ["elevation", "Elevation"],
    ["waterProximity", "Water Proximity"], ["temperature", "Temperature"], ["humidity", "Humidity"],
    ["settlementProximity", "Settlement Proximity"], ["activityPeriod", "Activity Period"], ["seasonality", "Seasonality"]
  ]);
  const ECOLOGY_GROUP_LABELS = Object.freeze({
    "preys_on:outgoing": "Prey", "preys_on:incoming": "Predators / Natural Threats",
    "hunted_by:outgoing": "Hunted By", "hunted_by:incoming": "Hunts",
    symbiotic_with: "Symbiotic With", parasitic_on: "Parasites / Parasitic Relationships",
    competes_with: "Competes With", domesticated_by: "Domesticated By", scavenges_from: "Scavenges From",
    avoids: "Avoids", attracted_to: "Attracted To"
  });
  const ECOLOGY_DIRECTION_LABELS = Object.freeze({
    preys_on: ["Preys On", "Preyed On By"], hunted_by: ["Hunted By", "Hunts"], symbiotic_with: ["Symbiotic With", "Symbiotic With"],
    parasitic_on: ["Parasitic On", "Host To"], competes_with: ["Competes With", "Competes With"], domesticated_by: ["Domesticated By", "Domesticates"],
    scavenges_from: ["Scavenges From", "Scavenged By"], avoids: ["Avoids", "Avoided By"], attracted_to: ["Attracted To", "Attracts"]
  });
  const CATEGORY_LABELS = Object.freeze({
    traits: "Traits", features: "Special Features", abilities: "Abilities", "passive-abilities": "Passive Abilities",
    actions: "Actions", "bonus-actions": "Bonus Actions", reactions: "Reactions", "legendary-actions": "Legendary Actions",
    "lair-actions": "Lair Actions", "mythic-actions": "Mythic Actions", spellcasting: "Spellcasting", "innate-spellcasting": "Innate Spellcasting"
  });

  function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
  function text(value) { return typeof value === "string" || typeof value === "number" ? String(value).trim() : ""; }
  function title(value) { return text(value).replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, letter => letter.toUpperCase()); }
  function compact(value = {}) { return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== "" && item !== null && item !== undefined && (!Array.isArray(item) || item.length))); }
  function validImage(value) {
    const source = text(value);
    return /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(source) ? source : "";
  }
  function list(value) {
    if (Array.isArray(value)) return value.map(item => typeof item === "string" ? text(item) : text(item?.name || item?.label)).filter(Boolean);
    return text(value) ? text(value).split(/[,;\n]/).map(item => item.trim()).filter(Boolean) : [];
  }
  function reference(value = {}, fallbackType = "") {
    if (!isObject(value)) return null;
    const entityId = text(value.entityId || value.entity_id || value.referenceId || value.itemEntityId || value.itemId);
    const entityType = text(value.entityType || value.entity_type || value.referenceType || value.type || (value.itemEntityId || value.itemId ? "item" : fallbackType)).toLowerCase();
    return entityId && entityType ? { entityId, entityType, openable: BROWSER_TYPES.has(entityType) } : null;
  }
  function capabilityEntry(value = {}) {
    if (!isObject(value)) value = typeof value === "string" ? { name: value } : {};
    const name = text(value.name || value.title);
    if (!name) return null;
    const facts = [
      value.attackBonus !== undefined && value.attackBonus !== "" ? `Attack ${String(value.attackBonus).startsWith("-") || String(value.attackBonus).startsWith("+") ? "" : "+"}${value.attackBonus}` : "",
      text(value.reach), text(value.range), text(value.target || value.targets),
      text(value.damage) ? `${text(value.damage)}${text(value.damageType) ? ` ${text(value.damageType)}` : ""}` : "",
      value.saveDC !== undefined && value.saveDC !== "" ? `Save DC ${value.saveDC}${text(value.saveAbility) ? ` ${text(value.saveAbility).toUpperCase()}` : ""}` : "",
      text(value.recharge || value.rechargeNotes), text(value.uses || value.usesPerDay) ? `Uses ${text(value.uses || value.usesPerDay)}` : ""
    ].filter(Boolean);
    return compact({
      id: text(value.id), name, description: text(value.description || value.text || value.rulesText), facts,
      source: text(value.provenance || (value.inherited && value.sourceName ? `Inherited from ${value.sourceName}` : "")),
      castingAbility: text(value.castingAbility), casterLevel: text(value.casterLevel), saveDC: text(value.saveDC), spellAttackBonus: text(value.spellAttackBonus),
      atWillSpells: text(value.atWillSpells), usesPerDay: text(value.usesPerDay), spellSlots: text(value.spellSlots),
      preparedSpells: text(value.preparedSpells), innateSpells: text(value.innateSpells), sourceText: text(value.sourceText)
    });
  }
  function lootEntry(value = {}) {
    if (typeof value === "string") return text(value) ? { name: text(value), quantity: "", value: "", notes: "", reference: null } : null;
    if (!isObject(value)) return null;
    const name = text(value.name || value.item || value.title || value.producesItem);
    if (!name) return null;
    return { name, quantity: text(value.quantity || value.qty), value: text(value.value), notes: text(value.notes || value.description), reference: reference(value.itemReference || value.linkedItem || value, "item") };
  }
  function relationshipEntry(value = {}) {
    if (!isObject(value)) return null;
    const other = isObject(value.otherEntity) ? value.otherEntity : {};
    const metadata = isObject(value.metadata) ? value.metadata : {};
    const entityType = text(other.type).toLowerCase();
    const entityId = text(other.id);
    const name = text(other.name || entityId);
    if (!name) return null;
    return { name, entityType, entityId, openable: BROWSER_TYPES.has(entityType) && Boolean(entityId), type: text(value.type).toLowerCase().replaceAll("-", "_"), label: text(value.label) || title(value.type), role: text(metadata.role || metadata.title || metadata.rank), status: text(value.status) && value.status !== "active" ? text(value.status) : "", direction: text(value.direction).toLowerCase() };
  }
  function relationshipGroup(type) {
    if (["faction", "organisation"].includes(type)) return "factions";
    if (["location", "settlement"].includes(type)) return "locations";
    if (type === "creature") return "creatures";
    if (type === "npc") return "npcs";
    return "other";
  }
  function readSemantic(canonical, role, systemId, gameSystems, fallbacks = []) {
    const fromSystem = typeof gameSystems?.readSemantic === "function" ? gameSystems.readSemantic(canonical, role, systemId) : undefined;
    if (fromSystem !== undefined && fromSystem !== null && fromSystem !== "") return String(fromSystem);
    for (const path of fallbacks) {
      const value = path.split(".").reduce((item, key) => item?.[key], canonical);
      if (value !== undefined && value !== null && value !== "") return String(value);
    }
    return "";
  }
  function ecologyModel(canonical) {
    const raw = isObject(canonical.ecology) ? canonical.ecology : {};
    const normaliser = typeof globalThis.MasterForgeCreatureEcology?.normaliseCreatureEcology === "function"
      ? globalThis.MasterForgeCreatureEcology.normaliseCreatureEcology
      : null;
    const ecology = normaliser ? normaliser(raw) : raw;
    const habitat = isObject(ecology.habitatPreferences) ? ecology.habitatPreferences : {};
    return {
      summary: compact({
        behaviour: text(ecology.behaviour), temperament: text(ecology.temperament), diet: text(ecology.diet),
        socialStructure: text(ecology.socialStructure), activityCycle: text(ecology.activityCycle)
      }),
      habitatGroups: HABITAT_FIELDS.map(([key, label]) => ({ key, label, values: list(habitat[key]) })).filter(group => group.values.length),
      notes: compact({ ecologyNotes: text(ecology.ecologyNotes), reproductiveNotes: text(ecology.reproductiveNotes) })
    };
  }
  function ecologyRelationshipGroup(item) {
    if (!ECOLOGY_RELATIONSHIP_TYPES.has(item.type)) return "";
    return ECOLOGY_GROUP_LABELS[`${item.type}:${item.direction}`] || ECOLOGY_GROUP_LABELS[item.type] || title(item.type);
  }
  function ecologyDirectionLabel(item) {
    const labels = ECOLOGY_DIRECTION_LABELS[item.type];
    return labels ? labels[item.direction === "incoming" ? 1 : 0] : item.label;
  }
  function statModel(canonical, gameSystems) {
    const systemId = text(canonical.systemId || canonical.data_json?.systemId || "system-neutral");
    const rules = typeof gameSystems?.getRules === "function" ? gameSystems.getRules(systemId) : null;
    let attributes = [];
    if (Array.isArray(rules?.attributes) && typeof gameSystems?.readAttribute === "function") {
      attributes = rules.attributes.filter(item => item.enabled !== false).map(item => ({ label: text(item.shortLabel || item.name), value: gameSystems.readAttribute(canonical, item.id, systemId) })).filter(item => item.value !== undefined && item.value !== null && item.value !== "").map(item => ({ ...item, value: String(item.value) }));
    }
    if (!attributes.length) attributes = [["STR", "str"], ["DEX", "dex"], ["CON", "con"], ["INT", "int"], ["WIS", "wis"], ["CHA", "cha"]].map(([label, key]) => ({ label, value: canonical.stats?.[key] ?? canonical.abilities?.[key] })).filter(item => item.value !== undefined && item.value !== null && item.value !== "").map(item => ({ ...item, value: String(item.value) }));
    const semanticLabel = (role, fallback) => {
      const definition = typeof gameSystems?.statisticForRole === "function" ? gameSystems.statisticForRole(role, systemId) : null;
      return text(definition?.name || definition?.shortLabel) || fallback;
    };
    return {
      systemId, attributes,
      core: [
        { label: semanticLabel("primaryDefence", "AC"), value: readSemantic(canonical, "primaryDefence", systemId, gameSystems, ["ac", "stats.ac"]) },
        { label: semanticLabel("maximumHealth", "Maximum HP"), value: readSemantic(canonical, "maximumHealth", systemId, gameSystems, ["maxHP", "maxHp", "stats.maxHP", "stats.maxHp", "stats.hp", "hp"]) },
        { label: semanticLabel("movement", "Movement"), value: readSemantic(canonical, "movement", systemId, gameSystems, ["speed", "stats.speed"]) },
        { label: semanticLabel("threat", "Challenge"), value: readSemantic(canonical, "threat", systemId, gameSystems, ["cr", "stats.cr"]) },
        { label: semanticLabel("proficiency", "Proficiency"), value: readSemantic(canonical, "proficiency", systemId, gameSystems, ["proficiencyBonus", "stats.proficiencyBonus"]) }
      ].filter(item => item.value),
      details: compact({
        "Saving Throws": text(canonical.savingThrows || canonical.stats?.savingThrows), Skills: text(canonical.skills || canonical.stats?.skills),
        Vulnerabilities: text(canonical.damageVulnerabilities || canonical.stats?.damageVulnerabilities), Resistances: text(canonical.damageResistances || canonical.stats?.damageResistances),
        Immunities: text(canonical.damageImmunities || canonical.stats?.damageImmunities), "Condition Immunities": text(canonical.conditionImmunities || canonical.stats?.conditionImmunities),
        Senses: text(canonical.senses || canonical.stats?.senses), "Passive Perception": text(canonical.passivePerception || canonical.stats?.passivePerception),
        Languages: text(canonical.languages || canonical.stats?.languages)
      })
    };
  }

  function buildCreatureReferenceViewModel(resolved = {}, options = {}) {
    const canonical = isObject(resolved.canonical) ? resolved.canonical : {};
    const profile = isObject(resolved.resolvedCapabilities) ? resolved.resolvedCapabilities : {};
    let categories = Array.isArray(profile.categories) ? profile.categories : [];
    if (!categories.length) {
      const direct = [["traits", canonical.traits], ["actions", canonical.actions], ["bonus-actions", canonical.bonusActions], ["reactions", canonical.reactions], ["legendary-actions", canonical.legendaryActions], ["lair-actions", canonical.lairActions], ["spellcasting", canonical.spellcasting || canonical.spells], ["innate-spellcasting", canonical.innateSpellcasting]];
      categories = direct.filter(([, entries]) => Array.isArray(entries) && entries.length).map(([id, entries]) => ({ id, name: CATEGORY_LABELS[id], entries }));
    }
    const traits = [], actions = [], spellcasting = [];
    categories.forEach(category => {
      const id = text(category.id).toLowerCase().replaceAll("_", "-");
      const entries = (Array.isArray(category.entries) ? category.entries : []).map(capabilityEntry).filter(Boolean);
      if (!entries.length) return;
      const group = { id, label: text(category.pluralLabel || category.name) || CATEGORY_LABELS[id] || title(id), entries };
      if (SPELL_CATEGORIES.has(id)) spellcasting.push(group);
      else if (ACTION_CATEGORIES.has(id)) actions.push(group);
      else if (TRAIT_CATEGORIES.has(id)) traits.push(group);
      else traits.push(group);
    });
    const relationships = { factions: [], creatures: [], npcs: [], locations: [], other: [] };
    const ecologicalRelationshipMap = new Map();
    (Array.isArray(resolved.relationships) ? resolved.relationships : []).map(relationshipEntry).filter(Boolean).forEach(item => {
      const ecologyGroup = ecologyRelationshipGroup(item);
      if (ecologyGroup) {
        item.label = ecologyDirectionLabel(item);
        if (!ecologicalRelationshipMap.has(ecologyGroup)) ecologicalRelationshipMap.set(ecologyGroup, []);
        ecologicalRelationshipMap.get(ecologyGroup).push(item);
        return;
      }
      relationships[relationshipGroup(item.entityType)].push(item);
    });
    const ecology = ecologyModel(canonical);
    const relatedLocationIds = new Set(relationships.locations.map(item => item.entityId));
    const locationIds = [...new Set([...(Array.isArray(canonical.foundInLocationIds) ? canonical.foundInLocationIds : []), canonical.locationId, canonical.location, canonical.defaultLocationId, canonical.currentLocationId].map(text).filter(Boolean))].filter(id => !relatedLocationIds.has(id));
    return {
      atAGlance: compact({
        description: text(canonical.description || canonical.overview?.summary), classification: [text(canonical.size), text(canonical.type)].filter(Boolean),
        environment: list(canonical.environment), tags: list(canonical.tags), alignment: text(canonical.alignment), ecology: ecology.summary,
        habitatGroups: ecology.habitatGroups, ecologicalRelationships: [...ecologicalRelationshipMap].map(([label, entries]) => ({ label, entries }))
      }),
      ecologyNotes: ecology.notes,
      stats: statModel(canonical, options.gameSystems), traits, actions, spellcasting,
      loot: (Array.isArray(canonical.loot) ? canonical.loot : Array.isArray(canonical.harvest) ? canonical.harvest : Array.isArray(canonical.harvestLoot) ? canonical.harvestLoot : []).map(lootEntry).filter(Boolean),
      relationships,
      locations: locationIds.map(entityId => ({ name: entityId, entityType: "location", entityId, openable: false }))
    };
  }

  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
  function section(label, body, open = false) { return body ? `<details class="creatureReferenceSection mf-reading-section"${open ? " open" : ""}><summary class="mf-reading-heading">${escapeHtml(label)}</summary><div class="creatureReferenceSectionBody">${body}</div></details>` : ""; }
  function valueBlock(label, value) { return value ? `<div class="creatureReferenceValue mf-reading-prose"><h3 class="mf-reading-subheading">${escapeHtml(label)}</h3><p>${escapeHtml(value)}</p></div>` : ""; }
  function capabilityRows(entries, spell = false) {
    return `<div class="creatureReferenceCapabilityRows">${entries.map(entry => {
      const spellFacts = spell ? [entry.castingAbility && `Ability ${entry.castingAbility}`, entry.casterLevel && `Level ${entry.casterLevel}`, entry.saveDC && `Save DC ${entry.saveDC}`, entry.spellAttackBonus && `Attack ${entry.spellAttackBonus}`].filter(Boolean) : [];
      const spellLists = spell ? [["At Will", entry.atWillSpells], ["Per Day", entry.usesPerDay], ["Slots", entry.spellSlots], ["Prepared / Known", entry.preparedSpells], ["Innate", entry.innateSpells]].filter(([, value]) => value) : [];
      return `<article><strong>${escapeHtml(entry.name)}</strong>${entry.description ? `<p>${escapeHtml(entry.description)}</p>` : ""}${[...(entry.facts || []), ...spellFacts].length ? `<div class="creatureReferenceFacts">${[...(entry.facts || []), ...spellFacts].map(fact => `<span>${escapeHtml(fact)}</span>`).join("")}</div>` : ""}${spellLists.map(([label, value]) => `<p><b>${escapeHtml(label)}:</b> ${escapeHtml(value)}</p>`).join("")}${entry.sourceText ? `<p>${escapeHtml(entry.sourceText)}</p>` : ""}${entry.source ? `<footer>${escapeHtml(entry.source)}</footer>` : ""}</article>`;
    }).join("")}</div>`;
  }
  function groupedCapabilities(groups, spell = false) { return groups.map(group => `<div class="creatureReferenceCapabilityGroup"><h3>${escapeHtml(group.label)}</h3>${capabilityRows(group.entries, spell)}</div>`).join(""); }
  function linkedRows(entries, prefix) {
    return `<div class="creatureReferenceRows mf-reading-links">${entries.map(item => {
      const ref = item.reference || item;
      const openable = ref?.openable;
      const tag = openable ? "button" : "div";
      const attrs = openable ? ` type="button" data-creature-reference-type="${escapeHtml(ref.entityType)}" data-creature-reference-id="${escapeHtml(ref.entityId)}"` : "";
      const details = prefix === "loot" ? [item.quantity && `×${item.quantity}`, item.value, item.notes] : [item.label, item.role, item.direction, item.status];
      return `<${tag} class="creatureReferenceRow"${attrs}><span><strong>${escapeHtml(item.name)}</strong>${item.entityType ? `<small>${escapeHtml(title(item.entityType))}</small>` : ""}</span>${details.filter(Boolean).length ? `<span>${details.filter(Boolean).map(escapeHtml).join(" · ")}</span>` : ""}</${tag}>`;
    }).join("")}</div>`;
  }
  function renderCreatureReferenceView(model = {}) {
    const at = model.atAGlance || {};
    const ecologyLabels = { behaviour: "Behaviour", temperament: "Temperament", diet: "Diet", socialStructure: "Social Structure", activityCycle: "Activity Cycle" };
    const identity = `${valueBlock("Description", at.description)}${at.classification?.length ? `<div class="creatureReferenceBadges">${at.classification.map(value => `<span>${escapeHtml(value)}</span>`).join("")}</div>` : ""}${at.environment?.length ? valueBlock("Environment", at.environment.join(" · ")) : ""}${at.tags?.length ? valueBlock("Tags", at.tags.join(" · ")) : ""}`;
    const ecologySummary = Object.entries(at.ecology || {}).map(([key, value]) => valueBlock(ecologyLabels[key] || title(key), value)).join("");
    const alignment = valueBlock("Alignment", at.alignment);
    const habitat = at.habitatGroups?.length ? `<div class="creatureReferenceHabitat"><h3>Habitat Preferences</h3><p class="creatureReferenceHint">Where this creature tends to thrive</p>${at.habitatGroups.map(group => `<div class="creatureReferenceHabitatGroup"><strong>${escapeHtml(group.label)}</strong><div class="creatureReferenceBadges">${group.values.map(value => `<span>${escapeHtml(value)}</span>`).join("")}</div></div>`).join("")}</div>` : "";
    const ecologyRelationships = at.ecologicalRelationships?.length ? `<div class="creatureReferenceEcologyRelationships"><h3>Ecological Relationships</h3>${at.ecologicalRelationships.map(group => `<div class="creatureReferenceRelationshipGroup"><h3>${escapeHtml(group.label)}</h3>${linkedRows(group.entries, "ecology")}</div>`).join("")}</div>` : "";
    const glanceBody = `<div class="creatureReferenceGlance">${identity}<div class="creatureReferenceEcologyGrid">${ecologySummary}${alignment}</div>${habitat}${ecologyRelationships}</div>`;
    const stats = model.stats || {};
    const statsBody = `<div class="mf-reading-stat">${stats.core?.length ? `<div class="creatureReferenceStatGrid">${stats.core.map(item => `<article><small>${escapeHtml(item.label)}</small><strong>${escapeHtml(item.value)}</strong></article>`).join("")}</div>` : ""}${stats.attributes?.length ? `<div class="creatureReferenceAttributeGrid">${stats.attributes.map(item => `<article><small>${escapeHtml(item.label)}</small><strong>${escapeHtml(item.value)}</strong></article>`).join("")}</div>` : ""}${Object.entries(stats.details || {}).length ? `<div class="creatureReferenceDetailGrid">${Object.entries(stats.details).map(([label, value]) => valueBlock(label, value)).join("")}</div>` : ""}</div>`;
    const relationshipGroups = [["Factions", "factions"], ["Creatures", "creatures"], ["NPCs", "npcs"], ["Locations", "locations"], ["Other", "other"]].map(([label, key]) => model.relationships?.[key]?.length ? `<div class="creatureReferenceRelationshipGroup"><h3>${label}</h3>${linkedRows(model.relationships[key], "relationship")}</div>` : "").join("");
    const directLocations = model.locations?.length ? `<div class="creatureReferenceRelationshipGroup"><h3>Recorded Locations</h3>${linkedRows(model.locations, "location")}</div>` : "";
    const notes = `${valueBlock("Ecology Notes", model.ecologyNotes?.ecologyNotes)}${valueBlock("Reproductive Notes", model.ecologyNotes?.reproductiveNotes)}`;
    return `<div class="creatureReferenceView mf-reading-surface">${section("At a Glance", glanceBody, true)}${section("Ecology Notes", notes)}${section("Stat Profile", statsBody, true)}${section("Traits & Abilities", groupedCapabilities(model.traits || []))}${section("Actions", groupedCapabilities(model.actions || []), true)}${section("Spellcasting", groupedCapabilities(model.spellcasting || [], true))}${section("Loot", model.loot?.length ? linkedRows(model.loot, "loot") : "")}${section("Relationships & Locations", relationshipGroups + directLocations)}</div>`;
  }

  const api = Object.freeze({ buildCreatureReferenceViewModel, renderCreatureReferenceView });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.MasterForgeCreatureReferenceView = api;
})();
