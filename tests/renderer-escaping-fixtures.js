"use strict";

// Renderer hardening: CSP present on both pages, and the older views that
// showed pack or user text without escaping now go through escapeHtml.
// Run from anywhere: node tests/renderer-escaping-fixtures.js

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// --- Content Security Policy ------------------------------------------------
for (const page of ["src/index.html", "src/activation.html"]) {
  const html = read(page);
  const match = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
  assert(match, `${page} declares a Content-Security-Policy`);
  const policy = match[1];
  assert(/default-src 'none'/.test(policy), `${page} CSP defaults to none`);
  assert(/script-src 'self'(;|$)/.test(policy), `${page} CSP allows only the app's own scripts`);
  assert(!/script-src[^;]*'unsafe-(inline|eval)'/.test(policy), `${page} CSP never allows inline or eval script`);
  assert(/object-src 'none'/.test(policy), `${page} CSP blocks plugins`);
  assert(!/<script>(?!\s*<\/script>)/.test(html), `${page} has no inline script blocks`);
  assert(!/\son[a-z]+\s*=\s*"/i.test(html), `${page} has no inline event handlers`);
}

// --- renderer sinks ---------------------------------------------------------
const renderer = read("src/renderer.js");

const mustBeEscaped = [
  '${escapeHtml(theme.name)}',
  '${escapeHtml(s.title || "Untitled Session")}',
  '${escapeHtml(s.date || "No date set")}',
  '<h3>${escapeHtml(c.name)}</h3>',
  '${escapeHtml(player?.name || "Unknown Player")}',
  '<h3>${escapeHtml(player.name)}</h3>',
  'data-player-name="${escapeHtml(player.name)}"',
  '<b>${escapeHtml(c.name)}</b>',
  'Active in ${escapeHtml(window.dmState.current.campaign)}',
  '${escapeHtml(encounter.name)}',
  '<li>${escapeHtml(char.name)}: PP',
  '${escapeHtml(currentGeneratedNpc.secret)}',
  '<b>${escapeHtml(npc.name)}</b>',
  '${escapeHtml(faction.summary)}',
  '${escapeHtml(contact.hook)}',
  '${escapeHtml(note.type)}: ${escapeHtml(note.title)}',
  '${escapeHtml(note.content || "No information added yet.")}',
  '<li>${escapeHtml(item)}</li>'
];
for (const snippet of mustBeEscaped) {
  assert(renderer.includes(snippet), `renderer escapes: ${snippet}`);
}

const mustNotRemain = [
  '<div class="sessionItemTitle">${s.title',
  '<h3>${c.name}</h3>',
  '<h3>${player.name}</h3>',
  '<b>${npc.name}</b>',
  '<p>${faction.summary}</p>',
  '<p>${note.content',
  '<li>${item}</li>'
];
for (const snippet of mustNotRemain) {
  assert(!renderer.includes(snippet), `unescaped sink removed: ${snippet}`);
}

// escapeHtml itself neutralises markup.
const escapeSource = renderer.match(/function escapeHtml\(value\) \{[\s\S]*?\n\}/);
assert(escapeSource, "escapeHtml is defined");
const escapeHtml = new Function(`${escapeSource[0]}; return escapeHtml;`)();
assert(escapeHtml('<img src=x onerror="alert(1)">') === "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;", "escapeHtml neutralises tags and quotes");

console.log("Renderer escaping fixtures passed.");
