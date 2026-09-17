"use strict";

const assert = require("assert");
const api = require("../src/items/item-model.js");

const defaults = api.createDefaultItem();
assert.strictEqual(defaults.version, 1, "Item schema is versioned");
assert.strictEqual(defaults.physical.quantity, 1, "default quantity is one");
assert.strictEqual(defaults.physical.weight, null, "missing weight is null");
assert.strictEqual(defaults.physical.value, null, "missing value is null");
assert.deepStrictEqual(defaults.mechanics, { system: "", properties: {}, effects: [], capabilities: [] }, "system-neutral mechanics default");
assert.deepStrictEqual(api.normalizeItemRecord(null), defaults, "null Item normalises safely");

const source = {
  version: 1, id: "staff-1", name: "Ween's Replacement Staff", description: "A rebuilt ash staff.", image: "data:image/webp;base64,AAAA",
  classification: { type: "magic_item", subtype: "staff", category: "focus", rarity: "rare", tags: ["arcane", " staff "], customClass: "focus" },
  physical: { quantity: 0, weight: 0, value: 0, currency: "gp", material: "ash", size: "long" },
  usage: { consumable: false, stackable: false, attunementRequired: true, attunementNotes: "By a spellcaster", charges: 0, maxCharges: 7, recharge: "1d6 at dawn", uses: "Cast spells" },
  mechanics: { system: "dnd5e", properties: { versatile: true, namespaced: { reach: 5 } }, effects: [{ id: "e1", name: "Ward", extra: true }], capabilities: [{ id: "c1", name: "Storm Bolt", category: "actions", damage: "2d8" }] },
  lore: { summary: "A silver-capped staff.", history: "Rebuilt after the crossing.", origin: "Mistcliff", inscriptions: "Stand fast", secrets: "It remembers its first owner.", gmNotes: "Awakens later." },
  ownership: { status: "carried", notes: "Ownership identity remains a relationship." }, canonicalSource: "homebrew", sourceTitle: "Campaign Notes", sourceReference: "Session 8",
  flags: { favourite: true }, extensions: { "example.test": { preserved: true } }, unknownRoot: { preserved: true }
};
const item = api.normalizeItemRecord(source);
assert.strictEqual(item.classification.type, "magic_item", "controlled Item type persists");
assert.strictEqual(api.normalizeItemRecord({ classification: { type: "clockwork_relic" } }).classification.type, "clockwork_relic", "custom Item type persists");
assert.strictEqual(item.physical.quantity, 0, "quantity persists including zero");
assert.strictEqual(item.physical.weight, 0, "real numeric weight zero persists");
assert.strictEqual(item.physical.value, 0, "real numeric value zero persists");
assert.strictEqual(api.normalizeItemRecord({ physical: {} }).physical.value, null, "missing numeric value is not fabricated as zero");
assert.strictEqual(item.usage.attunementRequired, true, "attunement persists");
assert.strictEqual(item.usage.charges, 0, "zero charges persist");
assert.strictEqual(item.usage.maxCharges, 7, "maximum charges persist");
assert.strictEqual(item.usage.recharge, "1d6 at dawn", "recharge persists");
assert.strictEqual(item.mechanics.capabilities[0].damage, "2d8", "capability data persists losslessly");
assert.deepStrictEqual(item.mechanics.properties.namespaced, { reach: 5 }, "unknown mechanics properties persist");
assert.strictEqual(item.lore.summary, "A silver-capped staff.", "player lore persists");
assert.strictEqual(item.lore.secrets, "It remembers its first owner.", "GM secret persists in canonical model");
assert.strictEqual(item.image, source.image, "image persists");
assert.deepStrictEqual(item.unknownRoot, { preserved: true }, "unknown root fields survive");
assert.deepStrictEqual(item.extensions, source.extensions, "unknown extensions survive");

const publicItem = api.projectItemForVisibility(item, "public");
assert(!Object.hasOwn(publicItem.lore, "secrets") && !Object.hasOwn(publicItem.lore, "gmNotes"), "GM lore is structurally absent from public projection");
assert.strictEqual(publicItem.lore.history, source.lore.history, "player lore survives public projection");
const imageRemoved = api.cloneItemRecord(item); imageRemoved.image = "";
assert.strictEqual(imageRemoved.name, item.name, "removing image does not affect other fields");
const cloned = api.cloneItemRecord(item); cloned.mechanics.properties.namespaced.reach = 10;
assert.strictEqual(item.mechanics.properties.namespaced.reach, 5, "clone is independent");
assert(!Object.hasOwn(item, "relationships") && !Object.hasOwn(item.ownership, "ownerId") && !Object.hasOwn(item.ownership, "locationId"), "relationship identities are not duplicated in Item record");

console.log("Item model fixtures passed.");
