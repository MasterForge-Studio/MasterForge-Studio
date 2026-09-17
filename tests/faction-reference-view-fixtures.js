"use strict";

const assert = require("assert");
const fs = require("fs");
const api = require("../src/inGame/views/faction-reference-view.js");
const browserApi = require("../src/inGame/reference-browser.js");

const canonicalResult = {
  reference: { entityType: "faction", entityId: "f1" }, visibilityMode: "gm",
  canonical: { id: "f1", entity_type: "faction", name: "Galeclaw", data_json: {
    factionLore: { public: {
      symbolImage: "data:image/png;base64,AAAA", motto: "Ride the storm", concept: "A stormborne alliance", symbol: "Three silver feathers",
      currentStatus: "Mobilising", currentTrajectory: "Closing on the harbour", playerHooks: ["Win their trust"],
      goals: ["Control the skies"], methods: ["Swift raids"], resources: ["Skyships"], history: "Born in rebellion", founding: "The Tempest Accord", turningPoints: ["The first flight"]
    }, gm: { secrets: ["The admiral is compromised"], hiddenGoals: ["Awaken the storm-eye"], hiddenHistory: "The pact was forged in blood", futurePlans: "Seize the harbour" } },
    leadership: [{ id: "n1", entityType: "npc", name: "Admiral Vey", title: "Admiral" }],
    factionHierarchy: { nodes: [{ id: "r1", name: "Storm Admiral", nodeType: "rank", parentNodeIds: [] }] }
  } },
  relationships: [
    { id: "m1", type: "member_of", label: "Member of", direction: "incoming", status: "active", otherEntity: { id: "n2", type: "npc", name: "Rook" }, metadata: { role: "Scout" } },
    { id: "a1", type: "allied_with", label: "Allied with", direction: "outgoing", status: "active", otherEntity: { id: "f2", type: "faction", name: "Tideguard" }, metadata: {} },
    { id: "e1", type: "rival_of", label: "Rival of", direction: "outgoing", status: "active", otherEntity: { id: "f3", type: "faction", name: "Iron Wake" }, metadata: {} },
    { id: "n1", type: "trades_with", label: "Trades with", direction: "outgoing", status: "active", otherEntity: { id: "f4", type: "faction", name: "Freehands" }, metadata: {} },
    { id: "x1", type: "watches", label: "Watches", direction: "outgoing", status: "active", otherEntity: { id: "", type: "npc", name: "Missing agent" }, metadata: {} },
    { id: "l1", type: "based_in", label: "Based in", direction: "outgoing", status: "active", otherEntity: { id: "l1", type: "location", name: "Storm Spire" }, metadata: {} }
  ]
};

const before = JSON.stringify(canonicalResult);
const model = api.buildFactionReferenceViewModel(canonicalResult);
assert.strictEqual(model.atAGlance.emblem, "data:image/png;base64,AAAA", "emblem maps from symbolImage");
assert(!Object.hasOwn(model.atAGlance, "name") && !Object.hasOwn(model.atAGlance, "type"), "hero name/type are not duplicated in the model");
assert.strictEqual(model.currentSituation.status, "Mobilising", "current status maps");
assert.strictEqual(model.currentSituation.trajectory, "Closing on the harbour", "trajectory maps");
assert.deepStrictEqual(model.currentSituation.hooks, ["Win their trust"], "player hooks map");
assert.deepStrictEqual(model.operations.goals, ["Control the skies"], "goals map as a list");
assert.deepStrictEqual(model.operations.methods, ["Swift raids"], "methods map as a list");
assert.deepStrictEqual(model.operations.resources, ["Skyships"], "resources map as a list");
assert.strictEqual(model.history.history, "Born in rebellion", "history stays separately grouped");
assert.strictEqual(model.gm.secrets[0], "The admiral is compromised", "GM secrets map in GM mode");
assert.strictEqual(model.leadership[0].name, "Admiral Vey", "structured leadership maps");
assert.strictEqual(model.members[0].name, "Rook", "structured membership relationships map");
assert.strictEqual(model.groupedRelationships.allies[0].name, "Tideguard", "allies group by exact type");
assert.strictEqual(model.groupedRelationships.enemies[0].name, "Iron Wake", "enemies group by exact type");
assert.strictEqual(model.groupedRelationships.neutral[0].name, "Freehands", "neutral relationships group by exact type");
assert.strictEqual(model.groupedRelationships.other[0].openable, false, "missing endpoints remain safely non-clickable");
assert.strictEqual(JSON.stringify(canonicalResult), before, "view model does not mutate resolved canonical input");

const html = api.renderFactionReferenceView(model);
assert(html.includes("mf-reading-surface") && html.includes("mf-reading-section") && html.includes("mf-reading-prose"), "Faction uses shared editorial reading structure");
assert(html.includes("mf-reading-gm") && !html.includes("infoCard"), "Faction GM content is a restrained callout and ordinary prose is not card-wrapped");
assert(!html.includes("Faction emblem") && !html.includes("factionReferenceEmblem") && html.includes("Ride the storm"), "motto remains while the emblem is delegated to the shared visual rail");
assert(html.includes("Current Status") && html.includes("Player-Facing Hooks"), "live current situation renders");
assert(html.includes("Purpose &amp; Operations") && html.includes("History"), "secondary sections render separately");
assert(html.includes("GM Only") && html.includes("The admiral is compromised"), "GM section renders when authorised");
assert(html.includes('data-faction-reference-id="f2"'), "supported related entity receives shared navigation hook");
assert(!html.includes("JSON.stringify") && !html.includes("Save") && !html.includes("Delete"), "view exposes no raw JSON or writes");

const publicInput = JSON.parse(JSON.stringify(canonicalResult));
publicInput.visibilityMode = "public";
publicInput.relationships = publicInput.relationships.filter(item => item.type !== "secretly_member_of");
const publicModel = api.buildFactionReferenceViewModel(publicInput);
const publicHtml = api.renderFactionReferenceView(publicModel);
assert.strictEqual(publicModel.gm, null, "GM model is absent entirely in public mode projection");
assert(!publicHtml.includes("GM Only") && !publicHtml.includes("Hidden Goals"), "GM and hidden goal DOM is absent in public mode");
assert(!publicHtml.includes("Secretly Member"), "secret memberships absent from public projection remain absent");

const sparseModel = api.buildFactionReferenceViewModel({ canonical: { data_json: { factionLore: { public: { motto: "", resources: [] } } } }, relationships: [] });
const sparseHtml = api.renderFactionReferenceView(sparseModel);
assert(!sparseHtml.includes("Motto") && !sparseHtml.includes("Resources") && !sparseHtml.includes("History</summary>"), "blank labels and empty optional sections are omitted");
assert(sparseHtml.includes("No structured members recorded."), "structured member empty state is quiet and explicit");
assert(!sparseHtml.includes("No emblem"), "view-level content leaves missing-emblem fallback to the shared visual rail");
assert.strictEqual(api.buildFactionReferenceViewModel({ canonical: { data_json: { factionLore: { public: { symbolImage: "javascript:bad" } } } } }).atAGlance.emblem, undefined, "malformed emblem falls back safely");

let resolverCalls = 0;
const browser = browserApi.createReferenceBrowser({ resolveCanonicalEntityReference: async reference => { resolverCalls += 1; return { reference, canonical: {}, entity: {} }; } });
(async () => {
  await browser.openReference({ entityType: "faction", entityId: "f2" });
  await browser.openReference({ entityType: "faction", entityId: "f2" });
  assert.strictEqual(browser.getState().openTabs.length, 1, "duplicate related opens reuse the existing Reference Browser tab");
  assert.strictEqual(resolverCalls, 2, "each activation resolves canonical data afresh");
  const renderer = fs.readFileSync("src/renderer.js", "utf8");
  assert(renderer.includes("data-faction-reference-type") && renderer.includes("openReferenceBrowserReference"), "related clicks use the shared Reference Browser opener");
  assert(!renderer.includes('id: "reference-browser-save"'), "Faction reference adds no write action");
  console.log("Faction Reference View fixtures passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
