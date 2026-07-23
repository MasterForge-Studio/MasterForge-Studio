// =====================================================
// MasterForge Studio
// Relationship Graph Renderer (tree compatibility mode)
// =====================================================
(() => {
  "use strict";

  const version = "0.2.0-alpha";

  function requireRelationshipEngine() {
    const engine = window.MasterForgeRelationshipEngine;

    if (!engine) {
      throw new Error(
        "MasterForge Relationship Graph Renderer: relationship engine is unavailable."
      );
    }

    for (const methodName of [
      "getEntity",
      "getRelationshipsForEntity",
      "normaliseRelationshipRecord"
    ]) {
      if (typeof engine[methodName] !== "function") {
        throw new Error(
          `MasterForge Relationship Graph Renderer: engine.${methodName} is unavailable.`
        );
      }
    }

    return engine;
  }

  function getEntityType(entity = {}) {
    return String(
      entity.entity_type ||
      entity.entityType ||
      ""
    ).trim().toLowerCase();
  }

  function getEntityId(entity = {}) {
    return String(entity.id || "").trim();
  }

  function getEntityDisplayName(entity = {}) {
    return entity.presentationDisplayName || entity.name || getEntityId(entity);
  }

  const LEGACY_COMMAND_ROOT_PRIORITIES = {
    answers_to: 1,
    commands: 2,
    operates_from: 3,
    member_of: 4,
    secretly_member_of: 9
  };

  const LEGACY_CHILD_PRIORITIES = {
    operates_from: 1,
    commands: 2,
    answers_to: 3,
    member_of: 4,
    secretly_member_of: 5,
    aboard: 20
  };

  const EQUAL_PEER_RELATIONSHIP_TYPES = new Set([
    "equal_rank_to",
    "co_leads_with"
  ]);

  const PARTY_STRUCTURAL_RELATIONSHIP_TYPES = new Set([
    "member_of_party",
    "has_party_member",
    "subgroup_of",
    "contains_subgroup"
  ]);

  const PARTY_ASSOCIATED_RELATIONSHIP_TYPES = new Set([
    "companion_of",
    "bonded_to",
    "handler_of",
    "handled_by",
    "travels_with",
    "prisoner_of",
    "has_prisoner",
    "holds_captive"
  ]);

  const PARTY_HISTORICAL_RELATIONSHIP_TYPES = new Set([
    "split_from",
    "rejoined_with",
    "captured_by"
  ]);

  const collapsedTreeNodeKeys = new Set();
  const expandedTreeNodeKeys = new Set();

  function getRelationshipTypeRegistry() {
    return window.MasterForgeRelationshipTypes || null;
  }

  function getRegisteredRelationshipType(relationshipType) {
    const registry = getRelationshipTypeRegistry();

    if (typeof registry?.get !== "function") {
      return null;
    }

    return registry.get(relationshipType);
  }

  function getRelationshipTreePriority(
    relationshipType,
    priorityField,
    fallbackPriorities
  ) {
    const definition =
      getRegisteredRelationshipType(relationshipType);
    const registryPriority =
      definition?.tree?.[priorityField];

    if (Number.isFinite(registryPriority)) {
      return registryPriority;
    }

    const fallbackPriority =
      fallbackPriorities[relationshipType];

    return Number.isFinite(fallbackPriority)
      ? fallbackPriority
      : null;
  }

  function createEntityTreeContext() {
    return {
      rendered: new Set(),
      adjacency: new Map(),
      equalAdjacency: new Map(),
      ancestorParents: new Map(),
      collapseControls: new Map()
    };
  }

  function addTreeContextEdge(map, fromKey, toKey) {
    if (!map.has(fromKey)) {
      map.set(fromKey, new Set());
    }

    map.get(fromKey).add(toKey);
  }

  function recordHierarchyEdge(parent, child, treeContext) {
    const parentKey =
      `${getEntityType(parent)}:${getEntityId(parent)}`;
    const childKey =
      `${getEntityType(child)}:${getEntityId(child)}`;

    addTreeContextEdge(treeContext.adjacency, parentKey, childKey);
    addTreeContextEdge(treeContext.adjacency, childKey, parentKey);

    if (!treeContext.ancestorParents.has(childKey)) {
      treeContext.ancestorParents.set(childKey, new Set());
    }

    treeContext.ancestorParents.get(childKey).add(parentKey);
  }

  function recordEqualEdge(first, second, treeContext) {
    const firstKey =
      `${getEntityType(first)}:${getEntityId(first)}`;
    const secondKey =
      `${getEntityType(second)}:${getEntityId(second)}`;

    addTreeContextEdge(
      treeContext.equalAdjacency,
      firstKey,
      secondKey
    );
    addTreeContextEdge(
      treeContext.equalAdjacency,
      secondKey,
      firstKey
    );
  }

  function getTreeRelationshipDistances(
    selectedEntityKey,
    treeContext
  ) {
    const distances = new Map([[selectedEntityKey, 0]]);
    const queue = [selectedEntityKey];

    while (queue.length) {
      const currentKey = queue.shift();
      const currentDistance = distances.get(currentKey);

      for (const equalKey of (
        treeContext.equalAdjacency.get(currentKey) || []
      )) {
        if (
          !distances.has(equalKey) ||
          currentDistance < distances.get(equalKey)
        ) {
          distances.set(equalKey, currentDistance);
          queue.unshift(equalKey);
        }
      }

      for (const relatedKey of (
        treeContext.adjacency.get(currentKey) || []
      )) {
        const nextDistance = currentDistance + 1;

        if (
          !distances.has(relatedKey) ||
          nextDistance < distances.get(relatedKey)
        ) {
          distances.set(relatedKey, nextDistance);
          queue.push(relatedKey);
        }
      }
    }

    return distances;
  }

  function getProtectedAncestorKeys(
    selectedEntityKey,
    treeContext
  ) {
    const protectedKeys = new Set([selectedEntityKey]);
    const queue = [selectedEntityKey];

    while (queue.length) {
      const currentKey = queue.shift();

      for (const parentKey of (
        treeContext.ancestorParents.get(currentKey) || []
      )) {
        if (!protectedKeys.has(parentKey)) {
          protectedKeys.add(parentKey);
          queue.push(parentKey);
        }
      }
    }

    return protectedKeys;
  }

  function setTreeCollapseControlState(control, collapsed) {
    control.childrenContainer.classList.toggle(
      "is-collapsed",
      collapsed
    );
    control.button.textContent = collapsed ? "+" : "−";
    control.button.setAttribute(
      "aria-expanded",
      collapsed ? "false" : "true"
    );
    control.button.setAttribute(
      "aria-label",
      `${collapsed ? "Expand" : "Collapse"} descendants of ${control.entity.name}`
    );
  }

  function applyTreeCollapseDefaults(
    treeContext,
    selectedEntityKey,
    defaultExpandedDistance
  ) {
    const distances = getTreeRelationshipDistances(
      selectedEntityKey,
      treeContext
    );
    const protectedAncestors = getProtectedAncestorKeys(
      selectedEntityKey,
      treeContext
    );

    treeContext.collapseControls.forEach((control, nodeKey) => {
      let collapsed;

      if (collapsedTreeNodeKeys.has(nodeKey)) {
        collapsed = true;
      } else if (expandedTreeNodeKeys.has(nodeKey)) {
        collapsed = false;
      } else if (protectedAncestors.has(nodeKey)) {
        collapsed = false;
      } else {
        collapsed =
          (distances.get(nodeKey) ?? Infinity) >
          defaultExpandedDistance;
      }

      setTreeCollapseControlState(control, collapsed);
    });
  }

  function isSelectedTreeEntity(entity, callbacks) {
    return (
      `${getEntityType(entity)}:${getEntityId(entity)}` ===
      callbacks.selectedEntityKey
    );
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function attachTreeCollapseControl(
    entity,
    header,
    childrenContainer,
    treeContext
  ) {
    if (!header || !childrenContainer.children.length) {
      return;
    }

    const nodeKey =
      `${getEntityType(entity)}:${getEntityId(entity)}`;
    const button = document.createElement("button");
    button.className = "entity-tree-collapse-btn";
    button.type = "button";

    const control = {
      entity,
      button,
      childrenContainer
    };

    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      const collapsed = childrenContainer.classList.contains(
        "is-collapsed"
      );

      if (collapsed) {
        expandedTreeNodeKeys.add(nodeKey);
        collapsedTreeNodeKeys.delete(nodeKey);
      } else {
        collapsedTreeNodeKeys.add(nodeKey);
        expandedTreeNodeKeys.delete(nodeKey);
      }

      setTreeCollapseControlState(control, !collapsed);
    });

    treeContext.collapseControls.set(nodeKey, control);
    header.appendChild(button);
  }

  function getEntityTreeIcon(entityType) {
    const icons = {
      ship: "🚢",
      faction: "🏴",
      npc: "🧍",
      location: "🗺",
      settlement: "🏘",
      item: "💎",
      quest: "📜",
      event: "⚡",
      creature: "🐲"
    };

    return icons[entityType] || "🔗";
  }

  function formatRelationshipLabel(relationship, direction = "incoming") {
    const registry = getRelationshipTypeRegistry();
    const registered =
      getRegisteredRelationshipType(relationship);

    if (
      registered &&
      typeof registry?.getLabel === "function"
    ) {
      const registryLabel =
        registry.getLabel(relationship, direction);

      if (registryLabel) {
        return registryLabel;
      }
    }

    const labels = {
      commands: {
        incoming: "Commanded By / Leader",
        outgoing: "Commands"
      },
      operates_from: {
        incoming: "Operated By",
        outgoing: "Operates From"
      },
      answers_to: {
        incoming: "Reports To Them",
        outgoing: "Answers To"
      },
      member_of: {
        incoming: "Members",
        outgoing: "Member Of"
      },
      secretly_member_of: {
        incoming: "Secret Members / Agents",
        outgoing: "Secretly Member Of"
      },
      allied_with: {
        incoming: "Allied With",
        outgoing: "Allied With"
      },
      owns: {
        incoming: "Owned By",
        outgoing: "Owns"
      },
      located_in: {
        incoming: "Contains",
        outgoing: "Located In"
      },
      aboard: {
        incoming: "Crew / Aboard",
        outgoing: "Aboard / Assigned To"
      }
    };

    if (labels[relationship]?.[direction]) {
      return labels[relationship][direction];
    }

    return String(relationship || "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, letter => letter.toUpperCase());
  }

  async function findTopLevelShipForEntity(entity, engine) {
    const visited = new Set();
    let current = entity;
    let highestDiscoveredAncestor = null;

    for (let i = 0; i < 10; i++) {
      const currentType = getEntityType(current);
      const currentId = getEntityId(current);
      const key = `${currentType}:${currentId}`;

      if (visited.has(key)) {
        return null;
      }

      visited.add(key);

      // Command roots may be people, factions, organisations, ships, or vehicles.
      if (["ship", "vehicle"].includes(currentType)) {
        return current;
      }

      const relationships = await engine.getRelationshipsForEntity(
        currentType,
        currentId
      );

      const parentCandidates = relationships
        .map(value => {
          const relationship = engine.normaliseRelationshipRecord(value);
          const currentIsSource =
            relationship.sourceEntityType === currentType &&
            relationship.sourceEntityId === currentId;

          if (!currentIsSource) {
            return null;
          }

          const priority = getRelationshipTreePriority(
            relationship.relationshipType,
            "rootPriority",
            LEGACY_COMMAND_ROOT_PRIORITIES
          );

          if (!Number.isFinite(priority)) {
            return null;
          }

          return {
            nextType: relationship.targetEntityType,
            nextId: relationship.targetEntityId,
            priority
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.priority - b.priority);

      const parentLink = parentCandidates[0];

      if (!parentLink) {
        return highestDiscoveredAncestor;
      }

      const nextEntity = await engine.getEntity(
        parentLink.nextType,
        parentLink.nextId
      );

      if (!nextEntity) {
        return highestDiscoveredAncestor;
      }

      highestDiscoveredAncestor = nextEntity;
      current = nextEntity;

      if (["ship", "vehicle"].includes(getEntityType(current))) {
        return current;
      }
    }

    return highestDiscoveredAncestor;
  }

  async function findTopLevelFactionForEntity(entity, engine) {
    const visited = new Set();
    let current = entity;

    for (let i = 0; i < 10; i++) {
      const currentType = getEntityType(current);
      const currentId = getEntityId(current);
      const key = `${currentType}:${currentId}`;

      if (visited.has(key)) {
        return null;
      }

      visited.add(key);

      if (currentType === "faction") {
        return current;
      }

      const relationships = await engine.getRelationshipsForEntity(
        currentType,
        currentId
      );

      const factionLink = relationships
        .map(value => engine.normaliseRelationshipRecord(value))
        .find(relationship => {
          const currentIsSource =
            relationship.sourceEntityType === currentType &&
            relationship.sourceEntityId === currentId;

          return (
            currentIsSource &&
            ["member_of", "secretly_member_of"].includes(
              relationship.relationshipType
            )
          );
        });

      if (!factionLink) {
        return null;
      }

      current = await engine.getEntity(
        factionLink.targetEntityType,
        factionLink.targetEntityId
      );

      if (!current) {
        return null;
      }
    }

    return null;
  }

  function sortEntityTreeChildren(childLinks) {
    return childLinks.sort((a, b) => {
      const aPriority = getRelationshipTreePriority(
        a.relationship.relationshipType,
        "childPriority",
        LEGACY_CHILD_PRIORITIES
      ) ?? 99;
      const bPriority = getRelationshipTreePriority(
        b.relationship.relationshipType,
        "childPriority",
        LEGACY_CHILD_PRIORITIES
      ) ?? 99;

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      return a.entity.name.localeCompare(b.entity.name);
    });
  }

  function groupEntityTreeChildren(childLinks) {
    const groups = [];

    childLinks.forEach(childLink => {
      const label = formatRelationshipLabel(
        childLink.relationship.relationshipType,
        childLink.direction
      );

      let group = groups.find(existingGroup => existingGroup.label === label);

      if (!group) {
        group = {
          label,
          children: []
        };

        groups.push(group);
      }

      group.children.push(childLink);
    });

    return groups;
  }

  async function getEntityTreeChildren(entity, engine) {
    const entityType = getEntityType(entity);
    const entityId = getEntityId(entity);
    const relationships = await engine.getRelationshipsForEntity(
      entityType,
      entityId
    );
    const childLinks = [];

    for (const value of relationships) {
      const relationship = engine.normaliseRelationshipRecord(value);

      if (
        EQUAL_PEER_RELATIONSHIP_TYPES.has(
          relationship.relationshipType
        )
      ) {
        continue;
      }

      const selectedEntityIsTarget =
        relationship.targetEntityType === entityType &&
        relationship.targetEntityId === entityId;

      const selectedEntityIsSource =
        relationship.sourceEntityType === entityType &&
        relationship.sourceEntityId === entityId;

      if (selectedEntityIsTarget) {
        const childEntity = await engine.getEntity(
          relationship.sourceEntityType,
          relationship.sourceEntityId
        );

        if (childEntity) {
          childLinks.push({
            relationship,
            entity: childEntity,
            direction: "incoming"
          });
        }
      }

      if (selectedEntityIsSource) {
        continue;
      }
    }

    return sortEntityTreeChildren(childLinks);
  }

  async function getConnectedEqualPeers(entity, engine) {
    const peers = [];
    const queued = new Set();
    const queue = [entity];

    while (queue.length) {
      const current = queue.shift();
      const currentType = getEntityType(current);
      const currentId = getEntityId(current);
      const currentKey = `${currentType}:${currentId}`;

      if (!currentType || !currentId || queued.has(currentKey)) {
        continue;
      }

      queued.add(currentKey);
      peers.push(current);

      const relationships = await engine.getRelationshipsForEntity(
        currentType,
        currentId
      );

      for (const value of relationships) {
        const relationship = engine.normaliseRelationshipRecord(value);

        if (
          !EQUAL_PEER_RELATIONSHIP_TYPES.has(
            relationship.relationshipType
          )
        ) {
          continue;
        }

        const currentIsSource =
          relationship.sourceEntityType === currentType &&
          relationship.sourceEntityId === currentId;
        const currentIsTarget =
          relationship.targetEntityType === currentType &&
          relationship.targetEntityId === currentId;

        if (!currentIsSource && !currentIsTarget) {
          continue;
        }

        const peerType = currentIsSource
          ? relationship.targetEntityType
          : relationship.sourceEntityType;
        const peerId = currentIsSource
          ? relationship.targetEntityId
          : relationship.sourceEntityId;
        const peerKey = `${peerType}:${peerId}`;

        if (queued.has(peerKey)) {
          continue;
        }

        const peer = await engine.getEntity(peerType, peerId);

        if (peer) {
          queue.push(peer);
        }
      }
    }

    return peers;
  }

  async function extractEqualPeerGroups(
    children,
    visited,
    treeContext,
    engine
  ) {
    const groups = [];
    const absorbed = new Set();
    const ordinaryChildKeys = new Set(
      children.map(childLink => {
        return `${getEntityType(childLink.entity)}:${getEntityId(childLink.entity)}`;
      })
    );

    for (const childLink of children) {
      const childType = getEntityType(childLink.entity);
      const childId = getEntityId(childLink.entity);
      const childKey = `${childType}:${childId}`;

      if (absorbed.has(childKey)) {
        continue;
      }

      const connectedPeers = await getConnectedEqualPeers(
        childLink.entity,
        engine
      );
      const availablePeers = connectedPeers.filter(peer => {
        const peerKey = `${getEntityType(peer)}:${getEntityId(peer)}`;

        return (
          ordinaryChildKeys.has(peerKey) &&
          !visited.has(peerKey) &&
          !treeContext.rendered.has(peerKey)
        );
      });

      if (availablePeers.length < 2) {
        continue;
      }

      availablePeers.forEach(peer => {
        absorbed.add(`${getEntityType(peer)}:${getEntityId(peer)}`);
      });
      groups.push(availablePeers);
    }

    return {
      groups,
      remainingChildren: children.filter(childLink => {
        const childKey = `${getEntityType(childLink.entity)}:${getEntityId(childLink.entity)}`;
        return !absorbed.has(childKey);
      })
    };
  }

  async function buildEntityTreeNode(
    entity,
    visited,
    treeContext,
    engine,
    callbacks
  ) {
    const entityType = getEntityType(entity);
    const entityId = getEntityId(entity);
    const nodeKey = `${entityType}:${entityId}`;
    const wrapper = document.createElement("div");
    wrapper.className = isSelectedTreeEntity(entity, callbacks)
      ? "entity-tree-node entity-tree-selected-anchor"
      : "entity-tree-node";

    const header = document.createElement("div");
    header.className = "entity-tree-header";
    header.innerHTML = `
      <span class="entity-tree-icon">${getEntityTreeIcon(entityType)}</span>
      <strong>${escapeHtml(getEntityDisplayName(entity))}</strong>
      <span class="entity-tree-type">${escapeHtml(entityType)}</span>
    `;

    header.addEventListener("click", async () => {
      if (typeof callbacks.onSelectTreeEntity === "function") {
        await callbacks.onSelectTreeEntity(entity);
        return;
      }

      if (entityType === "npc") {
        await callbacks.onOpenNpc(entity);
        return;
      }

      await callbacks.onOpenEntity(entity);
    });

    wrapper.appendChild(header);

    if (visited.has(nodeKey)) {
      const loopNotice = document.createElement("div");
      loopNotice.className = "entity-tree-children";
      loopNotice.innerHTML = `<p class="muted">Already shown in this branch.</p>`;
      wrapper.appendChild(loopNotice);
      return wrapper;
    }

    if (treeContext.rendered.has(nodeKey)) {
      return null;
    }

    visited.add(nodeKey);
    treeContext.rendered.add(nodeKey);

    const children = await getEntityTreeChildren(entity, engine);

    if (children.length > 0) {
      const childrenContainer = document.createElement("div");
      childrenContainer.className = "entity-tree-children";
      const {
        groups: equalPeerGroups,
        remainingChildren
      } = await extractEqualPeerGroups(
        children,
        visited,
        treeContext,
        engine
      );

      for (const equalPeers of equalPeerGroups) {
        const equalRow = document.createElement("div");
        equalRow.className = "entity-tree-equal-row";
        const renderedEqualPeers = [];

        for (const peer of equalPeers) {
          const peerBranch = document.createElement("div");
          peerBranch.className = "entity-tree-equal-branch";
          const peerNode = await buildEntityTreeNode(
            peer,
            new Set(visited),
            treeContext,
            engine,
            callbacks
          );

          if (peerNode) {
            recordHierarchyEdge(entity, peer, treeContext);
            renderedEqualPeers.push(peer);
            peerBranch.appendChild(peerNode);
            equalRow.appendChild(peerBranch);
          }
        }

        for (let i = 1; i < renderedEqualPeers.length; i++) {
          recordEqualEdge(
            renderedEqualPeers[0],
            renderedEqualPeers[i],
            treeContext
          );
        }

        if (equalRow.children.length) {
          childrenContainer.appendChild(equalRow);
        }
      }

      const groupedChildren = groupEntityTreeChildren(
        remainingChildren
      );

      for (const group of groupedChildren) {
        const relationLabel = document.createElement("div");
        relationLabel.className = "entity-tree-relation";
        relationLabel.textContent = group.label;

        const groupContainer = document.createElement("div");
        groupContainer.className = "entity-tree-group";

        for (const childLink of group.children) {
          const childNode = await buildEntityTreeNode(
            childLink.entity,
            new Set(visited),
            treeContext,
            engine,
            callbacks
          );

          if (childNode) {
            recordHierarchyEdge(
              entity,
              childLink.entity,
              treeContext
            );
            groupContainer.appendChild(childNode);
          }
        }

        if (groupContainer.children.length) {
          childrenContainer.appendChild(relationLabel);
          childrenContainer.appendChild(groupContainer);
        }
      }

      const relationshipLabels =
        childrenContainer.querySelectorAll(
          ":scope > .entity-tree-relation"
        );
      const relationshipGroups =
        childrenContainer.querySelectorAll(
          ":scope > .entity-tree-group"
        );
      const equalRows =
        childrenContainer.querySelectorAll(
          ":scope > .entity-tree-equal-row"
        );

      if (
        relationshipLabels.length === 1 &&
        relationshipGroups.length === 1 &&
        equalRows.length === 0 &&
        childrenContainer.children.length === 2 &&
        relationshipGroups[0].querySelectorAll(
          ":scope > .entity-tree-node"
        ).length === 1
      ) {
        childrenContainer.classList.add(
          "entity-tree-single-branch"
        );
      }

      if (childrenContainer.children.length > 0) {
        attachTreeCollapseControl(
          entity,
          header,
          childrenContainer,
          treeContext
        );

        wrapper.appendChild(childrenContainer);
      }
    }

    return wrapper;
  }

  async function buildAllLinksTree(entity, engine, callbacks) {
    const entityType = getEntityType(entity);
    const entityId = getEntityId(entity);
    const wrapper = document.createElement("div");
    wrapper.className = isSelectedTreeEntity(entity, callbacks)
      ? "entity-tree-node entity-tree-selected-anchor"
      : "entity-tree-node";

    const header = document.createElement("div");
    header.className = "entity-tree-header";
    header.innerHTML = `
      <span class="entity-tree-icon">${getEntityTreeIcon(entityType)}</span>
      <strong>${escapeHtml(getEntityDisplayName(entity))}</strong>
      <span class="entity-tree-type">${escapeHtml(entityType)}</span>
    `;
    wrapper.appendChild(header);

    const relationships = await engine.getRelationshipsForEntity(
      entityType,
      entityId
    );

    if (!relationships.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No relationships found.";
      wrapper.appendChild(empty);
      return wrapper;
    }

    const linksGrid = document.createElement("div");
    linksGrid.className = "entity-tree-all-links-grid";
    const renderedLinks = new Set();

    for (const value of relationships) {
      const relationship = engine.normaliseRelationshipRecord(value);
      const selectedIsSource =
        relationship.sourceEntityType === entityType &&
        relationship.sourceEntityId === entityId;
      const direction = selectedIsSource
        ? "outgoing"
        : "incoming";

      const otherType = selectedIsSource
        ? relationship.targetEntityType
        : relationship.sourceEntityType;
      const otherId = selectedIsSource
        ? relationship.targetEntityId
        : relationship.sourceEntityId;
      const linkKey =
        `${relationship.relationshipType}:${direction}:${otherType}:${otherId}`;

      if (renderedLinks.has(linkKey)) {
        continue;
      }

      const otherEntity = await engine.getEntity(otherType, otherId);

      if (!otherEntity) {
        continue;
      }

      renderedLinks.add(linkKey);

      const relationLabel = document.createElement("div");
      relationLabel.className = "entity-tree-relation";
      relationLabel.textContent = formatRelationshipLabel(
        relationship.relationshipType,
        direction
      );

      const linkItem = document.createElement("div");
      linkItem.className = "entity-tree-all-link-item";
      const childHeader = document.createElement("div");
      childHeader.className = "entity-tree-header";
      childHeader.innerHTML = `
        <span class="entity-tree-icon">${getEntityTreeIcon(getEntityType(otherEntity))}</span>
        <strong>${escapeHtml(otherEntity.name)}</strong>
        <span class="entity-tree-type">${escapeHtml(getEntityType(otherEntity))}</span>
      `;
      childHeader.addEventListener("click", async () => {
        if (typeof callbacks.onSelectTreeEntity === "function") {
          await callbacks.onSelectTreeEntity(otherEntity);
          return;
        }

        await callbacks.onOpenEntity(otherEntity);
      });

      linkItem.appendChild(relationLabel);
      linkItem.appendChild(childHeader);
      linksGrid.appendChild(linkItem);
    }

    wrapper.appendChild(linksGrid);
    return wrapper;
  }

  function getFocusedRelationshipRole(
    relationship,
    entity,
    mode,
    role
  ) {
    const entityType = getEntityType(entity);
    const entityId = getEntityId(entity);
    const selectedIsSource =
      relationship.sourceEntityType === entityType &&
      relationship.sourceEntityId === entityId;
    const selectedIsTarget =
      relationship.targetEntityType === entityType &&
      relationship.targetEntityId === entityId;
    const relationshipType = relationship.relationshipType;

    if (!selectedIsSource && !selectedIsTarget) {
      return null;
    }

    let qualifies = false;

    if (mode === "command" && role === "parent") {
      qualifies =
        (selectedIsSource && [
          "answers_to",
          "secretly_answers_to",
          "deputy_to"
        ].includes(relationshipType)) ||
        (selectedIsTarget && [
          "commands",
          "secretly_commands",
          "leads"
        ].includes(relationshipType));
    }

    if (mode === "command" && role === "child") {
      qualifies =
        (selectedIsTarget && [
          "answers_to",
          "secretly_answers_to",
          "deputy_to"
        ].includes(relationshipType)) ||
        (selectedIsSource && [
          "commands",
          "secretly_commands",
          "leads"
        ].includes(relationshipType));
    }

    if (mode === "faction" && role === "parent") {
      qualifies =
        (selectedIsSource && [
          "member_of",
          "secretly_member_of",
          "subfaction_of"
        ].includes(relationshipType)) ||
        (selectedIsTarget && relationshipType === "contains_subfaction");
    }

    if (mode === "faction" && role === "child") {
      qualifies =
        (selectedIsTarget && [
          "member_of",
          "secretly_member_of",
          "subfaction_of",
          "leads",
          "commands",
          "secretly_commands"
        ].includes(relationshipType)) ||
        (selectedIsSource && relationshipType === "contains_subfaction");
    }

    if (!qualifies) {
      return null;
    }

    return {
      relationship,
      direction: selectedIsSource ? "outgoing" : "incoming",
      entityType: selectedIsSource
        ? relationship.targetEntityType
        : relationship.sourceEntityType,
      entityId: selectedIsSource
        ? relationship.targetEntityId
        : relationship.sourceEntityId
    };
  }

  async function getImmediateFocusedLinks(
    entity,
    mode,
    role,
    engine
  ) {
    const relationships = await engine.getRelationshipsForEntity(
      getEntityType(entity),
      getEntityId(entity)
    );
    const links = [];
    const included = new Set();

    for (const value of relationships) {
      const relationship = engine.normaliseRelationshipRecord(value);
      const link = getFocusedRelationshipRole(
        relationship,
        entity,
        mode,
        role
      );

      if (!link) {
        continue;
      }

      const key = `${link.entityType}:${link.entityId}`;

      if (included.has(key)) {
        continue;
      }

      const linkedEntity = await engine.getEntity(
        link.entityType,
        link.entityId
      );

      if (linkedEntity) {
        included.add(key);
        links.push({
          ...link,
          entity: linkedEntity
        });
      }
    }

    return sortEntityTreeChildren(links);
  }

  function createFocusedEntityNode(
    entity,
    callbacks
  ) {
    const entityType = getEntityType(entity);
    const wrapper = document.createElement("div");
    wrapper.className = isSelectedTreeEntity(entity, callbacks)
      ? "entity-tree-node entity-tree-selected-anchor"
      : "entity-tree-node";
    const header = document.createElement("div");
    header.className = "entity-tree-header";
    header.innerHTML = `
      <span class="entity-tree-icon">${getEntityTreeIcon(entityType)}</span>
      <strong>${escapeHtml(getEntityDisplayName(entity))}</strong>
      <span class="entity-tree-type">${escapeHtml(entityType)}</span>
    `;
    header.addEventListener("click", async () => {
      if (typeof callbacks.onSelectTreeEntity === "function") {
        await callbacks.onSelectTreeEntity(entity);
        return;
      }

      if (entityType === "npc") {
        await callbacks.onOpenNpc(entity);
        return;
      }

      await callbacks.onOpenEntity(entity);
    });
    wrapper.appendChild(header);
    return wrapper;
  }

  function getFactionHierarchyApi() {
    return window.MasterForgeFactionHierarchy || null;
  }

  function normaliseFactionTreeHierarchy(faction) {
    const api = getFactionHierarchyApi();
    if (typeof api?.normaliseFactionHierarchy === "function") {
      return api.normaliseFactionHierarchy(faction?.data_json || {});
    }
    return {
      version: 1,
      nodes: Array.isArray(faction?.data_json?.factionHierarchy?.nodes)
        ? faction.data_json.factionHierarchy.nodes
        : []
    };
  }

  function sortFactionTreeHierarchyNodes(nodes = []) {
    const api = getFactionHierarchyApi();
    if (typeof api?.sortFactionHierarchyNodes === "function") {
      return api.sortFactionHierarchyNodes(nodes);
    }
    return [...nodes].sort((left, right) =>
      Number(left.order || 0) - Number(right.order || 0) ||
      String(left.name || "").localeCompare(String(right.name || ""))
    );
  }

  function getFactionHierarchyRenderRoots(nodes = []) {
    const sorted = sortFactionTreeHierarchyNodes(nodes);
    const nodeIds = new Set(sorted.map(node => node.id).filter(Boolean));
    const roots = sorted.filter(node =>
      !Array.isArray(node.parentNodeIds) ||
      node.parentNodeIds.length === 0 ||
      node.parentNodeIds.every(parentId => !nodeIds.has(parentId))
    );
    const reachable = new Set();
    const markReachable = node => {
      if (!node?.id || reachable.has(node.id)) return;
      reachable.add(node.id);
      sorted
        .filter(child => child.parentNodeIds?.includes(node.id))
        .forEach(markReachable);
    };
    roots.forEach(markReachable);
    sorted.forEach(node => {
      if (!reachable.has(node.id)) {
        roots.push(node);
        markReachable(node);
      }
    });
    return roots;
  }

  async function getFactionTreeData(faction, engine, callbacks) {
    const relationships = await engine.getRelationshipsForEntity(
      getEntityType(faction),
      getEntityId(faction)
    );
    const memberships = [];
    const subfactions = [];
    const includedSubfactions = new Set();

    for (const value of relationships) {
      const relationship = engine.normaliseRelationshipRecord(value);
      const isTarget =
        relationship.targetEntityType === "faction" &&
        relationship.targetEntityId === getEntityId(faction);
      const isSource =
        relationship.sourceEntityType === "faction" &&
        relationship.sourceEntityId === getEntityId(faction);

      if (
        isTarget &&
        ["member_of", "secretly_member_of"].includes(relationship.relationshipType) &&
        ["npc", "pc", "creature"].includes(relationship.sourceEntityType)
      ) {
        const secret = relationship.relationshipType === "secretly_member_of";
        if (secret && !callbacks.showSecretRelationships) continue;
        const member = await engine.getEntity(
          relationship.sourceEntityType,
          relationship.sourceEntityId
        );
        if (member) {
          const displayResolution =
            typeof callbacks.resolveFactionMemberDisplayTitle === "function"
              ? await callbacks.resolveFactionMemberDisplayTitle(
                  member,
                  faction,
                  relationship
                )
              : null;
          memberships.push({
            relationship,
            entity: displayResolution?.displayName
              ? {
                  ...member,
                  presentationDisplayName: displayResolution.displayName
                }
              : member,
            secret
          });
        }
        continue;
      }

      const childReference =
        isTarget && relationship.relationshipType === "subfaction_of"
          ? { type: relationship.sourceEntityType, id: relationship.sourceEntityId }
          : isSource && relationship.relationshipType === "contains_subfaction"
            ? { type: relationship.targetEntityType, id: relationship.targetEntityId }
            : null;
      if (!childReference || childReference.type !== "faction") continue;
      const childKey = `${childReference.type}:${childReference.id}`;
      if (includedSubfactions.has(childKey)) continue;
      const child = await engine.getEntity(childReference.type, childReference.id);
      if (child) {
        includedSubfactions.add(childKey);
        subfactions.push(child);
      }
    }

    subfactions.sort((left, right) =>
      String(left.name || left.id).localeCompare(String(right.name || right.id))
    );
    memberships.sort((left, right) =>
      String(left.entity.name || left.entity.id).localeCompare(
        String(right.entity.name || right.entity.id)
      ) || String(left.relationship.id).localeCompare(String(right.relationship.id))
    );
    return { memberships, subfactions };
  }

  function createFactionVirtualNode(faction, hierarchyNode, pathKey) {
    return {
      id: `virtual-faction:${getEntityId(faction)}:${hierarchyNode.id}:${pathKey}`,
      entity_type: "virtual_faction_hierarchy",
      name: hierarchyNode.name || hierarchyNode.displayTitle || "Unnamed hierarchy node",
      virtual: true,
      virtualType: "faction-hierarchy-node",
      faction,
      hierarchyNode
    };
  }

  function createFactionUnrankedVirtualNode(faction) {
    return {
      id: `virtual-faction:${getEntityId(faction)}:unranked`,
      entity_type: "virtual_faction_hierarchy",
      name: "Unranked Members",
      virtual: true,
      virtualType: "faction-unranked-members",
      faction,
      hierarchyNode: null
    };
  }

  function createFactionVirtualTreeNode(virtualNode, callbacks) {
    const node = document.createElement("div");
    const hierarchyNode = virtualNode.hierarchyNode;
    node.className = [
      "entity-tree-node",
      "entity-tree-virtual-node",
      hierarchyNode?.hidden ? "entity-tree-virtual-hidden" : "",
      hierarchyNode?.active === false ? "entity-tree-virtual-inactive" : ""
    ].filter(Boolean).join(" ");
    const header = document.createElement("div");
    header.className = "entity-tree-header entity-tree-virtual-header";
    header.innerHTML = `
      <span class="entity-tree-icon">${escapeHtml(hierarchyNode?.icon || "◇")}</span>
      <strong>${escapeHtml(virtualNode.name)}</strong>
      <span class="entity-tree-type">${escapeHtml(hierarchyNode?.nodeType || "group")}</span>
      ${hierarchyNode?.hidden ? `<span class="entity-tree-virtual-badge">Hidden</span>` : ""}
      ${hierarchyNode?.active === false ? `<span class="entity-tree-virtual-badge">Inactive</span>` : ""}
      ${hierarchyNode?.promotional === false ? `<span class="entity-tree-virtual-badge">Non-promotional</span>` : ""}
      ${(hierarchyNode?.parentNodeIds?.length || 0) > 1 ? `<span class="entity-tree-virtual-badge">${hierarchyNode.parentNodeIds.length} parents</span>` : ""}
    `;
    header.addEventListener("click", async () => {
      if (typeof callbacks.onOpenFactionHierarchy === "function") {
        await callbacks.onOpenFactionHierarchy(
          virtualNode.faction,
          hierarchyNode?.id || null
        );
      }
    });
    node.appendChild(header);
    return node;
  }

  function appendFactionMemberNodes({
    parentNode,
    parentVirtual,
    members,
    callbacks,
    treeContext
  }) {
    if (!members.length) return;
    const children = document.createElement("div");
    children.className = "entity-tree-children";
    const group = document.createElement("div");
    group.className = "entity-tree-group entity-tree-faction-members";
    members.forEach(member => {
      const memberNode = createFocusedEntityNode(member.entity, callbacks);
      if (member.secret) {
        memberNode.classList.add("entity-tree-secret-member");
        const header = memberNode.querySelector(":scope > .entity-tree-header");
        header?.insertAdjacentHTML(
          "beforeend",
          `<span class="entity-tree-virtual-badge">Secret / GM-only</span>`
        );
      }
      group.appendChild(memberNode);
      recordHierarchyEdge(parentVirtual, member.entity, treeContext);
    });
    children.appendChild(group);
    const header = parentNode.querySelector(":scope > .entity-tree-header");
    attachTreeCollapseControl(parentVirtual, header, children, treeContext);
    parentNode.appendChild(children);
  }

  function buildFactionHierarchyVirtualBranch({
    faction,
    hierarchyNode,
    nodes,
    membershipsByNode,
    callbacks,
    treeContext,
    path = []
  }) {
    const pathKey = [...path, hierarchyNode.id].join("/");
    const virtual = createFactionVirtualNode(faction, hierarchyNode, pathKey);
    const node = createFactionVirtualTreeNode(virtual, callbacks);
    const childHierarchyNodes = sortFactionTreeHierarchyNodes(
      nodes.filter(child =>
        child.id !== hierarchyNode.id &&
        Array.isArray(child.parentNodeIds) &&
        child.parentNodeIds.includes(hierarchyNode.id) &&
        !path.includes(child.id)
      )
    );
    const members = membershipsByNode.get(hierarchyNode.id) || [];
    const children = document.createElement("div");
    children.className = "entity-tree-children";

    childHierarchyNodes.forEach(child => {
      const childBranch = buildFactionHierarchyVirtualBranch({
        faction,
        hierarchyNode: child,
        nodes,
        membershipsByNode,
        callbacks,
        treeContext,
        path: [...path, hierarchyNode.id]
      });
      children.appendChild(childBranch);
      recordHierarchyEdge(virtual, childBranch._virtualFactionNode, treeContext);
    });
    if (members.length) {
      const memberGroup = document.createElement("div");
      memberGroup.className = "entity-tree-group entity-tree-faction-members";
      members.forEach(member => {
        const memberNode = createFocusedEntityNode(member.entity, callbacks);
        if (member.secret) {
          memberNode.classList.add("entity-tree-secret-member");
          memberNode.querySelector(":scope > .entity-tree-header")?.insertAdjacentHTML(
            "beforeend",
            `<span class="entity-tree-virtual-badge">Secret / GM-only</span>`
          );
        }
        memberGroup.appendChild(memberNode);
        recordHierarchyEdge(virtual, member.entity, treeContext);
      });
      children.appendChild(memberGroup);
    }
    if (children.children.length) {
      attachTreeCollapseControl(
        virtual,
        node.querySelector(":scope > .entity-tree-header"),
        children,
        treeContext
      );
      node.appendChild(children);
    }
    node._virtualFactionNode = virtual;
    return node;
  }

  async function buildFactionVirtualTreeNode(
    faction,
    engine,
    callbacks,
    treeContext,
    visitedFactions = new Set()
  ) {
    const factionKey = `faction:${getEntityId(faction)}`;
    const realNode = createFocusedEntityNode(faction, callbacks);
    if (visitedFactions.has(factionKey)) return realNode;
    visitedFactions.add(factionKey);
    treeContext.rendered.add(factionKey);

    const hierarchy = normaliseFactionTreeHierarchy(faction);
    const nodes = sortFactionTreeHierarchyNodes(hierarchy.nodes || []);
    const nodeIds = new Set(nodes.map(node => node.id).filter(Boolean));
    const { memberships, subfactions } = await getFactionTreeData(
      faction,
      engine,
      callbacks
    );
    const membershipsByNode = new Map();
    const unranked = [];
    memberships.forEach(member => {
      const nodeId = member.relationship.data_json?.factionRankId || "";
      if (!nodeId || !nodeIds.has(nodeId)) {
        unranked.push(member);
        return;
      }
      if (!membershipsByNode.has(nodeId)) membershipsByNode.set(nodeId, []);
      membershipsByNode.get(nodeId).push(member);
    });

    const children = document.createElement("div");
    children.className = "entity-tree-children entity-tree-faction-virtual-children";
    const roots = getFactionHierarchyRenderRoots(nodes);
    const hierarchyGroup = document.createElement("div");
    hierarchyGroup.className = "entity-tree-group entity-tree-faction-hierarchy";
    roots.forEach(root => {
      const branch = buildFactionHierarchyVirtualBranch({
        faction,
        hierarchyNode: root,
        nodes,
        membershipsByNode,
        callbacks,
        treeContext
      });
      hierarchyGroup.appendChild(branch);
      recordHierarchyEdge(faction, branch._virtualFactionNode, treeContext);
    });

    const unrankedVirtual = createFactionUnrankedVirtualNode(faction);
    const unrankedNode = createFactionVirtualTreeNode(unrankedVirtual, callbacks);
    appendFactionMemberNodes({
      parentNode: unrankedNode,
      parentVirtual: unrankedVirtual,
      members: unranked,
      callbacks,
      treeContext
    });
    hierarchyGroup.appendChild(unrankedNode);
    recordHierarchyEdge(faction, unrankedVirtual, treeContext);
    if (hierarchyGroup.children.length) children.appendChild(hierarchyGroup);

    if (subfactions.length) {
      const label = document.createElement("div");
      label.className = "entity-tree-relation";
      label.textContent = "Subfactions";
      const group = document.createElement("div");
      group.className = "entity-tree-group entity-tree-subfactions";
      for (const subfaction of subfactions) {
        const subfactionNode = await buildFactionVirtualTreeNode(
          subfaction,
          engine,
          callbacks,
          treeContext,
          new Set(visitedFactions)
        );
        group.appendChild(subfactionNode);
        recordHierarchyEdge(faction, subfaction, treeContext);
      }
      children.appendChild(label);
      children.appendChild(group);
    }

    if (children.children.length) {
      attachTreeCollapseControl(
        faction,
        realNode.querySelector(":scope > .entity-tree-header"),
        children,
        treeContext
      );
      realNode.appendChild(children);
    }
    return realNode;
  }

  async function buildFactionVirtualTree(entity, engine, callbacks) {
    const root = await findTopLevelFactionForEntity(entity, engine) || entity;
    const treeContext = createEntityTreeContext();
    const tree = getEntityType(root) === "faction"
      ? await buildFactionVirtualTreeNode(root, engine, callbacks, treeContext)
      : await buildEntityTreeNode(root, new Set(), treeContext, engine, callbacks);
    tree._relationshipTreeContext = treeContext;
    return tree;
  }

  function isActivePartyGroupEntity(entity) {
    if (getEntityType(entity) !== "party_group") return true;

    const data = entity.data_json || entity.data || {};
    const status = String(data.status || entity.status || "active")
      .trim()
      .toLowerCase();

    return !["inactive", "dissolved"].includes(status);
  }

  async function getPartyTreeLinks(entity, engine) {
    const entityType = getEntityType(entity);
    const entityId = getEntityId(entity);
    const relationships = await engine.getRelationshipsForEntity(
      entityType,
      entityId
    );
    const result = {
      parents: [],
      children: [],
      associated: [],
      historical: []
    };
    const included = new Set();

    for (const value of relationships) {
      const relationship = engine.normaliseRelationshipRecord(value);
      const selectedIsSource =
        relationship.sourceEntityType === entityType &&
        relationship.sourceEntityId === entityId;
      const selectedIsTarget =
        relationship.targetEntityType === entityType &&
        relationship.targetEntityId === entityId;

      if (!selectedIsSource && !selectedIsTarget) continue;

      const direction = selectedIsSource ? "outgoing" : "incoming";
      const otherType = selectedIsSource
        ? relationship.targetEntityType
        : relationship.sourceEntityType;
      const otherId = selectedIsSource
        ? relationship.targetEntityId
        : relationship.sourceEntityId;
      const relationshipType = relationship.relationshipType;
      const key = `${relationshipType}:${direction}:${otherType}:${otherId}`;

      if (included.has(key)) continue;

      let bucket = null;

      if (PARTY_STRUCTURAL_RELATIONSHIP_TYPES.has(relationshipType)) {
        const isParent =
          (selectedIsSource && [
            "member_of_party",
            "subgroup_of"
          ].includes(relationshipType)) ||
          (selectedIsTarget && [
            "has_party_member",
            "contains_subgroup"
          ].includes(relationshipType));
        const isChild =
          (selectedIsTarget && [
            "member_of_party",
            "subgroup_of"
          ].includes(relationshipType)) ||
          (selectedIsSource && [
            "has_party_member",
            "contains_subgroup"
          ].includes(relationshipType));

        if (isParent) bucket = result.parents;
        if (isChild) bucket = result.children;
      } else if (PARTY_ASSOCIATED_RELATIONSHIP_TYPES.has(relationshipType)) {
        bucket = result.associated;
      } else if (PARTY_HISTORICAL_RELATIONSHIP_TYPES.has(relationshipType)) {
        bucket = result.historical;
      }

      if (!bucket) continue;

      const linkedEntity = await engine.getEntity(otherType, otherId);
      if (!linkedEntity) continue;

      if (
        PARTY_STRUCTURAL_RELATIONSHIP_TYPES.has(relationshipType) &&
        !isActivePartyGroupEntity(linkedEntity)
      ) {
        continue;
      }

      included.add(key);
      bucket.push({
        relationship,
        direction,
        entity: linkedEntity
      });
    }

    return result;
  }

  async function findPartyTreeRoot(entity, engine) {
    if (getEntityType(entity) === "party") return entity;

    const queue = [{ entity, depth: 0 }];
    const visited = new Set();
    let highestGroup = null;

    while (queue.length) {
      const current = queue.shift();
      const currentKey =
        `${getEntityType(current.entity)}:${getEntityId(current.entity)}`;

      if (visited.has(currentKey) || current.depth > 10) continue;
      visited.add(currentKey);

      const links = await getPartyTreeLinks(current.entity, engine);
      const partyParent = links.parents.find(link =>
        getEntityType(link.entity) === "party"
      );

      if (partyParent) return partyParent.entity;

      for (const parentLink of links.parents) {
        if (getEntityType(parentLink.entity) === "party_group") {
          highestGroup = parentLink.entity;
        }

        queue.push({
          entity: parentLink.entity,
          depth: current.depth + 1
        });
      }
    }

    return highestGroup || entity;
  }

  function appendPartyTerminalLink(
    childrenContainer,
    links,
    prefix,
    callbacks
  ) {
    const link = links[0];
    const relationLabel = document.createElement("div");
    relationLabel.className = "entity-tree-relation";
    relationLabel.textContent = `${prefix} — ${links.map(item =>
      formatRelationshipLabel(
        item.relationship.relationshipType,
        item.direction
      )
    ).join(" · ")}`;
    const group = document.createElement("div");
    group.className = "entity-tree-group";
    group.appendChild(createFocusedEntityNode(link.entity, callbacks));
    childrenContainer.appendChild(relationLabel);
    childrenContainer.appendChild(group);
  }

  async function buildPartyHierarchyNode(
    entity,
    engine,
    callbacks,
    treeContext,
    visited,
    recurseStructural = true
  ) {
    const node = createFocusedEntityNode(entity, callbacks);
    const entityKey = `${getEntityType(entity)}:${getEntityId(entity)}`;

    if (visited.has(entityKey) || treeContext.rendered.has(entityKey)) {
      return null;
    }

    visited.add(entityKey);
    treeContext.rendered.add(entityKey);
    const links = await getPartyTreeLinks(entity, engine);
    const groupedPcIds = new Set();
    const groupedAssociateKeys = new Set();

    if (getEntityType(entity) === "party") {
      const activeChildGroups = links.children.filter(link => (
        getEntityType(link.entity) === "party_group" &&
        isActivePartyGroupEntity(link.entity)
      ));

      for (const groupLink of activeChildGroups) {
        const groupLinks = await getPartyTreeLinks(groupLink.entity, engine);
        groupLinks.children.forEach(memberLink => {
          if (getEntityType(memberLink.entity) === "pc") {
            groupedPcIds.add(getEntityId(memberLink.entity));
          }
        });
        groupLinks.associated.forEach(associateLink => {
          groupedAssociateKeys.add(
            `${getEntityType(associateLink.entity)}:${getEntityId(associateLink.entity)}`
          );
        });
      }
    }

    const structuralChildren = links.children.filter(link => !(
      getEntityType(entity) === "party" &&
      getEntityType(link.entity) === "pc" &&
      groupedPcIds.has(getEntityId(link.entity))
    ));
    const childrenContainer = document.createElement("div");
    childrenContainer.className = "entity-tree-children";

    for (const childLink of structuralChildren) {
      const childKey =
        `${getEntityType(childLink.entity)}:${getEntityId(childLink.entity)}`;

      if (visited.has(childKey) || treeContext.rendered.has(childKey)) {
        continue;
      }

      const relationLabel = document.createElement("div");
      relationLabel.className = "entity-tree-relation";
      relationLabel.textContent = formatRelationshipLabel(
        childLink.relationship.relationshipType,
        childLink.direction
      );
      const group = document.createElement("div");
      group.className = "entity-tree-group";
      const renderFocusedGroupBranch =
        !recurseStructural &&
        getEntityType(entity) === "party" &&
        getEntityType(childLink.entity) === "party_group";
      const childNode = recurseStructural || renderFocusedGroupBranch
        ? await buildPartyHierarchyNode(
            childLink.entity,
            engine,
            callbacks,
            treeContext,
            new Set(visited),
            recurseStructural
          )
        : createFocusedEntityNode(childLink.entity, callbacks);

      if (childNode) {
        recordHierarchyEdge(entity, childLink.entity, treeContext);
        if (!recurseStructural && !renderFocusedGroupBranch) {
          treeContext.rendered.add(childKey);
        }
        group.appendChild(childNode);
        childrenContainer.appendChild(relationLabel);
        childrenContainer.appendChild(group);
      }
    }

    const includeTerminalLinks =
      !recurseStructural ||
      ["party", "party_group"].includes(getEntityType(entity));

    if (includeTerminalLinks) {
      const currentAssociateGroups = new Map();
      links.associated
        .filter(link => !(
          getEntityType(entity) === "party" &&
          groupedAssociateKeys.has(
            `${getEntityType(link.entity)}:${getEntityId(link.entity)}`
          )
        ))
        .forEach(link => {
          const key = `${getEntityType(link.entity)}:${getEntityId(link.entity)}`;
          if (!currentAssociateGroups.has(key)) {
            currentAssociateGroups.set(key, []);
          }
          currentAssociateGroups.get(key).push(link);
        });

      currentAssociateGroups.forEach(associateLinks => {
        appendPartyTerminalLink(
          childrenContainer,
          associateLinks,
          "Associated",
          callbacks
        );
      });

      links.historical.forEach(link => {
        appendPartyTerminalLink(
          childrenContainer,
          [link],
          "Historical",
          callbacks
        );
      });
    }

    if (childrenContainer.children.length) {
      const header = node.querySelector(":scope > .entity-tree-header");
      attachTreeCollapseControl(
        entity,
        header,
        childrenContainer,
        treeContext
      );
      node.appendChild(childrenContainer);
    }

    return node;
  }

  async function buildFullPartyTree(entity, engine, callbacks) {
    const root = await findPartyTreeRoot(entity, engine);
    const treeContext = createEntityTreeContext();
    const tree = await buildPartyHierarchyNode(
      root,
      engine,
      callbacks,
      treeContext,
      new Set(),
      true
    );
    tree._relationshipTreeContext = treeContext;
    return tree;
  }

  async function buildFocusedPartyTree(entity, engine, callbacks) {
    const wrapper = document.createElement("div");
    wrapper.className = "entity-tree-node entity-tree-focused-view";
    const treeContext = createEntityTreeContext();
    const links = await getPartyTreeLinks(entity, engine);

    if (links.parents.length) {
      const parentGroup = document.createElement("div");
      parentGroup.className = "entity-tree-group";

      for (const parentLink of links.parents) {
        const relationLabel = document.createElement("div");
        relationLabel.className = "entity-tree-relation";
        relationLabel.textContent = formatRelationshipLabel(
          parentLink.relationship.relationshipType,
          parentLink.direction
        );
        parentGroup.appendChild(relationLabel);
        parentGroup.appendChild(
          createFocusedEntityNode(parentLink.entity, callbacks)
        );
        recordHierarchyEdge(parentLink.entity, entity, treeContext);
      }

      wrapper.appendChild(parentGroup);
    }

    const anchor = await buildPartyHierarchyNode(
      entity,
      engine,
      callbacks,
      treeContext,
      new Set(),
      false
    );
    wrapper.appendChild(anchor);
    wrapper._relationshipTreeContext = treeContext;
    return wrapper;
  }

  async function appendFocusedChildren(
    node,
    entity,
    mode,
    engine,
    callbacks,
    treeContext,
    visited,
    depth = 0
  ) {
    const childLinks = await getImmediateFocusedLinks(
      entity,
      mode,
      "child",
      engine
    );

    if (!childLinks.length) {
      return;
    }

    const childrenContainer = document.createElement("div");
    childrenContainer.className = "entity-tree-children";

    for (const childLink of childLinks) {
      const childKey = `${getEntityType(childLink.entity)}:${getEntityId(childLink.entity)}`;

      if (
        visited.has(childKey) ||
        treeContext.rendered.has(childKey)
      ) {
        continue;
      }

      treeContext.rendered.add(childKey);
      recordHierarchyEdge(entity, childLink.entity, treeContext);
      const relationLabel = document.createElement("div");
      relationLabel.className = "entity-tree-relation";
      relationLabel.textContent = formatRelationshipLabel(
        childLink.relationship.relationshipType,
        childLink.direction
      );
      const childNode = createFocusedEntityNode(
        childLink.entity,
        callbacks
      );

      if (
        mode === "command" &&
        ["faction", "crew", "group", "organisation", "organization"].includes(
          getEntityType(childLink.entity)
        ) &&
        ["commands", "secretly_commands", "leads"].includes(
          childLink.relationship.relationshipType
        ) &&
        depth < 1
      ) {
        await appendFocusedChildren(
          childNode,
          childLink.entity,
          mode,
          engine,
          callbacks,
          treeContext,
          new Set([...visited, childKey]),
          depth + 1
        );
      }

      childrenContainer.appendChild(relationLabel);
      childrenContainer.appendChild(childNode);
    }

    if (childrenContainer.children.length > 0) {
      const header = node.querySelector(
        ":scope > .entity-tree-header"
      );

      attachTreeCollapseControl(
        entity,
        header,
        childrenContainer,
        treeContext
      );

      node.appendChild(childrenContainer);
    }
  }

  async function getFocusedEqualPeers(
    entity,
    parentLinks,
    mode,
    engine
  ) {
    const parentKeys = new Set(
      parentLinks.map(link => {
        return `${getEntityType(link.entity)}:${getEntityId(link.entity)}`;
      })
    );

    if (!parentKeys.size) {
      return [];
    }

    const connectedPeers = await getConnectedEqualPeers(entity, engine);
    const peers = [];

    for (const peer of connectedPeers) {
      if (
        getEntityType(peer) === getEntityType(entity) &&
        getEntityId(peer) === getEntityId(entity)
      ) {
        continue;
      }

      const peerParents = await getImmediateFocusedLinks(
        peer,
        mode,
        "parent",
        engine
      );
      const sharesParent = peerParents.some(link => {
        return parentKeys.has(
          `${getEntityType(link.entity)}:${getEntityId(link.entity)}`
        );
      });

      if (sharesParent) {
        peers.push(peer);
      }
    }

    return peers;
  }

  async function buildEntityFocusTree(
    entity,
    mode,
    engine,
    callbacks
  ) {
    const wrapper = document.createElement("div");
    wrapper.className = "entity-tree-node entity-tree-focused-view";
    const treeContext = createEntityTreeContext();
    const anchorKey = `${getEntityType(entity)}:${getEntityId(entity)}`;
    treeContext.rendered.add(anchorKey);
    const parentLinks = await getImmediateFocusedLinks(
      entity,
      mode,
      "parent",
      engine
    );

    if (parentLinks.length) {
      const parentGroup = document.createElement("div");
      parentGroup.className = "entity-tree-group";

      for (const parentLink of parentLinks) {
        recordHierarchyEdge(
          parentLink.entity,
          entity,
          treeContext
        );
        treeContext.rendered.add(
          `${getEntityType(parentLink.entity)}:${getEntityId(parentLink.entity)}`
        );
        const relationLabel = document.createElement("div");
        relationLabel.className = "entity-tree-relation";
        relationLabel.textContent = formatRelationshipLabel(
          parentLink.relationship.relationshipType,
          parentLink.direction
        );
        parentGroup.appendChild(relationLabel);
        parentGroup.appendChild(
          createFocusedEntityNode(parentLink.entity, callbacks)
        );
      }

      wrapper.appendChild(parentGroup);
    }

    const equalPeers = await getFocusedEqualPeers(
      entity,
      parentLinks,
      mode,
      engine
    );

    if (equalPeers.length) {
      const peerRow = document.createElement("div");
      peerRow.className = "entity-tree-equal-row";

      equalPeers.forEach(peer => {
        recordEqualEdge(entity, peer, treeContext);
        treeContext.rendered.add(
          `${getEntityType(peer)}:${getEntityId(peer)}`
        );
      });

      for (const peer of [entity, ...equalPeers]) {
        const peerBranch = document.createElement("div");
        peerBranch.className = "entity-tree-equal-branch";
        const peerNode = createFocusedEntityNode(
          peer,
          callbacks
        );
        await appendFocusedChildren(
          peerNode,
          peer,
          mode,
          engine,
          callbacks,
          treeContext,
          new Set([
            `${getEntityType(peer)}:${getEntityId(peer)}`
          ])
        );
        peerBranch.appendChild(peerNode);
        peerRow.appendChild(peerBranch);
      }

      wrapper.appendChild(peerRow);
      wrapper._relationshipTreeContext = treeContext;
      return wrapper;
    }

    const anchorNode = createFocusedEntityNode(
      entity,
      callbacks
    );
    await appendFocusedChildren(
      anchorNode,
      entity,
      mode,
      engine,
      callbacks,
      treeContext,
      new Set([anchorKey])
    );
    wrapper.appendChild(anchorNode);
    wrapper._relationshipTreeContext = treeContext;
    return wrapper;
  }

  async function buildFocusedEntityTree(entity, mode, engine, callbacks) {
    const treeContext = createEntityTreeContext();

    if (mode === "command") {
      const parentShip = getEntityType(entity) === "ship"
        ? entity
        : await findTopLevelShipForEntity(entity, engine);

      const tree = await buildEntityTreeNode(
        parentShip || entity,
        new Set(),
        treeContext,
        engine,
        callbacks
      );
      tree._relationshipTreeContext = treeContext;
      return tree;
    }

    if (mode === "faction") return buildFactionVirtualTree(entity, engine, callbacks);

    if (mode === "all") {
      return buildAllLinksTree(entity, engine, callbacks);
    }

    const tree = await buildEntityTreeNode(
      entity,
      new Set(),
      treeContext,
      engine,
      callbacks
    );
    tree._relationshipTreeContext = treeContext;
    return tree;
  }

  async function render({
    container,
    entity,
    mode = "command",
    scope = "full",
    onSelectTreeEntity,
    onOpenEntity,
    onOpenNpc,
    onOpenFactionHierarchy,
    resolveFactionMemberDisplayTitle,
    showSecretRelationships = true
  } = {}) {
    if (!(container instanceof Element)) {
      throw new Error(
        "MasterForge Relationship Graph Renderer: a valid container is required."
      );
    }

    if (!getEntityType(entity) || !getEntityId(entity)) {
      throw new Error(
        "MasterForge Relationship Graph Renderer: a valid entity is required."
      );
    }

    const engine = requireRelationshipEngine();
    const callbacks = {
      selectedEntityKey:
        `${getEntityType(entity)}:${getEntityId(entity)}`,
      onSelectTreeEntity:
        typeof onSelectTreeEntity === "function"
          ? onSelectTreeEntity
          : null,
      onOpenEntity:
        typeof onOpenEntity === "function"
          ? onOpenEntity
          : () => {},
      onOpenNpc:
        typeof onOpenNpc === "function"
          ? onOpenNpc
          : () => {},
      onOpenFactionHierarchy:
        typeof onOpenFactionHierarchy === "function"
          ? onOpenFactionHierarchy
          : null,
      resolveFactionMemberDisplayTitle:
        typeof resolveFactionMemberDisplayTitle === "function"
          ? resolveFactionMemberDisplayTitle
          : null,
      showSecretRelationships: showSecretRelationships !== false
    };
    const tree = mode === "faction"
      ? await buildFactionVirtualTree(entity, engine, callbacks)
      : mode === "party"
      ? scope === "focused"
        ? await buildFocusedPartyTree(
            entity,
            engine,
            callbacks
          )
        : await buildFullPartyTree(
            entity,
            engine,
            callbacks
          )
      : scope === "focused" && mode !== "all"
        ? await buildEntityFocusTree(
            entity,
            mode,
            engine,
            callbacks
          )
        : await buildFocusedEntityTree(
            entity,
            mode,
            engine,
            callbacks
          );

    const defaultExpandedDistance =
      scope === "full" ? 0 : 1;

    if (tree._relationshipTreeContext) {
      applyTreeCollapseDefaults(
        tree._relationshipTreeContext,
        callbacks.selectedEntityKey,
        defaultExpandedDistance
      );
    }

    container.innerHTML = "";
    container.appendChild(tree);
    return tree;
  }

  window.MasterForgeRelationshipGraphRenderer = {
    version,
    render
  };

  console.log("MasterForge Relationship Graph Renderer loaded:", version);
})();
