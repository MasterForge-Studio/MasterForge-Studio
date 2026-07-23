(() => {
  "use strict";

  const VERSION = 1;
  const NODE_TYPES = Object.freeze(["rank", "title", "position", "honour", "role"]);
  const TITLE_FORMATS = Object.freeze(["prefix", "suffix", "title-only"]);

  function createFactionHierarchyNodeId() {
    const value = globalThis.crypto?.randomUUID?.() ||
      `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    return `fhn_${value}`;
  }

  function normaliseFactionHierarchyNode(node = {}) {
    const source = node && typeof node === "object" && !Array.isArray(node)
      ? node
      : {};
    return {
      ...source,
      id: typeof source.id === "string" ? source.id : "",
      nodeType: typeof source.nodeType === "string" ? source.nodeType : "rank",
      name: typeof source.name === "string" ? source.name : "",
      displayTitle: typeof source.displayTitle === "string" ? source.displayTitle : "",
      titleFormat: typeof source.titleFormat === "string" ? source.titleFormat : "prefix",
      description: typeof source.description === "string" ? source.description : "",
      order: Number.isFinite(Number(source.order)) ? Number(source.order) : 0,
      parentNodeIds: Array.isArray(source.parentNodeIds) ? [...source.parentNodeIds] : [],
      colour: typeof source.colour === "string" ? source.colour : "",
      icon: typeof source.icon === "string" ? source.icon : "",
      hidden: source.hidden === true,
      active: source.active !== false,
      promotional: source.promotional !== false,
      abilityPackIds: Array.isArray(source.abilityPackIds) ? [...source.abilityPackIds] : [],
      traitIds: Array.isArray(source.traitIds) ? [...source.traitIds] : []
    };
  }

  function normaliseFactionHierarchy(dataJson = {}) {
    const source = dataJson?.factionHierarchy;
    const nodes = Array.isArray(source?.nodes)
      ? source.nodes.map(normaliseFactionHierarchyNode)
      : [];
    return {
      ...(source && typeof source === "object" && !Array.isArray(source) ? source : {}),
      version: Number.isFinite(Number(source?.version)) ? Number(source.version) : VERSION,
      nodes
    };
  }

  function sortFactionHierarchyNodes(nodes = []) {
    return [...nodes].sort((left, right) =>
      Number(left.order || 0) - Number(right.order || 0) ||
      String(left.name || "").localeCompare(String(right.name || "")) ||
      String(left.id || "").localeCompare(String(right.id || ""))
    );
  }

  function getFactionHierarchyDescendants(nodes = [], nodeId) {
    const found = new Set();
    let changed = true;
    while (changed) {
      changed = false;
      nodes.forEach(node => {
        if (found.has(node.id)) return;
        if ((node.parentNodeIds || []).some(id => id === nodeId || found.has(id))) {
          found.add(node.id);
          changed = true;
        }
      });
    }
    return [...found];
  }

  function wouldCreateFactionHierarchyCycle(hierarchy, nodeId, parentNodeIds = []) {
    if (parentNodeIds.includes(nodeId)) return true;
    const descendants = new Set(
      getFactionHierarchyDescendants(hierarchy?.nodes || [], nodeId)
    );
    return parentNodeIds.some(parentId => descendants.has(parentId));
  }

  function validateFactionHierarchy(hierarchy = { version: VERSION, nodes: [] }) {
    const errors = [];
    const warnings = [];
    const nodes = Array.isArray(hierarchy.nodes) ? hierarchy.nodes : [];
    const ids = new Set(nodes.map(node => node.id).filter(Boolean));
    const names = new Map();

    nodes.forEach((node, index) => {
      const label = node.name || node.id || `Node ${index + 1}`;
      if (!node.id) errors.push(`${label} is missing a stable ID.`);
      if (!Array.isArray(node.parentNodeIds)) {
        errors.push(`${label} has invalid parentNodeIds.`);
        return;
      }
      if (node.parentNodeIds.includes(node.id)) {
        errors.push(`${label} cannot be its own parent.`);
      }
      node.parentNodeIds.forEach(parentId => {
        if (!ids.has(parentId)) warnings.push(`${label} references missing parent ${parentId}.`);
      });
      if (node.id && wouldCreateFactionHierarchyCycle(hierarchy, node.id, node.parentNodeIds)) {
        errors.push(`${label} participates in a hierarchy cycle.`);
      }
      const nameKey = String(node.name || "").trim().toLowerCase();
      if (nameKey) names.set(nameKey, [...(names.get(nameKey) || []), label]);
      if (!NODE_TYPES.includes(node.nodeType)) warnings.push(`${label} has unknown node type ${node.nodeType}.`);
      if (!TITLE_FORMATS.includes(node.titleFormat)) warnings.push(`${label} has invalid title format ${node.titleFormat}.`);
      node.parentNodeIds.forEach(parentId => {
        const parent = nodes.find(item => item.id === parentId);
        if (parent && parent.active === false && node.active !== false) {
          warnings.push(`${label} is active beneath inactive parent ${parent.name || parent.id}.`);
        }
      });
    });

    names.forEach((matches, name) => {
      if (matches.length > 1) warnings.push(`Duplicate hierarchy node name: ${name}.`);
    });

    return { valid: errors.length === 0, errors, warnings };
  }

  function copyFactionHierarchy(sourceHierarchy, targetHierarchy, options = {}) {
    const mode = options.mode === "replace" ? "replace" : "merge";
    const includeAbilityPacks = options.includeAbilityPacks !== false;
    const source = {
      version: VERSION,
      nodes: Array.isArray(sourceHierarchy?.nodes)
        ? sourceHierarchy.nodes.map(normaliseFactionHierarchyNode)
        : []
    };
    const target = {
      version: VERSION,
      nodes: Array.isArray(targetHierarchy?.nodes)
        ? targetHierarchy.nodes.map(normaliseFactionHierarchyNode)
        : []
    };
    const sourceValidation = validateFactionHierarchy(source);
    if (!sourceValidation.valid) throw new Error(`Source hierarchy is invalid: ${sourceValidation.errors.join(" ")}`);
    if (!source.nodes.length) throw new Error("The source faction has no hierarchy nodes.");

    const idMap = new Map(source.nodes.map(node => [node.id, createFactionHierarchyNodeId()]));
    const copiedNodes = source.nodes.map(node => {
      const copy = normaliseFactionHierarchyNode({
        ...node,
        id: idMap.get(node.id),
        parentNodeIds: node.parentNodeIds.map(parentId => idMap.get(parentId)).filter(Boolean),
        abilityPackIds: includeAbilityPacks ? [...node.abilityPackIds] : [],
        traitIds: []
      });
      delete copy.createdAt;
      delete copy.updatedAt;
      delete copy.factionId;
      delete copy.memberIds;
      delete copy.members;
      delete copy.leaderId;
      return copy;
    });
    const result = { version: VERSION, nodes: mode === "replace" ? copiedNodes : [...target.nodes, ...copiedNodes] };
    const validation = validateFactionHierarchy(result);
    if (!validation.valid) throw new Error(`Copied hierarchy is invalid: ${validation.errors.join(" ")}`);
    return { hierarchy: result, idMap: Object.fromEntries(idMap), warnings: validation.warnings, copiedNodeCount: copiedNodes.length, mode };
  }

  window.MasterForgeFactionHierarchy = Object.freeze({
    VERSION,
    NODE_TYPES,
    TITLE_FORMATS,
    createFactionHierarchyNodeId,
    normaliseFactionHierarchy,
    normaliseFactionHierarchyNode,
    validateFactionHierarchy,
    wouldCreateFactionHierarchyCycle,
    sortFactionHierarchyNodes,
    getFactionHierarchyDescendants
    ,copyFactionHierarchy
  });
})();
