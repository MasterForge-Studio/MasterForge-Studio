"use strict";

const fs = require("fs");
const vm = require("vm");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const records = new Map();
  const entities = new Map();
  const relationships = new Map();
  const packs = [];
  const context = {
    console,
    window: {
      dmState: { current: { systemId: "dnd-2024" } },
      dmStorage: {
        getCharacters: async () => records.get("characters") || []
      },
      dmAPI: {
        getAllRecordsInCollection: async collection => records.get(collection) || [],
        getEntitiesByType: async type => type === "ability_pack" ? packs : [],
        getEntity: async (type, id) => entities.get(`${type}:${id}`) || null
      },
      MasterForgeRelationshipMetadata: {
        KEYS: { PRIMARY_FACTION: "primaryFaction", FACTION_RANK_ID: "factionRankId" }
      },
      MasterForgeRelationshipEngine: {
        getRelationshipsForEntity: async (type, id) => relationships.get(`${type}:${id}`) || []
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("src/gameSystems.js", "utf8"), context);
  vm.runInContext(fs.readFileSync("src/engines/inheritance-engine.js", "utf8"), context);
  const engine = context.window.MasterForgeInheritanceEngine;

  const creature = {
    id: "fixture-creature",
    entity_type: "creature",
    name: "Fixture Dragon",
    data_json: {
      creatureId: "fixture-creature",
      systemId: "dnd-2024",
      canonicalSource: "official-reference",
      sourceTitle: "Monster Manual",
      sourceReference: "Page 28"
    }
  };
  records.set("creatures", [{
    id: "fixture-creature",
    traits: [{ id: "amphibious", name: "Amphibious", description: "Breathes air and water." }],
    actions: [{ id: "bite", name: "Bite", attackBonus: "+6", damage: "2d8+4" }],
    reactions: [{ id: "parry", name: "Parry", description: "Adds 2 to defence." }],
    legendaryActions: [{ id: "detect", name: "Detect", description: "Makes a Wisdom check." }],
    lairActions: [{ id: "tremor", name: "Tremor", description: "The ground shakes." }],
    systemCapabilities: {
      spellcasting: [{ id: "prepared-magic", name: "Prepared Magic", description: "Uses prepared spell slots." }],
      "innate-spellcasting": [{ id: "innate-magic", name: "Innate Magic", description: "Uses innate daily magic." }]
    }
  }]);
  const directProfile = await engine.resolveCombatProfile(creature, { systemId: "dnd-2024" });
  assert(directProfile.source === "official-reference", "combat profile canonical source fixture");
  assert(directProfile.sourceTitle === "Monster Manual", "combat profile source title fixture");
  assert(directProfile.sourceReference === "Page 28", "combat profile source reference fixture");
  ["traits", "actions", "reactions", "legendary-actions", "lair-actions"].forEach(id =>
    assert(directProfile.categories.some(category => category.id === id), `direct ${id} fixture`)
  );
  assert(
    directProfile.categories.find(category => category.id === "spellcasting")?.entries.some(entry => entry.name === "Prepared Magic"),
    "canonical spellcasting fixture"
  );
  assert(
    directProfile.categories.find(category => category.id === "innate-spellcasting")?.entries.some(entry => entry.name === "Innate Magic"),
    "canonical innate spellcasting fixture"
  );
  assert(
    !directProfile.categories.find(category => category.id === "spellcasting")?.entries.some(entry => entry.name === "Innate Magic"),
    "innate spellcasting must not leak into spellcasting"
  );

  entities.set("faction:fixture-faction", {
    id: "fixture-faction",
    entity_type: "faction",
    name: "Marsh Wardens",
    data_json: { traits: [{ id: "marsh-step", name: "Marsh Step", description: "Ignores marsh terrain." }], abilityPackIds: ["marsh-pack", "duplicate-pack"] }
  });
  packs.push(
    { id: "marsh-pack", name: "Marsh Warden", data_json: { traits: [], abilities: [{ id: "reed-strike", name: "Reed Strike", category: "Action", description: "A precise strike.", uses: "2" }] } },
    { id: "duplicate-pack", name: "Marsh Warden Copy", data_json: { traits: [], abilities: [{ id: "reed-strike-copy", name: "Reed Strike", category: "Action", description: "A precise strike.", uses: "2" }] } }
  );
  relationships.set("creature:fixture-creature", [{
    id: "membership-1",
    sourceEntityType: "creature",
    sourceEntityId: "fixture-creature",
    targetEntityType: "faction",
    targetEntityId: "fixture-faction",
    relationshipType: "member_of",
    data_json: {}
  }]);
  const inheritedProfile = await engine.resolveCombatProfile(creature, { systemId: "dnd-2024" });
  const inheritedAction = inheritedProfile.categories.find(category => category.id === "actions")?.entries.find(entry => entry.name === "Reed Strike");
  assert(inheritedProfile.categories.find(category => category.id === "traits")?.entries.some(entry => entry.name === "Marsh Step"), "inherited trait fixture");
  assert(inheritedAction?.provenance.startsWith("From Ability Pack:"), "inherited action provenance fixture");
  assert(inheritedAction?.duplicateSources.length === 1, "identical inherited action de-duplication fixture");

  const npc = { id: "fixture-npc", entity_type: "npc", name: "Fixture NPC", data_json: { npcId: "fixture-npc", systemId: "dnd-2024" } };
  const pc = { id: "fixture-pc", entity_type: "pc", name: "Fixture PC", data_json: { characterId: "fixture-pc", systemId: "dnd-2024" } };
  records.set("npcs", [{ id: "fixture-npc", actions: [] }]);
  records.set("characters", [{ id: "fixture-pc", traits: [{ id: "gm-secret", name: "Secret Training", description: "GM-only.", gmOnly: true }] }]);
  [npc, pc].forEach(entity => relationships.set(`${entity.entity_type}:${entity.id}`, [{
    id: `membership-${entity.id}`,
    sourceEntityType: entity.entity_type,
    sourceEntityId: entity.id,
    targetEntityType: "faction",
    targetEntityId: "fixture-faction",
    relationshipType: "member_of",
    data_json: {}
  }]));
  const npcProfile = await engine.resolveCombatProfile(npc, { systemId: "dnd-2024" });
  assert(npcProfile.categories.some(category => category.entries.some(entry => entry.name === "Reed Strike")), "NPC ability-pack fixture");
  const gmPcProfile = await engine.resolveCombatProfile(pc, { systemId: "dnd-2024", visibilityMode: "gm", includeHidden: true });
  const publicPcProfile = await engine.resolveCombatProfile(pc, { systemId: "dnd-2024", visibilityMode: "public", includeHidden: false });
  assert(gmPcProfile.categories.some(category => category.entries.some(entry => entry.name === "Secret Training")), "GM-only PC fixture");
  assert(!publicPcProfile.categories.some(category => category.entries.some(entry => entry.name === "Secret Training")), "public visibility fixture");

  const simple = await engine.resolveCombatProfile({ id: "simple", entity_type: "creature", name: "Simple", data_json: { systemId: "dnd-2024" } }, { systemId: "dnd-2024" });
  assert(Array.isArray(simple.categories), "simple participant fixture");
  console.log("PASS combat profile fixtures");
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
