(() => {
  "use strict";

  const STORAGE_KEY = "masterforge.actionConsole.v1";
  const state = {
    initialised: false,
    activeWorkspaceId: null,
    activePageId: null,
    context: {},
    isOpen: true,
    isOverlay: false,
    busyActionId: null,
    registeredWorkspaces: new Map(),
    collapsedGroups: new Set()
  };
  let host = null;
  let shell = null;
  let toggleButton = null;
  let backdrop = null;
  let returnFocus = null;

  const resolve = (value, context, fallback) => {
    try { return typeof value === "function" ? value(context) : value ?? fallback; }
    catch (error) { console.error("Action Console resolver failed:", error); return fallback; }
  };
  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ isOpen: state.isOpen, collapsedGroups: [...state.collapsedGroups] })); }
    catch (error) { console.warn("Could not save Action Console preferences:", error); }
  };
  const load = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      state.isOpen = saved.isOpen !== false;
      state.collapsedGroups = new Set(Array.isArray(saved.collapsedGroups) ? saved.collapsedGroups : []);
    } catch (error) { console.warn("Could not load Action Console preferences:", error); }
  };
  const actions = () => state.registeredWorkspaces.get(state.activeWorkspaceId)?.actions || [];

  function getContextTitle() {
    const configured = state.registeredWorkspaces.get(state.activeWorkspaceId)?.title;
    if (configured) return resolve(configured, state.context, "Actions");
    const labels = {
      encounters: "Encounter Actions",
      entities: state.context.recordType === "faction" ? "Faction Actions" : "Entity Actions",
      region: "Location Actions"
    };
    return labels[state.activeWorkspaceId] || "Actions";
  }

  function applyShellState() {
    if (!shell || !host) return;
    shell.classList.add("has-action-console");
    shell.classList.toggle("is-action-console-open", state.isOpen);
    shell.classList.toggle("is-action-console-closed", !state.isOpen);
    shell.classList.toggle("is-action-console-overlay", state.isOverlay);
    host.classList.toggle("is-open", state.isOpen);
    host.classList.toggle("is-overlay", state.isOverlay);
    host.hidden = !state.isOpen;
    host.setAttribute("aria-hidden", String(!state.isOpen));
    toggleButton?.setAttribute("aria-expanded", String(state.isOpen));
    toggleButton?.classList.toggle("mf-button--active", state.isOpen);
    backdrop.hidden = !(state.isOverlay && state.isOpen);
    document.body.classList.toggle("is-action-console-overlay-open", state.isOverlay && state.isOpen);
  }

  function render() {
    if (!host) return;
    const available = actions().filter(action => resolve(action.visible, state.context, true));
    const groups = new Map();
    available.forEach(action => {
      const id = action.groupId || "actions";
      if (!groups.has(id)) groups.set(id, { id, label: action.groupLabel || "Actions", order: action.groupOrder || 0, actions: [] });
      groups.get(id).actions.push(action);
    });
    applyShellState();
    host.innerHTML = `<header class="masterforge-action-console__header"><div><strong>${getContextTitle()}</strong>${state.activePageId ? `<small>${String(state.activePageId).replace(/-/g, " ")}</small>` : ""}</div><button type="button" data-action-console-close aria-label="Close page actions">Close</button></header><div class="masterforge-action-console__body">${available.length ? [...groups.values()].sort((a,b) => a.order-b.order).map(group => {
      const collapsed = state.collapsedGroups.has(group.id);
      return `<section class="masterforge-action-group"><button type="button" class="masterforge-action-group__toggle" data-action-group="${group.id}" aria-expanded="${!collapsed}"><span>${group.label}</span><span aria-hidden="true">${collapsed ? "+" : "−"}</span></button><div class="masterforge-action-group__items" ${collapsed ? "hidden" : ""}>${group.actions.sort((a,b) => (a.order||0)-(b.order||0)).map(action => {
        const enabled = resolve(action.enabled, state.context, true) && state.busyActionId === null;
        const reason = enabled ? "" : resolve(action.disabledReason, state.context, "This action is unavailable.");
        const label = state.busyActionId === action.id ? (action.busyLabel || "Working…") : action.label;
        const badge = resolve(action.badge, state.context, null);
        if (typeof action.renderControl === "function") {
          return `<div class="masterforge-console-control" data-console-control="${action.id}">${action.renderControl({ ...state.context }) || ""}</div>`;
        }
        return `<button type="button" class="masterforge-console-action${action.danger ? " danger" : ""}" data-console-action="${action.id}" ${enabled ? "" : "disabled"} ${reason ? `title="${String(reason).replace(/\"/g, "&quot;")}" aria-description="${String(reason).replace(/\"/g, "&quot;")}"` : ""}><span>${label}</span>${badge == null ? "" : `<span class="masterforge-action-badge">${badge}</span>`}</button>`;
      }).join("")}</div></section>`;
    }).join("") : `<p class="masterforge-action-empty">No actions are available for this page.</p>`}</div>`;
    available.forEach(action => {
      if (typeof action.bindControl !== "function") return;
      const control = host.querySelector(`[data-console-control="${action.id}"]`);
      if (control) action.bindControl(control, { ...state.context });
    });
  }

  async function handleClick(event) {
    if (event.target.closest("[data-action-console-close]")) return close();
    const groupButton = event.target.closest("[data-action-group]");
    if (groupButton) {
      const id = groupButton.dataset.actionGroup;
      state.collapsedGroups.has(id) ? state.collapsedGroups.delete(id) : state.collapsedGroups.add(id);
      save(); render(); return;
    }
    const button = event.target.closest("[data-console-action]");
    if (!button || state.busyActionId) return;
    const action = actions().find(item => item.id === button.dataset.consoleAction);
    if (!action || !resolve(action.enabled, state.context, true)) return;
    state.busyActionId = action.id; render();
    try { await action.handler?.({ ...state.context }); }
    catch (error) { console.error(`Action ${action.id} failed:`, error); alert(error?.message || `${action.label} failed.`); }
    finally { state.busyActionId = null; render(); }
  }
  function initialise(options = {}) {
    if (state.initialised) return api;
    host = options.host || document.querySelector("#masterForgeActionConsole");
    if (!host) throw new Error("Action Console host was not found.");
    shell = options.shell || document.querySelector("#mainLayout");
    toggleButton = options.toggleButton || document.querySelector("#actionConsoleToggle");
    backdrop = options.backdrop || document.querySelector("#masterForgeActionConsoleBackdrop");
    load(); state.initialised = true;
    host.addEventListener("click", handleClick);
    backdrop?.addEventListener("click", close);
    window.addEventListener("resize", refreshResponsiveMode);
    document.addEventListener("keydown", event => { if (event.key === "Escape" && state.isOverlay && state.isOpen) close(); });
    refreshResponsiveMode(); render(); return api;
  }
  function registerWorkspace(id, definition = {}) { state.registeredWorkspaces.set(id, { ...definition, actions: [...(definition.actions || [])] }); if (id === state.activeWorkspaceId) render(); }
  function unregisterWorkspace(id) { state.registeredWorkspaces.delete(id); if (id === state.activeWorkspaceId) clear(); }
  function setActiveWorkspace(id, context = {}) { state.activeWorkspaceId = id || null; state.context = { ...context }; render(); }
  function setContext(context = {}) { state.context = { ...context }; state.activePageId = context.pageId || null; render(); }
  function updateContext(patch = {}) { setContext({ ...state.context, ...patch }); }
  function updateAction(id, patch = {}) { const workspace = state.registeredWorkspaces.get(state.activeWorkspaceId); const action = workspace?.actions.find(item => item.id === id); if (action) Object.assign(action, patch); render(); }
  function open() { returnFocus = document.activeElement; state.isOpen = true; save(); render(); requestAnimationFrame(() => host?.querySelector("button")?.focus()); }
  function openGroup(id) { if (id) state.collapsedGroups.delete(id); open(); requestAnimationFrame(() => host?.querySelector(`[data-action-group="${id}"]`)?.focus()); }
  function close() { state.isOpen = false; save(); render(); (returnFocus?.isConnected ? returnFocus : toggleButton)?.focus?.(); }
  function toggle() { state.isOpen ? close() : open(); }
  function clear() { state.activeWorkspaceId = null; state.activePageId = null; state.context = {}; state.busyActionId = null; render(); }
  function refreshResponsiveMode() { state.isOverlay = window.matchMedia("(max-width: 1050px)").matches; applyShellState(); render(); }
  function destroy() { if (host) host.removeEventListener("click", handleClick); backdrop?.removeEventListener("click", close); state.registeredWorkspaces.clear(); state.initialised = false; host = null; shell = null; toggleButton = null; backdrop = null; }

  const api = Object.freeze({ initialise, registerWorkspace, unregisterWorkspace, setActiveWorkspace, setContext, updateContext, updateAction, refresh: render, open, openGroup, close, toggle, clear, destroy });
  window.MasterForgeActionConsole = api;
})();
