// =====================================================
// MasterForge Studio
// Canonical Relationship Type Registry
// =====================================================
(() => {
  "use strict";

  const version = "0.1.0-alpha";
  const unrestrictedEntityTypes = ["*"];

  function createType(definition) {
    return {
      ...definition,
      allowedSources: [...unrestrictedEntityTypes],
      allowedTargets: [...unrestrictedEntityTypes],
      tree: {
        rootPriority: null,
        childPriority: null,
        displayMode: "branch",
        supportsEqualRank: false,
        ...definition.tree
      },
      movement: {
        inheritsPosition: false,
        currentLocation: false,
        ...definition.movement
      },
      secrecy: {
        inherentlySecret: false,
        allowed: true,
        ...definition.secrecy
      },
      aliases: [...(definition.aliases || [])],
      deprecatedAliases: [...(definition.deprecatedAliases || [])]
    };
  }

  const types = {
    answers_to: createType({
      id: "answers_to",
      label: "Reports To",
      description: "This NPC answers to, reports to, or serves under another NPC.",
      category: "command",
      modes: ["command", "general"],
      directional: true,
      symmetrical: false,
      inverseType: "commands",
      labels: {
        source: "Answers To",
        target: "Reports To Them"
      },
      tree: {
        rootPriority: 1,
        childPriority: 3
      }
    }),

    commands: createType({
      id: "commands",
      label: "Commands / Leads",
      description: "This NPC commands a crew, faction, squad, group or organisation. If you choose a ship or vehicle, MasterForge will link them to that vehicle's crew instead.",
      category: "command",
      modes: ["command", "general"],
      directional: true,
      symmetrical: false,
      inverseType: "answers_to",
      labels: {
        source: "Commands",
        target: "Commanded By / Leader"
      },
      tree: {
        rootPriority: 2,
        childPriority: 2
      }
    }),

    member_of: createType({
      id: "member_of",
      label: "Member Of",
      description: "This NPC is openly a member of a faction, crew, guild, army, order, or organisation.",
      category: "faction",
      modes: ["faction", "command", "general"],
      directional: true,
      symmetrical: false,
      inverseType: null,
      labels: {
        source: "Member Of",
        target: "Members"
      },
      tree: {
        rootPriority: 4,
        childPriority: 4
      }
    }),

    secretly_member_of: createType({
      id: "secretly_member_of",
      label: "Secretly Member Of",
      description: "This NPC is secretly connected to a faction or organisation.",
      category: "faction",
      modes: ["faction", "command", "general"],
      directional: true,
      symmetrical: false,
      inverseType: null,
      labels: {
        source: "Secretly Member Of",
        target: "Secret Members / Agents"
      },
      tree: {
        rootPriority: 9,
        childPriority: 5
      },
      secrecy: {
        inherentlySecret: true
      }
    }),

    operates_from: createType({
      id: "operates_from",
      label: "Operates From",
      description: "This NPC operates from a ship, base, settlement, stronghold, lair, or location.",
      category: "location",
      modes: ["location", "command", "general"],
      directional: true,
      symmetrical: false,
      inverseType: null,
      labels: {
        source: "Operates From",
        target: "Operated By"
      },
      tree: {
        rootPriority: 3,
        childPriority: 1
      },
      movement: {
        inheritsPosition: true,
        currentLocation: false
      }
    }),

    aboard: createType({
      id: "aboard",
      label: "Aboard / Assigned To",
      description: "This NPC is currently aboard, stationed on, or assigned to a ship, base, settlement or other entity.",
      category: "location",
      modes: ["location", "general"],
      directional: true,
      symmetrical: false,
      inverseType: null,
      labels: {
        source: "Aboard / Assigned To",
        target: "Crew / Aboard"
      },
      tree: {
        childPriority: 20
      },
      movement: {
        inheritsPosition: true,
        currentLocation: true
      }
    }),

    located_in: createType({
      id: "located_in",
      label: "Located In",
      description: "This NPC is currently based in, found in, or associated with a location.",
      category: "location",
      modes: ["location", "general"],
      directional: true,
      symmetrical: false,
      inverseType: null,
      labels: {
        source: "Located In",
        target: "Contains"
      },
      movement: {
        inheritsPosition: true,
        currentLocation: true
      }
    }),

    allied_with: createType({
      id: "allied_with",
      label: "Allied With",
      description: "This NPC is allied with another entity.",
      category: "general",
      modes: ["general"],
      directional: false,
      symmetrical: true,
      inverseType: "allied_with",
      labels: {
        source: "Allied With",
        target: "Allied With"
      }
    }),

    rival_of: createType({
      id: "rival_of",
      label: "Rival Of",
      description: "This NPC is a rival, enemy, competitor, or opposing force to another entity.",
      category: "general",
      modes: ["general"],
      directional: false,
      symmetrical: true,
      inverseType: "rival_of",
      labels: {
        source: "Rival Of",
        target: "Rival Of"
      }
    }),

    owns: createType({
      id: "owns",
      label: "Owns / Controls",
      description: "This NPC owns, controls, possesses, or claims something.",
      category: "ownership",
      modes: ["general"],
      directional: true,
      symmetrical: false,
      inverseType: null,
      labels: {
        source: "Owns",
        target: "Owned By"
      }
    }),

    inside: createType({
      id: "inside",
      label: "Inside",
      description: "This entity is physically inside another entity.",
      category: "location",
      modes: ["location", "general"],
      directional: true,
      symmetrical: false,
      inverseType: null,
      labels: {
        source: "Inside",
        target: "Inside"
      },
      movement: {
        inheritsPosition: true,
        currentLocation: true
      }
    }),

    contained_in: createType({
      id: "contained_in",
      label: "Contained In",
      description: "This entity is contained inside another entity.",
      category: "location",
      modes: ["location", "general"],
      directional: true,
      symmetrical: false,
      inverseType: null,
      labels: {
        source: "Contained In",
        target: "Contained In"
      },
      movement: {
        inheritsPosition: true,
        currentLocation: true
      }
    }),

    stored_in: createType({
      id: "stored_in",
      label: "Stored In",
      description: "This item, loot, cargo or object is stored inside another entity.",
      category: "ownership",
      modes: ["location", "general"],
      directional: true,
      symmetrical: false,
      inverseType: null,
      labels: {
        source: "Stored In",
        target: "Stored In"
      },
      movement: {
        inheritsPosition: true,
        currentLocation: true
      }
    }),

    carried_by: createType({
      id: "carried_by",
      label: "Carried By",
      description: "This item or object is carried by another entity.",
      category: "ownership",
      modes: ["location", "general"],
      directional: true,
      symmetrical: false,
      inverseType: null,
      labels: {
        source: "Carried By",
        target: "Carried By"
      },
      movement: {
        inheritsPosition: true,
        currentLocation: true
      }
    }),

    stationed_at: createType({
      id: "stationed_at",
      label: "Stationed At",
      description: "This group, NPC, crew, creature or force is stationed at another entity.",
      category: "location",
      modes: ["location", "general"],
      directional: true,
      symmetrical: false,
      inverseType: null,
      labels: {
        source: "Stationed At",
        target: "Stationed At"
      },
      movement: {
        inheritsPosition: true,
        currentLocation: true
      }
    }),

    assigned_to: createType({
      id: "assigned_to",
      label: "Assigned To",
      description: "This entity is assigned to another entity, ship, base, faction or location.",
      category: "command",
      modes: ["command", "location", "general"],
      directional: true,
      symmetrical: false,
      inverseType: null,
      labels: {
        source: "Assigned To",
        target: "Assigned To"
      },
      movement: {
        inheritsPosition: true,
        currentLocation: true
      }
    }),

    co_leads_with: createType({
      id: "co_leads_with",
      label: "Co-Leads With",
      description: "This entity shares leadership responsibility with another entity.",
      category: "command",
      modes: ["command", "faction", "general"],
      directional: false,
      symmetrical: true,
      inverseType: "co_leads_with",
      labels: {
        source: "Co-Leads With",
        target: "Co-Leads With"
      },
      tree: {
        rootPriority: null,
        childPriority: null,
        displayMode: "equal",
        supportsEqualRank: true
      }
    }),

    equal_rank_to: createType({
      id: "equal_rank_to",
      label: "Equal In Position To",
      description: "This entity holds equal rank or authority with another entity.",
      category: "command",
      modes: ["command", "faction", "general"],
      directional: false,
      symmetrical: true,
      inverseType: "equal_rank_to",
      labels: {
        source: "Equal In Position To",
        target: "Equal In Position To"
      },
      tree: {
        rootPriority: null,
        childPriority: null,
        displayMode: "equal",
        supportsEqualRank: true
      }
    }),

    deputy_to: createType({
      id: "deputy_to",
      label: "Deputy To",
      description: "This entity serves as deputy, second-in-command, or designated subordinate to another entity.",
      category: "command",
      modes: ["command", "general"],
      directional: true,
      symmetrical: false,
      inverseType: null,
      labels: {
        source: "Deputy To",
        target: "Has Deputy"
      },
      tree: {
        rootPriority: null,
        childPriority: null,
        displayMode: "branch",
        supportsEqualRank: false
      }
    }),

    leads: createType({
      id: "leads",
      label: "Leads",
      description: "This entity leads a faction, organisation, crew, order, or other group.",
      category: "faction",
      modes: ["faction", "command", "general"],
      directional: true,
      symmetrical: false,
      inverseType: null,
      labels: {
        source: "Leads",
        target: "Led By"
      },
      tree: {
        rootPriority: null,
        childPriority: null,
        displayMode: "branch",
        supportsEqualRank: false
      }
    }),

    subfaction_of: createType({
      id: "subfaction_of",
      label: "Subfaction Of",
      description: "This faction or organisation is structurally contained within another faction or organisation.",
      category: "faction",
      modes: ["faction", "general"],
      directional: true,
      symmetrical: false,
      inverseType: "contains_subfaction",
      labels: {
        source: "Subfaction Of",
        target: "Contains Subfaction"
      },
      tree: {
        rootPriority: null,
        childPriority: null,
        displayMode: "branch",
        supportsEqualRank: false
      }
    }),

    contains_subfaction: createType({
      id: "contains_subfaction",
      label: "Contains Subfaction",
      description: "This faction or organisation structurally contains another faction or organisation.",
      category: "faction",
      modes: ["faction", "general"],
      directional: true,
      symmetrical: false,
      inverseType: "subfaction_of",
      labels: {
        source: "Contains Subfaction",
        target: "Subfaction Of"
      },
      tree: {
        rootPriority: null,
        childPriority: null,
        displayMode: "branch",
        supportsEqualRank: false
      }
    }),

    secretly_answers_to: createType({
      id: "secretly_answers_to",
      label: "Secretly Answers To",
      description: "This entity secretly reports to or serves under another entity.",
      category: "command",
      modes: ["command", "general"],
      directional: true,
      symmetrical: false,
      inverseType: "secretly_commands",
      labels: {
        source: "Secretly Answers To",
        target: "Secretly Receives Reports From"
      },
      tree: {
        rootPriority: null,
        childPriority: null,
        displayMode: "branch",
        supportsEqualRank: false
      },
      secrecy: {
        inherentlySecret: true,
        allowed: true
      }
    }),

    secretly_commands: createType({
      id: "secretly_commands",
      label: "Secretly Commands",
      description: "This entity secretly commands, directs, or controls another entity.",
      category: "command",
      modes: ["command", "general"],
      directional: true,
      symmetrical: false,
      inverseType: "secretly_answers_to",
      labels: {
        source: "Secretly Commands",
        target: "Secretly Commanded By"
      },
      tree: {
        rootPriority: null,
        childPriority: null,
        displayMode: "branch",
        supportsEqualRank: false
      },
      secrecy: {
        inherentlySecret: true,
        allowed: true
      }
    }),

    member_of_party: createType({
      id: "member_of_party",
      label: "Member Of Party",
      description: "This entity is a member of a party or adventuring group.",
      category: "party",
      modes: ["party", "general"],
      directional: true,
      symmetrical: false,
      inverseType: "has_party_member",
      labels: { source: "Member Of Party", target: "Party Members" },
      tree: { rootPriority: null, childPriority: null, displayMode: "branch", supportsEqualRank: false },
      movement: { inheritsPosition: false, currentLocation: false },
      secrecy: { inherentlySecret: false, allowed: true },
      aliases: [],
      deprecatedAliases: []
    }),

    has_party_member: createType({
      id: "has_party_member",
      label: "Has Party Member",
      description: "This party includes an entity as one of its members.",
      category: "party",
      modes: ["party", "general"],
      directional: true,
      symmetrical: false,
      inverseType: "member_of_party",
      labels: { source: "Has Party Member", target: "Member Of Party" },
      tree: { rootPriority: null, childPriority: null, displayMode: "branch", supportsEqualRank: false },
      movement: { inheritsPosition: false, currentLocation: false },
      secrecy: { inherentlySecret: false, allowed: true },
      aliases: [],
      deprecatedAliases: []
    }),

    subgroup_of: createType({
      id: "subgroup_of",
      label: "Subgroup Of",
      description: "This party group is a temporary or permanent subgroup of another party.",
      category: "party",
      modes: ["party", "general"],
      directional: true,
      symmetrical: false,
      inverseType: "contains_subgroup",
      labels: { source: "Subgroup Of", target: "Contains Subgroup" },
      tree: { rootPriority: null, childPriority: null, displayMode: "branch", supportsEqualRank: false },
      movement: { inheritsPosition: false, currentLocation: false },
      secrecy: { inherentlySecret: false, allowed: true },
      aliases: [],
      deprecatedAliases: []
    }),

    contains_subgroup: createType({
      id: "contains_subgroup",
      label: "Contains Subgroup",
      description: "This party contains another party group as a subgroup.",
      category: "party",
      modes: ["party", "general"],
      directional: true,
      symmetrical: false,
      inverseType: "subgroup_of",
      labels: { source: "Contains Subgroup", target: "Subgroup Of" },
      tree: { rootPriority: null, childPriority: null, displayMode: "branch", supportsEqualRank: false },
      movement: { inheritsPosition: false, currentLocation: false },
      secrecy: { inherentlySecret: false, allowed: true },
      aliases: [],
      deprecatedAliases: []
    }),

    split_from: createType({
      id: "split_from",
      label: "Split From",
      description: "This party or party group split from another party or group.",
      category: "party",
      modes: ["party", "general"],
      directional: false,
      symmetrical: true,
      inverseType: "split_from",
      labels: { source: "Split From", target: "Split From" },
      tree: { rootPriority: null, childPriority: null, displayMode: "branch", supportsEqualRank: false },
      movement: { inheritsPosition: false, currentLocation: false },
      secrecy: { inherentlySecret: false, allowed: true },
      aliases: [],
      deprecatedAliases: []
    }),

    rejoined_with: createType({
      id: "rejoined_with",
      label: "Rejoined With",
      description: "This party or party group later rejoined another party or group.",
      category: "party",
      modes: ["party", "general"],
      directional: false,
      symmetrical: true,
      inverseType: "rejoined_with",
      labels: { source: "Rejoined With", target: "Rejoined With" },
      tree: { rootPriority: null, childPriority: null, displayMode: "branch", supportsEqualRank: false },
      movement: { inheritsPosition: false, currentLocation: false },
      secrecy: { inherentlySecret: false, allowed: true },
      aliases: [],
      deprecatedAliases: []
    }),

    travels_with: createType({
      id: "travels_with",
      label: "Travels With",
      description: "These entities currently travel together without necessarily sharing formal party membership.",
      category: "party",
      modes: ["party", "companion", "general"],
      directional: false,
      symmetrical: true,
      inverseType: "travels_with",
      labels: { source: "Travels With", target: "Travels With" },
      tree: { rootPriority: null, childPriority: null, displayMode: "branch", supportsEqualRank: false },
      movement: { inheritsPosition: false, currentLocation: false },
      secrecy: { inherentlySecret: false, allowed: true },
      aliases: [],
      deprecatedAliases: []
    }),

    companion_of: createType({
      id: "companion_of",
      label: "Companion Of",
      description: "These entities have an established companion relationship.",
      category: "companion",
      modes: ["companion", "party", "general"],
      directional: false,
      symmetrical: true,
      inverseType: "companion_of",
      labels: { source: "Companion Of", target: "Companion Of" },
      tree: { rootPriority: null, childPriority: null, displayMode: "branch", supportsEqualRank: false },
      movement: { inheritsPosition: false, currentLocation: false },
      secrecy: { inherentlySecret: false, allowed: true },
      aliases: [],
      deprecatedAliases: []
    }),

    bonded_to: createType({
      id: "bonded_to",
      label: "Bonded To",
      description: "These entities share a significant personal, magical, trained, or creature bond.",
      category: "companion",
      modes: ["companion", "party", "general"],
      directional: false,
      symmetrical: true,
      inverseType: "bonded_to",
      labels: { source: "Bonded To", target: "Bonded To" },
      tree: { rootPriority: null, childPriority: null, displayMode: "branch", supportsEqualRank: false },
      movement: { inheritsPosition: false, currentLocation: false },
      secrecy: { inherentlySecret: false, allowed: true },
      aliases: [],
      deprecatedAliases: []
    }),

    handler_of: createType({
      id: "handler_of",
      label: "Handler Of",
      description: "This entity is responsible for directing, caring for, or managing another entity.",
      category: "companion",
      modes: ["companion", "party", "general"],
      directional: true,
      symmetrical: false,
      inverseType: "handled_by",
      labels: { source: "Handler Of", target: "Handled By" },
      tree: { rootPriority: null, childPriority: null, displayMode: "branch", supportsEqualRank: false },
      movement: { inheritsPosition: false, currentLocation: false },
      secrecy: { inherentlySecret: false, allowed: true },
      aliases: [],
      deprecatedAliases: []
    }),

    handled_by: createType({
      id: "handled_by",
      label: "Handled By",
      description: "This entity is directed, cared for, or managed by another entity.",
      category: "companion",
      modes: ["companion", "party", "general"],
      directional: true,
      symmetrical: false,
      inverseType: "handler_of",
      labels: { source: "Handled By", target: "Handler Of" },
      tree: { rootPriority: null, childPriority: null, displayMode: "branch", supportsEqualRank: false },
      movement: { inheritsPosition: false, currentLocation: false },
      secrecy: { inherentlySecret: false, allowed: true },
      aliases: [],
      deprecatedAliases: []
    }),

    captured_by: createType({
      id: "captured_by",
      label: "Captured By",
      description: "This entity was captured by another entity, party, faction, or group.",
      category: "captivity",
      modes: ["party", "general"],
      directional: true,
      symmetrical: false,
      inverseType: "holds_captive",
      labels: { source: "Captured By", target: "Captured" },
      tree: { rootPriority: null, childPriority: null, displayMode: "branch", supportsEqualRank: false },
      movement: { inheritsPosition: false, currentLocation: false },
      secrecy: { inherentlySecret: false, allowed: true },
      aliases: [],
      deprecatedAliases: []
    }),

    holds_captive: createType({
      id: "holds_captive",
      label: "Holds Captive",
      description: "This entity, party, faction, or group holds another entity captive.",
      category: "captivity",
      modes: ["party", "general"],
      directional: true,
      symmetrical: false,
      inverseType: "captured_by",
      labels: { source: "Holds Captive", target: "Held Captive By" },
      tree: { rootPriority: null, childPriority: null, displayMode: "branch", supportsEqualRank: false },
      movement: { inheritsPosition: false, currentLocation: false },
      secrecy: { inherentlySecret: false, allowed: true },
      aliases: [],
      deprecatedAliases: []
    }),

    prisoner_of: createType({
      id: "prisoner_of",
      label: "Prisoner Of",
      description: "This entity is currently held as a prisoner by another entity, party, faction, or group.",
      category: "captivity",
      modes: ["party", "general"],
      directional: true,
      symmetrical: false,
      inverseType: "has_prisoner",
      labels: { source: "Prisoner Of", target: "Has Prisoner" },
      tree: { rootPriority: null, childPriority: null, displayMode: "branch", supportsEqualRank: false },
      movement: { inheritsPosition: false, currentLocation: false },
      secrecy: { inherentlySecret: false, allowed: true },
      aliases: [],
      deprecatedAliases: []
    }),

    has_prisoner: createType({
      id: "has_prisoner",
      label: "Has Prisoner",
      description: "This entity, party, faction, or group currently holds another entity as a prisoner.",
      category: "captivity",
      modes: ["party", "general"],
      directional: true,
      symmetrical: false,
      inverseType: "prisoner_of",
      labels: { source: "Has Prisoner", target: "Prisoner Of" },
      tree: { rootPriority: null, childPriority: null, displayMode: "branch", supportsEqualRank: false },
      movement: { inheritsPosition: false, currentLocation: false },
      secrecy: { inherentlySecret: false, allowed: true },
      aliases: [],
      deprecatedAliases: []
    })
  };

  const movementTypes = [
    "aboard",
    "inside",
    "contained_in",
    "stored_in",
    "carried_by",
    "located_in",
    "operates_from",
    "stationed_at",
    "assigned_to"
  ];

  const currentLocationTypes = [
    "aboard",
    "inside",
    "contained_in",
    "stored_in",
    "carried_by",
    "located_in",
    "stationed_at",
    "assigned_to"
  ];

  function normaliseKey(value = "") {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replaceAll("-", "_")
      .replaceAll(" ", "_");
  }

  function get(key) {
    return types[normaliseKey(key)] || null;
  }

  function has(key) {
    return get(key) !== null;
  }

  function getLabel(key, direction = "") {
    const type = get(key);

    if (!type) {
      return String(key || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
    }

    const normalisedDirection = normaliseKey(direction);

    if (["source", "outgoing"].includes(normalisedDirection)) {
      return type.labels.source;
    }

    if (["target", "incoming"].includes(normalisedDirection)) {
      return type.labels.target;
    }

    return type.label;
  }

  function getInverseType(key) {
    return get(key)?.inverseType || null;
  }

  function isSymmetrical(key) {
    return get(key)?.symmetrical === true;
  }

  function getByMode(mode) {
    const normalisedMode = normaliseKey(mode);

    return Object.values(types).filter(type =>
      type.modes.includes(normalisedMode)
    );
  }

  function getMovementTypes() {
    return [...movementTypes];
  }

  function getCurrentLocationTypes() {
    return [...currentLocationTypes];
  }

  window.MasterForgeRelationshipTypes = {
    version,
    types,
    get,
    has,
    getLabel,
    getInverseType,
    isSymmetrical,
    getByMode,
    getMovementTypes,
    getCurrentLocationTypes
  };

  console.log(
    "MasterForge Relationship Types loaded:",
    version
  );
})();
