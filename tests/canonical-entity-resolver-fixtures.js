"use strict";

const assert = require("assert");
const loreApi = require("../src/factions/faction-lore.js");
const itemApi = require("../src/items/item-model.js");
const { createCanonicalEntityResolver } = require("../src/entities/canonical-entity-resolver.js");

const entities = new Map([
  ["faction:f1", { id: "f1", entity_type: "faction", name: "Galeclaw", extension: { kept: true }, data_json: { factionLore: { public: { identity: "Known" }, gm: { secrets: ["Hidden"] } }, factionHierarchy: { nodes: [] }, traits: [{ id: "t1" }], abilityPackIds: ["p1"] } }],
  ["npc:n1", { id: "n1", entity_type: "npc", name: "Nara", data_json: { source: "npc-builder", npcId: "npc-record-1", canonicalSource: "homebrew", sourceTitle: "Campaign Notes", sourceReference: "NPC 4" } }],
  ["creature:c1", { id: "c1", entity_type: "creature", name: "Storm Drake", data_json: { source: "creature-builder", creatureId: "creature-record-1" } }],
  ["item:local", { id: "local", entity_type: "item", name: "Local Key", data_json: { extension: { kept: true } } }],
  ["item:first-class", { id: "first-class", entity_type: "item", name: "Staff Mirror", data_json: { source: "item-builder", itemId: "item-record-2" } }],
  ["item:imported", { id: "imported", entity_type: "item", name: "Pack Key", data_json: { source: "content-pack", sourceCollection: "items", sourceId: "item-record-1" } }],
  ["item:missing", { id: "missing", entity_type: "item", name: "Missing", data_json: { sourceCollection: "items", sourceId: "does-not-exist" } }],
  ["quest:q1", { id: "q1", entity_type: "quest", name: "Find the Eye", data_json: { customExtension: { value: 7 } } }],
  ["location:l1", { id: "l1", entity_type: "location", name: "Harbour" }]
]);
const records = new Map([
  ["npcs:npc-record-1", { id: "npc-record-1", name: "Nara", personality: { hook: "Helpful", secret: "Spy" }, gmNotes: "Do not show", unknownExtension: { kept: true }, sourceTitle: "Campaign Notes", sourceReference: "NPC 4" }],
  ["creatures:creature-record-1", { id: "creature-record-1", name: "Storm Drake", hp: 88, actions: [{ name: "Bite" }], secretNotes: "Hidden lair" }],
  ["items:item-record-1", { id: "item-record-1", name: "Pack Key Complete", description: "Complete item", canonicalSource: "official-reference", sourceTitle: "Vault Guide", sourceReference: "Page 12", extension: { retained: true } }],
  ["items:item-record-2", itemApi.normalizeItemRecord({ id: "item-record-2", name: "Complete Staff", externalProvenance: { version: 1, sourceSystem: "masterforge-atlas", sourceWorkspaceId: "11111111-1111-4111-8111-111111111111", sourceEntityType: "item", sourceEntityId: "22222222-2222-4222-8222-222222222222", sourceRevision: "4", sourceHash: "sha256:staff" }, lore: { summary: "Known lore", secrets: "Hidden truth", gmNotes: "GM only" }, mechanics: { properties: { focus: true }, capabilities: [{ name: "Bolt" }] } })]
]);
const relationshipRows = [
  { id: "out", sourceEntityType: "faction", sourceEntityId: "f1", relationshipType: "based_in", targetEntityType: "location", targetEntityId: "l1", visibility: "public", data_json: { note: "Known" } },
  { id: "in", from_type: "npc", from_id: "n1", relationship: "member_of", to_type: "faction", to_id: "f1", visibility: "public" },
  { id: "secret", sourceEntityType: "npc", sourceEntityId: "n1", relationshipType: "secretly_member_of", targetEntityType: "faction", targetEntityId: "f1", data_json: { secret: true } },
  { id: "broken", sourceEntityType: "faction", sourceEntityId: "f1", relationshipType: "knows", targetEntityType: "npc", targetEntityId: "deleted", visibility: "public" }
];
const calls = { writes: 0, combat: 0, inheritance: 0, entityReads: new Map() };
const resolver = createCanonicalEntityResolver({
  getEntity: async (type, id) => {
    const key = `${type}:${id}`;
    calls.entityReads.set(key, (calls.entityReads.get(key) || 0) + 1);
    return entities.get(key) || null;
  },
  getRecord: async (collection, id) => records.get(`${collection}:${id}`) || null,
  getRelationshipsForEntity: async (type, id) => type === "faction" && id === "f1" ? relationshipRows : [],
  projectFactionLore: loreApi.projectFactionLore,
  projectItemForVisibility: itemApi.projectItemForVisibility,
  resolveCapabilities: async (_entity, canonical) => { calls.inheritance += 1; return { effective: { traits: [{ name: canonical.personality?.hook }, { name: "Hidden inheritance", hidden: true }] } }; },
  resolveCombatProfile: async (_entity, canonical) => { calls.combat += 1; return { categories: [{ id: "actions", entries: canonical.actions }], snapshot: undefined }; },
  saveRecord: () => { calls.writes += 1; }, updateEntity: () => { calls.writes += 1; }, createCombatSnapshot: () => { calls.writes += 1; }
});

(async () => {
  const factionGm = await resolver.resolveCanonicalEntityReference({ entityType: "faction", entityId: "f1" }, { visibilityMode: "gm", includeRelationships: true });
  assert.strictEqual(factionGm.source.kind, "entity", "Faction resolves directly from its URE entity");
  assert.deepStrictEqual(factionGm.canonical.data_json.factionLore.gm.secrets, ["Hidden"], "GM Faction Lore is included in GM mode");
  assert.deepStrictEqual(factionGm.canonical.data_json.traits, [{ id: "t1" }], "Faction traits remain canonical");
  assert.deepStrictEqual(factionGm.canonical.data_json.abilityPackIds, ["p1"], "Faction Ability Pack references remain canonical");
  assert.deepStrictEqual(factionGm.canonical.extension, { kept: true }, "unknown entity extensions survive");

  const factionPublic = await resolver.resolveCanonicalEntityReference({ entityType: "faction", entityId: "f1" }, { visibilityMode: "public", includeRelationships: true });
  assert(!Object.prototype.hasOwnProperty.call(factionPublic.canonical.data_json.factionLore, "gm"), "public Faction Lore excludes GM data");
  assert.deepStrictEqual(factionPublic.relationships.map(item => item.id), ["out", "in", "broken"], "public relationships exclude secret links");
  assert.strictEqual(factionPublic.relationships.find(item => item.id === "out").direction, "outgoing", "outgoing relationship is normalized");
  assert.strictEqual(factionPublic.relationships.find(item => item.id === "in").direction, "incoming", "incoming relationship is normalized");
  assert.deepStrictEqual(factionPublic.relationships.find(item => item.id === "out").otherEntity, { id: "l1", type: "location", name: "Harbour" }, "other endpoint metadata resolves");
  assert(factionPublic.warnings.some(item => item.code === "RELATIONSHIP_ENDPOINT_MISSING"), "missing relationship endpoint warns without crashing");
  assert.strictEqual(calls.entityReads.get("location:l1"), 2, "entity cache is scoped to each resolution call");

  const npcGm = await resolver.resolveCanonicalEntityReference({ entityType: "npc", entityId: "n1" }, { visibilityMode: "gm", includeResolvedCapabilities: true });
  assert.strictEqual(npcGm.source.collection, "npcs", "NPC mirror follows its NPC record pointer");
  assert.strictEqual(npcGm.canonical.personality.secret, "Spy", "NPC secrets remain in GM mode");
  assert.strictEqual(npcGm.resolvedCapabilities.effective.traits[0].name, "Helpful", "NPC uses injected inheritance resolution");
  assert.strictEqual(npcGm.attribution.sourceTitle, "Campaign Notes", "source title is preserved");
  assert.strictEqual(npcGm.attribution.sourceReference, "NPC 4", "source reference is preserved");
  assert.deepStrictEqual(npcGm.canonical.unknownExtension, { kept: true }, "unknown canonical record fields survive");

  const npcPublic = await resolver.resolveCanonicalEntityReference({ entityType: "npc", entityId: "n1" }, { visibilityMode: "public", includeResolvedCapabilities: true });
  assert(!Object.prototype.hasOwnProperty.call(npcPublic.canonical.personality, "secret"), "NPC secret is excluded in public mode");
  assert(!Object.prototype.hasOwnProperty.call(npcPublic.canonical, "gmNotes"), "NPC GM notes are excluded in public mode");
  assert.deepStrictEqual(npcPublic.resolvedCapabilities.effective.traits.map(item => item.name), ["Helpful"], "hidden inherited capabilities are excluded in public mode");

  const creature = await resolver.resolveCanonicalEntityReference({ entityType: "creature", entityId: "c1" }, { includeResolvedCapabilities: true });
  assert.strictEqual(creature.source.collection, "creatures", "Creature mirror follows its Creature record pointer");
  assert.strictEqual(creature.canonical.hp, 88, "complete Creature builder record is returned");
  assert.strictEqual(creature.resolvedCapabilities.categories[0].entries[0].name, "Bite", "Creature uses combat profile resolution");
  assert.strictEqual(calls.combat, 1, "combat profile is resolved once");

  const localItem = await resolver.resolveCanonicalEntityReference({ entityType: "item", entityId: "local" });
  assert.strictEqual(localItem.source.kind, "entity", "local generic Item resolves directly");
  const importedItem = await resolver.resolveCanonicalEntityReference({ entityType: "item", entityId: "imported" });
  assert.strictEqual(importedItem.canonical.name, "Pack Key Complete", "imported Item resolves its source record");
  assert.strictEqual(importedItem.attribution.sourceTitle, "Vault Guide", "imported Item attribution is retained");
  assert.deepStrictEqual(importedItem.canonical.extension, { retained: true }, "imported Item extensions survive");
  const firstClassItem = await resolver.resolveCanonicalEntityReference({ entityType: "item", entityId: "first-class" });
  assert.strictEqual(firstClassItem.source.collection, "items", "first-class Item mirror follows its canonical pointer");
  assert.strictEqual(firstClassItem.canonical.name, "Complete Staff", "first-class Item resolves complete canonical record");
  assert.strictEqual(firstClassItem.source.externalProvenance.sourceRevision, "4", "resolver exposes canonical external provenance without changing source pointers");
  assert.strictEqual(firstClassItem.canonical.lore.secrets, "Hidden truth", "GM Item resolution retains secrets");
  const publicItem = await resolver.resolveCanonicalEntityReference({ entityType: "item", entityId: "first-class" }, { visibilityMode: "public" });
  assert(!Object.hasOwn(publicItem.canonical.lore, "secrets") && !Object.hasOwn(publicItem.canonical.lore, "gmNotes"), "public Item resolution structurally excludes GM lore");

  const missing = await resolver.resolveCanonicalEntityReference({ entityType: "item", entityId: "missing" });
  assert(missing.warnings.some(item => item.code === "SOURCE_RECORD_NOT_FOUND"), "missing source record returns a safe warning");
  assert.strictEqual(missing.canonical.id, "missing", "missing source falls back to the URE entity");

  const generic = await resolver.resolveCanonicalEntityReference({ entityType: "quest", entityId: "q1" });
  assert.strictEqual(generic.source.kind, "entity", "generic entity resolves directly");
  assert.deepStrictEqual(generic.canonical.data_json.customExtension, { value: 7 }, "generic extension fields survive");
  assert.strictEqual(calls.inheritance, 2, "capability resolution runs only when requested for an eligible type");
  assert.strictEqual(calls.writes, 0, "resolver never invokes write or snapshot APIs");
  await assert.rejects(() => resolver.resolveCanonicalEntityReference({ entityType: "npc" }), /entityType and entityId/, "invalid invocation throws clearly");

  console.log("Canonical entity resolver fixtures passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
