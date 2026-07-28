"use strict";

const fs = require("fs");
const vm = require("vm");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const context = {
  console,
  window: {
    dmState: { current: { systemId: "dnd-2024" } }
  }
};

vm.createContext(context);
vm.runInContext(fs.readFileSync("src/gameSystems.js", "utf8"), context);

const rules = context.window.MasterForgeGameSystems.getRules("dnd-2024");
const categories = rules.capabilityCategories;
const expectedIds = [
  "traits",
  "actions",
  "bonus-actions",
  "reactions",
  "legendary-actions",
  "lair-actions",
  "mythic-actions",
  "spellcasting",
  "innate-spellcasting",
  "equipment"
];

assert(
  categories.map(category => category.id).join(",") === expectedIds.join(","),
  "D&D builder categories must retain stable schema order."
);
categories.forEach(category => {
  assert(category.enabled, `${category.id} must be enabled`);
  assert(category.builderEditable, `${category.id} must be builder editable`);
  assert(category.entityTypes.includes("npc"), `${category.id} must apply to NPCs`);
  assert(category.entityTypes.includes("creature"), `${category.id} must apply to creatures`);
  assert(category.sourceKeys.length, `${category.id} must declare a legacy read/write key`);
});
assert(
  categories.find(category => category.id === "spellcasting").editorType === "spellcasting",
  "Spellcasting must route to its structured editor."
);
assert(
  categories.find(category => category.id === "innate-spellcasting").sourceKeys.includes("innateSpellcasting"),
  "Innate spellcasting must retain its legacy field mapping."
);
assert(
  !categories.find(category => category.id === "innate-spellcasting").sourceKeys.includes("spells"),
  "Generic spells must not be a legacy source for innate spellcasting."
);
assert(
  categories.find(category => category.id === "spellcasting").id !==
    categories.find(category => category.id === "innate-spellcasting").id,
  "Spellcasting categories must retain separate stable IDs."
);

console.log("Builder capability schema fixtures passed.");
