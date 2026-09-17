(() => {
  "use strict";

  const MEMBER_TYPES = new Set(["member_of", "secretly_member_of"]);
  const LEADER_TYPES = new Set(["leader_of", "leads", "commands", "secretly_commands"]);
  const LOCATION_TYPES = new Set(["based_in", "located_in", "operates_from", "stationed_at"]);
  const ALLY_TYPES = new Set(["ally", "allied", "allied_with", "supports"]);
  const ENEMY_TYPES = new Set(["enemy", "enemy_of", "rival", "rival_of", "hostile_to", "opposes"]);
  const NEUTRAL_TYPES = new Set(["neutral", "transactional", "trades_with", "client_of", "patron_of"]);
  const BROWSER_TYPES = new Set(["npc", "creature", "faction", "item"]);

  function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
  function text(value) { return typeof value === "string" ? value.trim() : ""; }
  function strings(value) { return Array.isArray(value) ? value.map(text).filter(Boolean) : []; }
  function title(value) {
    return text(value).replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
  }
  function image(value) {
    const source = text(value);
    return /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(source) ? source : "";
  }
  function compactObject(value = {}) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== "" && item !== null && item !== undefined));
  }
  function entry(value, fallbackType = "") {
    if (typeof value === "string") return text(value) ? { name: text(value), entityType: fallbackType, entityId: "", role: "", detail: "", openable: false } : null;
    if (!isObject(value)) return null;
    const entityType = text(value.entityType || value.entity_type || value.type || fallbackType).toLowerCase();
    const entityId = text(value.entityId || value.entity_id || value.id);
    const name = text(value.name || value.label || value.title || entityId);
    if (!name) return null;
    return {
      name, entityType, entityId,
      role: text(value.role || value.rank || value.position || value.displayTitle),
      detail: text(value.description || value.summary || value.notes),
      openable: BROWSER_TYPES.has(entityType) && Boolean(entityId)
    };
  }
  function relationEntry(relationship) {
    if (!isObject(relationship)) return null;
    const other = relationship.otherEntity || {};
    const metadata = isObject(relationship.metadata) ? relationship.metadata : {};
    const base = entry({
      entityType: other.type,
      entityId: other.id,
      name: other.name,
      role: metadata.role || metadata.title || metadata.rank || metadata.position,
      description: metadata.summary || metadata.description
    });
    if (!base) return null;
    return {
      ...base,
      relationshipType: text(relationship.type),
      relationshipLabel: text(relationship.label) || title(relationship.type),
      direction: text(relationship.direction),
      status: text(relationship.status),
      detail: base.detail || text(relationship.notes)
    };
  }
  function unique(entries) {
    const seen = new Set();
    return entries.filter(Boolean).filter(item => {
      const key = `${item.entityType}:${item.entityId}:${item.name}:${item.role}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function hierarchyModel(data = {}) {
    const nodes = Array.isArray(data.factionHierarchy?.nodes) ? data.factionHierarchy.nodes : [];
    const safe = nodes.filter(isObject).filter(node => node.hidden !== true && node.active !== false).map(node => ({
      id: text(node.id), name: text(node.name || node.displayTitle), type: title(node.nodeType),
      parents: Array.isArray(node.parentNodeIds) ? node.parentNodeIds.map(text).filter(Boolean) : []
    })).filter(node => node.name);
    if (!safe.length) return [];
    const names = new Map(safe.map(node => [node.id, node.name]));
    return safe.map(node => ({ name: node.name, type: node.type, parents: node.parents.map(id => names.get(id) || id) }));
  }
  function relationshipGroup(type) {
    if (ALLY_TYPES.has(type)) return "allies";
    if (ENEMY_TYPES.has(type)) return "enemies";
    if (NEUTRAL_TYPES.has(type)) return "neutral";
    return "other";
  }

  function buildFactionReferenceViewModel(resolved = {}) {
    const canonical = isObject(resolved.canonical) ? resolved.canonical : {};
    const data = isObject(canonical.data_json) ? canonical.data_json : {};
    const lore = isObject(data.factionLore) ? data.factionLore : {};
    const publicLore = isObject(lore.public) ? lore.public : {};
    const gmLore = resolved.visibilityMode === "public" ? null : (isObject(lore.gm) ? lore.gm : null);
    const relationships = Array.isArray(resolved.relationships) ? resolved.relationships.map(relationEntry).filter(Boolean) : [];
    const structuredLeadership = [data.leadership, data.leaders, canonical.leadership, canonical.leaders].flatMap(value => Array.isArray(value) ? value : []).map(value => entry(value, "npc"));
    const structuredMembers = [data.members, canonical.members].flatMap(value => Array.isArray(value) ? value : []).map(value => entry(value, "npc"));
    const leadership = unique([...structuredLeadership, ...relationships.filter(item => LEADER_TYPES.has(item.relationshipType))]);
    const members = unique([...structuredMembers, ...relationships.filter(item => MEMBER_TYPES.has(item.relationshipType))]);
    const locations = unique([
      ...[data.locations, canonical.locations].flatMap(value => Array.isArray(value) ? value : []).map(value => entry(value, "location")),
      ...relationships.filter(item => LOCATION_TYPES.has(item.relationshipType) || ["location", "settlement"].includes(item.entityType))
    ]);
    const generalRelationships = relationships.filter(item => !MEMBER_TYPES.has(item.relationshipType) && !LEADER_TYPES.has(item.relationshipType) && !LOCATION_TYPES.has(item.relationshipType));
    const groupedRelationships = { allies: [], enemies: [], neutral: [], other: [] };
    generalRelationships.forEach(item => groupedRelationships[relationshipGroup(item.relationshipType)].push(item));
    const renown = canonical.renown ?? canonical.reputation ?? data.renown ?? data.reputation;
    const gm = gmLore && compactObject({
      secrets: strings(gmLore.secrets), hiddenGoals: strings(gmLore.hiddenGoals),
      hiddenHistory: text(gmLore.hiddenHistory), futurePlans: text(gmLore.futurePlans)
    });
    return {
      atAGlance: compactObject({
        emblem: image(publicLore.symbolImage), motto: text(publicLore.motto), concept: text(publicLore.concept),
        motif: text(publicLore.symbol), identity: text(publicLore.identity),
        scope: text(canonical.scope || data.scope?.label || data.scope?.name),
        renown: renown === undefined || renown === null || renown === "" ? "" : String(renown)
      }),
      currentSituation: compactObject({
        status: text(publicLore.currentStatus), trajectory: text(publicLore.currentTrajectory), hooks: strings(publicLore.playerHooks)
      }),
      leadership, members, hierarchy: hierarchyModel(data), groupedRelationships,
      operations: compactObject({
        goals: strings(publicLore.goals), motivation: text(publicLore.motivation), methods: strings(publicLore.methods),
        resources: strings(publicLore.resources), structure: text(publicLore.structure), tensions: strings(publicLore.internalTensions)
      }),
      locations,
      history: compactObject({ history: text(publicLore.history), founding: text(publicLore.founding), turningPoints: strings(publicLore.turningPoints) }),
      gm: gm && Object.keys(gm).length ? gm : null
    };
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }
  function valueBlock(label, value) {
    if (!value) return "";
    return `<div class="factionReferenceValue mf-reading-prose"><h3 class="mf-reading-subheading">${escapeHtml(label)}</h3><p>${escapeHtml(value)}</p></div>`;
  }
  function listBlock(label, values) {
    if (!values?.length) return "";
    return `<div class="factionReferenceValue mf-reading-prose"><h3 class="mf-reading-subheading">${escapeHtml(label)}</h3><ul class="mf-reading-list">${values.map(value => `<li>${escapeHtml(value)}</li>`).join("")}</ul></div>`;
  }
  function entityRows(items, emptyText = "") {
    if (!items.length) return emptyText ? `<p class="factionReferenceEmpty">${escapeHtml(emptyText)}</p>` : "";
    return `<div class="factionReferenceRows mf-reading-links">${items.map(item => {
      const details = [item.role, item.relationshipLabel, item.direction, item.status && item.status !== "active" ? item.status : "", item.detail].filter(Boolean);
      const attrs = item.openable ? ` data-faction-reference-type="${escapeHtml(item.entityType)}" data-faction-reference-id="${escapeHtml(item.entityId)}"` : "";
      const tag = item.openable ? "button" : "div";
      return `<${tag}${item.openable ? ' type="button"' : ""} class="factionReferenceRow"${attrs}><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(title(item.entityType) || "Entity")}</small></span>${details.length ? `<span>${details.map(escapeHtml).join(" · ")}</span>` : ""}</${tag}>`;
    }).join("")}</div>`;
  }
  function section(titleText, body, { open = false, gm = false } = {}) {
    if (!body) return "";
    return `<details class="factionReferenceSection mf-reading-section${gm ? " factionReferenceSection--gm mf-reading-callout mf-reading-gm" : ""}"${open ? " open" : ""}><summary class="mf-reading-heading">${gm ? '<span class="factionReferenceGmBadge">GM Only</span>' : ""}${escapeHtml(titleText)}</summary><div class="factionReferenceSectionBody">${body}</div></details>`;
  }
  function renderFactionReferenceView(model = {}) {
    const at = model.atAGlance || {};
    const atBody = `<div class="factionReferenceGlance"><div class="factionReferenceGlanceContent">${at.motto ? `<blockquote>${escapeHtml(at.motto)}</blockquote>` : ""}${valueBlock("Concept", at.concept)}${valueBlock("Visual Motif", at.motif)}${valueBlock("Identity", at.identity)}${valueBlock("Scope", at.scope)}${valueBlock("Renown", at.renown)}</div></div>`;
    const current = model.currentSituation || {};
    const currentBody = valueBlock("Current Status", current.status) + valueBlock("Current Trajectory", current.trajectory) + listBlock("Player-Facing Hooks", current.hooks);
    const peopleBody = `<div class="factionReferenceColumns"><div><h3>Leadership</h3>${entityRows(model.leadership || [], "No structured leadership recorded.")}</div><div><h3>Members</h3>${entityRows(model.members || [], "No structured members recorded.")}</div></div>${model.hierarchy?.length ? `<div class="factionReferenceHierarchy"><h3>Hierarchy</h3>${model.hierarchy.map(node => `<p><strong>${escapeHtml(node.name)}</strong>${node.type ? ` <small>${escapeHtml(node.type)}</small>` : ""}${node.parents.length ? `<span>Reports to ${node.parents.map(escapeHtml).join(", ")}</span>` : ""}</p>`).join("")}</div>` : ""}`;
    const relationshipBody = [["Allies", "allies"], ["Enemies", "enemies"], ["Neutral / Transactional", "neutral"], ["Other", "other"]].map(([label, key]) => model.groupedRelationships?.[key]?.length ? `<div><h3>${label}</h3>${entityRows(model.groupedRelationships[key])}</div>` : "").join("");
    const operations = model.operations || {};
    const operationsBody = listBlock("Goals", operations.goals) + valueBlock("Motivation", operations.motivation) + listBlock("Methods", operations.methods) + listBlock("Resources", operations.resources) + valueBlock("Structure", operations.structure) + listBlock("Internal Tensions", operations.tensions);
    const history = model.history || {};
    const historyBody = valueBlock("History", history.history) + valueBlock("Founding / Origin", history.founding) + listBlock("Major Turning Points", history.turningPoints);
    const gm = model.gm || {};
    const gmBody = listBlock("Secrets", gm.secrets) + listBlock("Hidden Goals", gm.hiddenGoals) + valueBlock("Hidden History", gm.hiddenHistory) + valueBlock("Future Plans", gm.futurePlans);
    return `<div class="factionReferenceView mf-reading-surface">${section("At a Glance", atBody, { open: true })}${section("Current Situation", currentBody, { open: true })}${section("Leadership & Members", peopleBody, { open: true })}${section("Relationships", relationshipBody, { open: true })}${section("Purpose & Operations", operationsBody)}${section("Locations", entityRows(model.locations || []))}${section("History", historyBody)}${model.gm ? section("", gmBody, { gm: true }) : ""}</div>`;
  }

  const api = Object.freeze({ buildFactionReferenceViewModel, renderFactionReferenceView });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.MasterForgeFactionReferenceView = api;
})();
