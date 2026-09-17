(() => {
  "use strict";

  const VERSION = 1;
  const ITEM_TYPES = Object.freeze([
    "mundane", "weapon", "armour", "ammunition", "consumable", "tool", "container", "treasure",
    "currency", "magic_item", "artefact", "quest_item", "key", "document", "component", "custom"
  ]);

  function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
    return value;
  }
  function string(value, fallback = "") { return typeof value === "string" ? value : fallback; }
  function boolean(value, fallback = false) { return typeof value === "boolean" ? value : fallback; }
  function optionalNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : null;
  }
  function quantity(value) {
    if (value === null || value === undefined || value === "") return 1;
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : 1;
  }
  function strings(value) {
    if (!Array.isArray(value)) return typeof value === "string" ? value.split(/[,;\n]/).map(item => item.trim()).filter(Boolean) : [];
    return value.filter(item => typeof item === "string").map(item => item.trim()).filter(Boolean);
  }
  function objects(value) { return Array.isArray(value) ? value.filter(isObject).map(clone) : []; }

  function createDefaultItem() {
    return {
      version: VERSION, id: "", name: "", description: "", image: "",
      classification: { type: "", subtype: "", category: "", rarity: "", tags: [] },
      physical: { quantity: 1, weight: null, value: null, currency: "", material: "", size: "" },
      usage: { consumable: false, stackable: false, attunementRequired: false, attunementNotes: "", charges: null, maxCharges: null, recharge: "", uses: "" },
      mechanics: { system: "", properties: {}, effects: [], capabilities: [] },
      lore: { summary: "", history: "", origin: "", inscriptions: "", secrets: "", gmNotes: "" },
      ownership: { status: "", notes: "" },
      canonicalSource: "", sourceTitle: "", sourceReference: "",
      flags: {}, extensions: {}
    };
  }

  function normalizeItemRecord(value) {
    const input = isObject(value) ? value : {};
    const defaults = createDefaultItem();
    const classification = isObject(input.classification) ? input.classification : {};
    const physical = isObject(input.physical) ? input.physical : {};
    const usage = isObject(input.usage) ? input.usage : {};
    const mechanics = isObject(input.mechanics) ? input.mechanics : {};
    const lore = isObject(input.lore) ? input.lore : {};
    const ownership = isObject(input.ownership) ? input.ownership : {};
    const legacySource = isObject(input.source) ? input.source : {};
    return {
      ...clone(input), version: Number.isFinite(Number(input.version)) ? Number(input.version) : VERSION,
      id: string(input.id), name: string(input.name), description: string(input.description), image: string(input.image),
      canonicalSource: string(input.canonicalSource), sourceTitle: string(input.sourceTitle, string(legacySource.sourceTitle)), sourceReference: string(input.sourceReference, string(legacySource.sourceReference)),
      classification: { ...clone(classification), type: string(classification.type), subtype: string(classification.subtype), category: string(classification.category), rarity: string(classification.rarity), tags: strings(classification.tags) },
      physical: { ...clone(physical), quantity: quantity(physical.quantity), weight: optionalNumber(physical.weight), value: optionalNumber(physical.value), currency: string(physical.currency), material: string(physical.material), size: string(physical.size) },
      usage: { ...clone(usage), consumable: boolean(usage.consumable), stackable: boolean(usage.stackable), attunementRequired: boolean(usage.attunementRequired), attunementNotes: string(usage.attunementNotes), charges: optionalNumber(usage.charges), maxCharges: optionalNumber(usage.maxCharges), recharge: string(usage.recharge), uses: string(usage.uses) },
      mechanics: { ...clone(mechanics), system: string(mechanics.system), properties: isObject(mechanics.properties) ? clone(mechanics.properties) : {}, effects: objects(mechanics.effects), capabilities: objects(mechanics.capabilities) },
      lore: { ...clone(lore), summary: string(lore.summary), history: string(lore.history), origin: string(lore.origin), inscriptions: string(lore.inscriptions), secrets: string(lore.secrets), gmNotes: string(lore.gmNotes) },
      ownership: { ...clone(ownership), status: string(ownership.status), notes: string(ownership.notes) },
      flags: isObject(input.flags) ? clone(input.flags) : defaults.flags,
      extensions: isObject(input.extensions) ? clone(input.extensions) : defaults.extensions
    };
  }

  function cloneItemRecord(value) { return normalizeItemRecord(clone(value)); }
  function projectItemForVisibility(value, mode = "gm") {
    const item = normalizeItemRecord(value);
    if (mode !== "public") return item;
    const { secrets, gmNotes, ...publicLore } = item.lore;
    return { ...item, lore: publicLore };
  }

  const api = Object.freeze({ VERSION, ITEM_TYPES, createDefaultItem, normalizeItemRecord, cloneItemRecord, projectItemForVisibility });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.MasterForgeItemModel = api;
})();
