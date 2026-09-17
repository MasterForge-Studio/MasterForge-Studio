"use strict";

const assert = require("assert");
const fs = require("fs");
const api = require("../src/inGame/reference-browser.js");

const entities = [
  { id: "n1", entity_type: "npc", name: "Nara", description: "Harbour guide", data_json: { visibility: { pinned: true }, secret: "not indexed" } },
  { id: "c1", entity_type: "creature", name: "Beholder", description: "Aberration" },
  { id: "f1", entity_type: "faction", name: "Galeclaw", description: "Storm faction" },
  { id: "i1", entity_type: "item", name: "Storm Eye", description: "Relic" },
  { id: "q1", entity_type: "quest", name: "Unsupported", description: "Not shown" }
];
const index = api.createReferenceIndex(entities);
assert.deepStrictEqual(index.map(item => item.entityType), ["npc", "creature", "faction", "item"], "unsupported types are excluded");
assert.deepStrictEqual(api.filterReferenceIndex(index, { entityType: "creature" }).map(item => item.name), ["Beholder"], "supported type filtering works");
assert.deepStrictEqual(api.filterReferenceIndex(index, { search: "beh" }).map(item => item.name), ["Beholder"], "name search works");
assert.deepStrictEqual(api.filterReferenceIndex(index, { search: "aberration" }).map(item => item.name), ["Beholder"], "basic description search works");
assert.strictEqual(api.filterReferenceIndex(index, { search: "not indexed" }).length, 0, "GM secret data is not searchable");
assert.deepStrictEqual(api.groupReferenceIndex(index).pinned.map(item => item.entityId), ["n1"], "canonical pinned visibility drives grouping");

let tick = 100;
let writes = 0;
const resolverCalls = [];
const browser = api.createReferenceBrowser({
  maxOpenTabs: 3,
  maxRecent: 3,
  now: () => ++tick,
  resolveCanonicalEntityReference: async (reference, options) => {
    resolverCalls.push({ reference: { ...reference }, options: { ...options } });
    if (reference.entityId === "deleted") return { reference, entity: null, canonical: null, warnings: [{ code: "ENTITY_NOT_FOUND" }] };
    return { reference, entity: { id: reference.entityId }, canonical: { id: reference.entityId, sourceTitle: "Guide", sourceReference: "Page 4" }, relationships: [] };
  },
  save: () => { writes += 1; }
});

(async () => {
  const opened = await browser.openReference({ entityType: "creature", entityId: "c1" });
  assert.strictEqual(resolverCalls.length, 1, "opening a reference calls the canonical resolver");
  assert.strictEqual(resolverCalls[0].options.visibilityMode, "gm", "GM visibility mode is passed by default");
  assert.strictEqual(resolverCalls[0].options.includeRelationships, true, "relationship descriptors are retained for future links");
  assert.strictEqual(opened.resolved.canonical.sourceReference, "Page 4", "source reference survives resolver presentation input");
  assert.deepStrictEqual(browser.getState().openTabs, [{ entityType: "creature", entityId: "c1" }], "open state stores references only");

  await browser.openReference({ entityType: "faction", entityId: "f1" });
  await browser.openReference({ entityType: "creature", entityId: "c1" });
  assert.strictEqual(browser.getState().openTabs.length, 2, "opening an existing tab does not duplicate it");
  assert.strictEqual(browser.getState().activeTab, "creature:c1", "duplicate open activates the existing tab");
  assert.deepStrictEqual(browser.getState().recent.map(item => item.entityId), ["c1", "f1"], "Recent references deduplicate and sort newest first");

  await browser.openReference({ entityType: "npc", entityId: "n1" });
  await browser.openReference({ entityType: "item", entityId: "i1" });
  assert.deepStrictEqual(browser.getState().openTabs.map(item => item.entityId), ["f1", "n1", "i1"], "maximum tabs evicts the oldest read-only tab");
  assert.strictEqual(browser.getState().recent.length, 3, "Recent references respect their maximum");

  browser.activateReference({ entityType: "npc", entityId: "n1" });
  browser.closeReference({ entityType: "npc", entityId: "n1" });
  assert.strictEqual(browser.getState().activeTab, "item:i1", "closing the active tab selects a neighboring fallback");
  assert.strictEqual(browser.closeReference({ entityType: "faction", entityId: "missing" }), false, "closing a missing tab is safe");

  const missing = await browser.openReference({ entityType: "npc", entityId: "deleted" });
  assert.strictEqual(missing.resolved.entity, null, "missing Recent/reference resolution returns a safe result");
  assert.strictEqual(writes, 0, "reference state never invokes write APIs");

  const renderer = fs.readFileSync("src/renderer.js", "utf8");
  const html = fs.readFileSync("src/index.html", "utf8");
  assert(html.includes('data-tab="reference-browser"'), "In Game navigation contains Reference Browser");
  assert(html.includes('id="reference-browser"'), "Reference Browser panel exists");
  assert(renderer.includes("canonicalResolver.resolveCanonicalEntityReference"), "renderer presentation is connected to the canonical resolver");
  assert(!renderer.includes("referenceBrowserResolved = entity"), "NPC and Creature mirrors are not assigned as presentation data");
  assert(!renderer.includes("JSON.stringify(referenceBrowserResolved"), "Reference Browser does not render raw JSON");
  assert(!renderer.includes('id: "reference-browser-save"') && !renderer.includes('id: "reference-browser-delete"'), "Reference Browser exposes no save or delete actions");
  assert(renderer.includes('id: "reference-browser-pin"') && renderer.includes("handler: toggleActiveReferencePin"), "Pin / Unpin remains available through the Action Console");
  assert(renderer.includes("mf-reading-layout") && renderer.includes("mf-reading-visual-rail") && renderer.includes("mf-reading-figure-image") && renderer.includes("mf-reading-figure-placeholder"), "Reference Browser emits the shared reading layout and safe visual rail states");
  assert(!renderer.includes("data-reference-pin") && !renderer.includes("data-reference-close") && !renderer.includes("data-reference-open-library"), "Reference Browser emits no duplicate inline page actions");

  console.log("Reference Browser fixtures passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
