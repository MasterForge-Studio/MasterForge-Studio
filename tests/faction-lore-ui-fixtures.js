"use strict";

const fs = require("fs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const renderer = fs.readFileSync("src/renderer.js", "utf8");
const style = fs.readFileSync("src/style.css", "utf8");

assert(renderer.includes('new Set(["identity", "current-campaign-state"])'), "Identity and Current Campaign State open by default");
assert(renderer.includes('data-faction-lore-group="gm-only"'), "GM Only remains a separate collapsible section");
assert(renderer.includes("factionLoreOpenGroups.add"), "section open state survives Lore rerenders");
assert(renderer.includes('data-faction-lore-image-choose'), "emblem upload and replace control remains present");
assert(renderer.includes('data-faction-lore-image-remove'), "emblem remove control remains present");
[
  ["goals", "Add Goal"], ["methods", "Add Method"], ["resources", "Add Resource"],
  ["internalTensions", "Add Tension"], ["turningPoints", "Add Turning Point"],
  ["playerHooks", "Add Player Hook"], ["secrets", "Add Secret"], ["hiddenGoals", "Add Hidden Goal"]
].forEach(([key, label]) => assert(renderer.includes(`${key}: "${label}"`), `${key} retains its compact add action`));
assert(style.includes(".factionLoreGroupFields--identity"), "Identity has a dedicated responsive layout");
assert(style.includes("min-height: 160px"), "long History prose uses the larger Lore-only measure");
assert(style.includes("object-fit: contain"), "emblem remains uncropped");
assert(style.includes(".factionLoreGm"), "GM-only treatment remains locally scoped");

console.log("Faction Lore UI fixtures passed.");
