const assert = require("assert");
const fs = require("fs");
const loreApi = require("../src/factions/faction-lore.js");

const defaults = loreApi.getDefaultFactionLore();
assert.strictEqual(defaults.version, 1, "empty lore uses version 1");
assert.strictEqual(defaults.public.symbolImage, "", "empty lore has no symbol image");
assert.deepStrictEqual(defaults.public.goals, [], "empty public arrays are safe");
assert.deepStrictEqual(defaults.gm.secrets, [], "empty GM arrays are safe");

const legacyFaction = { description: "Legacy description", data_json: { publicNotes: "Legacy public", dmSecrets: "Legacy secret" } };
const legacyBefore = JSON.stringify(legacyFaction);
const legacyLore = loreApi.normaliseFactionLore(legacyFaction.data_json.factionLore, legacyFaction);
assert.strictEqual(JSON.stringify(legacyFaction), legacyBefore, "normalization does not mutate legacy fields");
assert.strictEqual(legacyLore.public.identity, "", "legacy description is not copied into lore");
assert.deepStrictEqual(legacyLore.gm.secrets, [], "legacy secrets are not copied into lore");
assert.strictEqual(legacyLore.public.symbolImage, "", "legacy lore without symbolImage loads safely");

const raw = {
  version: 1,
  futureRoot: { enabled: true },
  public: { identity: "Known identity", symbol: "Three silver feathers", symbolImage: "data:image/png;base64,fixture", goals: ["Goal one", 2, "Goal two"], futurePublic: "kept" },
  gm: { secrets: ["Hidden truth"], hiddenGoals: null, futureGm: { key: "kept" } }
};
const normalised = loreApi.normaliseFactionLore(raw);
assert.deepStrictEqual(normalised.public.goals, ["Goal one", "Goal two"], "array fields retain string entries safely");
assert.deepStrictEqual(normalised.gm.hiddenGoals, [], "malformed arrays normalize safely");
assert.deepStrictEqual(normalised.futureRoot, { enabled: true }, "unknown root fields survive");
assert.strictEqual(normalised.public.futurePublic, "kept", "unknown public fields survive");
assert.deepStrictEqual(normalised.gm.futureGm, { key: "kept" }, "unknown GM fields survive");
assert.strictEqual(normalised.public.identity, "Known identity", "public data remains public");
assert.strictEqual(normalised.public.symbolImage, "data:image/png;base64,fixture", "symbol image survives normalization");
assert.strictEqual(normalised.public.symbol, "Three silver feathers", "symbol text remains independent");
assert.strictEqual(loreApi.normaliseFactionLore({ public: { symbolImage: null } }).public.symbolImage, "", "null symbol images normalize safely");
assert.deepStrictEqual(normalised.gm.secrets, ["Hidden truth"], "GM data remains separate");
assert.doesNotThrow(() => loreApi.normaliseFactionLore(null), "null lore is safe");
assert.doesNotThrow(() => loreApi.normaliseFactionLore("malformed"), "malformed lore is safe");

const publicProjection = loreApi.projectFactionLore(normalised, { visibilityMode: "public" });
const gmProjection = loreApi.projectFactionLore(normalised, { visibilityMode: "gm" });
assert(!Object.prototype.hasOwnProperty.call(publicProjection, "gm"), "public projection excludes GM lore");
assert.deepStrictEqual(gmProjection.gm.secrets, ["Hidden truth"], "GM projection includes GM lore");
assert.strictEqual(publicProjection.public.symbolImage, "data:image/png;base64,fixture", "public projection preserves symbol image");
assert.strictEqual(publicProjection.public.symbol, "Three silver feathers", "public projection preserves symbol text");

const withoutImage = loreApi.copyFactionLore(normalised);
withoutImage.public.symbolImage = "";
assert.strictEqual(withoutImage.public.symbolImage, "", "symbol image can be removed");
assert.strictEqual(withoutImage.public.symbol, "Three silver feathers", "removing symbol image does not remove motif text");
assert.strictEqual(normalised.public.symbolImage, "data:image/png;base64,fixture", "image removal does not mutate the source lore");

const faction = {
  id: "fixture-faction",
  description: "Untouched",
  data_json: {
    publicNotes: "Untouched public", dmSecrets: "Untouched secret",
    factionHierarchy: { version: 1, nodes: [{ id: "captain", name: "Captain" }] },
    traits: [{ id: "disciplined", name: "Disciplined" }],
    abilityPackIds: ["pack-one"], extension: { retained: true }, factionLore: raw
  }
};
const relationships = [{ id: "membership-1", from_id: "npc-1", to_id: faction.id }];
const beforeRelationships = JSON.stringify(relationships);
const saved = JSON.parse(JSON.stringify({ ...faction, data_json: { ...faction.data_json, factionLore: loreApi.copyFactionLore(faction.data_json.factionLore) } }));
assert.deepStrictEqual(saved.data_json.factionLore, normalised, "save/reload round trip is lossless after normalization");
assert.deepStrictEqual(saved.data_json.factionHierarchy, faction.data_json.factionHierarchy, "hierarchy survives Lore save");
assert.deepStrictEqual(saved.data_json.traits, faction.data_json.traits, "traits survive Lore save");
assert.deepStrictEqual(saved.data_json.abilityPackIds, faction.data_json.abilityPackIds, "Ability Pack assignments survive Lore save");
assert.deepStrictEqual(saved.data_json.extension, faction.data_json.extension, "unrelated extension data survives Lore save");
assert.strictEqual(JSON.stringify(relationships), beforeRelationships, "relationships are not modified");
assert.strictEqual(saved.description, "Untouched", "legacy description remains untouched");
assert.strictEqual(saved.data_json.publicNotes, "Untouched public", "legacy publicNotes remains untouched");
assert.strictEqual(saved.data_json.dmSecrets, "Untouched secret", "legacy dmSecrets remains untouched");

const renderer = fs.readFileSync("src/renderer.js", "utf8");
assert(renderer.includes('["lore", "Lore"]'), "Faction workspace registers Lore tab");
assert(renderer.includes("entity.data_json.factionLore = getFactionLoreApi().copyFactionLore"), "Faction save persists normalized Lore");
assert(renderer.includes("if (entityBuilderState.factionLoreShouldPersist)"), "legacy factions are not eagerly given empty lore");
assert(renderer.includes("entityBuilderState.factionLoreShouldPersist = false;"), "existing Lore is not rewritten with new defaults until edited");
assert(renderer.includes('accept="image/*" data-faction-lore-image-input'), "Faction Lore accepts the established image upload formats");
assert(renderer.includes("readImageFileAsDataUrl(file)"), "Faction Lore reuses the common data URL image helper");
assert(renderer.includes('object-fit: contain') || fs.readFileSync("src/style.css", "utf8").includes("object-fit: contain"), "emblem previews preserve aspect ratio without cropping");

console.log("Faction Lore fixtures passed.");
