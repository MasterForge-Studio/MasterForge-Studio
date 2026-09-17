"use strict";

const assert = require("assert");
const fs = require("fs");
const parser = require("../src/interchange/atlas-package-parser.js");
const preview = require("../src/interchange/atlas-import-preview.js");
const provenance = require("../src/interchange/external-provenance.js");
const matcher = require("../src/interchange/external-entity-match.js");
const ui = require("../src/interchange/atlas-import-preview-ui.js");

const workspaceId = "11111111-1111-4111-8111-111111111111";
const creatureId = "22222222-2222-4222-8222-222222222222";
const regionId = "33333333-3333-4333-8333-333333333333";
const validPackage = {
  manifestVersion: 1,
  source: { system: "masterforge-atlas", workspaceId, workspaceRevision: "12", exportedAt: "2026-09-14T10:30:00Z" },
  selection: [{ type: "region", id: regionId, name: "Mist Coast" }],
  entities: [
    { identity: { type: "creature", id: creatureId }, name: "<script>Wyrm</script>", revision: "2", contentHash: "sha256:new", visibility: "public", data: {} },
    { identity: { type: "region", id: regionId }, name: "Mist Coast", visibility: "gm", data: { hiddenPayload: "SECRET_NEEDLE" } }
  ],
  relationships: [{ id: "edge-1", type: "native_to", source: { type: "creature", id: creatureId }, target: { type: "region", id: regionId }, visibility: "hidden", metadata: {} }],
  geography: [{ id: "geo-1" }], ecology: [{ id: "eco-1" }],
  assets: [{ assetId: "asset-1", mimeType: "image/webp", path: "assets/wyrm.webp" }],
  dependencies: [{ identity: { type: "region", id: regionId }, requiredBy: { type: "creature", id: creatureId }, class: "required", reason: "range" }]
};

const readDependencies = {
  provenance,
  matchModule: matcher,
  listEntities: async () => [],
  listRecords: async () => [],
  isRelationshipTypeSupported: type => type === "native_to"
};

(async () => {
  const controller = ui.createAtlasImportPreviewController({
    parsePackage: parser.parseAtlasPackage,
    buildPreview: preview.buildAtlasImportPreview,
    previewDependencies: readDependencies
  });
  assert.strictEqual(controller.getState().status, "empty", "workspace starts with no package loaded");

  const rawBefore = JSON.stringify(validPackage);
  await controller.loadPackageText({ fileName: "atlas.json", size: 800, text: JSON.stringify(validPackage) });
  let state = controller.getState();
  assert.strictEqual(state.status, "valid", "valid package reaches a ready preview state");
  assert.strictEqual(state.preview.entities.length, 2, "entity counts propagate into the UI state");
  assert.strictEqual(state.preview.relationships.length, 1, "relationship preview propagates into the UI state");
  assert.strictEqual(state.preview.packageSummary.geographyRecords, 1, "geography summary is retained");
  assert.strictEqual(state.preview.packageSummary.ecologyRecords, 1, "ecology summary is retained");
  assert.strictEqual(state.preview.packageSummary.assets.referenced, 1, "asset summary is retained");
  assert.strictEqual(JSON.stringify(validPackage), rawBefore, "UI loading does not mutate the input package");

  controller.setSearch("Mist Coast");
  assert.strictEqual(ui.filteredEntities(controller.getState()).length, 1, "search covers incoming entity names");
  controller.setSearch("creature:2222");
  assert.strictEqual(ui.filteredEntities(controller.getState()).length, 1, "search covers external identity text");
  controller.setSearch("SECRET_NEEDLE");
  assert.strictEqual(ui.filteredEntities(controller.getState()).length, 0, "search does not inspect hidden payload content");
  controller.setSearch("");
  controller.setTypeFilter("region");
  assert.strictEqual(ui.filteredEntities(controller.getState()).length, 1, "entity type filtering works");
  controller.setTypeFilter("all");
  controller.setActionFilter("create");
  assert.strictEqual(ui.filteredEntities(controller.getState()).length, 2, "proposed-action filtering works");

  const html = ui.renderAtlasImportPreview(controller.getState());
  assert(html.includes("Dry run — nothing will be changed"), "loaded preview has an explicit dry-run label");
  for (const count of ["Create", "Update", "Unchanged", "Manual review", "Unsupported", "Skipped"]) assert(html.includes(count), `${count} total renders`);
  assert(html.includes("2 entities") && html.includes("1 relationships") && html.includes("1 geography") && html.includes("1 ecology") && html.includes("1 assets") && html.includes("1 dependencies"), "package content counts render");
  assert(html.includes("&lt;script&gt;Wyrm&lt;/script&gt;"), "package-controlled text is escaped");
  assert(!html.includes("<script>Wyrm</script>"), "raw package markup is never rendered");
  assert(html.includes("Ownership boundaries") && html.includes("Dependencies"), "entity detail exposes review context");

  controller.setMode("relationships");
  const relationshipHtml = ui.renderAtlasImportPreview(controller.getState());
  assert(relationshipHtml.includes("Relationships") && relationshipHtml.includes("Hidden"), "relationship mode preserves visibility context");

  const actions = ui.createAtlasPreviewActions(controller, () => {});
  assert(actions.some(action => action.id === "atlas-preview-choose"), "Action Console exposes package selection");
  assert(actions.some(action => action.id === "atlas-preview-clear"), "Action Console exposes clear preview");
  assert(actions.every(action => !/\b(apply|import)\b/i.test(action.label)), "Action Console exposes no apply or import command");

  await controller.loadPackageText({ fileName: "broken.json", size: 3, text: "{" });
  assert.strictEqual(controller.getState().errors[0].code, "INVALID_PACKAGE_JSON", "malformed JSON has a safe structured error");
  await controller.loadPackageText({ fileName: "future.json", size: 100, text: JSON.stringify({ ...validPackage, manifestVersion: 99 }) });
  assert.strictEqual(controller.getState().status, "invalid", "unsupported manifests stay invalid");
  await controller.loadPackageText({ fileName: "huge.json", size: ui.MAX_PACKAGE_BYTES + 1, text: "{}" });
  assert.strictEqual(controller.getState().errors[0].code, "ATLAS_PACKAGE_TOO_LARGE", "oversized input is rejected before JSON parsing");

  controller.clear();
  state = controller.getState();
  assert.strictEqual(state.status, "empty", "clear returns to the no-package state");
  assert.strictEqual(state.preview, null, "clear retains no parsed preview");

  const source = fs.readFileSync("src/interchange/atlas-import-preview-ui.js", "utf8");
  for (const forbidden of ["saveRecord(", "createEntity(", "updateEntity(", "createRelationship(", "deleteRecord("]) assert(!source.includes(forbidden), `${forbidden} is not exposed by the preview UI`);
  const index = fs.readFileSync("src/index.html", "utf8");
  const main = fs.readFileSync("main.js", "utf8");
  const preload = fs.readFileSync("preload.js", "utf8");
  assert(index.includes('data-tab="atlas-import"') && index.includes('id="atlas-import"'), "World Building navigation exposes the Atlas preview workspace");
  assert(main.includes('ipcMain.handle("interchange:chooseAtlasPackage"') && main.includes("ATLAS_PREVIEW_MAX_FILE_BYTES"), "main process picker enforces the boundary limit");
  assert(preload.includes("chooseAtlasPackage") && !preload.includes("applyAtlasPackage"), "preload exposes selection but no apply API");
  console.log("Atlas import preview UI fixtures passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
