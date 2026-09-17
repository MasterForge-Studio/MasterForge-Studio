(() => {
  "use strict";

  const BROWSER_TYPES = new Set(["npc", "creature", "faction", "item"]);
  const OWNERSHIP_GROUPS = Object.freeze({
    "carried_by:outgoing": "Carrier", "stored_in:outgoing": "Stored At", "located_in:outgoing": "Located At", "owns:incoming": "Owner"
  });

  function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
  function text(value) { return typeof value === "string" || typeof value === "number" ? String(value).trim() : ""; }
  function title(value) { return text(value).replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, letter => letter.toUpperCase()); }
  function list(value) { return Array.isArray(value) ? value.map(text).filter(Boolean) : text(value) ? text(value).split(/[,;\n]/).map(item => item.trim()).filter(Boolean) : []; }
  function compact(value = {}) { return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== "" && item !== null && item !== undefined && (!Array.isArray(item) || item.length))); }
  function validImage(value) {
    const source = text(value);
    return /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(source) ? source : "";
  }
  function displayValue(value, depth = 0) {
    if (value === true) return "Yes";
    if (value === false) return "No";
    if (value === null || value === undefined || value === "") return "";
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.map(item => displayValue(item, depth + 1)).filter(Boolean).join(" · ");
    if (isObject(value) && depth < 2) return Object.entries(value).map(([key, item]) => `${title(key)}: ${displayValue(item, depth + 1)}`).filter(item => !item.endsWith(": ")).join(" · ");
    return "Structured value";
  }
  function relationshipEntry(value = {}) {
    if (!isObject(value)) return null;
    const other = isObject(value.otherEntity) ? value.otherEntity : {};
    const entityType = text(other.type).toLowerCase(), entityId = text(other.id), name = text(other.name || entityId);
    if (!name) return null;
    const metadata = isObject(value.metadata) ? value.metadata : {};
    return compact({
      type: text(value.type).toLowerCase().replaceAll("-", "_"), direction: text(value.direction).toLowerCase(), label: text(value.label) || title(value.type),
      name, entityType, entityId, openable: BROWSER_TYPES.has(entityType) && Boolean(entityId), status: text(value.status) === "active" ? "" : text(value.status),
      detail: text(metadata.role || metadata.summary || metadata.description || value.notes)
    });
  }
  function relationshipGroup(type) {
    if (["faction", "organisation"].includes(type)) return "factions";
    if (["location", "settlement"].includes(type)) return "locations";
    if (type === "npc") return "npcs";
    if (type === "creature") return "creatures";
    if (type === "item") return "items";
    return "other";
  }
  function structuredEntry(value = {}, kind = "effect") {
    if (!isObject(value)) return typeof value === "string" && value.trim() ? { name: title(kind), description: value.trim(), facts: [] } : null;
    const name = text(value.name || value.title || value.label), description = text(value.description || value.text || value.rulesText || value.summary);
    if (!name && !description) return null;
    const omitted = new Set(["id", "name", "title", "label", "description", "text", "rulesText", "summary", "source", "sourceTitle", "sourceReference", "provenance"]);
    const facts = Object.entries(value).filter(([key, item]) => !omitted.has(key) && item !== "" && item !== null && item !== undefined && typeof item !== "object").map(([key, item]) => `${title(key)}: ${displayValue(item)}`);
    return compact({ name: name || title(kind), description, category: text(value.category || value.type), facts, source: text(value.provenance || value.sourceTitle || value.source) });
  }

  function buildItemReferenceViewModel(resolved = {}) {
    const canonical = isObject(resolved.canonical) ? resolved.canonical : {};
    const data = isObject(canonical.data_json) ? canonical.data_json : {};
    const firstClass = isObject(canonical.classification) || isObject(canonical.physical) || isObject(canonical.mechanics) || isObject(canonical.lore);
    const classification = firstClass && isObject(canonical.classification) ? canonical.classification : data;
    const physical = firstClass && isObject(canonical.physical) ? canonical.physical : {};
    const usage = firstClass && isObject(canonical.usage) ? canonical.usage : {};
    const mechanics = firstClass && isObject(canonical.mechanics) ? canonical.mechanics : {};
    const lore = firstClass && isObject(canonical.lore) ? canonical.lore : {};
    const ownershipState = firstClass && isObject(canonical.ownership) ? canonical.ownership : {};
    const atAGlance = compact({
      image: validImage(firstClass ? canonical.image : data.image || data.imageUrl), description: text(canonical.description),
      type: text(classification.type || classification.itemType), subtype: text(classification.subtype), category: text(classification.category), rarity: text(classification.rarity),
      tags: list(classification.tags), quantity: physical.quantity === 0 || physical.quantity ? String(physical.quantity) : "",
      weight: physical.weight === 0 || physical.weight ? String(physical.weight) : "", value: physical.value === 0 || physical.value ? String(physical.value) : "",
      currency: text(physical.currency), material: text(physical.material), size: text(physical.size), ownershipStatus: text(ownershipState.status), legacy: firstClass ? "" : "Legacy Item record"
    });
    const usageModel = compact({
      system: text(mechanics.system), consumable: usage.consumable === true ? "Yes" : "", stackable: usage.stackable === true ? "Yes" : "",
      attunement: usage.attunementRequired === true ? "Required" : "", attunementNotes: text(usage.attunementNotes),
      charges: usage.charges === 0 || usage.charges ? String(usage.charges) : "", maxCharges: usage.maxCharges === 0 || usage.maxCharges ? String(usage.maxCharges) : "",
      recharge: text(usage.recharge), uses: text(usage.uses)
    });
    const properties = Object.entries(isObject(mechanics.properties) ? mechanics.properties : {}).map(([key, value]) => ({ label: title(key), value: displayValue(value) })).filter(item => item.value);
    const effects = (Array.isArray(mechanics.effects) ? mechanics.effects : []).map(item => structuredEntry(item, "effect")).filter(Boolean);
    const capabilities = (Array.isArray(mechanics.capabilities) ? mechanics.capabilities : []).map(item => structuredEntry(item, "capability")).filter(Boolean);
    const ownershipMap = new Map();
    const relationships = { npcs: [], factions: [], creatures: [], items: [], locations: [], other: [] };
    (Array.isArray(resolved.relationships) ? resolved.relationships : []).map(relationshipEntry).filter(Boolean).forEach(item => {
      const label = OWNERSHIP_GROUPS[`${item.type}:${item.direction}`];
      if (label) {
        if (!ownershipMap.has(label)) ownershipMap.set(label, []);
        ownershipMap.get(label).push(item);
      } else relationships[relationshipGroup(item.entityType)].push(item);
    });
    const gm = resolved.visibilityMode === "public" ? null : compact({ secrets: text(lore.secrets), notes: text(lore.gmNotes) });
    return {
      legacy: !firstClass, atAGlance, usage: usageModel, properties, effects, capabilities,
      lore: compact({ summary: text(lore.summary || data.summary), history: text(lore.history), origin: text(lore.origin), inscriptions: text(lore.inscriptions) }),
      ownership: { statusNotes: text(ownershipState.notes), groups: [...ownershipMap].map(([label, entries]) => ({ label, entries })) },
      relationships, gm: gm && Object.keys(gm).length ? gm : null
    };
  }

  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
  function valueBlock(label, value) { return value !== "" && value !== null && value !== undefined ? `<div class="itemReferenceValue mf-reading-prose"><h3 class="mf-reading-subheading">${escapeHtml(label)}</h3><p>${escapeHtml(value)}</p></div>` : ""; }
  function section(label, body, { open = false, gm = false } = {}) { return body ? `<details class="itemReferenceSection mf-reading-section${gm ? " itemReferenceSection--gm mf-reading-callout mf-reading-gm" : ""}"${open ? " open" : ""}><summary class="mf-reading-heading">${gm ? '<span class="itemReferenceGmBadge">GM Only</span>' : ""}${escapeHtml(label)}</summary><div class="itemReferenceSectionBody">${body}</div></details>` : ""; }
  function relationshipRows(entries = []) {
    return `<div class="itemReferenceRows">${entries.map(item => { const tag = item.openable ? "button" : "div"; const attrs = item.openable ? ` type="button" data-item-reference-type="${escapeHtml(item.entityType)}" data-item-reference-id="${escapeHtml(item.entityId)}"` : ""; return `<${tag} class="itemReferenceRow"${attrs}><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(title(item.entityType) || "Entity")}</small></span><span>${[item.label, item.status, item.detail].filter(Boolean).map(escapeHtml).join(" · ")}</span></${tag}>`; }).join("")}</div>`;
  }
  function structuredRows(entries = []) { return `<div class="itemReferenceStructuredRows">${entries.map(item => `<article><header><strong>${escapeHtml(item.name)}</strong>${item.category ? `<small>${escapeHtml(title(item.category))}</small>` : ""}</header>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}${item.facts?.length ? `<div class="itemReferenceFacts">${item.facts.map(fact => `<span>${escapeHtml(fact)}</span>`).join("")}</div>` : ""}${item.source ? `<footer>${escapeHtml(item.source)}</footer>` : ""}</article>`).join("")}</div>`; }

  function renderItemReferenceView(model = {}) {
    const at = model.atAGlance || {};
    const glanceValues = [["Type", title(at.type)], ["Subtype", title(at.subtype)], ["Category", title(at.category)], ["Rarity", title(at.rarity)], ["Quantity", at.quantity], ["Value", [at.value, at.currency].filter(Boolean).join(" ")], ["Weight", at.weight], ["Material", at.material], ["Size", at.size], ["Ownership Status", title(at.ownershipStatus)]].filter(([, value]) => value);
    const glanceBody = `<div class="itemReferenceGlance"><div class="itemReferenceGlanceContent">${at.legacy ? `<p class="itemReferenceLegacy">${escapeHtml(at.legacy)}</p>` : ""}${valueBlock("Description", at.description)}${glanceValues.length ? `<div class="itemReferenceMetadata">${glanceValues.map(([label, value]) => valueBlock(label, value)).join("")}</div>` : ""}${at.tags?.length ? `<div class="itemReferenceBadges">${at.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}</div></div>`;
    const usage = model.usage || {};
    const charge = usage.charges !== undefined || usage.maxCharges !== undefined ? [usage.charges ?? "—", usage.maxCharges !== undefined ? `of ${usage.maxCharges}` : ""].filter(Boolean).join(" ") : "";
    const usageValues = [["System", usage.system], ["Consumable", usage.consumable], ["Stackable", usage.stackable], ["Attunement", usage.attunement], ["Attunement Notes", usage.attunementNotes], ["Charges", charge], ["Recharge", usage.recharge], ["Uses", usage.uses]].filter(([, value]) => value);
    const usageBody = usageValues.length ? `<div class="itemReferenceMetadata">${usageValues.map(([label, value]) => valueBlock(label, value)).join("")}</div>` : "";
    const properties = model.properties?.length ? `<div class="itemReferenceProperties"><h3>Properties</h3>${model.properties.map(item => `<div><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.value)}</span></div>`).join("")}</div>` : "";
    const capabilityBody = properties + (model.effects?.length ? `<div class="itemReferenceStructuredGroup"><h3>Effects</h3>${structuredRows(model.effects)}</div>` : "") + (model.capabilities?.length ? `<div class="itemReferenceStructuredGroup"><h3>Capabilities</h3>${structuredRows(model.capabilities)}</div>` : "");
    const lore = model.lore || {};
    const loreBody = [["Summary", lore.summary], ["Origin", lore.origin], ["Inscriptions", lore.inscriptions], ["History", lore.history]].filter(([, value]) => value).map(([label, value]) => valueBlock(label, value)).join("");
    const ownershipBody = valueBlock("Status Notes", model.ownership?.statusNotes) + (model.ownership?.groups || []).map(group => `<div class="itemReferenceRelationshipGroup"><h3>${escapeHtml(group.label)}</h3>${relationshipRows(group.entries)}</div>`).join("");
    const relationshipBody = [["NPCs", "npcs"], ["Factions", "factions"], ["Creatures", "creatures"], ["Items", "items"], ["Locations", "locations"], ["Other", "other"]].map(([label, key]) => model.relationships?.[key]?.length ? `<div class="itemReferenceRelationshipGroup"><h3>${label}</h3>${relationshipRows(model.relationships[key])}</div>` : "").join("");
    const gmBody = model.gm ? valueBlock("Secrets", model.gm.secrets) + valueBlock("GM Notes", model.gm.notes) : "";
    return `<div class="itemReferenceView mf-reading-surface">${section("At a Glance", glanceBody, { open: true })}${section("Mechanics & Usage", usageBody, { open: true })}${section("Capabilities & Effects", capabilityBody)}${section("Lore", loreBody)}${section("Ownership & Location", ownershipBody, { open: true })}${section("Relationships", relationshipBody)}${model.gm ? section("GM Only", gmBody, { gm: true }) : ""}</div>`;
  }

  const api = Object.freeze({ buildItemReferenceViewModel, renderItemReferenceView });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.MasterForgeItemReferenceView = api;
})();
