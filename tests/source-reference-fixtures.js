"use strict";

const fs = require("fs");
const vm = require("vm");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const context = {
  console,
  setTimeout,
  clearTimeout,
  requestAnimationFrame: callback => callback(),
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: {
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    body: { classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } }
  },
  window: {
    dmState: { current: {} },
    matchMedia: () => ({ matches: false }),
    dmAPI: {
      getAllRecordsInCollection: async collection => collection === "creatures" ? [{
        id: "beholder",
        name: "Beholder",
        source: "official-reference",
        sourceTitle: "Monster Manual",
        sourceReference: "Page 28"
      }] : [],
      getEntitiesByType: async () => []
    }
  }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync("src/combatOps.js", "utf8"), context);

const api = context.window.MasterForgeCombatOps;
assert(
  api.formatSourceReference("official-reference", "Monster Manual", "Page 28") ===
    "Source: Monster Manual · Page 28",
  "title and reference formatting"
);
assert(
  api.formatSourceReference("third-party", "Tome of Beasts", "") === "Source: Tome of Beasts",
  "title-only formatting"
);
assert(
  api.formatSourceReference("imported", "", "Appendix B") === "Source Reference: Appendix B",
  "reference-only formatting"
);
assert(
  api.formatSourceReference("homebrew", "Preserved Title", "Page 1") === "",
  "homebrew hides preserved metadata"
);
assert(api.formatSourceReference("official-reference", "", "") === "", "empty metadata hides line");

api.state.mode = "active";
api.state.activeIndex = 0;
api.state.combatants = [{
  name: "Beholder",
  sourceType: "creature",
  source: "official-reference",
  sourceTitle: "Monster Manual",
  sourceReference: "Page 28",
  hp: 170,
  maxHp: 190,
  tempHp: 0,
  status: "Active",
  attributes: {},
  passiveScores: {},
  capabilityProfile: { categories: [] }
}];
let markup = api.render();
assert(markup.includes("data-combat-source-reference"), "combat hero stable source attribute");
assert(markup.includes("Source: Monster Manual · Page 28"), "combat hero source text");
assert(markup.includes("HP 170 / 190 · Init"), "participant key combat line");

api.state.combatants[0].source = "homebrew";
markup = api.render();
assert(!markup.includes("data-combat-source-reference"), "homebrew combat hero hides source line");

const rendererSource = fs.readFileSync("src/renderer.js", "utf8");
[
  "npcSourceTitleInput",
  "npcSourceReferenceInput",
  "creatureSourceTitleInput",
  "creatureSourceReferenceInput",
  "canonicalSource: normaliseSourceValue(npc.source",
  "canonicalSource: normaliseSourceValue(creature.source"
].forEach(token => assert(rendererSource.includes(token), `builder propagation token: ${token}`));

const canonical = {
  id: "fixture",
  source: "official-reference",
  sourceTitle: "Lost Mine of Phandelver",
  sourceReference: "Page 32"
};
const roundTrip = JSON.parse(JSON.stringify(canonical));
assert(roundTrip.sourceTitle === canonical.sourceTitle, "canonical serialization preserves source title");
assert(roundTrip.sourceReference === canonical.sourceReference, "canonical serialization preserves source reference");

(async () => {
  api.state.combatants = [{
    id: "old-runtime-beholder",
    sourceType: "creature",
    sourceId: "beholder",
    sourceEntityId: "beholder",
    name: "Beholder",
    systemId: "dnd-2024"
  }];
  await api.refreshMissingSourceReferences();
  const refreshed = api.state.combatants[0];
  assert(refreshed.source === "official-reference", "legacy snapshot source refresh");
  assert(refreshed.sourceTitle === "Monster Manual", "legacy snapshot source title refresh");
  assert(refreshed.sourceReference === "Page 28", "legacy snapshot source reference refresh");
  console.log("Source reference fixtures passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
