// MasterForge relationship metadata is deliberately extensible. This registry
// documents shared keys; it is not a schema validator and custom metadata is valid.
(() => {
  "use strict";

  const KEYS = Object.freeze({
    FACTION_RANK_ID: "factionRankId",
    FACTION_TITLE_OVERRIDE: "factionTitleOverride",
    PRIMARY_FACTION: "primaryFaction",
    TITLE_VISIBILITY: "titleVisibility",
    SHOW_TITLE_IN_DISPLAY_NAME: "showTitleInDisplayName",
    RELATIONSHIP_PROFILE_ID: "relationshipProfileId",
    BOND_LEVEL: "bondLevel",
    TRUST: "trust",
    LOYALTY: "loyalty",
    SHARED_INITIATIVE: "sharedInitiative",
    INITIATIVE_GROUP_ID: "initiativeGroupId",
    INHERIT_MOVEMENT: "inheritMovement",
    SHARED_INVENTORY: "sharedInventory",
    TEMPORARY: "temporary",
    ACTIVE: "active"
  });

  const GROUPS = Object.freeze({
    faction: Object.freeze([
      KEYS.FACTION_RANK_ID,
      KEYS.FACTION_TITLE_OVERRIDE,
      KEYS.PRIMARY_FACTION,
      KEYS.TITLE_VISIBILITY,
      KEYS.SHOW_TITLE_IN_DISPLAY_NAME
    ]),
    profile: Object.freeze([KEYS.RELATIONSHIP_PROFILE_ID]),
    bond: Object.freeze([KEYS.BOND_LEVEL, KEYS.TRUST, KEYS.LOYALTY]),
    combat: Object.freeze([KEYS.SHARED_INITIATIVE, KEYS.INITIATIVE_GROUP_ID]),
    movement: Object.freeze([KEYS.INHERIT_MOVEMENT]),
    narrative: Object.freeze([
      KEYS.SHARED_INVENTORY,
      KEYS.TEMPORARY,
      KEYS.ACTIVE
    ])
  });

  const TITLE_VISIBILITY = Object.freeze({
    PUBLIC: "public",
    GM: "gm",
    HIDDEN: "hidden"
  });

  window.MasterForgeRelationshipMetadata = Object.freeze({
    VERSION: 1,
    KEYS,
    GROUPS,
    TITLE_VISIBILITY
  });
})();
