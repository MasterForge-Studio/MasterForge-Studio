"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const ecologyApi = require("../src/creatures/creature-ecology.js");
const resolverApi = require("../src/entities/canonical-entity-resolver.js");

const defaults = ecologyApi.createDefaultCreatureEcology();
assert.deepStrictEqual(Object.keys(defaults), ["version", "behaviour", "temperament", "diet", "socialStructure", "activityCycle", "reproductiveNotes", "ecologyNotes", "habitatPreferences"], "default ecology has only ecology-specific fields");
assert(!Object.hasOwn(defaults, "description"), "canonical Creature description is not duplicated inside ecology");
assert.deepStrictEqual(Object.keys(defaults.habitatPreferences), ["biomes", "terrain", "climate", "elevation", "waterProximity", "temperature", "humidity", "settlementProximity", "activityPeriod", "seasonality"], "default habitat preference shape is complete");
Object.values(defaults.habitatPreferences).forEach(value => assert(Array.isArray(value) && value.length === 0, "default habitat preferences are arrays"));

assert.deepStrictEqual(ecologyApi.normaliseCreatureEcology(undefined), defaults, "missing ecology loads safely");
assert.deepStrictEqual(ecologyApi.normaliseCreatureEcology(null), defaults, "null ecology loads safely");
const raw = {
  version: 4, behaviour: "Ambushes from cliffs", temperament: null, diet: 42, socialStructure: "Pairs", activityCycle: "Nocturnal",
  reproductiveNotes: "One clutch", ecologyNotes: "Follows warm currents", futureEcology: { retained: true },
  habitatPreferences: { biomes: [" coastal ", null, "volcanic"], terrain: "cliffs", climate: ["tropical"], elevation: ["high"], waterProximity: ["shoreline"], temperature: ["warm"], humidity: ["humid"], settlementProximity: ["remote"], activityPeriod: ["night"], seasonality: ["year-round"], futurePreference: ["retained"] }
};
const normalised = ecologyApi.normaliseCreatureEcology(raw);
assert.strictEqual(normalised.behaviour, "Ambushes from cliffs", "narrative strings normalize");
assert.strictEqual(normalised.temperament, "", "null narrative values normalize safely");
assert.strictEqual(normalised.diet, "", "malformed narrative scalars do not crash");
assert.deepStrictEqual(normalised.habitatPreferences.biomes, ["coastal", "volcanic"], "preference arrays normalize deterministic strings");
assert.deepStrictEqual(normalised.habitatPreferences.terrain, [], "malformed preference scalars normalize safely");
assert.deepStrictEqual(normalised.futureEcology, { retained: true }, "unknown ecology fields survive");
assert.deepStrictEqual(normalised.habitatPreferences.futurePreference, ["retained"], "unknown habitat fields survive");
const cloned = ecologyApi.cloneCreatureEcology(raw);
cloned.habitatPreferences.biomes.push("caves");
assert.strictEqual(raw.habitatPreferences.biomes.includes("caves"), false, "ecology clone is independent");

const legacyCreature = { id: "legacy", name: "Legacy Beast", stats: { hp: 12 }, actions: [{ name: "Bite" }], foundInLocationIds: ["coast"] };
const legacyRoundTrip = JSON.parse(JSON.stringify(legacyCreature));
assert(!Object.hasOwn(legacyRoundTrip, "ecology"), "existing Creature without ecology remains valid and serialization does not eagerly add ecology");
const editedCreature = { ...legacyCreature, ecology: ecologyApi.cloneCreatureEcology({ behaviour: "Stalks tidal caves", habitatPreferences: { biomes: ["coastal"], terrain: ["caves"] } }) };
const reloaded = JSON.parse(JSON.stringify(editedCreature));
assert.strictEqual(reloaded.ecology.behaviour, "Stalks tidal caves", "edited ecology persists and reloads");
assert.deepStrictEqual(reloaded.ecology.habitatPreferences.terrain, ["caves"], "structured preferences remain arrays after serialization");
assert.deepStrictEqual({ stats: reloaded.stats, actions: reloaded.actions, foundInLocationIds: reloaded.foundInLocationIds }, { stats: legacyCreature.stats, actions: legacyCreature.actions, foundInLocationIds: legacyCreature.foundInLocationIds }, "existing Creature fields remain unchanged");
assert(!Object.hasOwn(editedCreature.ecology, "prey") && !Object.hasOwn(editedCreature.ecology, "relationships") && !Object.hasOwn(editedCreature.ecology, "locations"), "ecology relationships and geography remain separate");

const relationshipContext = { window: {}, console: { log() {} } };
vm.createContext(relationshipContext);
vm.runInContext(fs.readFileSync("src/relationships/relationship-types.js", "utf8"), relationshipContext);
const types = relationshipContext.window.MasterForgeRelationshipTypes;
assert(types.has("preys_on"), "preys_on relationship is available");
assert.strictEqual(types.getLabel("preys_on", "incoming"), "Preyed On By", "preys_on inverse presentation works without a duplicate inverse type");
assert.strictEqual(types.getInverseType("preys_on"), null, "preyed_on_by is not stored as a second relationship type");
assert.strictEqual(types.has("preyed_on_by"), false, "duplicate prey inverse is absent");
assert(types.has("hunted_by") && types.getLabel("hunted_by", "incoming") === "Hunts", "organized hunting uses one distinct directional relationship");

const entity = { id: "creature-1", entity_type: "creature", name: "Cinderwatch Wyrm", data_json: { creatureId: "canonical-1" } };
const canonical = { id: "canonical-1", name: "Cinderwatch Wyrm", description: "Existing identity description", ecology: reloaded.ecology, stats: { hp: 44 } };
let writes = 0;
const resolver = resolverApi.createCanonicalEntityResolver({
  getEntity: async () => entity,
  getRecord: async () => canonical,
  getRelationshipsForEntity: async () => [{ id: "secret", sourceEntityType: "creature", sourceEntityId: "creature-1", relationshipType: "preys_on", targetEntityType: "creature", targetEntityId: "prey-1", visibility: "secret" }],
  save: () => { writes += 1; }
});
(async () => {
  const gm = await resolver.resolveCanonicalEntityReference({ entityType: "creature", entityId: "creature-1" }, { visibilityMode: "gm", includeRelationships: true });
  assert.deepStrictEqual(gm.canonical.ecology, canonical.ecology, "canonical resolver preserves ecology unchanged");
  const publicResult = await resolver.resolveCanonicalEntityReference({ entityType: "creature", entityId: "creature-1" }, { visibilityMode: "public", includeRelationships: true });
  assert.strictEqual(publicResult.relationships.length, 0, "public resolver excludes secret ecology relationships");
  assert.strictEqual(writes, 0, "resolver-only reads perform no writes");

  const renderer = fs.readFileSync("src/renderer.js", "utf8");
  assert(renderer.includes('data-workspace="ecology"') && renderer.includes("renderCreatureEcologyWorkspace"), "Creature builder exposes Ecology workspace");
  assert(renderer.includes("workspace === \"ecology\" && creatureBuilderState.ecologyDirty"), "ecology persists only from a dirty Ecology workspace");
  assert(!/data_json:\s*\{[^}]*ecology/s.test(renderer.slice(renderer.indexOf("async function syncCreatureToEntity"), renderer.indexOf("async function migrateCreatureEntities"))), "URE mirror sync does not duplicate full ecology");
  const packed = JSON.stringify({ records: [editedCreature] });
  assert.deepStrictEqual(JSON.parse(packed).records[0].ecology, editedCreature.ecology, "generic content-package JSON serialization preserves ecology");
  console.log("Creature Ecology fixtures passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
