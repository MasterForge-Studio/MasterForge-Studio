"use strict";

// Session Prompter layout: while the prompter runs, it sits above the
// controls, and edit mode returns to the normal order.
// Run from anywhere: node tests/prompter-layout-fixtures.js

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start !== -1, `${name} is defined`);
  const next = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

const renderer = read("src/renderer.js");
assert(
  functionBody(renderer, "enterStoryPromptMode").includes('closest("#story")?.classList.add("is-prompting")'),
  "prompt mode marks the story panel as prompting"
);
assert(
  functionBody(renderer, "enterStoryEditMode").includes('closest("#story")?.classList.remove("is-prompting")'),
  "edit mode clears the prompting state"
);

const css = read("src/style.css");
const rule = selector => {
  const at = css.indexOf(`${selector} {`);
  assert(at !== -1, `style.css has ${selector}`);
  return css.slice(at, css.indexOf("}", at));
};
const prompting = "#sessionPrompterSlideDown .embeddedSessionPrompter.is-prompting";
assert(/display:\s*flex !important/.test(rule(prompting)), "prompting panel overrides the inline display:block");
assert(/flex-direction:\s*column/.test(rule(prompting)), "prompting panel stacks vertically");
assert(/order:\s*-1/.test(rule(`${prompting} #storyPromptLayout`)), "prompter is placed above the controls");

console.log("Prompter layout fixtures passed.");
