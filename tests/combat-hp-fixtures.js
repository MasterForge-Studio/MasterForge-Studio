"use strict";

const fs = require("fs");
const vm = require("vm");

function assertHp(label, combatant, hp, tempHp) {
  if (combatant.hp !== hp || combatant.tempHp !== tempHp) {
    throw new Error(`${label}: expected HP ${hp}, Temp HP ${tempHp}; received HP ${combatant.hp}, Temp HP ${combatant.tempHp}`);
  }
}

const stored = new Map();
const context = {
  console,
  setTimeout,
  clearTimeout,
  requestAnimationFrame: callback => callback(),
  localStorage: {
    getItem: key => stored.get(key) || null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: key => stored.delete(key)
  },
  document: {
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    body: { classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } }
  },
  window: {
    dmState: { current: {} },
    matchMedia: () => ({ matches: false })
  }
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(fs.readFileSync("src/combatOps.js", "utf8"), context);

const api = context.window.MasterForgeCombatOps;
const resolve = api.resolveHitPointAdjustment;

const absorbed = { hp: 190, maxHp: 190, tempHp: 200 };
resolve(absorbed, -20);
assertHp("damage fully absorbed by temporary HP", absorbed, 190, 180);

const overflow = { hp: 190, maxHp: 190, tempHp: 20 };
resolve(overflow, -35);
assertHp("overflow damage", overflow, 175, 0);

const noTemporaryHp = { hp: 10, maxHp: 190, tempHp: 0 };
resolve(noTemporaryHp, -20);
assertHp("zero temporary HP and current HP floor", noTemporaryHp, 0, 0);

resolve(noTemporaryHp, 10);
assertHp("healing after temporary HP depletion", noTemporaryHp, 10, 0);

const capped = { hp: 185, maxHp: 190, tempHp: 17 };
resolve(capped, 20);
assertHp("healing cap and preserved temporary HP", capped, 190, 17);

const overkill = { hp: 5, maxHp: 190, tempHp: 3 };
resolve(overkill, -100);
assertHp("both HP floors", overkill, 0, 0);

api.state.mode = "active";
api.state.combatants = [{ name: "Beholder", hp: 190, maxHp: 190, tempHp: 200, status: "Active" }];
api.state.activeIndex = 0;
api.adjustHp(-20);
assertHp("active runtime adjustment", api.getActiveCombatant(), 190, 180);
const persisted = JSON.parse(stored.get("masterforge.combatOperations.v1"));
assertHp("existing active-combat persistence", persisted.combatants[0], 190, 180);

let summary = api.render();
if (!summary.includes("data-combat-temp-hp-summary") || !summary.includes("+ 180 Temporary HP")) {
  throw new Error("positive temporary HP summary markup");
}
api.getActiveCombatant().tempHp = 0;
summary = api.render();
if (summary.includes("data-combat-temp-hp-summary")) {
  throw new Error("zero temporary HP summary must be hidden");
}

console.log("Combat HP fixtures passed.");
