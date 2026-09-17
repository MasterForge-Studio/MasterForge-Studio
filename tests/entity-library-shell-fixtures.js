"use strict";

const fs = require("fs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const renderer = fs.readFileSync("src/renderer.js", "utf8");
const style = fs.readFileSync("src/style.css", "utf8");

assert(renderer.includes('class="entityLibrarySearch"'), "primary search is rendered in the browser rail");
assert(renderer.includes('data-entity-library-type='), "compact type filters are rendered in the browser rail");
assert(!renderer.includes('id: "browse-search"'), "Action Console does not duplicate primary search");
assert(!renderer.includes('id: "browse-type"'), "Action Console does not duplicate primary type filters");
assert(renderer.includes('renderGroup("Pinned"'), "Pinned group is rendered");
assert(renderer.includes('renderGroup("All Entities"'), "All Entities group is rendered");
assert(renderer.includes('id="entityRelationshipsSurface"'), "one relationship surface is retained");
assert(renderer.includes("mountEntityRelationshipsSurface(mount)"), "Faction Relationships tab mounts the shared surface");
assert(renderer.includes('data-entity-workspace-tab="${key}"'), "generic and faction profile tabs use stable tab keys");
assert(renderer.includes('closeRelationshipTree();'), "existing relationship tree return path remains wired");
assert(style.includes("grid-template-columns: clamp(260px, 19vw, 290px) minmax(0, 1fr)"), "desktop shell reserves majority width for workspace");
assert(style.includes("grid-template-columns: repeat(2, minmax(0, 1fr)) !important"), "browser type filters use a compact two-column grid");
assert(style.includes('.entity-type-tab[data-entity-library-type="all"]'), "All filter can span the compact chip grid");
assert(style.includes("flex: 1 1 auto !important"), "entity results receive the remaining rail height");
assert(style.includes("overflow-x: auto"), "tab and filter overflow remains horizontally usable");
assert(style.includes("position: sticky"), "workspace tabs are sticky");
assert(!renderer.includes('id="saveGenericEntityBtn"'), "generic editor has no inline Save Entity button");
assert(!renderer.includes('id="deleteGenericEntityBtn"'), "generic editor has no inline Delete button");
assert(renderer.includes('id: "save-entity", label: "Save Entity"'), "Action Console exposes Save Entity");
assert(renderer.includes('id: "delete-entity", label: "Delete Entity"'), "Action Console exposes Delete Entity");
assert(renderer.includes("handler: saveGenericEntityFromBuilder"), "console save reuses the existing save path");
assert(renderer.includes("handler: deleteGenericEntityFromBuilder"), "console delete reuses the existing delete path");
assert(renderer.includes("enabled: () => hasEditableGenericEntityDraft()"), "save requires a mounted editable draft");
assert(renderer.includes("hasEditableGenericEntityDraft() && Boolean(entityBuilderState.activeEntityId)"), "delete requires a mounted saved draft");

console.log("Entity Library structural shell fixtures passed.");
