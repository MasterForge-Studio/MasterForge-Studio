"use strict";

const assert = require("assert");
const { parseAtlasPackage } = require("../src/interchange/atlas-package-parser.js");

const workspaceId = "11111111-1111-4111-8111-111111111111";
const creatureId = "22222222-2222-4222-8222-222222222222";
const regionId = "33333333-3333-4333-8333-333333333333";
const validPackage = {
  manifestVersion: 1,
  source: { system: "masterforge-atlas", workspaceId, exportedAt: "2026-09-14T10:30:00Z", workspaceRevision: "184" },
  selection: [{ type: "region", id: regionId, name: "Mistcliff Coast" }],
  entities: [
    { identity: { type: "creature", id: creatureId }, revision: "44", contentHash: "sha256:creature", visibility: "public", name: "Cinderwatch Wyrm", data: { description: "A storm predator." }, futureEntityField: { retained: true } },
    { identity: { type: "region", id: regionId }, revision: "185", contentHash: "sha256:region", visibility: { audience: "public" }, name: "Mistcliff Coast", data: { biomes: ["coastal"] } },
    { identity: { type: "future_construct", id: "44444444-4444-4444-8444-444444444444" }, name: "Unknown Future Type", data: { custom: true } }
  ],
  relationships: [{ id: "55555555-5555-4555-8555-555555555555", type: "native_to", source: { type: "creature", id: creatureId }, target: { type: "region", id: regionId }, visibility: "hidden", metadata: { frequency: "common", visibility: "hidden" }, revision: "2", contentHash: "sha256:edge" }],
  geography: [{ id: "geo-1", owner: { type: "region", id: regionId }, geometryReference: "preserved", unknown: true }],
  ecology: [{ id: "eco-1", owner: { type: "creature", id: creatureId }, habitat: ["cliffs"] }],
  assets: [{ assetId: "asset-1", mimeType: "image/webp", path: "assets/wyrm.webp", visibility: "public" }, { assetId: "asset-2", mimeType: "application/x-future", url: "https://example.invalid/a" }, { path: "missing-id.png" }],
  dependencies: [{ identity: { type: "region", id: regionId }, requiredBy: { type: "creature", id: creatureId }, class: "required", reason: "relationship-endpoint", visibility: "public" }],
  futureTopLevel: { preserved: true }
};

const before = JSON.stringify(validPackage);
const parsed = parseAtlasPackage(validPackage);
assert(parsed.valid, "valid v1 Atlas package parses");
assert.strictEqual(parsed.manifestVersion, 1, "manifest version normalises");
assert.strictEqual(parsed.source.system, "masterforge-atlas", "Atlas source validates");
assert.strictEqual(parsed.entities[0].externalIdentity.sourceWorkspaceId, workspaceId, "valid Atlas UUID identity accepted");
assert.strictEqual(parsed.entities[0].sourceRevision, "44", "entity revision normalises");
assert.strictEqual(parsed.entities[0].payload.description, "A storm predator.", "entity remains package-neutral payload");
assert.deepStrictEqual(parsed.entities[0].rawExtensions.futureEntityField, { retained: true }, "unknown entity fields remain inspectable");
assert.strictEqual(parsed.entities[2].supported, false, "unknown future entity type is preserved as unsupported");
assert(parsed.entities[2].warnings.some(item => item.code === "UNSUPPORTED_EXTERNAL_ENTITY_TYPE"), "unsupported type warning is explicit");
assert.strictEqual(parsed.relationships[0].sourceExternalIdentity.sourceEntityId, creatureId, "relationship source endpoint normalises");
assert.strictEqual(parsed.relationships[0].targetExternalIdentity.sourceEntityId, regionId, "relationship target endpoint normalises");
assert.strictEqual(parsed.relationships[0].visibility, "hidden", "relationship visibility metadata is preserved");
assert.strictEqual(parsed.relationships[0].metadata.visibility, "hidden", "nested relationship visibility remains structural");
assert.deepStrictEqual(parsed.geography, validPackage.geography, "geography block is preserved without mapping");
assert.deepStrictEqual(parsed.ecology, validPackage.ecology, "ecology block is preserved without mapping");
assert.deepStrictEqual(parsed.assets.map(item => item.previewKind), ["referenced", "unsupported", "missing_metadata"], "asset descriptors receive read-only preview classifications");
assert.deepStrictEqual(parsed.extensions.futureTopLevel, { preserved: true }, "unknown top-level fields survive");
assert.strictEqual(JSON.stringify(validPackage), before, "parser does not mutate input object");

const minimal = parseAtlasPackage({ manifestVersion: 1, source: { system: "masterforge-atlas", workspaceId } });
for (const key of ["selection", "entities", "relationships", "geography", "ecology", "assets", "dependencies"]) assert.deepStrictEqual(minimal[key], [], `${key} defaults to an empty array`);
assert(!parseAtlasPackage({ ...validPackage, manifestVersion: 2 }).valid && parseAtlasPackage({ ...validPackage, manifestVersion: 2 }).errors.some(item => item.code === "UNSUPPORTED_MANIFEST_VERSION"), "unsupported manifest version is rejected");
assert(!parseAtlasPackage({ ...validPackage, source: { ...validPackage.source, system: "other-tool" } }).valid, "wrong source system is rejected");
assert(!parseAtlasPackage({ ...validPackage, source: { system: "masterforge-atlas" } }).valid, "missing workspace ID is rejected");
assert(parseAtlasPackage({ ...validPackage, entities: [{ identity: { type: "creature", id: "not-a-uuid" } }] }).errors.some(item => item.code === "MALFORMED_PACKAGE_ENTITY_IDENTITY"), "malformed entity identity is rejected");
assert(parseAtlasPackage({ ...validPackage, relationships: [{ id: "bad", type: "native_to", source: { type: "creature", id: creatureId } }] }).errors.some(item => item.code === "MALFORMED_RELATIONSHIP_ENDPOINT"), "missing relationship endpoint is rejected structurally");
assert(parseAtlasPackage({ ...validPackage, dependencies: [{ class: "required" }] }).errors.some(item => item.code === "MALFORMED_DEPENDENCY_REFERENCE"), "malformed dependency is rejected");
assert(parseAtlasPackage({ ...validPackage, entities: [validPackage.entities[0], validPackage.entities[0]] }).errors.some(item => item.code === "DUPLICATE_PACKAGE_EXTERNAL_IDENTITY"), "duplicate package external identity is a hard error");
assert(parseAtlasPackage(validPackage, { limits: { maxEntities: 1 } }).errors.some(item => item.code === "PACKAGE_ENTITY_LIMIT_EXCEEDED"), "entity graph ceiling is enforced");
assert(!parseAtlasPackage(null).valid, "invalid package shape returns structured error");

console.log("Atlas package parser fixtures passed.");
