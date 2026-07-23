// Descriptive registry for reusable MasterForge configuration asset types.
// This module intentionally contains no persistence or validation behaviour.
(() => {
  "use strict";

  const TYPES = Object.freeze({
    ABILITY_PACK: "ability_pack",
    RELATIONSHIP_PROFILE: "relationship_profile",
    CONDITION_PACK: "condition_pack",
    RULE_PACK: "rule_pack",
    SPELL_LIST: "spell_list",
    LOOT_TABLE: "loot_table",
    ENCOUNTER_TEMPLATE: "encounter_template",
    AI_PROFILE: "ai_profile"
  });

  window.MasterForgeConfigurationAssets = Object.freeze({
    VERSION: 1,
    TYPES
  });
})();
