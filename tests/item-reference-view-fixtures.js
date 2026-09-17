"use strict";

const assert = require("assert");
const fs = require("fs");
const api = require("../src/inGame/views/item-reference-view.js");
const browserApi = require("../src/inGame/reference-browser.js");

const resolved = {
  visibilityMode: "gm", reference: { entityType: "item", entityId: "staff-1" },
  entity: { id: "staff-1", entity_type: "item", name: "Staff Mirror", data_json: { itemId: "staff-1" } },
  canonical: {
    version: 1, id: "staff-1", name: "Ween's Replacement Staff", description: "A silver-capped ash staff.", image: "data:image/webp;base64,AAAA",
    classification: { type: "magic_item", subtype: "staff", category: "arcane focus", rarity: "rare", tags: ["arcane", "storm"] },
    physical: { quantity: 1, weight: 4, value: 0, currency: "gp", material: "ash and silver", size: "long" },
    usage: { consumable: false, stackable: false, attunementRequired: true, attunementNotes: "Requires a spellcaster.", charges: 0, maxCharges: 7, recharge: "Regains 1d6 charges at dawn.", uses: "Casts stored storm magic." },
    mechanics: {
      system: "dnd5e", properties: { spellFocus: true, unknownResonance: { frequency: "storm", strength: 3 } },
      effects: [{ id: "effect-1", name: "Storm Ward", description: "Protects its bearer from wind.", duration: "1 hour", trigger: "Command word" }],
      capabilities: [{ id: "cap-1", name: "Lightning Bolt", category: "action", description: "Releases stored lightning.", range: "100 ft.", saveDC: 15, recharge: "Charge", uses: "1 charge", provenance: "Staff inscription" }]
    },
    lore: { summary: "A rebuilt symbol of survival.", history: "Broken during the crossing and remade.", origin: "Mistcliff Coast", inscriptions: "Stand against the storm.", secrets: "The first owner still dreams through it.", gmNotes: "It awakens after the third use." },
    ownership: { status: "carried", notes: "Currently entrusted to Ween." },
    canonicalSource: "homebrew", sourceTitle: "Campaign Notes", sourceReference: "Session 8"
  },
  relationships: [
    { type: "carried_by", label: "Carried By", direction: "outgoing", otherEntity: { id: "npc-1", type: "npc", name: "Ween" }, status: "active", metadata: {} },
    { type: "stored_in", label: "Stored In", direction: "outgoing", otherEntity: { id: "faction-1", type: "faction", name: "Galeclaw Armoury" }, status: "active", metadata: {} },
    { type: "located_in", label: "Located In", direction: "outgoing", otherEntity: { id: "location-1", type: "location", name: "Mistcliff" }, status: "active", metadata: {} },
    { type: "owns", label: "Owns", direction: "incoming", otherEntity: { id: "npc-2", type: "npc", name: "Nara" }, status: "active", metadata: {} },
    { type: "associated_with", label: "Associated With", direction: "outgoing", otherEntity: { id: "item-2", type: "item", name: "Storm Eye" }, status: "active", metadata: {} },
    { type: "sought_by", label: "Sought By", direction: "outgoing", otherEntity: { id: "creature-1", type: "creature", name: "Ash Drake" }, status: "active", metadata: {} }
  ]
};

const before = JSON.stringify(resolved);
const model = api.buildItemReferenceViewModel(resolved);
assert.strictEqual(model.legacy, false, "canonical Item maps to first-class presentation");
assert.strictEqual(model.atAGlance.image, resolved.canonical.image, "safe Item image maps");
assert.strictEqual(model.atAGlance.type, "magic_item", "type maps");
assert.strictEqual(model.atAGlance.subtype, "staff", "subtype maps");
assert.strictEqual(model.atAGlance.category, "arcane focus", "category maps");
assert.strictEqual(model.atAGlance.rarity, "rare", "rarity maps");
assert.strictEqual(model.atAGlance.quantity, "1", "quantity maps");
assert.strictEqual(model.atAGlance.weight, "4", "weight maps");
assert.strictEqual(model.atAGlance.value, "0", "real zero value is preserved");
assert.strictEqual(model.atAGlance.currency, "gp", "currency maps");
assert.strictEqual(model.atAGlance.material, "ash and silver", "material maps");
assert.strictEqual(model.atAGlance.size, "long", "size maps");
assert.strictEqual(model.atAGlance.ownershipStatus, "carried", "ownership status maps");
assert.strictEqual(model.usage.attunement, "Required", "attunement maps");
assert.strictEqual(model.usage.attunementNotes, "Requires a spellcaster.", "attunement notes map");
assert.strictEqual(model.usage.charges, "0", "real zero charges map without mutation");
assert.strictEqual(model.usage.maxCharges, "7", "maximum charges map");
assert.strictEqual(model.usage.recharge, "Regains 1d6 charges at dawn.", "recharge maps");
assert.strictEqual(model.usage.uses, "Casts stored storm magic.", "uses map");
assert(model.properties.some(item => item.label === "Spell Focus" && item.value === "Yes"), "properties are humanised");
assert(model.properties.some(item => item.label === "Unknown Resonance" && item.value.includes("Frequency: storm")), "unknown structured property displays without raw JSON");
assert.strictEqual(model.effects[0].name, "Storm Ward", "effect maps");
assert.strictEqual(model.capabilities[0].name, "Lightning Bolt", "capability maps");
assert.strictEqual(model.lore.summary, "A rebuilt symbol of survival.", "summary maps");
assert.strictEqual(model.lore.history, "Broken during the crossing and remade.", "history maps");
assert.strictEqual(model.lore.origin, "Mistcliff Coast", "origin maps");
assert.strictEqual(model.lore.inscriptions, "Stand against the storm.", "inscriptions map");
assert.strictEqual(model.gm.secrets, "The first owner still dreams through it.", "GM secrets map in GM mode");
assert.strictEqual(model.gm.notes, "It awakens after the third use.", "GM notes map in GM mode");
assert.deepStrictEqual(model.ownership.groups.map(group => group.label), ["Carrier", "Stored At", "Located At", "Owner"], "Item ownership/location relationships are prioritised by exact type and direction");
assert(!Object.values(model.relationships).flat().some(item => item.type === "carried_by"), "ownership relationship is not duplicated in general relationships");
assert(model.relationships.items.some(item => item.name === "Storm Eye"), "general Item relationship remains grouped");
assert.strictEqual(JSON.stringify(resolved), before, "resolved canonical data and charge/use values are not mutated");

const html = api.renderItemReferenceView(model);
assert(html.includes("mf-reading-surface") && html.includes("mf-reading-section") && html.includes("mf-reading-prose"), "Item uses shared editorial reading structure");
assert(html.includes("mf-reading-gm") && !html.includes("infoCard"), "Item GM content is a callout and ordinary prose is not card-wrapped");
assert(!html.includes("Item artwork") && !html.includes("itemReferenceImage"), "item artwork is delegated to the shared visual rail");
for (const value of ["Magic Item", "staff", "arcane focus", "rare", "0 gp", "ash and silver", "Requires a spellcaster.", "0 of 7", "Storm Ward", "Lightning Bolt", "Broken during the crossing", "Stand against the storm", "The first owner still dreams through it."]) assert(html.toLowerCase().includes(value.toLowerCase()), `${value} renders`);
assert(html.includes('data-item-reference-id="npc-1"') && html.includes('data-item-reference-id="faction-1"'), "supported ownership links expose shared browser hooks");
assert(!html.includes('data-item-reference-id="location-1"'), "unsupported Location remains read-only");
assert.strictEqual((html.match(/<strong>Ween<\/strong>/g) || []).length, 1, "ownership relationship row is rendered once");
assert(!html.includes('"unknownResonance"') && !html.includes('"classification"'), "raw canonical JSON is not rendered");
assert(!/>(?:Save|Delete|Edit|Consume|Equip|Give to NPC|Use Charge)</i.test(html), "Item live view contains no mutation controls");

const sparse = api.buildItemReferenceViewModel({ visibilityMode: "gm", canonical: { version: 1, classification: {}, physical: {}, usage: {}, mechanics: {}, lore: {}, ownership: {} }, relationships: [] });
const sparseHtml = api.renderItemReferenceView(sparse);
assert(!Object.hasOwn(sparse.atAGlance, "value") && !Object.hasOwn(sparse.atAGlance, "weight"), "missing numeric values are omitted");
assert(!sparseHtml.includes("No image"), "view-level at a glance does not duplicate the shared missing-image placeholder");
assert(!sparseHtml.includes("Mechanics &amp; Usage") && !sparseHtml.includes("Capabilities &amp; Effects") && !sparseHtml.includes("GM Only"), "blank sections are omitted");
const malformed = api.buildItemReferenceViewModel({ canonical: { classification: {}, image: "file:unsafe" }, relationships: [] });
assert.strictEqual(malformed.atAGlance.image, undefined, "malformed image is safely rejected");

const legacyResolved = { visibilityMode: "gm", canonical: { id: "legacy", entity_type: "item", name: "Old Key", description: "A worn brass key.", data_json: { type: "key", tags: ["door"], source: "old notes" } }, relationships: [] };
const legacyModel = api.buildItemReferenceViewModel(legacyResolved);
const legacyHtml = api.renderItemReferenceView(legacyModel);
assert(legacyModel.legacy && legacyHtml.includes("Legacy Item record") && legacyHtml.includes("A worn brass key."), "legacy generic Item renders a useful degraded view");
assert(!legacyHtml.includes("Mechanics &amp; Usage"), "legacy Item does not invent empty canonical mechanics");

const publicResolved = JSON.parse(JSON.stringify(resolved));
publicResolved.visibilityMode = "public";
delete publicResolved.canonical.lore.secrets;
delete publicResolved.canonical.lore.gmNotes;
publicResolved.relationships = publicResolved.relationships.filter(item => item.otherEntity.id !== "creature-1");
const publicModel = api.buildItemReferenceViewModel(publicResolved);
const publicHtml = api.renderItemReferenceView(publicModel);
assert.strictEqual(publicModel.gm, null, "GM data is absent from public presentation model");
assert(!publicHtml.includes("GM Only") && !publicHtml.includes("Ash Drake"), "GM section and hidden authorised relationship are absent from public DOM");

let writes = 0;
const browser = browserApi.createReferenceBrowser({ resolveCanonicalEntityReference: async reference => ({ reference, canonical: {}, entity: {} }), save: () => { writes += 1; } });
(async () => {
  await browser.openReference({ entityType: "npc", entityId: "npc-1" });
  assert.strictEqual(writes, 0, "cross-reference navigation invokes no write API");
  const renderer = fs.readFileSync("src/renderer.js", "utf8");
  const index = fs.readFileSync("src/index.html", "utf8");
  assert(renderer.includes("data-item-reference-type") && renderer.includes("openReferenceBrowserReference"), "Item links reuse shared Reference Browser opener");
  assert(renderer.includes("buildItemReferenceViewModel") && index.includes("inGame/views/item-reference-view.js"), "Item presentation is wired into Reference Browser");
  assert(!renderer.includes('id: "reference-browser-consume"') && !renderer.includes('id: "reference-browser-use-charge"'), "Reference Browser adds no Item runtime actions");
  console.log("Item Reference View fixtures passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
