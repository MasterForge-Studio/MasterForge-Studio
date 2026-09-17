(() => {
  "use strict";

  function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function text(value) { return String(value ?? "").trim(); }
  function slug(value) { return text(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `item-${Date.now()}`; }
  function itemSummary(item) { return text(item.lore?.summary || item.description).slice(0, 240); }
  function externalIdentity(value) {
    const source = isObject(value?.externalProvenance) ? value.externalProvenance : null;
    if (!source) return null;
    const identity = { sourceSystem: text(source.sourceSystem).toLowerCase(), sourceWorkspaceId: text(source.sourceWorkspaceId), sourceEntityType: text(source.sourceEntityType).toLowerCase(), sourceEntityId: text(source.sourceEntityId) };
    return Object.values(identity).every(Boolean) ? identity : null;
  }
  function mirrorForItem(item, existing = null, scope = {}) {
    const existingData = isObject(existing?.data_json) ? existing.data_json : {};
    return {
      ...(existing || {}), id: item.id, entity_type: "item", name: item.name || "Unnamed Item", description: itemSummary(item),
      data_json: {
        ...existingData, source: "item-builder", itemId: item.id,
        systemId: item.mechanics.system || existingData.systemId || "",
        itemType: item.classification.type || "", rarity: item.classification.rarity || "",
        tags: [...item.classification.tags], scope: { ...(existingData.scope || {}), ...scope },
        canonicalSource: item.canonicalSource || existingData.canonicalSource || "", sourceTitle: item.sourceTitle || "", sourceReference: item.sourceReference || "",
        ...(externalIdentity(item) ? { externalIdentity: externalIdentity(item) } : {})
      }
    };
  }

  function createItemBuilderController(dependencies = {}) {
    const model = dependencies.model;
    if (!model?.normalizeItemRecord) throw new TypeError("Item model dependency is required.");
    let currentId = null;
    let legacyEntity = null;
    let draft = model.createDefaultItem();

    async function list() {
      const records = typeof dependencies.listRecords === "function" ? await dependencies.listRecords("items") : [];
      const entities = typeof dependencies.listEntities === "function" ? await dependencies.listEntities("item") : [];
      const canonicalIds = new Set((records || []).map(item => text(item.id)));
      const legacy = (entities || []).filter(entity => !entity.data_json?.itemId && !entity.data_json?.sourceCollection && !canonicalIds.has(text(entity.id)));
      return [
        ...(records || []).map(item => ({ kind: "canonical", id: text(item.id), name: item.name || item.id, item: model.normalizeItemRecord(item) })),
        ...legacy.map(entity => ({ kind: "legacy", id: text(entity.id), name: entity.name || entity.id, entity: clone(entity) }))
      ];
    }
    function beginNew() { currentId = null; legacyEntity = null; draft = model.createDefaultItem(); return getState(); }
    function openCanonical(item) { draft = model.normalizeItemRecord(item); currentId = draft.id || null; legacyEntity = null; return getState(); }
    function openLegacy(entity) {
      const data = isObject(entity?.data_json) ? entity.data_json : {};
      draft = model.normalizeItemRecord({ id: entity.id, name: entity.name, description: entity.description, image: data.image || data.imageUrl || "", classification: { type: data.itemType || data.type || "", subtype: data.subtype || "", category: data.category || "", rarity: data.rarity || "", tags: data.tags || [] }, lore: { summary: data.summary || "" } });
      currentId = null; legacyEntity = clone(entity); return getState();
    }
    function setDraft(value) { draft = model.normalizeItemRecord(value); return getState(); }
    function getState() { return { currentId, legacyEntity: legacyEntity ? clone(legacyEntity) : null, draft: model.cloneItemRecord(draft), adoptionPending: Boolean(legacyEntity && !currentId) }; }
    async function save(value, scope = {}) {
      const wasAdoption = Boolean(legacyEntity && !currentId);
      const item = model.normalizeItemRecord(value || draft);
      if (!text(item.name)) throw new Error("Item name is required.");
      item.id = currentId || text(legacyEntity?.id) || text(item.id) || (dependencies.slugify || slug)(item.name);
      const existingMirror = typeof dependencies.getEntity === "function" ? await dependencies.getEntity("item", item.id) : null;
      await dependencies.saveRecord("items", item.id, item, scope.worldId || scope.campaignId || "global");
      const mirror = mirrorForItem(item, existingMirror || legacyEntity, scope);
      if (existingMirror || legacyEntity) await dependencies.updateEntity("item", item.id, mirror);
      else await dependencies.createEntity(mirror);
      currentId = item.id; legacyEntity = null; draft = model.cloneItemRecord(item);
      return { item: model.cloneItemRecord(item), mirror: clone(mirror), adopted: wasAdoption };
    }
    async function remove() {
      if (!currentId) throw new Error("Select a saved Item first.");
      if (typeof dependencies.getRelationships === "function" && typeof dependencies.deleteRelationship === "function") {
        const relationships = await dependencies.getRelationships("item", currentId);
        for (const relationship of [...(relationships || [])]) if (relationship?.id) await dependencies.deleteRelationship(relationship.id);
      }
      if (typeof dependencies.deleteEntity === "function") await dependencies.deleteEntity("item", currentId);
      if (typeof dependencies.deleteRecord === "function") await dependencies.deleteRecord(currentId);
      return beginNew();
    }
    return Object.freeze({ list, beginNew, openCanonical, openLegacy, setDraft, getState, save, remove });
  }

  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
  function field(label, key, value, options = {}) {
    const input = options.textarea ? `<textarea data-item-field="${key}">${escapeHtml(value)}</textarea>` : `<input data-item-field="${key}" type="${options.type || "text"}" value="${escapeHtml(value ?? "")}">`;
    return `<label class="itemBuilderField ${options.wide ? "itemBuilderField--wide" : ""}"><span>${escapeHtml(label)}</span>${input}</label>`;
  }
  function check(label, key, value) { return `<label class="itemBuilderCheck"><input data-item-field="${key}" type="checkbox" ${value ? "checked" : ""}> ${escapeHtml(label)}</label>`; }
  function rows(kind, entries) {
    const fields = kind === "property" ? ["key", "value"] : ["name", "description"];
    return `<div class="itemBuilderRows" data-item-rows="${kind}">${entries.map((entry, index) => `<div class="itemBuilderRow" data-index="${index}">${fields.map(key => `<input data-row-field="${key}" value="${escapeHtml(entry[key] ?? "")}" placeholder="${key === "key" ? "Property" : key === "value" ? "Value" : key === "name" ? "Name" : "Description"}">`).join("")}<button type="button" data-remove-row="${kind}" aria-label="Remove ${kind}">Remove</button></div>`).join("")}</div><button type="button" data-add-row="${kind}">Add ${kind === "property" ? "Property" : kind === "effect" ? "Effect" : "Capability"}</button>`;
  }

  function mountItemBuilder(options = {}) {
    const root = options.root;
    if (!root || !options.model) return null;
    const controller = createItemBuilderController({
      model: options.model, listRecords: collection => options.api.getAllRecordsInCollection(collection), listEntities: type => options.api.getEntitiesByType(type),
      getEntity: (...args) => options.api.getEntity(...args), saveRecord: (...args) => options.api.saveRecord(...args), createEntity: value => options.api.createEntity(value),
      updateEntity: (...args) => options.api.updateEntity(...args), deleteEntity: (...args) => options.api.deleteEntity(...args), deleteRecord: id => options.api.deleteRecord(id),
      getRelationships: (...args) => options.api.getEntityRelationships(...args), deleteRelationship: id => options.api.deleteRelationship(id), slugify: options.slugify
    });
    let activeTab = "overview", records = [], busy = false;
    const tabLabels = { overview: "Overview", mechanics: "Mechanics", lore: "Lore", ownership: "Ownership & Location", relationships: "Relationships", technical: "Technical / Source" };

    function collect() {
      const current = controller.getState().draft;
      root.querySelectorAll("[data-item-field]").forEach(input => {
        const path = input.dataset.itemField.split("."); let target = current;
        while (path.length > 1) target = target[path.shift()];
        const key = path[0];
        if (input.type === "checkbox") target[key] = input.checked;
        else if (input.type === "number") target[key] = input.value === "" ? null : Number(input.value);
        else target[key] = input.value;
      });
      if (activeTab === "overview") current.classification.tags = text(root.querySelector('[data-item-field="classification.tags"]')?.value).split(/[,;\n]/).map(value => value.trim()).filter(Boolean);
      if (activeTab === "mechanics") {
        current.mechanics.properties = Object.fromEntries([...root.querySelectorAll('[data-item-rows="property"] .itemBuilderRow')].map(row => {
          const key = text(row.querySelector('[data-row-field="key"]')?.value), displayed = row.querySelector('[data-row-field="value"]')?.value || "", original = current.mechanics.properties[key];
          return [key, isObject(original) && JSON.stringify(original) === displayed ? original : displayed];
        }).filter(([key]) => key));
        for (const kind of ["effect", "capability"]) current.mechanics[`${kind}s`] = [...root.querySelectorAll(`[data-item-rows="${kind}"] .itemBuilderRow`)].map((row, index) => ({ ...(current.mechanics[`${kind}s`][index] || {}), name: row.querySelector('[data-row-field="name"]')?.value || "", description: row.querySelector('[data-row-field="description"]')?.value || "" })).filter(entry => entry.name || entry.description);
      }
      controller.setDraft(current); return current;
    }
    function renderPreview(item) { return item.image ? `<img src="${escapeHtml(item.image)}" alt="Item image">` : `<span>No image</span>`; }
    function renderWorkspace() {
      const state = controller.getState(), item = state.draft;
      const typeOptions = options.model.ITEM_TYPES.map(type => `<option value="${type}" ${item.classification.type === type ? "selected" : ""}>${escapeHtml(type.replaceAll("_", " ").replace(/\b\w/g, value => value.toUpperCase()))}</option>`).join("");
      let body = "";
      if (activeTab === "overview") body = `<div class="itemBuilderOverview"><section class="itemBuilderImage"><div data-item-image-preview>${renderPreview(item)}</div><input data-item-image-input type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden><div><button type="button" data-item-upload>${item.image ? "Replace" : "Upload Image"}</button><button type="button" data-item-remove-image ${item.image ? "" : "disabled"}>Remove</button></div></section><div class="itemBuilderGrid">${field("Name", "name", item.name)}<label class="itemBuilderField"><span>Type</span><select data-item-field="classification.type"><option value=""></option>${typeOptions}${item.classification.type && !options.model.ITEM_TYPES.includes(item.classification.type) ? `<option selected value="${escapeHtml(item.classification.type)}">${escapeHtml(item.classification.type)} (custom)</option>` : ""}</select></label>${field("Subtype", "classification.subtype", item.classification.subtype)}${field("Category", "classification.category", item.classification.category)}${field("Rarity", "classification.rarity", item.classification.rarity)}${field("Tags", "classification.tags", item.classification.tags.join(", "))}${field("Description", "description", item.description, { textarea: true, wide: true })}${field("Quantity", "physical.quantity", item.physical.quantity, { type: "number" })}${field("Weight", "physical.weight", item.physical.weight, { type: "number" })}${field("Value", "physical.value", item.physical.value, { type: "number" })}${field("Currency", "physical.currency", item.physical.currency)}${field("Material", "physical.material", item.physical.material)}${field("Size", "physical.size", item.physical.size)}</div></div>`;
      if (activeTab === "mechanics") body = `<div class="itemBuilderGrid">${field("System", "mechanics.system", item.mechanics.system)}${check("Attunement Required", "usage.attunementRequired", item.usage.attunementRequired)}${check("Consumable", "usage.consumable", item.usage.consumable)}${check("Stackable", "usage.stackable", item.usage.stackable)}${field("Attunement Notes", "usage.attunementNotes", item.usage.attunementNotes, { textarea: true, wide: true })}${field("Charges", "usage.charges", item.usage.charges, { type: "number" })}${field("Maximum Charges", "usage.maxCharges", item.usage.maxCharges, { type: "number" })}${field("Recharge", "usage.recharge", item.usage.recharge)}${field("Uses", "usage.uses", item.usage.uses)}</div><section class="itemBuilderRepeatable"><h3>Properties</h3>${rows("property", Object.entries(item.mechanics.properties).map(([key, value]) => ({ key, value: typeof value === "string" || typeof value === "number" ? value : JSON.stringify(value) })))}</section><section class="itemBuilderRepeatable"><h3>Effects</h3>${rows("effect", item.mechanics.effects)}</section><section class="itemBuilderRepeatable"><h3>Capabilities</h3><p>Capability entries use the shared name/description foundation and preserve additional canonical fields.</p>${rows("capability", item.mechanics.capabilities)}</section>`;
      if (activeTab === "lore") body = `<section><h3>Player-facing Lore</h3><div class="itemBuilderGrid">${field("Summary", "lore.summary", item.lore.summary, { textarea: true, wide: true })}${field("History", "lore.history", item.lore.history, { textarea: true, wide: true })}${field("Origin", "lore.origin", item.lore.origin, { textarea: true })}${field("Inscriptions", "lore.inscriptions", item.lore.inscriptions, { textarea: true })}</div></section><section class="itemBuilderGm"><h3>GM Only</h3><div class="itemBuilderGrid">${field("Secrets", "lore.secrets", item.lore.secrets, { textarea: true })}${field("GM Notes", "lore.gmNotes", item.lore.gmNotes, { textarea: true })}</div></section>`;
      if (activeTab === "ownership") body = `<p class="itemBuilderGuidance">Named owners and actual locations are relationships, not fields on the Item record.</p><div class="itemBuilderGrid">${field("Ownership Status", "ownership.status", item.ownership.status)}${field("Status Notes", "ownership.notes", item.ownership.notes, { textarea: true, wide: true })}</div>`;
      if (activeTab === "relationships") body = `<div data-item-relationships><p class="forgeEmptyState">${state.currentId ? "Loading Item relationships…" : "Save or adopt this Item before creating relationships."}</p></div>`;
      if (activeTab === "technical") body = `<div class="itemBuilderGrid">${field("Canonical Source", "canonicalSource", item.canonicalSource)}${field("Source Title", "sourceTitle", item.sourceTitle)}${field("Source Reference", "sourceReference", item.sourceReference)}<div class="itemBuilderTechnical"><strong>Canonical identity</strong><span>${escapeHtml(item.id || "Assigned on save")}</span><strong>Schema</strong><span>Item v${item.version}</span></div></div>`;
      root.querySelector("[data-item-workspace]").innerHTML = body;
      wireWorkspace();
      if (activeTab === "relationships" && state.currentId) void renderRelationships(state.currentId);
    }
    async function renderRelationships(id) {
      const host = root.querySelector("[data-item-relationships]"); if (!host) return;
      const relationships = await options.api.getEntityRelationships("item", id);
      host.innerHTML = relationships?.length ? relationships.map(value => `<article class="itemBuilderRelationship"><strong>${escapeHtml(value.relationship || value.relationshipType)}</strong><span>${escapeHtml(value.from_id === id ? `${value.to_type}: ${value.to_id}` : `${value.from_type}: ${value.from_id}`)}</span></article>`).join("") : `<p class="forgeEmptyState">No Item relationships yet. Use the Entity Library relationship workspace to add carried, stored, located, ownership, or story links.</p>`;
    }
    function wireWorkspace() {
      root.querySelectorAll("[data-add-row]").forEach(button => button.onclick = () => { collect(); const item = controller.getState().draft; const kind = button.dataset.addRow; if (kind === "property") item.mechanics.properties[`property_${Object.keys(item.mechanics.properties).length + 1}`] = ""; else item.mechanics[`${kind}s`].push({ name: "", description: "" }); controller.setDraft(item); renderWorkspace(); });
      root.querySelectorAll("[data-remove-row]").forEach(button => button.onclick = () => { const kind = button.dataset.removeRow; const index = Number(button.closest(".itemBuilderRow").dataset.index); const item = collect(); if (kind === "property") delete item.mechanics.properties[Object.keys(item.mechanics.properties)[index]]; else item.mechanics[`${kind}s`].splice(index, 1); controller.setDraft(item); renderWorkspace(); });
      const file = root.querySelector("[data-item-image-input]");
      root.querySelector("[data-item-upload]")?.addEventListener("click", () => file?.click());
      root.querySelector("[data-item-remove-image]")?.addEventListener("click", () => { const item = collect(); item.image = ""; controller.setDraft(item); renderWorkspace(); refreshActions(); });
      if (file) file.onchange = async () => { const selected = file.files?.[0]; if (!selected) return; try { const item = collect(); item.image = await options.readImage(selected); controller.setDraft(item); renderWorkspace(); refreshActions(); } catch (error) { options.notify(error.message, "error"); } };
    }
    function renderShell() {
      const state = controller.getState();
      root.innerHTML = `<div class="itemBuilderShell"><aside class="itemBuilderRail infoCard"><header><h1>Item Builder</h1><input type="search" data-item-search placeholder="Search Items"></header><div data-item-list></div><footer>${records.length} Item${records.length === 1 ? "" : "s"}</footer></aside><main class="itemBuilderMain infoCard"><header><div><h1 data-item-title>${escapeHtml(state.draft.name || "New Item")}</h1>${state.adoptionPending ? `<p class="itemBuilderAdoption">Legacy Item — saving explicitly adopts it as a first-class Item.</p>` : ""}</div></header><nav class="itemBuilderTabs">${Object.entries(tabLabels).map(([key, label]) => `<button type="button" data-item-tab="${key}" class="${activeTab === key ? "active" : ""}">${escapeHtml(label)}</button>`).join("")}</nav><div class="itemBuilderWorkspace" data-item-workspace></div></main></div>`;
      wireShell(); renderList(); renderWorkspace(); refreshActions();
    }
    function renderList() {
      const host = root.querySelector("[data-item-list]"); const query = text(root.querySelector("[data-item-search]")?.value).toLowerCase();
      const filtered = records.filter(entry => entry.name.toLowerCase().includes(query));
      host.innerHTML = filtered.length ? filtered.map(entry => `<button type="button" data-item-kind="${entry.kind}" data-item-id="${escapeHtml(entry.id)}"><strong>${escapeHtml(entry.name)}</strong><small>${entry.kind === "legacy" ? "Legacy generic Item" : escapeHtml(entry.item.classification.type || "Item")}</small></button>`).join("") : `<p class="forgeEmptyState">No matching Items.</p>`;
      host.querySelectorAll("[data-item-id]").forEach(button => button.onclick = () => { collect(); const entry = records.find(value => value.id === button.dataset.itemId && value.kind === button.dataset.itemKind); if (entry.kind === "legacy") controller.openLegacy(entry.entity); else controller.openCanonical(entry.item); activeTab = "overview"; renderShell(); });
    }
    function wireShell() {
      root.querySelector("[data-item-search]").oninput = renderList;
      root.querySelectorAll("[data-item-tab]").forEach(button => button.onclick = () => { collect(); activeTab = button.dataset.itemTab; renderShell(); });
    }
    async function reload() { records = await controller.list(); renderShell(); }
    async function save() {
      if (busy) return; busy = true; refreshActions();
      try { const state = controller.getState(); await controller.save(collect(), options.scope()); await reload(); options.notify(state.adoptionPending ? "Legacy Item adopted and saved." : "Item saved."); }
      catch (error) { options.notify(error.message, "error"); } finally { busy = false; refreshActions(); }
    }
    async function remove() { const state = controller.getState(); if (!state.currentId || !confirm(`Delete ${state.draft.name || state.currentId} permanently?`)) return; try { await controller.remove(); activeTab = "overview"; await reload(); options.notify("Item deleted."); } catch (error) { options.notify(error.message, "error"); } }
    function refreshActions() {
      options.actionConsole?.registerWorkspace("items", { title: "Item Actions", actions: [
        ...Object.entries(tabLabels).map(([key, label], index) => ({ id: `item-section-${key}`, label, groupId: "item-sections", groupLabel: "Item Sections", groupOrder: 5, order: index * 10, badge: () => activeTab === key ? "Active" : null, handler: () => { collect(); activeTab = key; renderShell(); } })),
        { id: "new-item", label: "New Item", groupId: "record", groupLabel: "Record", order: 10, handler: () => { controller.beginNew(); activeTab = "overview"; renderShell(); } },
        { id: "save-item", label: "Save Item", groupId: "record", groupLabel: "Record", order: 20, enabled: () => !busy && Boolean(controller.getState().draft), handler: save },
        { id: "delete-item", label: "Delete Item", groupId: "lifecycle", groupLabel: "Lifecycle", order: 10, danger: true, enabled: () => Boolean(controller.getState().currentId) && !busy, handler: remove }
      ] });
      options.actionConsole?.refresh();
    }
    async function openEntity(entity) {
      records = await controller.list();
      const canonicalId = text(entity?.data_json?.itemId || entity?.data_json?.sourceId || entity?.id);
      const entry = records.find(value => value.kind === "canonical" && value.id === canonicalId) || records.find(value => value.kind === "legacy" && value.id === text(entity?.id));
      if (entry?.kind === "canonical") controller.openCanonical(entry.item);
      else controller.openLegacy(entry?.entity || entity);
      activeTab = "overview";
      renderShell();
    }
    void reload();
    return Object.freeze({ controller, reload, save, remove, openEntity });
  }

  const api = Object.freeze({ mirrorForItem, createItemBuilderController, mountItemBuilder });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.MasterForgeItemBuilder = api;
})();
