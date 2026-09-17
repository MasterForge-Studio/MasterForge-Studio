"use strict";

const assert = require("assert");
const provenance = require("../src/interchange/external-provenance.js");
const { findExistingEntityForExternalIdentity } = require("../src/interchange/external-entity-match.js");

const identity = { sourceSystem: "masterforge-atlas", sourceWorkspaceId: "11111111-1111-4111-8111-111111111111", sourceEntityType: "item", sourceEntityId: "22222222-2222-4222-8222-222222222222" };
const canonical = { id: "local-item", collection: "items", name: "Atlas Relic", externalProvenance: { version: 1, ...identity, sourceRevision: "7", sourceHash: "sha256:item" } };
const mirror = { id: "local-item", entity_type: "item", name: "Atlas Relic", data_json: { itemId: "local-item", externalIdentity: { ...identity } } };
let writes = 0;

(async () => {
  const exact = await findExistingEntityForExternalIdentity(identity, { provenance, listEntities: async () => [mirror], listRecords: async () => [canonical], save: () => { writes += 1; } });
  assert.strictEqual(exact.match, "exact", "exact Studio entity match found");
  assert.strictEqual(exact.entity.id, "local-item", "matching mirror is returned");
  assert.strictEqual(exact.record.id, "local-item", "linked canonical record is paired with mirror as one candidate");
  assert.strictEqual(exact.candidates.length, 1, "canonical record and its mirror are not treated as duplicates");

  const none = await findExistingEntityForExternalIdentity({ ...identity, sourceEntityId: "33333333-3333-4333-8333-333333333333" }, { provenance, listEntities: async () => [mirror], listRecords: async () => [canonical] });
  assert.strictEqual(none.match, "none", "unknown immutable identity returns no match");
  const nameOnly = await findExistingEntityForExternalIdentity(identity, { provenance, listEntities: async () => [{ id: "same-name", entity_type: "item", name: "Atlas Relic", data_json: {} }], listRecords: async () => [] });
  assert.strictEqual(nameOnly.match, "none", "name-only similarity is not an automatic match");
  const slugOnly = await findExistingEntityForExternalIdentity(identity, { provenance, listEntities: async () => [{ id: "atlas-relic", entity_type: "item", name: "Different", data_json: {} }], listRecords: async () => [] });
  assert.strictEqual(slugOnly.match, "none", "slug-only similarity is not an automatic match");

  const duplicate = { id: "duplicate", entity_type: "item", data_json: { externalIdentity: { ...identity } } };
  const ambiguous = await findExistingEntityForExternalIdentity(identity, { provenance, listEntities: async () => [mirror, duplicate], listRecords: async () => [canonical] });
  assert.strictEqual(ambiguous.match, "ambiguous", "duplicate claims return ambiguous");
  assert(ambiguous.warnings.some(item => item.code === "DUPLICATE_EXTERNAL_IDENTITY"), "duplicate identity warning is explicit");

  const legacy = await findExistingEntityForExternalIdentity(identity, { provenance, listEntities: async () => [{ id: "legacy", entity_type: "item", name: "Legacy Item", data_json: {} }], listRecords: async () => [] });
  assert.strictEqual(legacy.match, "none", "legacy local entity without provenance remains valid and unmatched");
  assert.strictEqual(writes, 0, "match helper performs no writes");
  console.log("External entity match fixtures passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
