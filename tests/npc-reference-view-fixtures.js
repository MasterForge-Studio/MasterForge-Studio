"use strict";

const assert = require("assert");
const fs = require("fs");
const api = require("../src/inGame/views/npc-reference-view.js");
const browserApi = require("../src/inGame/reference-browser.js");

const resolved = {
  visibilityMode: "gm",
  reference: { entityType: "npc", entityId: "npc-mirror" },
  entity: { id: "npc-mirror", entity_type: "npc", name: "Wrong mirror name", description: "Wrong mirror summary", data_json: { npcId: "npc-1" } },
  canonical: {
    id: "npc-1", name: "Nara", species: "Elf", type: "Humanoid", role: "Guide", class: "Ranger", level: 5,
    image: { portrait: "data:image/png;base64,AAAA" }, overview: { summary: "A sharp-eyed harbour guide.", currentLocation: "North quay", firstMet: "Session 3" },
    personality: { appearance: "Silver braid", voice: "Measured", mannerisms: "Counts exits", ideals: "Freedom", bonds: "The harbour", flaws: "Distrustful", hook: "Knows who stole the chart", secret: "Works for the Tideguard" },
    gmNotes: "Will betray the captain if cornered."
  },
  resolvedCapabilities: { effective: {
    traits: [{ id: "keen", featureType: "trait", capabilitySection: "traits", name: "Keen Sight", description: "Sees through sea fog.", inherited: false, sourceData: {} }],
    abilities: [
      { id: "shot", featureType: "ability", capabilitySection: "actions", name: "Longbow", description: "A precise shot.", sourceData: { attackBonus: 6, range: "150/600 ft." } },
      { id: "dash", featureType: "ability", capabilitySection: "bonus-actions", name: "Harbour Dash", description: "Moves quickly." },
      { id: "parry", featureType: "ability", capabilitySection: "reactions", name: "Parry", description: "Adds to AC." },
      { id: "magic", featureType: "ability", capabilitySection: "spellcasting", name: "Ranger Magic", description: "Casts prepared spells.", inherited: true, sourceName: "Tideguard Training", sourceData: { castingAbility: "Wisdom", saveDC: 14, spellAttackBonus: "+6", atWillSpells: "Druidcraft", preparedSpells: "Fog Cloud, Hunter's Mark" } },
      { id: "rope", featureType: "ability", capabilitySection: "equipment", name: "Silk Rope", description: "50 feet", sourceData: { quantity: 1, carried: true } },
      { id: "blade", featureType: "ability", capabilitySection: "equipment", name: "Storm Blade", sourceData: { quantity: 1, equipped: true, entityType: "item", entityId: "item-1" } }
    ]
  } },
  relationships: [
    { type: "member_of", label: "Member of", direction: "outgoing", status: "active", otherEntity: { id: "f1", type: "faction", name: "Tideguard" }, metadata: { role: "Scout" } },
    { type: "knows", label: "Knows", direction: "outgoing", status: "active", otherEntity: { id: "n2", type: "npc", name: "Rook" }, metadata: {} },
    { type: "located_in", label: "Located in", direction: "outgoing", status: "active", otherEntity: { id: "l1", type: "location", name: "North Quay" }, metadata: {} },
    { type: "hunts", label: "Hunts", direction: "outgoing", status: "active", otherEntity: { id: "c1", type: "creature", name: "Fog Drake" }, metadata: {} }
  ]
};

const snapshot = JSON.stringify(resolved);
const model = api.buildNpcReferenceViewModel(resolved);
assert.strictEqual(model.atAGlance.portrait, "data:image/png;base64,AAAA", "portrait maps safely");
assert.strictEqual(model.atAGlance.summary, "A sharp-eyed harbour guide.", "canonical summary maps");
assert(!JSON.stringify(model).includes("Wrong mirror summary"), "NPC mirror content is not used as primary content");
assert.strictEqual(model.atAGlance.currentLocation, "North quay", "current location maps");
assert.strictEqual(model.atAGlance.firstMet, "Session 3", "first met maps");
assert.strictEqual(model.roleplay.appearance, "Silver braid", "appearance maps");
assert.strictEqual(model.roleplay.voice, "Measured", "voice maps");
assert.strictEqual(model.roleplay.mannerisms, "Counts exits", "mannerisms map");
assert.strictEqual(model.roleplay.ideals, "Freedom", "ideals map");
assert.strictEqual(model.roleplay.bonds, "The harbour", "bonds map");
assert.strictEqual(model.roleplay.flaws, "Distrustful", "flaws map");
assert.strictEqual(model.hook, "Knows who stole the chart", "hook maps");
assert.deepStrictEqual(model.capabilities.traits.map(item => item.name), ["Keen Sight"], "traits map from resolved capabilities");
assert.deepStrictEqual(model.capabilities.actions.map(item => item.name), ["Longbow"], "actions map from resolved capabilities");
assert.deepStrictEqual(model.capabilities["bonus-actions"].map(item => item.name), ["Harbour Dash"], "bonus actions map");
assert.deepStrictEqual(model.capabilities.reactions.map(item => item.name), ["Parry"], "reactions map");
assert.strictEqual(model.capabilities.spellcasting[0].castingAbility, "Wisdom", "structured spellcasting maps");
assert.strictEqual(model.capabilities.spellcasting.filter(item => item.id === "magic").length, 1, "inherited capabilities appear once");
assert.deepStrictEqual(model.equipment.map(item => item.name), ["Silk Rope", "Storm Blade"], "equipment maps from authoritative resolved capabilities");
assert.strictEqual(model.relationships.factions[0].name, "Tideguard", "Faction relationship groups");
assert.strictEqual(model.relationships.npcs[0].name, "Rook", "NPC relationship groups");
assert.strictEqual(model.relationships.locations[0].openable, false, "unsupported linked types remain read-only");
assert.strictEqual(model.gm.secret, "Works for the Tideguard", "secret maps in GM mode");
assert.strictEqual(JSON.stringify(resolved), snapshot, "model does not mutate the resolved reference");

const html = api.renderNpcReferenceView(model);
assert(html.includes("mf-reading-surface") && html.includes("mf-reading-section") && html.includes("mf-reading-prose"), "NPC uses shared editorial reading structure");
assert(html.includes("npcReferenceHook mf-reading-callout") && html.includes("mf-reading-gm") && !html.includes("infoCard"), "NPC hook and GM notes retain emphasis without prose cards");
assert(!html.includes("NPC portrait") && !html.includes("npcReferencePortrait") && html.includes("A sharp-eyed harbour guide."), "summary remains while the portrait is delegated to the shared visual rail");
assert(html.includes("Appearance") && html.includes("Voice") && html.includes("Mannerisms") && html.includes("Ideals") && html.includes("Bonds") && html.includes("Flaws"), "roleplay fields render");
assert(html.includes("Knows who stole the chart") && html.includes("npcReferenceHook"), "hook is prominent");
assert(html.includes("Combat &amp; Abilities") && html.includes("Longbow") && html.includes("Bonus Actions") && html.includes("Parry"), "capability groups render");
assert(html.includes("Ranger Magic") && html.includes("Save DC 14") && html.includes("Prepared / Known"), "spellcasting details render");
assert(html.includes("Silk Rope") && html.includes('data-npc-reference-id="item-1"'), "equipment and linked Item navigation render");
assert(html.includes('data-npc-reference-id="f1"') && html.includes('data-npc-reference-id="n2"'), "Faction and NPC relationship navigation render");
assert(!html.includes('data-npc-reference-id="l1"'), "unsupported relationship is not interactive");
assert(html.includes("GM Notes") && html.includes("Works for the Tideguard"), "GM notes render when authorised");
assert(!html.includes("JSON.stringify") && !/>\s*(?:Save|Delete|Edit)(?:\s+NPC)?\s*</i.test(html), "view has no raw JSON or write controls");

const publicResolved = JSON.parse(JSON.stringify(resolved));
publicResolved.visibilityMode = "public";
publicResolved.resolvedCapabilities.effective.abilities = publicResolved.resolvedCapabilities.effective.abilities.filter(item => item.id !== "dash");
publicResolved.relationships = publicResolved.relationships.filter(item => item.otherEntity.id !== "n2");
const publicModel = api.buildNpcReferenceViewModel(publicResolved);
const publicHtml = api.renderNpcReferenceView(publicModel);
assert.strictEqual(publicModel.gm, null, "GM model is absent entirely in public mode");
assert(!publicHtml.includes("Works for the Tideguard") && !publicHtml.includes("GM Notes"), "secret and private notes are absent from public DOM");
assert(!publicHtml.includes("Harbour Dash"), "hidden inherited capabilities excluded by resolver remain absent");
assert(!publicHtml.includes("Rook"), "hidden relationships excluded by resolver remain absent");

const sparseModel = api.buildNpcReferenceViewModel({ visibilityMode: "gm", canonical: { image: { portrait: "javascript:bad" }, overview: {}, personality: {} }, resolvedCapabilities: { effective: { traits: [], abilities: [] } }, relationships: [] });
const sparseHtml = api.renderNpcReferenceView(sparseModel);
assert.strictEqual(sparseModel.atAGlance.portrait, undefined, "malformed portrait is rejected safely");
assert(!sparseHtml.includes("No portrait"), "view-level content leaves missing-portrait fallback to the shared visual rail");
assert(!sparseHtml.includes("Roleplay</summary>") && !sparseHtml.includes("Combat &amp; Abilities") && !sparseHtml.includes("Equipment</summary>") && !sparseHtml.includes("Relationships</summary>") && !sparseHtml.includes("GM Notes"), "empty sections and labels are omitted");

let writes = 0;
const browser = browserApi.createReferenceBrowser({ resolveCanonicalEntityReference: async reference => ({ reference, canonical: {}, entity: {} }), save: () => { writes += 1; } });
(async () => {
  await browser.openReference({ entityType: "item", entityId: "item-1" });
  await browser.openReference({ entityType: "item", entityId: "item-1" });
  assert.strictEqual(browser.getState().openTabs.length, 1, "shared opener deduplicates linked Item tabs");
  assert.strictEqual(writes, 0, "read-only navigation invokes no write API");
  const renderer = fs.readFileSync("src/renderer.js", "utf8");
  assert(renderer.includes("data-npc-reference-type") && renderer.includes("openReferenceBrowserReference"), "NPC links use shared Reference Browser navigation");
  console.log("NPC Reference View fixtures passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
