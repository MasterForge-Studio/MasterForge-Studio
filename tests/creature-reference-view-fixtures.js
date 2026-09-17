"use strict";

const assert = require("assert");
const fs = require("fs");
const api = require("../src/inGame/views/creature-reference-view.js");
const browserApi = require("../src/inGame/reference-browser.js");
globalThis.MasterForgeCreatureEcology = require("../src/creatures/creature-ecology.js");

const gameSystems = {
  getRules: () => ({ attributes: [
    { id: "strength", shortLabel: "STR" }, { id: "dexterity", shortLabel: "DEX" }, { id: "constitution", shortLabel: "CON" },
    { id: "intelligence", shortLabel: "INT" }, { id: "wisdom", shortLabel: "WIS" }, { id: "charisma", shortLabel: "CHA" }
  ] }),
  readAttribute: (record, id) => record.stats[{ strength: "str", dexterity: "dex", constitution: "con", intelligence: "int", wisdom: "wis", charisma: "cha" }[id]],
  readSemantic: (record, role) => ({ primaryDefence: record.stats.ac, maximumHealth: record.stats.hp, movement: record.stats.speed, threat: record.cr, proficiency: record.proficiencyBonus })[role]
};
const resolved = {
  visibilityMode: "gm", reference: { entityType: "creature", entityId: "creature-mirror" },
  entity: { id: "creature-mirror", entity_type: "creature", name: "Wrong mirror", description: "Wrong mirror description", data_json: { creatureId: "creature-1" } },
  canonical: {
    id: "creature-1", name: "Storm Drake", image: { portrait: "data:image/webp;base64,AAAA" }, description: "A predator veiled in thunder.",
    size: "Large", type: "Dragon", alignment: "Chaotic Neutral", environment: "Coastal, Mountains", tags: "storm; flying",
    ecology: {
      behaviour: "Territorial ambush predator.", temperament: "Aggressive near its lair.", diet: "Large fish and seabirds.",
      socialStructure: "Primarily solitary.", activityCycle: "Nocturnal and crepuscular.",
      reproductiveNotes: "Nests once each storm season.", ecologyNotes: "Controls coastal prey populations.",
      habitatPreferences: { biomes: ["coastal"], terrain: ["cliffs", "caves"], climate: ["stormy"], waterProximity: ["shoreline"], humidity: [] }
    },
    cr: "8", proficiencyBonus: "+3", stats: { ac: 17, hp: 136, speed: "40 ft., fly 80 ft.", str: 21, dex: 14, con: 19, int: 9, wis: 13, cha: 15 },
    savingThrows: "Dex +5, Con +7", skills: "Perception +7", damageVulnerabilities: "", damageResistances: "Lightning", damageImmunities: "Thunder", conditionImmunities: "Prone", senses: "Darkvision 120 ft.", passivePerception: 17, languages: "Draconic",
    loot: [{ name: "Storm Scale", quantity: "1d4", value: "50 gp", notes: "Crackles faintly" }, { name: "Heart Crystal", quantity: 1, itemEntityId: "item-1" }],
    foundInLocationIds: ["location-1"]
  },
  resolvedCapabilities: { categories: [
    { id: "traits", pluralLabel: "Traits", entries: [{ id: "storm-hide", name: "Storm Hide", description: "Ignores severe wind." }] },
    { id: "actions", pluralLabel: "Actions", entries: [{ id: "bite", name: "Bite", description: "A crushing bite.", attackBonus: 8, reach: "10 ft.", damage: "2d10+5", damageType: "piercing" }, { id: "inherited", name: "Sky Rend", description: "Inherited strike.", inherited: true, provenance: "From Ability Pack: Tempest" }] },
    { id: "bonus-actions", pluralLabel: "Bonus Actions", entries: [{ id: "wing-step", name: "Wing Step" }] },
    { id: "reactions", pluralLabel: "Reactions", entries: [{ id: "deflect", name: "Deflect Missile" }] },
    { id: "legendary-actions", pluralLabel: "Legendary Actions", entries: [{ id: "detect", name: "Detect" }] },
    { id: "lair-actions", pluralLabel: "Lair Actions", entries: [{ id: "gale", name: "Sudden Gale" }] },
    { id: "spellcasting", pluralLabel: "Spellcasting", entries: [{ id: "magic", name: "Storm Magic", castingAbility: "Charisma", saveDC: 15, spellAttackBonus: "+7", spellSlots: "3/2", preparedSpells: "Gust, Lightning Bolt" }] }
  ] },
  relationships: [
    { type: "allied_with", label: "Allied with", direction: "outgoing", status: "active", otherEntity: { id: "f1", type: "faction", name: "Galeclaw" }, metadata: {} },
    { type: "hunts_with", label: "Hunts with", direction: "outgoing", status: "active", otherEntity: { id: "c2", type: "creature", name: "Cloud Raptor" }, metadata: {} },
    { type: "bonded_to", label: "Bonded to", direction: "outgoing", status: "active", otherEntity: { id: "n1", type: "npc", name: "Rook" }, metadata: {} },
    { type: "found_in", label: "Found in", direction: "outgoing", status: "active", otherEntity: { id: "location-1", type: "location", name: "Thunder Crag" }, metadata: {} }
    ,{ type: "preys_on", label: "Preys on", direction: "outgoing", status: "active", otherEntity: { id: "prey-1", type: "creature", name: "Cliff Grazer" }, metadata: {} }
    ,{ type: "preys_on", label: "Preys on", direction: "incoming", status: "active", otherEntity: { id: "predator-1", type: "creature", name: "Sky Leviathan" }, metadata: {} }
    ,{ type: "hunted_by", label: "Hunted by", direction: "outgoing", status: "active", otherEntity: { id: "hunter-1", type: "npc", name: "Mara Venn" }, metadata: {} }
    ,{ type: "symbiotic_with", label: "Symbiotic with", direction: "incoming", status: "active", otherEntity: { id: "symbiote-1", type: "creature", name: "Spark Mite" }, metadata: {} }
    ,{ type: "parasitic_on", label: "Parasitic on", direction: "incoming", status: "active", otherEntity: { id: "parasite-1", type: "creature", name: "Cloud Leech" }, metadata: {} }
    ,{ type: "competes_with", label: "Competes with", direction: "outgoing", status: "active", otherEntity: { id: "competitor-1", type: "faction", name: "Ashwing Brood" }, metadata: {} }
    ,{ type: "domesticated_by", label: "Domesticated by", direction: "outgoing", status: "active", otherEntity: { id: "domesticator-1", type: "faction", name: "Cliff Riders" }, metadata: {} }
    ,{ type: "scavenges_from", label: "Scavenges from", direction: "outgoing", status: "active", otherEntity: { id: "source-1", type: "creature", name: "Deep Whale" }, metadata: {} }
    ,{ type: "avoids", label: "Avoids", direction: "outgoing", status: "active", otherEntity: { id: "avoided-1", type: "item", name: "Storm Bell" }, metadata: {} }
    ,{ type: "attracted_to", label: "Attracted to", direction: "outgoing", status: "active", otherEntity: { id: "attraction-1", type: "location", name: "Lightning Spire" }, metadata: {} }
  ]
};

const before = JSON.stringify(resolved);
const model = api.buildCreatureReferenceViewModel(resolved, { gameSystems });
assert(!Object.hasOwn(model.atAGlance, "image"), "At a Glance leaves canonical artwork to the shared hero");
assert.strictEqual(model.atAGlance.description, "A predator veiled in thunder.", "description maps");
assert(!JSON.stringify(model).includes("Wrong mirror description"), "URE mirror is not used as primary content");
assert.deepStrictEqual(model.atAGlance.classification, ["Large", "Dragon"], "classification maps without duplicating alignment");
assert.strictEqual(model.atAGlance.alignment, "Chaotic Neutral", "alignment maps independently");
assert.deepStrictEqual(model.atAGlance.environment, ["Coastal", "Mountains"], "environment maps");
assert.deepStrictEqual(model.atAGlance.tags, ["storm", "flying"], "tags map");
assert.strictEqual(model.atAGlance.ecology.behaviour, "Territorial ambush predator.", "behaviour maps");
assert.strictEqual(model.atAGlance.ecology.temperament, "Aggressive near its lair.", "temperament maps");
assert.strictEqual(model.atAGlance.ecology.diet, "Large fish and seabirds.", "diet maps");
assert.strictEqual(model.atAGlance.ecology.socialStructure, "Primarily solitary.", "social structure maps");
assert.strictEqual(model.atAGlance.ecology.activityCycle, "Nocturnal and crepuscular.", "activity cycle maps");
assert.deepStrictEqual(model.atAGlance.habitatGroups.map(group => group.label), ["Biomes", "Terrain", "Climate", "Water Proximity"], "populated habitat categories map and empty categories are omitted");
assert(model.atAGlance.habitatGroups.find(group => group.label === "Terrain").values.includes("caves"), "terrain values map");
assert.strictEqual(model.atAGlance.ecologicalRelationships.find(group => group.label === "Prey").entries[0].name, "Cliff Grazer", "outgoing prey maps");
assert.strictEqual(model.atAGlance.ecologicalRelationships.find(group => group.label === "Predators / Natural Threats").entries[0].name, "Sky Leviathan", "incoming prey uses inverse predator presentation");
assert.strictEqual(model.atAGlance.ecologicalRelationships.find(group => group.label === "Predators / Natural Threats").entries[0].label, "Preyed On By", "incoming prey uses the relationship registry's inverse wording");
assert.strictEqual(model.atAGlance.ecologicalRelationships.find(group => group.label === "Parasites / Parasitic Relationships").entries[0].direction, "incoming", "parasitic relationship direction is preserved");
for (const label of ["Hunted By", "Symbiotic With", "Parasites / Parasitic Relationships", "Competes With", "Domesticated By", "Scavenges From", "Avoids", "Attracted To"]) assert(model.atAGlance.ecologicalRelationships.some(group => group.label === label), `${label} ecology relationship maps`);
assert(!model.relationships.creatures.some(item => item.name === "Cliff Grazer"), "ecological relationship is suppressed from generic relationships presentation");
assert(model.stats.core.some(item => item.label === "AC" && item.value === "17"), "AC maps through system semantics");
assert(model.stats.core.some(item => item.label === "Maximum HP" && item.value === "136"), "HP maximum maps as reference data");
assert(!Object.hasOwn(model.stats, "currentHP") && !Object.hasOwn(model, "snapshot"), "no current HP or combat snapshot is created");
assert(model.stats.core.some(item => item.label === "Movement" && item.value.includes("fly")), "movement maps");
assert.strictEqual(model.stats.details["Saving Throws"], "Dex +5, Con +7", "saving throws map");
assert.strictEqual(model.stats.details.Skills, "Perception +7", "skills map");
assert.strictEqual(model.stats.details.Resistances, "Lightning", "resistances map");
assert.strictEqual(model.stats.details.Immunities, "Thunder", "immunities map");
assert.strictEqual(model.stats.details.Senses, "Darkvision 120 ft.", "senses map");
assert(model.stats.core.some(item => item.label === "Challenge" && item.value === "8"), "challenge maps");
assert.strictEqual(model.traits[0].entries[0].name, "Storm Hide", "traits map from resolved profile");
assert.deepStrictEqual(model.actions.map(group => group.id), ["actions", "bonus-actions", "reactions", "legendary-actions", "lair-actions"], "action categories remain grouped");
assert.strictEqual(model.actions.flatMap(group => group.entries).filter(item => item.id === "inherited").length, 1, "resolved inherited capability appears once without re-merging");
assert.strictEqual(model.spellcasting[0].entries[0].castingAbility, "Charisma", "spellcasting maps");
assert.deepStrictEqual(model.loot.map(item => item.name), ["Storm Scale", "Heart Crystal"], "structured loot maps");
assert.strictEqual(model.relationships.creatures[0].name, "Cloud Raptor", "Creature relationships group");
assert.strictEqual(model.relationships.npcs[0].name, "Rook", "NPC relationships group");
assert.strictEqual(model.relationships.factions[0].name, "Galeclaw", "Faction relationships group");
assert.strictEqual(model.relationships.locations[0].openable, false, "unsupported Location stays read-only");
assert.strictEqual(JSON.stringify(resolved), before, "canonical resolved data is not mutated");

const html = api.renderCreatureReferenceView(model);
assert(html.includes("mf-reading-surface") && html.includes("mf-reading-section") && html.includes("mf-reading-prose"), "Creature uses shared editorial reading structure");
assert(html.includes("mf-reading-stat") && !html.includes("infoCard"), "Creature stat profile remains structured without nested application cards");
assert(!html.includes("Creature artwork") && !html.includes("creatureReferenceImage") && html.includes("A predator veiled in thunder."), "artwork is not duplicated and description renders");
assert(html.includes("Territorial ambush predator.") && html.includes("Habitat Preferences") && html.includes("shoreline"), "ecology and structured habitat render");
assert(html.includes("Ecological Relationships") && html.includes("Predators / Natural Threats") && html.includes('data-creature-reference-id="prey-1"'), "ecology relationships render with shared navigation hooks");
assert.strictEqual((html.match(/Cliff Grazer/g) || []).length, 1, "ecological relationships are not duplicated later");
assert(html.includes("Ecology Notes</summary>") && html.includes("Controls coastal prey populations.") && html.includes("Nests once each storm season."), "ecology and reproductive notes render in their own collapsed section");
assert(html.includes("Maximum HP") && !html.includes("Current HP"), "only reference maximum HP renders");
assert(html.includes("Storm Hide") && html.includes("Bite") && html.includes("Wing Step") && html.includes("Deflect Missile") && html.includes("Detect") && html.includes("Sudden Gale"), "traits and all populated action groups render");
assert(html.includes("Storm Magic") && html.includes("Save DC 15") && html.includes("Prepared / Known"), "spellcasting renders");
assert(html.includes("Storm Scale") && html.includes('data-creature-reference-id="item-1"'), "loot and linked Item render");
assert(html.includes('data-creature-reference-id="c2"') && html.includes('data-creature-reference-id="n1"') && html.includes('data-creature-reference-id="f1"'), "supported relationships expose shared navigation hooks");
assert(!html.includes('data-creature-reference-id="location-1"'), "Location remains non-interactive");
assert(!/>(?:Save|Delete|Edit|Damage|Heal|Initiative|Add to Combat)</i.test(html) && !html.includes("JSON.stringify"), "no writes, combat controls, or raw JSON render");
assert(!html.includes('"habitatPreferences"') && !html.includes('"ecologyNotes"'), "raw ecology JSON is not rendered");

const publicResolved = JSON.parse(JSON.stringify(resolved));
publicResolved.visibilityMode = "public";
publicResolved.resolvedCapabilities.categories[1].entries = publicResolved.resolvedCapabilities.categories[1].entries.filter(item => item.id !== "inherited");
publicResolved.relationships = publicResolved.relationships.filter(item => !["n1", "prey-1"].includes(item.otherEntity.id));
const publicHtml = api.renderCreatureReferenceView(api.buildCreatureReferenceViewModel(publicResolved, { gameSystems }));
assert(!publicHtml.includes("Sky Rend"), "hidden capability absent from authorised public profile stays absent");
assert(!publicHtml.includes("Rook"), "secret relationship absent from authorised public relationships stays absent");
assert(!publicHtml.includes("Cliff Grazer"), "secret ecology relationship absent from authorised public relationships stays absent");

const sparse = api.buildCreatureReferenceViewModel({ canonical: { image: { portrait: "file:not-safe" } }, resolvedCapabilities: { categories: [] }, relationships: [] }, { gameSystems: { getRules: () => ({ attributes: [] }) } });
const sparseHtml = api.renderCreatureReferenceView(sparse);
assert.strictEqual(sparse.atAGlance.image, undefined, "legacy Creature adds no At a Glance image model");
assert(!sparseHtml.includes("Habitat Preferences") && !sparseHtml.includes("Ecology Notes</summary>"), "legacy Creature omits empty ecology shells");
assert(!sparseHtml.includes("creatureReferenceImage"), "At a Glance has no image-height layout requirement");
assert(!sparseHtml.includes("Spellcasting</summary>") && !sparseHtml.includes("Loot</summary>") && !sparseHtml.includes("Relationships &amp; Locations"), "empty sections and blank labels are omitted");

let writes = 0;
const browser = browserApi.createReferenceBrowser({ resolveCanonicalEntityReference: async referenceValue => ({ reference: referenceValue, canonical: {}, entity: {} }), save: () => { writes += 1; } });
(async () => {
  await browser.openReference({ entityType: "item", entityId: "item-1" });
  await browser.openReference({ entityType: "item", entityId: "item-1" });
  assert.strictEqual(browser.getState().openTabs.length, 1, "shared Reference Browser navigation deduplicates linked Items");
  assert.strictEqual(writes, 0, "view/navigation invokes no write API");
  const renderer = fs.readFileSync("src/renderer.js", "utf8");
  assert(renderer.includes("data-creature-reference-type") && renderer.includes("openReferenceBrowserReference"), "Creature links use shared Reference Browser opener");
  assert(!renderer.includes('id: "reference-browser-add-combat"'), "no combat mutation Action Console entry is added");
  console.log("Creature Reference View fixtures passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
