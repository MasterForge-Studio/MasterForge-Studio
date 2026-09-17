"use strict";

const assert = require("assert");
const fs = require("fs");
const model = require("../src/items/item-model.js");
const builder = require("../src/items/item-builder.js");

const records = new Map();
const entities = new Map([
  ["item:legacy-key", { id: "legacy-key", entity_type: "item", name: "Legacy Key", description: "A generic brass key.", data_json: { type: "key", customLegacy: true } }]
]);
const relationships = new Map([["legacy-key", [{ id: "rel-1", relationship: "carried_by" }, { id: "rel-2", relationship: "stored_in" }]]]);
let saves = 0;
const controller = builder.createItemBuilderController({
  model,
  listRecords: async () => [...records.values()],
  listEntities: async type => [...entities.values()].filter(entity => entity.entity_type === type),
  getEntity: async (type, id) => entities.get(`${type}:${id}`) || null,
  saveRecord: async (_collection, id, value) => { saves += 1; records.set(id, JSON.parse(JSON.stringify(value))); },
  createEntity: async entity => { entities.set(`${entity.entity_type}:${entity.id}`, JSON.parse(JSON.stringify(entity))); return entity; },
  updateEntity: async (type, id, entity) => { entities.set(`${type}:${id}`, JSON.parse(JSON.stringify(entity))); return entity; },
  deleteEntity: async (type, id) => entities.delete(`${type}:${id}`),
  deleteRecord: async id => records.delete(id),
  getRelationships: async (_type, id) => relationships.get(id) || [],
  deleteRelationship: async id => { for (const values of relationships.values()) { const index = values.findIndex(value => value.id === id); if (index >= 0) values.splice(index, 1); } },
  slugify: value => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
});

(async () => {
  let listed = await controller.list();
  assert(listed.some(entry => entry.kind === "legacy" && entry.id === "legacy-key"), "existing generic Item remains available as legacy");
  assert.strictEqual(records.size, 0, "listing/opening does not silently adopt a legacy Item");
  controller.openLegacy(listed.find(entry => entry.id === "legacy-key").entity);
  assert(controller.getState().adoptionPending, "legacy Item clearly requires explicit adoption save");
  const adopted = await controller.save({ ...controller.getState().draft, lore: { summary: "Player-safe key lore", secrets: "GM-only lock" } }, { worldId: "world-1" });
  assert(adopted.adopted && records.has("legacy-key"), "explicit save adopts legacy Item into canonical records");
  const mirror = entities.get("item:legacy-key");
  assert.strictEqual(mirror.data_json.itemId, "legacy-key", "mirror points to canonical Item record");
  assert.strictEqual(mirror.name, "Legacy Key", "mirror remains searchable/navigation-ready");
  assert(!Object.hasOwn(mirror.data_json, "lore") && !Object.hasOwn(mirror.data_json, "mechanics") && !JSON.stringify(mirror).includes("GM-only lock"), "mirror does not duplicate canonical or secret content");
  const firstSaveCount = saves;
  await controller.save({ ...controller.getState().draft, description: "Updated once." }, { worldId: "world-1" });
  assert.strictEqual(saves, firstSaveCount + 1, "repeated save updates one stable record");
  assert.strictEqual([...records.keys()].filter(id => id === "legacy-key").length, 1, "repeated save creates no duplicate Item");

  controller.beginNew();
  const fresh = model.createDefaultItem(); fresh.name = "Storm Lantern"; fresh.classification.type = "tool"; fresh.mechanics.capabilities = [{ id: "shine", name: "Storm Light", custom: { radius: 30 } }];
  await controller.save(fresh, {});
  assert(records.has("storm-lantern") && entities.has("item:storm-lantern"), "new Item creates canonical record and lightweight mirror");
  assert.deepStrictEqual(records.get("storm-lantern").mechanics.capabilities[0].custom, { radius: 30 }, "capability extensions survive canonical save");

  const roundTrip = model.normalizeItemRecord(JSON.parse(JSON.stringify(records.get("storm-lantern"))));
  assert.deepStrictEqual(roundTrip, records.get("storm-lantern"), "generic content-package JSON round trip preserves canonical Item");
  controller.openCanonical(records.get("legacy-key"));
  await controller.remove();
  assert(!records.has("legacy-key") && !entities.has("item:legacy-key"), "delete removes canonical Item and mirror");
  assert.strictEqual((relationships.get("legacy-key") || []).length, 0, "delete cleans carried_by/stored_in relationships through existing relationship API");

  const source = fs.readFileSync("src/items/item-builder.js", "utf8");
  assert(source.includes('groupId: "record"') && source.includes('label: "Save Item"'), "Action Console owns Item save");
  assert(source.includes('danger: true') && source.includes('label: "Delete Item"'), "Action Console owns destructive Item lifecycle");
  assert(!/data-item-inline-(?:save|delete)/.test(source), "no duplicate inline save/delete controls");
  const index = fs.readFileSync("src/index.html", "utf8");
  assert(index.includes('data-tab="items"') && index.includes('id="itemBuilderRoot"'), "dedicated Item Builder is navigable");
  console.log("Item builder fixtures passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
