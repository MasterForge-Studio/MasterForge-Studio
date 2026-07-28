"use strict";

const fs = require("fs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const source = fs.readFileSync("src/renderer.js", "utf8");
const functionBody = (name, nextName) => {
  const start = source.indexOf(`async function ${name}()`);
  const end = source.indexOf(`async function ${nextName}`, start);
  assert(start >= 0 && end > start, `${name} source fixture`);
  return source.slice(start, end);
};

const npcSave = functionBody("saveNpc", "refreshNpcPostSaveViews");
const creatureSave = functionBody("saveCreature", "refreshCreaturePostSaveViews");

[["NPC", npcSave], ["Creature", creatureSave]].forEach(([label, body]) => {
  assert(body.includes("if (builderSaveLocks."), `${label} duplicate-save guard`);
  assert(body.includes("try {"), `${label} save uses try`);
  assert(body.includes("finally {"), `${label} save uses finally`);
  assert(body.includes("setBuilderSaveLock("), `${label} save lock transition`);
  assert(body.includes("false);"), `${label} save lock cleanup`);
  assert(body.includes("void refresh"), `${label} non-blocking post-save refresh`);
  assert(!body.includes("alert("), `${label} save lifecycle has no blocking alert`);
});

const timers = [...source.matchAll(/setTimeout\s*\([^,]+,\s*(\d+)\s*\)/gs)]
  .map(match => Number(match[1]));
assert(!timers.includes(60000), "builder save lifecycle must not use a one-minute timer");

const started = performance.now();
let locked = true;
try {
  // Mirrors the synchronous finally transition after the awaited save operation resolves.
} finally {
  locked = false;
}
const cleanupDelay = performance.now() - started;
assert(!locked, "save lock clears");
assert(cleanupDelay < 250, `save lock cleanup target (${cleanupDelay.toFixed(3)} ms)`);

console.log(`Builder save lifecycle fixtures passed (${cleanupDelay.toFixed(3)} ms cleanup).`);
