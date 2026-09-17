(() => {
  "use strict";

  const BROWSER_TYPES = new Set(["npc", "creature", "faction", "item"]);
  const CAPABILITY_LABELS = Object.freeze({
    traits: "Traits", actions: "Actions", "bonus-actions": "Bonus Actions", reactions: "Reactions",
    "legendary-actions": "Legendary Actions", "lair-actions": "Lair Actions", "mythic-actions": "Mythic Actions",
    features: "Features", abilities: "Abilities", spellcasting: "Spellcasting", "innate-spellcasting": "Innate Spellcasting"
  });

  function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
  function text(value) { return typeof value === "string" || typeof value === "number" ? String(value).trim() : ""; }
  function title(value) { return text(value).replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, letter => letter.toUpperCase()); }
  function validImage(value) {
    const source = text(value);
    return /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(source) ? source : "";
  }
  function compact(value = {}) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== "" && item !== null && item !== undefined && (!Array.isArray(item) || item.length)));
  }
  function sourceDetail(feature = {}) {
    if (feature.provenance) return text(feature.provenance);
    if (feature.inherited && feature.sourceName) return `Inherited from ${text(feature.sourceName)}`;
    return "";
  }
  function capabilityEntry(feature = {}) {
    const source = isObject(feature.sourceData) ? feature.sourceData : feature;
    const name = text(feature.name || source.name || source.title);
    if (!name) return null;
    const facts = [
      source.attackBonus !== undefined && source.attackBonus !== "" ? `Attack ${Number(source.attackBonus) >= 0 ? "+" : ""}${source.attackBonus}` : "",
      source.saveDC !== undefined && source.saveDC !== "" ? `Save DC ${source.saveDC}` : "",
      text(source.saveAbility) ? `${text(source.saveAbility).toUpperCase()} save` : "",
      text(source.range), text(source.reach), text(source.recharge || source.rechargeNotes),
      text(source.uses || source.usesPerDay) ? `Uses ${text(source.uses || source.usesPerDay)}` : ""
    ].filter(Boolean);
    return compact({
      id: text(feature.id), name, description: text(feature.description || source.description || source.text || source.rulesText),
      category: text(feature.category), facts, source: sourceDetail(feature),
      castingAbility: text(source.castingAbility), casterLevel: text(source.casterLevel), saveDC: text(source.saveDC),
      spellAttackBonus: text(source.spellAttackBonus), atWillSpells: text(source.atWillSpells), usesPerDay: text(source.usesPerDay),
      spellSlots: text(source.spellSlots), preparedSpells: text(source.preparedSpells), sourceText: text(source.sourceText),
      itemReference: normaliseReference(source.itemReference || source.linkedItem || source.item || source)
    });
  }
  function normaliseReference(value = {}) {
    if (!isObject(value)) return null;
    const entityType = text(value.entityType || value.entity_type || value.referenceType || value.type || (value.itemEntityId ? "item" : "")).toLowerCase();
    const entityId = text(value.entityId || value.entity_id || value.referenceId || value.itemEntityId);
    return entityType && entityId ? { entityType, entityId, openable: BROWSER_TYPES.has(entityType) } : null;
  }
  function equipmentEntry(value = {}) {
    if (typeof value === "string") return text(value) ? { name: text(value), quantity: "", state: "", notes: "", reference: null } : null;
    if (!isObject(value)) return null;
    const source = isObject(value.sourceData) ? { ...value.sourceData, ...value } : value;
    const name = text(source.name || source.title || source.itemName);
    if (!name) return null;
    const quantity = source.quantity ?? source.qty ?? "";
    const states = [source.equipped === true ? "Equipped" : "", source.carried === true ? "Carried" : "", text(source.state || source.status)].filter(Boolean);
    return { name, quantity: quantity === "" ? "" : String(quantity), state: states.join(" · "), notes: text(source.notes || source.description), reference: normaliseReference(source.itemReference || source.linkedItem || source) };
  }
  function relationshipEntry(value = {}) {
    if (!isObject(value)) return null;
    const other = isObject(value.otherEntity) ? value.otherEntity : {};
    const metadata = isObject(value.metadata) ? value.metadata : {};
    const entityType = text(other.type).toLowerCase();
    const entityId = text(other.id);
    const name = text(other.name || entityId);
    if (!name) return null;
    return {
      name, entityType, entityId, openable: BROWSER_TYPES.has(entityType) && Boolean(entityId),
      label: text(value.label) || title(value.type), direction: text(value.direction),
      role: text(metadata.role || metadata.title || metadata.rank || metadata.position),
      status: text(value.status) && value.status !== "active" ? text(value.status) : "",
      detail: text(metadata.summary || metadata.description || value.notes)
    };
  }
  function relationshipGroup(type) {
    if (type === "faction" || type === "organisation") return "factions";
    if (type === "location" || type === "settlement") return "locations";
    if (type === "npc") return "npcs";
    if (type === "creature") return "creatures";
    return "other";
  }

  function buildNpcReferenceViewModel(resolved = {}) {
    const canonical = isObject(resolved.canonical) ? resolved.canonical : {};
    const overview = isObject(canonical.overview) ? canonical.overview : {};
    const personality = isObject(canonical.personality) ? canonical.personality : {};
    const locationState = isObject(canonical.locationState) ? canonical.locationState : {};
    const profile = isObject(resolved.resolvedCapabilities) ? resolved.resolvedCapabilities : {};
    const effective = isObject(profile.effective) ? profile.effective : {};
    const capabilities = {};
    const equipment = [];
    const resolvedFeatures = [...(Array.isArray(effective.traits) ? effective.traits : []), ...(Array.isArray(effective.abilities) ? effective.abilities : [])];
    resolvedFeatures.forEach(feature => {
      if (!isObject(feature)) return;
      const section = text(feature.capabilitySection || (feature.featureType === "trait" ? "traits" : "actions")).toLowerCase().replaceAll("_", "-");
      if (section === "equipment") {
        const item = equipmentEntry(feature);
        if (item) equipment.push(item);
        return;
      }
      const entry = capabilityEntry(feature);
      if (!entry) return;
      const group = CAPABILITY_LABELS[section] ? section : (feature.featureType === "trait" ? "traits" : "actions");
      (capabilities[group] ||= []).push(entry);
    });
    if (!resolvedFeatures.length) {
      const directSections = ["traits", "actions", "bonusActions", "reactions", "legendaryActions", "lairActions", "spellcasting", "innateSpellcasting"];
      directSections.forEach(key => {
        const section = key.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
        (Array.isArray(canonical[key]) ? canonical[key] : []).forEach(item => {
          const mapped = capabilityEntry(item);
          if (mapped) (capabilities[section] ||= []).push(mapped);
        });
      });
      (Array.isArray(canonical.equipment) ? canonical.equipment : []).forEach(item => { const mapped = equipmentEntry(item); if (mapped) equipment.push(mapped); });
    }
    const relationships = { factions: [], locations: [], npcs: [], creatures: [], other: [] };
    (Array.isArray(resolved.relationships) ? resolved.relationships : []).map(relationshipEntry).filter(Boolean).forEach(item => relationships[relationshipGroup(item.entityType)].push(item));
    const classification = [text(canonical.species), text(canonical.type), text(canonical.role), text(canonical.class), canonical.level ? `Level ${canonical.level}` : "", text(canonical.cr) ? `CR ${canonical.cr}` : ""].filter(Boolean);
    const privateNotes = [canonical.gmNotes, canonical.privateNotes, canonical.secretNotes, canonical.notes?.gm].map(text).filter(Boolean);
    const gm = resolved.visibilityMode === "public" ? null : compact({ secret: text(personality.secret), notes: privateNotes });
    return {
      atAGlance: compact({
        portrait: validImage(canonical.image?.portrait || canonical.portrait), summary: text(overview.summary || canonical.summary || canonical.description),
        currentLocation: text(overview.currentLocation || locationState.notes || locationState.locationName || locationState.locationId || canonical.locationId),
        firstMet: text(overview.firstMet), classification
      }),
      roleplay: compact({
        appearance: text(personality.appearance), voice: text(personality.voice), mannerisms: text(personality.mannerisms),
        ideals: text(personality.ideals), bonds: text(personality.bonds), flaws: text(personality.flaws)
      }),
      hook: text(personality.hook), capabilities, equipment, relationships,
      gm: gm && Object.keys(gm).length ? gm : null
    };
  }

  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
  function valueBlock(label, value) { return value ? `<div class="npcReferenceValue mf-reading-prose"><h3 class="mf-reading-subheading">${escapeHtml(label)}</h3><p>${escapeHtml(value)}</p></div>` : ""; }
  function section(label, body, { open = false, gm = false } = {}) {
    if (!body) return "";
    return `<details class="npcReferenceSection mf-reading-section${gm ? " npcReferenceSection--gm mf-reading-callout mf-reading-gm" : ""}"${open ? " open" : ""}><summary class="mf-reading-heading">${gm ? '<span class="npcReferenceGmBadge">GM Only</span>' : ""}${escapeHtml(label)}</summary><div class="npcReferenceSectionBody">${body}</div></details>`;
  }
  function capabilityRows(entries = [], spellcasting = false) {
    return `<div class="npcReferenceCapabilityRows">${entries.map(entry => {
      const spellFacts = spellcasting ? [entry.castingAbility && `Ability ${entry.castingAbility}`, entry.casterLevel && `Level ${entry.casterLevel}`, entry.saveDC && `Save DC ${entry.saveDC}`, entry.spellAttackBonus && `Attack ${entry.spellAttackBonus}`].filter(Boolean) : [];
      const spellLists = spellcasting ? [["At Will", entry.atWillSpells], ["Per Day", entry.usesPerDay], ["Slots", entry.spellSlots], ["Prepared / Known", entry.preparedSpells]].filter(([, value]) => value) : [];
      return `<article><header><strong>${escapeHtml(entry.name)}</strong>${entry.category ? `<small>${escapeHtml(entry.category)}</small>` : ""}</header>${entry.description ? `<p>${escapeHtml(entry.description)}</p>` : ""}${[...(entry.facts || []), ...spellFacts].length ? `<div class="npcReferenceFacts">${[...(entry.facts || []), ...spellFacts].map(fact => `<span>${escapeHtml(fact)}</span>`).join("")}</div>` : ""}${spellLists.map(([label, value]) => `<p><b>${escapeHtml(label)}:</b> ${escapeHtml(value)}</p>`).join("")}${entry.sourceText ? `<p>${escapeHtml(entry.sourceText)}</p>` : ""}${entry.source ? `<footer>${escapeHtml(entry.source)}</footer>` : ""}</article>`;
    }).join("")}</div>`;
  }
  function relationshipRows(entries = []) {
    return `<div class="npcReferenceRelationshipRows mf-reading-links">${entries.map(item => {
      const tag = item.openable ? "button" : "div";
      const attrs = item.openable ? ` type="button" data-npc-reference-type="${escapeHtml(item.entityType)}" data-npc-reference-id="${escapeHtml(item.entityId)}"` : "";
      const details = [item.label, item.role, item.direction, item.status, item.detail].filter(Boolean).join(" · ");
      return `<${tag} class="npcReferenceRelationshipRow"${attrs}><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(title(item.entityType) || "Entity")}</small></span>${details ? `<span>${escapeHtml(details)}</span>` : ""}</${tag}>`;
    }).join("")}</div>`;
  }
  function equipmentRows(entries = []) {
    return `<div class="npcReferenceEquipmentRows">${entries.map(item => {
      const openable = item.reference?.openable;
      const tag = openable ? "button" : "div";
      const attrs = openable ? ` type="button" data-npc-reference-type="${escapeHtml(item.reference.entityType)}" data-npc-reference-id="${escapeHtml(item.reference.entityId)}"` : "";
      return `<${tag} class="npcReferenceEquipmentRow"${attrs}><strong>${escapeHtml(item.name)}</strong>${item.quantity ? `<span>×${escapeHtml(item.quantity)}</span>` : ""}${item.state ? `<span>${escapeHtml(item.state)}</span>` : ""}${item.notes ? `<small>${escapeHtml(item.notes)}</small>` : ""}</${tag}>`;
    }).join("")}</div>`;
  }
  function renderNpcReferenceView(model = {}) {
    const at = model.atAGlance || {};
    const atBody = `<div class="npcReferenceGlance"><div class="npcReferenceGlanceContent">${valueBlock("Summary", at.summary)}${valueBlock("Current Location", at.currentLocation)}${valueBlock("First Met", at.firstMet)}${at.classification?.length ? `<div class="npcReferenceBadges">${at.classification.map(value => `<span>${escapeHtml(value)}</span>`).join("")}</div>` : ""}</div></div>`;
    const role = model.roleplay || {};
    const roleBody = model.hook ? `<aside class="npcReferenceHook mf-reading-callout"><strong>Hook</strong><p>${escapeHtml(model.hook)}</p></aside>` : "";
    const roleFields = [["Appearance", role.appearance], ["Voice", role.voice], ["Mannerisms", role.mannerisms], ["Ideals", role.ideals], ["Bonds", role.bonds], ["Flaws", role.flaws]].filter(([, value]) => value);
    const completeRoleBody = roleBody + (roleFields.length ? `<div class="npcReferenceRoleplayGrid">${roleFields.map(([label, value]) => valueBlock(label, value)).join("")}</div>` : "");
    const capabilityBody = Object.entries(model.capabilities || {}).filter(([, entries]) => entries.length).map(([key, entries]) => `<div class="npcReferenceCapabilityGroup"><h3>${escapeHtml(CAPABILITY_LABELS[key] || title(key))}</h3>${capabilityRows(entries, key.includes("spellcasting"))}</div>`).join("");
    const relationshipBody = [["Factions", "factions"], ["Locations", "locations"], ["NPCs", "npcs"], ["Creatures", "creatures"], ["Other", "other"]].map(([label, key]) => model.relationships?.[key]?.length ? `<div class="npcReferenceRelationshipGroup"><h3>${label}</h3>${relationshipRows(model.relationships[key])}</div>` : "").join("");
    const gm = model.gm || {};
    const gmBody = valueBlock("Secret", gm.secret) + (gm.notes?.length ? `<div class="npcReferenceValue"><h3>Private Notes</h3>${gm.notes.map(note => `<p>${escapeHtml(note)}</p>`).join("")}</div>` : "");
    return `<div class="npcReferenceView mf-reading-surface">${section("At a Glance", atBody, { open: true })}${section("Roleplay", completeRoleBody, { open: true })}${section("Combat & Abilities", capabilityBody)}${section("Equipment", model.equipment?.length ? equipmentRows(model.equipment) : "")}${section("Relationships", relationshipBody, { open: true })}${model.gm ? section("GM Notes", gmBody, { gm: true }) : ""}</div>`;
  }

  const api = Object.freeze({ buildNpcReferenceViewModel, renderNpcReferenceView });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.MasterForgeNpcReferenceView = api;
})();
