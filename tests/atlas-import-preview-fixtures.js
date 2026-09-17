"use strict";

const assert = require("assert");
const parserApi = require("../src/interchange/atlas-package-parser.js");
const previewApi = require("../src/interchange/atlas-import-preview.js");
const provenanceApi = require("../src/interchange/external-provenance.js");
const matchApi = require("../src/interchange/external-entity-match.js");

const workspaceId = "11111111-1111-4111-8111-111111111111";
const ids = {
  create: "20000000-0000-4000-8000-000000000001", same: "20000000-0000-4000-8000-000000000002",
  revision: "20000000-0000-4000-8000-000000000003", hash: "20000000-0000-4000-8000-000000000004",
  unknown: "20000000-0000-4000-8000-000000000005", ambiguous: "20000000-0000-4000-8000-000000000006",
  unsupported: "20000000-0000-4000-8000-000000000007", existingDependency: "20000000-0000-4000-8000-000000000008",
  missing: "20000000-0000-4000-8000-000000000009", optional: "20000000-0000-4000-8000-000000000010"
};
const identity = (type, id) => ({ sourceSystem: "masterforge-atlas", sourceWorkspaceId: workspaceId, sourceEntityType: type, sourceEntityId: id });
const entity = (type, id, name, revision = "", hash = "") => ({ identity: { type, id }, name, revision, contentHash: hash, visibility: "public", data: { marker: name } });
const raw = {
  manifestVersion: 1, source: { system: "masterforge-atlas", workspaceId, workspaceRevision: "10" }, selection: [{ type: "creature", id: ids.create, name: "Selected Wyrm" }],
  entities: [
    entity("creature", ids.create, "Selected Wyrm", "1", "sha256:new"), entity("item", ids.same, "Stable Relic", "4", "sha256:same"),
    entity("faction", ids.revision, "Changed Faction", "5", "sha256:faction"), entity("npc", ids.hash, "Changed NPC", "7", "sha256:new-hash"),
    entity("region", ids.unknown, "Unknown Revision Region"), entity("item", ids.ambiguous, "Duplicate Claim Item", "2", "sha256:duplicate"),
    entity("future_construct", ids.unsupported, "Future Construct", "1", "sha256:future")
  ],
  relationships: [
    { id: "rel-create", type: "associated_with", source: { type: "creature", id: ids.create }, target: { type: "item", id: ids.same }, visibility: "public", metadata: {} },
    { id: "rel-missing", type: "located_in", source: { type: "item", id: ids.same }, target: { type: "location", id: ids.missing }, visibility: "hidden", metadata: { visibility: "hidden" } }
  ],
  geography: [{ id: "range-1" }, { id: "range-2" }], ecology: [{ id: "ecology-1" }],
  assets: [{ assetId: "a1", mimeType: "image/webp", path: "assets/a.webp" }],
  dependencies: [
    { identity: { type: "region", id: ids.unknown }, requiredBy: { type: "creature", id: ids.create }, class: "required", reason: "range" },
    { identity: { type: "location", id: ids.existingDependency }, requiredBy: { type: "creature", id: ids.create }, class: "required", reason: "ancestor" },
    { identity: { type: "hazard", id: ids.missing }, class: "required", reason: "endpoint" },
    { identity: { type: "resource", id: ids.optional }, class: "optional", reason: "context" },
    { identity: { type: "item", id: ids.same }, requiredBy: { type: "creature", id: ids.create }, class: "contextual", reason: "cycle-a" },
    { identity: { type: "creature", id: ids.create }, requiredBy: { type: "item", id: ids.same }, class: "contextual", reason: "cycle-b" }
  ]
};
const parsed = parserApi.parseAtlasPackage(raw);
assert(parsed.valid, "preview fixture package parses");
const localRecords = [
  { id: "same-local", collection: "items", externalProvenance: { ...identity("item", ids.same), sourceRevision: "4", sourceHash: "sha256:same" } },
  { id: "faction-local", collection: "factions", externalProvenance: { ...identity("faction", ids.revision), sourceRevision: "4", sourceHash: "sha256:faction" } },
  { id: "npc-local", collection: "npcs", externalProvenance: { ...identity("npc", ids.hash), sourceRevision: "7", sourceHash: "sha256:old-hash" } },
  { id: "region-local", collection: "regions", externalProvenance: { ...identity("region", ids.unknown), sourceRevision: "", sourceHash: "" } },
  { id: "location-local", collection: "locations", externalProvenance: { ...identity("location", ids.existingDependency), sourceRevision: "1", sourceHash: "sha256:location" } }
];
const localEntities = [
  { id: "name-only", entity_type: "creature", name: "Selected Wyrm", data_json: {} },
  { id: "ambiguous-a", entity_type: "item", data_json: { externalIdentity: identity("item", ids.ambiguous) } },
  { id: "ambiguous-b", entity_type: "item", data_json: { externalIdentity: identity("item", ids.ambiguous) } }
];
const counters = { match: 0, compare: 0, recordWrites: 0, entityWrites: 0, relationshipWrites: 0 };
const provenance = { ...provenanceApi, compareExternalRevision: (...args) => { counters.compare++; return provenanceApi.compareExternalRevision(...args); } };
const parsedBefore = JSON.stringify(parsed);

(async () => {
  const preview = await previewApi.buildAtlasImportPreview(parsed, {
    provenance,
    findExistingEntityForExternalIdentity: async (...args) => { counters.match++; return matchApi.findExistingEntityForExternalIdentity(...args); },
    listEntities: async () => localEntities,
    listRecords: async () => localRecords,
    isRelationshipTypeSupported: type => ["associated_with", "located_in"].includes(type),
    saveRecord: () => { counters.recordWrites++; }, createEntity: () => { counters.entityWrites++; }, createRelationship: () => { counters.relationshipWrites++; }
  }, { maxDependencyDepth: 4 });

  const byName = name => preview.entities.find(item => item.name === name);
  assert.strictEqual(byName("Selected Wyrm").proposedAction, "create", "new entity proposes create despite name-only local similarity");
  assert.strictEqual(byName("Selected Wyrm").match, "none", "name-only local entity does not match");
  assert.strictEqual(byName("Stable Relic").proposedAction, "unchanged", "exact same revision/hash is unchanged");
  assert.strictEqual(byName("Stable Relic").sourceComparison, "same", "same source comparison is explicit");
  assert.strictEqual(byName("Changed Faction").proposedAction, "update", "changed revision proposes update");
  assert.strictEqual(byName("Changed NPC").proposedAction, "update", "changed hash proposes update");
  assert.strictEqual(byName("Unknown Revision Region").proposedAction, "manual_review", "unknown revision/hash requires manual review");
  assert.strictEqual(byName("Unknown Revision Region").sourceComparison, "unknown", "unknown comparison is retained");
  assert.strictEqual(byName("Duplicate Claim Item").match, "ambiguous", "ambiguous Studio identity is detected");
  assert.strictEqual(byName("Duplicate Claim Item").proposedAction, "manual_review", "ambiguous match requires manual review");
  assert.strictEqual(byName("Future Construct").proposedAction, "unsupported", "unknown external type is unsupported without crashing");
  assert.deepStrictEqual(byName("Selected Wyrm").ownershipSummary.atlasOwned, ["geography", "habitat placement", "range", "ecology placement"], "Creature ownership summary is generated");

  const stateFor = id => preview.dependencies.find(item => item.externalIdentity.sourceEntityId === id)?.state;
  assert.strictEqual(stateFor(ids.unknown), "present_in_package", "required dependency present in package is classified");
  assert.strictEqual(stateFor(ids.existingDependency), "existing_in_studio", "required dependency already in Studio is classified");
  assert.strictEqual(stateFor(ids.missing), "missing", "required dependency missing is classified");
  assert.strictEqual(stateFor(ids.optional), "missing", "optional missing dependency remains a non-fatal preview state");
  assert(preview.warnings.some(item => item.code === "PACKAGE_DEPENDENCY_CYCLE"), "dependency cycles terminate with a warning");
  assert(preview.warnings.some(item => item.code === "REQUIRED_DEPENDENCY_UNRESOLVED"), "missing required dependency warns");

  assert.strictEqual(preview.relationships[0].proposedAction, "create_candidate", "relationship with available endpoints becomes create candidate");
  assert.strictEqual(preview.relationships[1].proposedAction, "skip", "relationship with missing endpoint is skipped safely");
  assert.strictEqual(preview.relationships[1].visibility, "hidden", "hidden relationship visibility is preserved");
  assert.strictEqual(preview.relationships[1].metadata.visibility, "hidden", "hidden relationship metadata remains structural");
  assert.deepStrictEqual(preview.totals, { create: 1, update: 2, unchanged: 1, manualReview: 2, unsupported: 1, skipped: 0 }, "package entity totals are correct");
  assert.strictEqual(preview.packageSummary.geographyRecords, 2, "geography payload is summarized without mapping");
  assert.strictEqual(preview.packageSummary.ecologyRecords, 1, "ecology payload is summarized without mapping");
  assert.strictEqual(preview.packageSummary.compiledByType.creature, 1, "selection compilation counts are exposed");
  assert(counters.match > 0, "external entity match helper is reused");
  assert(counters.compare >= 4, "provenance comparison helper is reused for exact matches");
  assert.deepStrictEqual([counters.recordWrites, counters.entityWrites, counters.relationshipWrites], [0, 0, 0], "preview performs no record, entity, or relationship writes");
  assert.strictEqual(JSON.stringify(parsed), parsedBefore, "preview does not mutate parsed package");

  const depthPreview = await previewApi.buildAtlasImportPreview(parsed, { provenance: provenanceApi, findExistingEntityForExternalIdentity: matchApi.findExistingEntityForExternalIdentity, listEntities: async () => [], listRecords: async () => [] }, { maxDependencyDepth: 0 });
  assert(depthPreview.errors.some(item => item.code === "PACKAGE_DEPENDENCY_DEPTH_EXCEEDED"), "dependency depth ceiling is enforced");
  console.log("Atlas import preview fixtures passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
