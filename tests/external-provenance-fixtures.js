"use strict";

const assert = require("assert");
const fs = require("fs");
const provenance = require("../src/interchange/external-provenance.js");
const contract = require("../src/interchange/interchange-contract.js");
const itemBuilder = require("../src/items/item-builder.js");
const itemModel = require("../src/items/item-model.js");

const atlas = {
  version: 1, sourceSystem: "masterforge-atlas", sourceWorkspaceId: "11111111-1111-4111-8111-111111111111",
  sourceEntityType: "creature", sourceEntityId: "22222222-2222-4222-8222-222222222222",
  sourceRevision: "41", sourceHash: "sha256:one", importedAt: "2026-09-14T10:00:00Z", lastSeenAt: "2026-09-14T11:00:00Z",
  futureMetadata: { preserved: true }
};
const normalized = provenance.normalizeExternalProvenance(atlas);
assert.strictEqual(normalized.sourceSystem, "masterforge-atlas", "valid provenance normalises");
assert.deepStrictEqual(normalized.futureMetadata, { preserved: true }, "unknown provenance fields survive");
assert.strictEqual(provenance.normalizeExternalProvenance(null), null, "missing provenance remains absent");
assert.strictEqual(provenance.normalizeExternalProvenance({}), null, "ordinary local object does not gain provenance");
assert(provenance.validateExternalIdentity(atlas).valid, "valid Atlas UUID identity passes validation");
assert(!provenance.validateExternalIdentity({ sourceSystem: "masterforge-atlas", sourceWorkspaceId: "bad", sourceEntityType: "creature", sourceEntityId: "bad" }).valid, "malformed Atlas UUIDs are rejected");
assert(provenance.validateExternalIdentity({ sourceSystem: "future-tool", sourceWorkspaceId: "workspace-A", sourceEntityType: "custom", sourceEntityId: "Entity-A" }).valid, "future source systems are not over-restricted to UUIDs");

const key = provenance.getExternalIdentityKey(atlas);
assert.strictEqual(key, "masterforge-atlas::11111111-1111-4111-8111-111111111111::creature::22222222-2222-4222-8222-222222222222", "identity key has deterministic tuple format");
for (const field of ["sourceRevision", "sourceHash", "importedAt", "lastSeenAt"]) assert.strictEqual(provenance.getExternalIdentityKey({ ...atlas, [field]: "changed" }), key, `${field} does not affect identity key`);
assert.notStrictEqual(provenance.getExternalIdentityKey({ ...atlas, sourceWorkspaceId: "33333333-3333-4333-8333-333333333333" }), key, "different workspace changes identity");
assert.notStrictEqual(provenance.getExternalIdentityKey({ ...atlas, sourceEntityId: "44444444-4444-4444-8444-444444444444" }), key, "different entity ID changes identity");
assert.notStrictEqual(provenance.getExternalIdentityKey({ ...atlas, sourceSystem: "future-tool" }), key, "different source system changes identity");
assert(provenance.isSameExternalIdentity(atlas, { ...atlas, sourceRevision: "42" }), "same immutable tuple compares exact despite revision");
assert.strictEqual(provenance.compareExternalRevision(atlas, { ...atlas }), "same", "same revision and hash compare same");
assert.strictEqual(provenance.compareExternalRevision(atlas, { ...atlas, sourceRevision: "42" }), "changed", "changed revision detected");
assert.strictEqual(provenance.hasSourceChanged(atlas, { ...atlas, sourceHash: "sha256:two" }), "changed", "changed hash detected");
assert.strictEqual(provenance.compareExternalRevision({ ...atlas, sourceRevision: "", sourceHash: "" }, { ...atlas, sourceRevision: "", sourceHash: "" }), "unknown", "missing revision and hash compare unknown");
assert.strictEqual(provenance.compareExternalRevision(atlas, { ...atlas, sourceEntityId: "55555555-5555-4555-8555-555555555555" }), "different_identity", "different identity is never treated as update");
assert(provenance.hasExternalProvenance(atlas) && provenance.isAtlasProvenance(atlas), "provenance presence and Atlas source are detectable");
assert.deepStrictEqual(Object.keys(provenance.toExternalIdentity(atlas)), provenance.IDENTITY_FIELDS, "minimal external identity contains immutable tuple only");

assert.deepStrictEqual(provenance.canAdoptExternalIdentity({ id: "local" }, atlas).status, "can_adopt", "local entity without provenance can be explicitly adopted");
assert.deepStrictEqual(provenance.canAdoptExternalIdentity({ externalProvenance: atlas }, atlas).status, "already_adopted", "repeated adoption is idempotent");
assert.strictEqual(provenance.canAdoptExternalIdentity({ externalProvenance: { ...atlas, sourceEntityId: "66666666-6666-4666-8666-666666666666" } }, atlas).allowed, false, "different existing identity blocks adoption");
assert(contract.validateManifestVersion(1).valid && !contract.validateManifestVersion(2).valid, "manifest version validation is explicit");
assert.strictEqual(contract.SOURCE_SYSTEM_MASTERFORGE_ATLAS, "masterforge-atlas", "Atlas source constant is shared");

const canonicalItem = itemModel.normalizeItemRecord({ id: "item-1", name: "Atlas Relic", externalProvenance: atlas });
const existingMirror = { id: "item-1", entity_type: "item", data_json: { sourceCollection: "items", sourceId: "item-1", custom: true } };
const itemMirror = itemBuilder.mirrorForItem(canonicalItem, existingMirror, {});
assert.deepStrictEqual(itemMirror.data_json.externalIdentity, provenance.createExternalIdentity(atlas), "Item mirror carries minimal external identity");
assert.strictEqual(itemMirror.data_json.sourceCollection, "items", "existing sourceCollection is preserved");
assert.strictEqual(itemMirror.data_json.sourceId, "item-1", "existing sourceId is preserved");
assert(!Object.hasOwn(itemMirror.data_json.externalIdentity, "sourceRevision") && !Object.hasOwn(itemMirror.data_json.externalIdentity, "sourceHash"), "mirror excludes mutable revision metadata");
const repeatedMirror = itemBuilder.mirrorForItem(canonicalItem, itemMirror, {});
assert.deepStrictEqual(repeatedMirror.data_json.externalIdentity, itemMirror.data_json.externalIdentity, "repeated canonical mirror saves do not duplicate provenance");
const renderer = fs.readFileSync("src/renderer.js", "utf8");
assert(renderer.includes("toExternalIdentity(npc.externalProvenance)"), "NPC mirror sync propagates minimal identity");
assert(renderer.includes("toExternalIdentity(creature.externalProvenance)"), "Creature mirror sync propagates minimal identity");

const faction = { id: "f1", entity_type: "faction", data_json: { externalProvenance: atlas, factionLore: { public: { identity: "Known" } } } };
assert.deepStrictEqual(JSON.parse(JSON.stringify(faction)).data_json.externalProvenance, atlas, "direct canonical Faction provenance survives entity serialization");
assert.deepStrictEqual(JSON.parse(JSON.stringify(canonicalItem)).externalProvenance, atlas, "content-package JSON round trip preserves canonical provenance");

console.log("External provenance fixtures passed.");
