(() => {
  "use strict";

  const MAX_PACKAGE_BYTES = 5 * 1024 * 1024;
  const ACTIONS = ["all", "create", "update", "unchanged", "manual_review", "unsupported", "skipped"];
  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const label = value => String(value ?? "").replace(/_/g, " ").replace(/\b\w/g, character => character.toUpperCase());
  const identityKey = identity => [identity?.sourceSystem, identity?.sourceWorkspaceId, identity?.sourceEntityType, identity?.sourceEntityId].map(value => String(value ?? "")).join(":");
  const issue = (code, message) => ({ code, message });

  function deriveStatus(preview) {
    if (!preview?.valid) return "invalid";
    if ((preview.totals?.manualReview || 0) > 0 || preview.relationships?.some(item => item.proposedAction === "manual_review")) return "manual_review";
    if ((preview.warnings || []).length) return "warnings";
    return "valid";
  }

  function createAtlasImportPreviewController(options = {}) {
    if (typeof options.parsePackage !== "function" || typeof options.buildPreview !== "function") throw new TypeError("Atlas parser and preview builder are required.");
    let state = { status: "empty", file: null, parsed: null, preview: null, mode: "entities", actionFilter: "all", typeFilter: "all", search: "", selectedEntityKey: null, errors: [] };
    const listeners = new Set();
    const publish = () => listeners.forEach(listener => listener(clone(state)));
    const set = changes => { state = { ...state, ...changes }; publish(); };
    async function loadPackageText(file = {}) {
      const size = Number(file.size);
      if (Number.isFinite(size) && size > (options.maxBytes || MAX_PACKAGE_BYTES)) {
        set({ status: "invalid", file: { name: file.fileName || "Package", size }, parsed: null, preview: null, errors: [issue("ATLAS_PACKAGE_TOO_LARGE", "The selected package exceeds the 5 MB preview limit.")] });
        return clone(state);
      }
      set({ status: "loading", file: { name: file.fileName || "Atlas package", size: Number.isFinite(size) ? size : null }, parsed: null, preview: null, errors: [] });
      let raw;
      try { raw = JSON.parse(String(file.text ?? "")); }
      catch (error) {
        set({ status: "invalid", errors: [issue("INVALID_PACKAGE_JSON", "The selected file is not valid JSON.")] });
        return clone(state);
      }
      let parsed;
      try { parsed = options.parsePackage(raw); }
      catch (error) {
        set({ status: "invalid", errors: [issue("ATLAS_PACKAGE_PARSE_FAILED", error?.message || "The package could not be parsed.")] });
        return clone(state);
      }
      if (!parsed?.valid) {
        set({ status: "invalid", parsed: clone(parsed), errors: clone(parsed?.errors || [issue("INVALID_ATLAS_PACKAGE", "The package is not valid.")]) });
        return clone(state);
      }
      try {
        const dependencies = typeof options.getPreviewDependencies === "function" ? await options.getPreviewDependencies() : (options.previewDependencies || {});
        const preview = await options.buildPreview(parsed, dependencies);
        const firstKey = preview.entities?.[0] ? identityKey(preview.entities[0].externalIdentity) : null;
        set({ status: deriveStatus(preview), parsed: clone(parsed), preview: clone(preview), selectedEntityKey: firstKey, errors: clone(preview.errors || []) });
      } catch (error) {
        set({ status: "invalid", parsed: clone(parsed), preview: null, errors: [issue("ATLAS_PREVIEW_FAILED", error?.message || "The preview could not be built.")] });
      }
      return clone(state);
    }
    return Object.freeze({
      loadPackageText,
      clear: () => set({ status: "empty", file: null, parsed: null, preview: null, mode: "entities", actionFilter: "all", typeFilter: "all", search: "", selectedEntityKey: null, errors: [] }),
      showError: (error, fileName = null) => set({ status: "invalid", file: fileName ? { name: fileName, size: null } : null, parsed: null, preview: null, errors: [clone(error || issue("ATLAS_PREVIEW_FAILED", "The preview could not be built."))] }),
      setMode: mode => set({ mode: mode === "relationships" ? "relationships" : "entities" }),
      setActionFilter: value => set({ actionFilter: ACTIONS.includes(value) ? value : "all" }),
      setTypeFilter: value => set({ typeFilter: String(value || "all") }),
      setSearch: value => set({ search: String(value || "") }),
      selectEntity: key => set({ selectedEntityKey: String(key || "") }),
      getState: () => clone(state),
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
    });
  }

  function filteredEntities(state) {
    const query = state.search.trim().toLowerCase();
    return (state.preview?.entities || []).filter(entity => {
      const actionMatches = state.actionFilter === "all" || entity.proposedAction === state.actionFilter || (state.actionFilter === "skipped" && entity.proposedAction === "skip");
      const typeMatches = state.typeFilter === "all" || entity.entityType === state.typeFilter;
      const haystack = `${entity.name} ${entity.entityType} ${identityKey(entity.externalIdentity)}`.toLowerCase();
      return actionMatches && typeMatches && (!query || haystack.includes(query));
    });
  }

  function renderIssues(items, heading) {
    if (!items?.length) return "";
    return `<section class="atlasPreviewIssues" aria-label="${escapeHtml(heading)}"><h3>${escapeHtml(heading)}</h3>${items.map(item => `<p><strong>${escapeHtml(item.code || "Notice")}</strong> ${escapeHtml(item.message || item)}</p>`).join("")}</section>`;
  }

  function actionExplanation(entity) {
    return ({ create: "No matching Studio object was found.", update: "The external revision differs from the matched Studio object.", unchanged: "The matched Studio object has the same external revision.", manual_review: "The match or revision is ambiguous and needs review.", unsupported: "This entity type is not supported by the interchange contract." })[entity.proposedAction] || "This record would be skipped by a future apply workflow.";
  }

  function renderEntityDetail(state, entity) {
    if (!entity) return `<div class="atlasPreviewEmptyDetail"><h2>No entity selected</h2><p>Choose a result to inspect its dry-run assessment.</p></div>`;
    const key = identityKey(entity.externalIdentity);
    const dependencies = (state.preview.dependencies || []).filter(item => !item.requiredByExternalIdentity || identityKey(item.requiredByExternalIdentity) === key);
    const existing = entity.existingRecord || entity.existingEntity;
    const provenance = existing?.externalProvenance || existing?.data_json?.externalProvenance;
    const ownership = entity.ownershipSummary || {};
    const rows = [
      ["Source system", entity.externalIdentity?.sourceSystem], ["Workspace ID", entity.externalIdentity?.sourceWorkspaceId],
      ["Source entity ID", entity.externalIdentity?.sourceEntityId], ["Visibility", typeof entity.visibility === "string" ? entity.visibility : JSON.stringify(entity.visibility)],
      ["Source revision", entity.sourceRevision || "Not supplied"], ["Source hash", entity.sourceHash || "Not supplied"],
      ["Existing revision", provenance?.sourceRevision || "Not supplied"], ["Existing hash", provenance?.sourceHash || "Not supplied"],
      ["Match", entity.match], ["Revision comparison", entity.sourceComparison]
    ];
    return `<article class="atlasPreviewDetail">
      <header><div><span class="atlasPreviewEyebrow">${escapeHtml(label(entity.entityType))}</span><h2>${escapeHtml(entity.name || "Unnamed entity")}</h2><p>${escapeHtml(key)}</p></div><span class="atlasPreviewBadge atlasPreviewBadge--${escapeHtml(entity.proposedAction)}">${escapeHtml(label(entity.proposedAction))}</span></header>
      <section class="atlasPreviewDecision"><h3>Dry-run decision</h3><p>${escapeHtml(actionExplanation(entity))}</p></section>
      <dl>${rows.map(([term, value]) => `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>
      <section><h3>Existing Studio match</h3><p>${existing ? `${escapeHtml(existing.name || existing.title || existing.id || "Matched object")}${provenance ? ` · ${escapeHtml(identityKey(provenance))}` : ""}` : "No existing object matched."}</p></section>
      <section><h3>Ownership boundaries</h3><div class="atlasPreviewOwnership">${["atlasOwned", "studioOwned", "shared"].map(type => `<div><strong>${escapeHtml(label(type))}</strong><p>${escapeHtml((ownership[type] || []).join(", ") || "None declared")}</p></div>`).join("")}</div></section>
      <section><h3>Dependencies</h3>${dependencies.length ? dependencies.map(item => `<p><span class="atlasPreviewBadge">${escapeHtml(label(item.state))}</span> ${escapeHtml(identityKey(item.externalIdentity))} · ${escapeHtml(label(item.class))}${item.reason ? ` · ${escapeHtml(item.reason)}` : ""}${item.class === "required" && ["missing", "unsupported", "ambiguous"].includes(item.state) ? " · Required dependency needs review" : ""}</p>`).join("") : "<p>No package dependencies are associated with this entity.</p>"}</section>
      <section><h3>Package-linked summaries</h3><p>Geography records: ${Number(state.preview.packageSummary?.geographyRecords || 0)} · Ecology records: ${Number(state.preview.packageSummary?.ecologyRecords || 0)}</p><p>Assets: ${Object.entries(state.preview.packageSummary?.assets || {}).map(([name, count]) => `${escapeHtml(label(name))} ${Number(count || 0)}`).join(" · ") || "None"}</p></section>
      ${renderIssues(entity.warnings, "Entity warnings")}
    </article>`;
  }

  function renderRelationships(state) {
    const names = new Map((state.preview.entities || []).map(entity => [identityKey(entity.externalIdentity), entity.name]));
    const relationships = state.preview.relationships || [];
    return `<div class="atlasPreviewRelationshipView"><header><h2>Relationships</h2><p>${relationships.length} relationship${relationships.length === 1 ? "" : "s"} assessed. No relationships are created in preview.</p></header>${relationships.length ? relationships.map(item => {
      const sourceKey = identityKey(item.sourceExternalIdentity), targetKey = identityKey(item.targetExternalIdentity);
      return `<article class="atlasPreviewRelationship"><div><strong>${escapeHtml(names.get(sourceKey) || sourceKey)}</strong><span>${escapeHtml(label(item.type))}</span><strong>${escapeHtml(names.get(targetKey) || targetKey)}</strong></div><p><span class="atlasPreviewBadge">${escapeHtml(label(item.proposedAction))}</span> Source ${escapeHtml(label(item.sourceState))} · Target ${escapeHtml(label(item.targetState))} · ${item.typeSupported ? "Supported type" : "Unsupported type"} · Visibility ${escapeHtml(label(typeof item.visibility === "string" ? item.visibility : JSON.stringify(item.visibility)))}</p>${renderIssues(item.warnings, "Relationship warnings")}</article>`;
    }).join("") : "<p>No relationships are included in this package.</p>"}</div>`;
  }

  function renderLoaded(state) {
    const preview = state.preview;
    const entities = filteredEntities(state);
    const types = Object.keys(preview.packageSummary?.compiledByType || {});
    const selected = preview.entities.find(entity => identityKey(entity.externalIdentity) === state.selectedEntityKey) || entities[0] || null;
    const totals = preview.totals || {};
    const source = preview.packageSummary?.source || {};
    const selection = preview.packageSummary?.selection || [];
    const assets = preview.packageSummary?.assets || {};
    return `<div class="atlasPreviewShell">
      <header class="atlasPreviewHeader"><div><span class="atlasPreviewEyebrow">World Building · Read only</span><h1>Atlas Import Preview</h1><p>${escapeHtml(state.file?.name)} · Manifest v${escapeHtml(preview.packageSummary?.manifestVersion)} · ${escapeHtml(source.system || source.sourceSystem || "MasterForge Atlas")} · ${escapeHtml(source.workspaceName || source.workspaceId || source.sourceWorkspaceId || "Atlas workspace")}${source.workspaceRevision ? ` · Revision ${escapeHtml(source.workspaceRevision)}` : ""}</p></div><span class="atlasPreviewDryRun">Dry run — nothing will be changed</span></header>
      <section class="atlasPreviewPackageSummary" aria-label="Package summary"><p><strong>Exported</strong> ${escapeHtml(source.exportedAt || "Not supplied")}</p><p><strong>Selection</strong> ${escapeHtml(selection.map(item => item.name || item.externalIdentity?.sourceEntityId || item.id).filter(Boolean).join(", ") || "Whole package")}</p><p><strong>Selection type</strong> ${escapeHtml([...new Set(selection.map(item => item.type || item.externalIdentity?.sourceEntityType).filter(Boolean))].map(label).join(", ") || "Package")}</p><p><strong>Contents</strong> ${(preview.entities || []).length} entities · ${(preview.relationships || []).length} relationships · ${Number(preview.packageSummary?.geographyRecords || 0)} geography · ${Number(preview.packageSummary?.ecologyRecords || 0)} ecology · ${Object.values(assets).reduce((sum, count) => sum + Number(count || 0), 0)} assets · ${(preview.dependencies || []).length} dependencies</p></section>
      <section class="atlasPreviewTotals" aria-label="Preview totals">${[["Create",totals.create],["Update",totals.update],["Unchanged",totals.unchanged],["Manual review",totals.manualReview],["Unsupported",totals.unsupported],["Skipped",totals.skipped]].map(([name,count]) => `<div><strong>${Number(count || 0)}</strong><span>${name}</span></div>`).join("")}</section>
      ${renderIssues(preview.warnings, "Package warnings")}${renderIssues(preview.errors, "Package errors")}
      <div class="atlasPreviewMode" role="tablist"><button type="button" data-atlas-mode="entities" aria-selected="${state.mode === "entities"}">Entities</button><button type="button" data-atlas-mode="relationships" aria-selected="${state.mode === "relationships"}">Relationships (${(preview.relationships || []).length})</button></div>
      ${state.mode === "relationships" ? renderRelationships(state) : `<div class="atlasPreviewBrowser"><aside class="atlasPreviewRail"><label>Search<input type="search" data-atlas-search value="${escapeHtml(state.search)}" placeholder="Name, type, or external ID"></label><div class="atlasPreviewFilters"><div><span>Action</span>${ACTIONS.map(value => `<button type="button" data-atlas-action-filter="${value}" aria-pressed="${state.actionFilter === value}">${escapeHtml(label(value))}</button>`).join("")}</div><div><span>Entity type</span>${["all", ...types].map(value => `<button type="button" data-atlas-type-filter="${escapeHtml(value)}" aria-pressed="${state.typeFilter === value}">${escapeHtml(label(value))}</button>`).join("")}</div></div><p class="atlasPreviewResultSummary">Showing ${entities.length} of ${(preview.entities || []).length} entities</p><div class="atlasPreviewList">${entities.length ? entities.map(entity => `<button type="button" data-atlas-entity="${escapeHtml(identityKey(entity.externalIdentity))}" aria-current="${identityKey(entity.externalIdentity) === identityKey(selected?.externalIdentity) ? "true" : "false"}"><span><strong>${escapeHtml(entity.name || "Unnamed entity")}</strong><small>${escapeHtml(label(entity.entityType))} · ${escapeHtml(label(entity.match))}${entity.warnings?.length ? ` · ${entity.warnings.length} warning${entity.warnings.length === 1 ? "" : "s"}` : ""}</small></span><span class="atlasPreviewBadge atlasPreviewBadge--${escapeHtml(entity.proposedAction)}">${escapeHtml(label(entity.proposedAction))}</span></button>`).join("") : "<p>No entities match these filters.</p>"}</div></aside><main class="atlasPreviewWorkspace">${renderEntityDetail(state, selected)}</main></div>`}
    </div>`;
  }

  function renderAtlasImportPreview(state) {
    if (state.status === "empty") return `<div class="atlasPreviewLanding"><span class="atlasPreviewEyebrow">World Building · Read only</span><h1>Atlas Import Preview</h1><p>Choose a MasterForge Atlas JSON package to inspect proposed matches and changes. This workspace cannot write to Studio data.</p><button type="button" data-atlas-choose>Choose Package</button></div>`;
    if (state.status === "loading") return `<div class="atlasPreviewLanding" role="status"><h1>Reading package…</h1><p>Validating the manifest and building a read-only comparison.</p></div>`;
    if (!state.preview) return `<div class="atlasPreviewLanding atlasPreviewInvalid"><span class="atlasPreviewEyebrow">Package not loaded</span><h1>Atlas Package Invalid</h1><p>${escapeHtml(state.file?.name || "Selected package")} · No Studio data was changed.</p>${renderIssues(state.errors, "Validation errors")}<div><button type="button" data-atlas-choose>Choose Another Package</button><button type="button" data-atlas-clear>Close</button></div></div>`;
    return renderLoaded(state);
  }

  function createAtlasPreviewActions(controller, choosePackage) {
    return [
      { id: "atlas-preview-choose", label: "Choose Package", groupId: "package", groupLabel: "Package", order: 10, handler: choosePackage },
      { id: "atlas-preview-clear", label: "Clear Preview", groupId: "package", groupLabel: "Package", order: 20, enabled: () => controller.getState().status !== "empty", disabledReason: "No package is loaded.", handler: controller.clear },
      { id: "atlas-preview-show-all", label: "Show All Entities", groupId: "view", groupLabel: "Preview", order: 10, enabled: () => Boolean(controller.getState().preview), disabledReason: "Choose a package first.", handler: () => { controller.setMode("entities"); controller.setActionFilter("all"); controller.setTypeFilter("all"); } },
      { id: "atlas-preview-create", label: "Show Create", groupId: "view", groupLabel: "Preview", order: 20, enabled: () => Boolean(controller.getState().preview), disabledReason: "Choose a package first.", handler: () => { controller.setMode("entities"); controller.setActionFilter("create"); } },
      { id: "atlas-preview-update", label: "Show Update", groupId: "view", groupLabel: "Preview", order: 30, enabled: () => Boolean(controller.getState().preview), disabledReason: "Choose a package first.", handler: () => { controller.setMode("entities"); controller.setActionFilter("update"); } },
      { id: "atlas-preview-manual-review", label: "Show Manual Review", groupId: "view", groupLabel: "Preview", order: 40, enabled: () => Boolean(controller.getState().preview), disabledReason: "Choose a package first.", handler: () => { controller.setMode("entities"); controller.setActionFilter("manual_review"); } },
      { id: "atlas-preview-relationships", label: "Show Relationships", groupId: "view", groupLabel: "Preview", order: 50, enabled: () => Boolean(controller.getState().preview), disabledReason: "Choose a package first.", handler: () => controller.setMode("relationships") }
    ];
  }

  function mountAtlasImportPreview(options = {}) {
    const root = options.root;
    if (!root) return null;
    const controller = createAtlasImportPreviewController(options);
    async function choosePackage() {
      let selected;
      try { selected = await options.choosePackage(); }
      catch (error) { selected = { error: issue("ATLAS_PACKAGE_PICKER_FAILED", "The package picker could not be opened.") }; }
      if (!selected || selected.cancelled) return;
      if (selected.error) return controller.showError(selected.error, selected.fileName);
      await controller.loadPackageText(selected);
    }
    const render = state => {
      const restoreSearchFocus = root.ownerDocument?.activeElement?.matches?.("[data-atlas-search]") === true;
      const selectionStart = restoreSearchFocus ? root.ownerDocument.activeElement.selectionStart : null;
      root.innerHTML = renderAtlasImportPreview(state);
      if (restoreSearchFocus) {
        const search = root.querySelector("[data-atlas-search]");
        search?.focus();
        if (search && selectionStart !== null) search.setSelectionRange(selectionStart, selectionStart);
      }
      options.actionConsole?.refresh?.();
    };
    controller.subscribe(render);
    render(controller.getState());
    root.addEventListener("click", event => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.matches("[data-atlas-choose]")) choosePackage();
      else if (button.matches("[data-atlas-clear]")) controller.clear();
      else if (button.dataset.atlasMode) controller.setMode(button.dataset.atlasMode);
      else if (button.dataset.atlasActionFilter) controller.setActionFilter(button.dataset.atlasActionFilter);
      else if (button.dataset.atlasTypeFilter) controller.setTypeFilter(button.dataset.atlasTypeFilter);
      else if (button.dataset.atlasEntity) controller.selectEntity(button.dataset.atlasEntity);
    });
    root.addEventListener("input", event => { if (event.target.matches("[data-atlas-search]")) controller.setSearch(event.target.value); });
    options.actionConsole?.registerWorkspace?.("atlas-import", { title: "Atlas Preview Actions", actions: createAtlasPreviewActions(controller, choosePackage) });
    return controller;
  }

  const api = Object.freeze({ MAX_PACKAGE_BYTES, createAtlasImportPreviewController, createAtlasPreviewActions, filteredEntities, renderAtlasImportPreview, mountAtlasImportPreview });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.MasterForgeAtlasImportPreviewUi = api;
})();
