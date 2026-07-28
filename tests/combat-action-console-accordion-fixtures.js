"use strict";

const fs = require("fs");
const vm = require("vm");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const stored = new Map();
const classList = { add() {}, remove() {}, toggle() {} };
const host = {
  hidden: false,
  innerHTML: "",
  classList,
  setAttribute() {},
  querySelector() { return null; },
  addEventListener(type, listener) { if (type === "click") this.clickListener = listener; },
  removeEventListener() {}
};
const shell = { classList };
const toggleButton = { classList, setAttribute() {} };
const backdrop = { hidden: true, addEventListener() {}, removeEventListener() {} };
const context = {
  console,
  alert: message => { throw new Error(message); },
  requestAnimationFrame: callback => callback(),
  localStorage: {
    getItem: key => stored.get(key) || null,
    setItem: (key, value) => stored.set(key, value)
  },
  document: {
    activeElement: null,
    body: { classList },
    querySelector() { return null; },
    addEventListener() {},
    removeEventListener() {}
  },
  window: {
    addEventListener() {},
    matchMedia: () => ({ matches: false })
  }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync("src/MasterForge_action_console.js", "utf8"), context);

const api = context.window.MasterForgeActionConsole;
api.initialise({ host, shell, toggleButton, backdrop });
api.registerWorkspace("combat-operations", {
  singleOpenAccordion: true,
  defaultCollapsedGroups: ["combat", "resource", "conditions"],
  actions: [
    { id: "one", label: "One", groupId: "combat", groupLabel: "Combat" },
    { id: "two", label: "Two", groupId: "resource", groupLabel: "Current Hit Points" },
    { id: "three", label: "Three", groupId: "conditions", groupLabel: "Conditions" }
  ]
});
api.setActiveWorkspace("combat-operations");

function expanded(groupId) {
  return new RegExp(`data-action-group="${groupId}"[^>]*aria-expanded="true"`).test(host.innerHTML);
}
async function clickGroup(groupId) {
  await host.clickListener({
    target: {
      closest(selector) {
        if (selector === "[data-action-group]") return { dataset: { actionGroup: groupId } };
        return null;
      }
    }
  });
}

(async () => {
  assert(!expanded("combat") && !expanded("resource") && !expanded("conditions"), "groups default collapsed");
  await clickGroup("resource");
  assert(expanded("resource") && !expanded("combat") && !expanded("conditions"), "resource opens alone");
  await clickGroup("conditions");
  assert(expanded("conditions") && !expanded("combat") && !expanded("resource"), "opening a group collapses its sibling");
  await clickGroup("conditions");
  assert(!expanded("combat") && !expanded("resource") && !expanded("conditions"), "clicking the open group closes all groups");

  const saved = JSON.parse(stored.get("masterforge.actionConsole.v1"));
  assert(saved.collapsedGroups.includes("combat") && saved.collapsedGroups.includes("resource") && saved.collapsedGroups.includes("conditions"), "collapsed state persists");
  console.log("Combat Action Console accordion fixtures passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
