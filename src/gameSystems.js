console.log("gameSystems.js loaded");

(function () {
    const attribute = (id, name, shortLabel, order, description) => ({
        id, name, shortLabel, description, order, enabled: true,
        valueType: "number", defaultValue: 10, calculationKey: "ability-modifier"
    });
    const statistic = (id, name, shortLabel, category, options = {}) => ({
        id, name, shortLabel, description: options.description || "", enabled: options.enabled !== false,
        valueType: options.valueType || "number", defaultValue: options.defaultValue ?? "",
        category, calculationKey: options.calculationKey || "",
        persistentBetweenEncounters: Boolean(options.persistentBetweenEncounters),
        combatWriteBack: Boolean(options.combatWriteBack),
        requiredForCombat: Boolean(options.requiredForCombat)
    });
    const classification = (id, name) => ({ id, name, enabled: true });
    const condition = (id, name, summary, mechanicalTags = []) => ({
        id, name, summary, gmReference: summary, sourceSystemId: "dnd-2024",
        enabled: true, icon: "", mechanicalTags
    });
    const capability = (id, singularLabel, pluralLabel, order, displayGroup, options = {}) => ({
        id,
        name: pluralLabel,
        singularLabel,
        pluralLabel,
        description: options.description || "",
        enabled: options.enabled !== false,
        order,
        displayGroup,
        icon: options.icon || "",
        appearsInCombat: options.appearsInCombat !== false,
        canTrackUses: Boolean(options.canTrackUses),
        canRecharge: Boolean(options.canRecharge),
        supportedRuleBlocks: options.supportedRuleBlocks || ["freeform"],
        prominent: Boolean(options.prominent),
        persistentRuntime: Boolean(options.persistentRuntime),
        resourceLabel: options.resourceLabel || "",
        sourceKeys: options.sourceKeys || [],
        categoryAliases: options.categoryAliases || [],
        builderEditable: options.builderEditable !== false,
        entityTypes: options.entityTypes || ["npc", "creature"],
        editorType: options.editorType || "generic"
    });

    const DND_ATTRIBUTES = [
        attribute("strength", "Strength", "STR", 10, "Physical power."),
        attribute("dexterity", "Dexterity", "DEX", 20, "Agility and reflexes."),
        attribute("constitution", "Constitution", "CON", 30, "Health and endurance."),
        attribute("intelligence", "Intelligence", "INT", 40, "Reasoning and memory."),
        attribute("wisdom", "Wisdom", "WIS", 50, "Awareness and intuition."),
        attribute("charisma", "Charisma", "CHA", 60, "Force of personality.")
    ];
    const DND_SKILLS = [
        ["acrobatics", "Acrobatics", "dexterity"], ["animal-handling", "Animal Handling", "wisdom"],
        ["arcana", "Arcana", "intelligence"], ["athletics", "Athletics", "strength"],
        ["deception", "Deception", "charisma"], ["history", "History", "intelligence"],
        ["insight", "Insight", "wisdom"], ["intimidation", "Intimidation", "charisma"],
        ["investigation", "Investigation", "intelligence"], ["medicine", "Medicine", "wisdom"],
        ["nature", "Nature", "intelligence"], ["perception", "Perception", "wisdom"],
        ["performance", "Performance", "charisma"], ["persuasion", "Persuasion", "charisma"],
        ["religion", "Religion", "intelligence"], ["sleight-of-hand", "Sleight of Hand", "dexterity"],
        ["stealth", "Stealth", "dexterity"], ["survival", "Survival", "wisdom"]
    ].map(([id, name, governingAttributeId], order) => ({
        id, name, governingAttributeId, order, enabled: true,
        proficiencyStates: ["none", "proficient", "expertise"],
        calculationKey: "dnd-skill"
    }));
    const DND_CONDITIONS = [
        condition("blinded", "Blinded", "Cannot see; attacks are impaired.", ["vision", "attack"]),
        condition("charmed", "Charmed", "Cannot harm the charmer and is socially influenced.", ["social"]),
        condition("deafened", "Deafened", "Cannot hear.", ["hearing"]),
        condition("exhaustion", "Exhaustion", "Cumulative penalties; tracked by level.", ["valued"]),
        condition("frightened", "Frightened", "Disadvantaged while the source of fear is visible.", ["fear"]),
        condition("grappled", "Grappled", "Speed becomes 0.", ["movement"]),
        condition("incapacitated", "Incapacitated", "Cannot take actions, bonus actions or reactions.", ["actions"]),
        condition("invisible", "Invisible", "Cannot be seen without special senses.", ["vision"]),
        condition("paralysed", "Paralysed", "Incapacitated and unable to move or speak.", ["actions", "movement"]),
        condition("petrified", "Petrified", "Transformed and incapacitated.", ["transformation"]),
        condition("poisoned", "Poisoned", "Impaired attacks and ability checks.", ["attack", "check"]),
        condition("prone", "Prone", "Movement and attacks are affected.", ["movement", "attack"]),
        condition("restrained", "Restrained", "Speed is 0 and attacks are affected.", ["movement", "attack"]),
        condition("stunned", "Stunned", "Incapacitated and unable to move.", ["actions", "movement"]),
        condition("unconscious", "Unconscious", "Incapacitated, unaware and prone.", ["actions", "awareness"])
    ];

    const DND_2024_RULES = {
        schemaVersion: 1,
        displayLabels: {
            attributes: "Ability Scores", skills: "Skills", passiveScores: "Passive Scores",
            savingThrows: "Saving Throws", conditions: "Conditions", status: "Status"
        },
        attributes: DND_ATTRIBUTES,
        statistics: [
            statistic("armor-class", "Armour Class", "AC", "defence", { defaultValue: 10, requiredForCombat: true }),
            statistic("current-hit-points", "Current Hit Points", "Current HP", "health", { defaultValue: 10, persistentBetweenEncounters: true, combatWriteBack: true, requiredForCombat: true }),
            statistic("maximum-hit-points", "Maximum Hit Points", "Max HP", "health", { defaultValue: 10, persistentBetweenEncounters: true, requiredForCombat: true }),
            statistic("temporary-hit-points", "Temporary Hit Points", "Temp HP", "health", { defaultValue: 0, persistentBetweenEncounters: true, combatWriteBack: true }),
            statistic("speed", "Speed", "Speed", "movement", { valueType: "text" }),
            statistic("initiative", "Initiative", "Init", "combat", { calculationKey: "dexterity-modifier" }),
            statistic("proficiency-bonus", "Proficiency Bonus", "PB", "progression", { calculationKey: "dnd-proficiency" }),
            statistic("challenge-rating", "Challenge Rating", "CR", "threat", { valueType: "text" }),
            statistic("level", "Level", "Level", "progression", { defaultValue: 1 })
        ],
        skills: DND_SKILLS,
        passiveScores: [
            { id: "passive-perception", name: "Passive Perception", shortLabel: "PP", skillId: "perception", governingAttributeId: "wisdom", enabled: true, calculationKey: "dnd-passive-skill" },
            { id: "passive-investigation", name: "Passive Investigation", shortLabel: "PI", skillId: "investigation", governingAttributeId: "intelligence", enabled: true, calculationKey: "dnd-passive-skill" },
            { id: "passive-insight", name: "Passive Insight", shortLabel: "Passive Insight", skillId: "insight", governingAttributeId: "wisdom", enabled: true, calculationKey: "dnd-passive-skill" }
        ],
        savingThrows: DND_ATTRIBUTES.map(item => ({ id: `${item.id}-save`, name: `${item.name} Saving Throw`, attributeId: item.id, enabled: true, calculationKey: "dnd-saving-throw" })),
        checks: DND_ATTRIBUTES.map(item => ({ id: `${item.id}-check`, name: `${item.name} Check`, attributeId: item.id, enabled: true, rollLabel: `${item.name} check`, calculationKey: "dnd-ability-check" })),
        conditions: DND_CONDITIONS,
        capabilityCategories: [
            capability("traits", "Trait", "Traits", 10, "features", { editorType: "simple", sourceKeys: ["traits", "features"], categoryAliases: ["trait", "feature"], supportedRuleBlocks: ["freeform", "save"] }),
            capability("actions", "Action", "Actions", 20, "actions", { editorType: "action", sourceKeys: ["actions", "abilities"], categoryAliases: ["action", "ability"], canTrackUses: true, canRecharge: true, supportedRuleBlocks: ["attack", "save", "damage", "healing", "freeform"], prominent: true }),
            capability("bonus-actions", "Bonus Action", "Bonus Actions", 30, "actions", { editorType: "action", sourceKeys: ["bonusActions", "bonus_actions"], categoryAliases: ["bonus action", "bonus-action"], canTrackUses: true, canRecharge: true, supportedRuleBlocks: ["attack", "save", "damage", "healing", "freeform"] }),
            capability("reactions", "Reaction", "Reactions", 40, "quick-reference", { editorType: "action", sourceKeys: ["reactions"], categoryAliases: ["reaction"], canTrackUses: true, supportedRuleBlocks: ["attack", "save", "damage", "freeform"], prominent: true }),
            capability("legendary-actions", "Legendary Action", "Legendary Actions", 50, "quick-reference", { editorType: "action", sourceKeys: ["legendaryActions", "legendary_actions"], categoryAliases: ["legendary action", "legendary-action"], canTrackUses: true, supportedRuleBlocks: ["attack", "save", "damage", "freeform"], prominent: true, resourceLabel: "Legendary Actions" }),
            capability("lair-actions", "Lair Action", "Lair Actions", 60, "quick-reference", { editorType: "action", sourceKeys: ["lairActions", "lair_actions"], categoryAliases: ["lair action", "lair-action"], canTrackUses: true, canRecharge: true, supportedRuleBlocks: ["attack", "save", "damage", "freeform"], prominent: true }),
            capability("mythic-actions", "Mythic Action", "Mythic Actions", 70, "quick-reference", { editorType: "action", sourceKeys: ["mythicActions", "mythic_actions"], categoryAliases: ["mythic action", "mythic-action"], canTrackUses: true, canRecharge: true, supportedRuleBlocks: ["attack", "save", "damage", "healing", "freeform"], prominent: true }),
            capability("spellcasting", "Spellcasting Feature", "Spellcasting", 80, "magic", { editorType: "spellcasting", sourceKeys: ["spellcasting", "spells"], categoryAliases: ["spellcasting", "spell"], canTrackUses: true, supportedRuleBlocks: ["attack", "save", "damage", "healing", "freeform"], resourceLabel: "Spell Slots" }),
            capability("innate-spellcasting", "Innate Spellcasting Feature", "Innate Spellcasting", 90, "magic", { editorType: "spellcasting", sourceKeys: ["innateSpellcasting", "innate_spellcasting"], categoryAliases: ["innate spellcasting", "innate-spellcasting"], canTrackUses: true, canRecharge: true, supportedRuleBlocks: ["attack", "save", "damage", "healing", "freeform"] }),
            capability("equipment", "Equipment Action", "Equipment", 100, "equipment", { sourceKeys: ["equipmentActions", "equipment"], categoryAliases: ["equipment", "item"], canTrackUses: true, supportedRuleBlocks: ["attack", "save", "damage", "healing", "freeform"] })
        ],
        classifications: {
            sizes: ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"].map(value => classification(value.toLowerCase(), value)),
            creatureTypes: ["Aberration", "Beast", "Celestial", "Construct", "Dragon", "Elemental", "Fey", "Fiend", "Giant", "Humanoid", "Monstrosity", "Ooze", "Plant", "Undead"].map(value => classification(value.toLowerCase(), value)),
            alignments: ["Unaligned", "Lawful Good", "Neutral Good", "Chaotic Good", "Lawful Neutral", "Neutral", "Chaotic Neutral", "Lawful Evil", "Neutral Evil", "Chaotic Evil"].map(value => classification(value.toLowerCase().replace(/\s+/g, "-"), value)),
            levelLabel: "Level",
            threatLabel: "Challenge Rating"
        },
        semanticMappings: {
            primaryDefence: { fieldId: "armor-class", legacyPaths: ["ac", "stats.ac"] },
            currentHealth: { fieldId: "current-hit-points", legacyPaths: ["currentHP", "currentHp", "stats.currentHP", "stats.currentHp", "stats.hp"] },
            maximumHealth: { fieldId: "maximum-hit-points", legacyPaths: ["maxHP", "maxHp", "stats.maxHP", "stats.maxHp", "stats.maximumHp", "stats.hp"] },
            temporaryHealth: { fieldId: "temporary-hit-points", legacyPaths: ["temporaryHP", "temporaryHp", "tempHP", "tempHp", "stats.tempHP", "stats.tempHp"] },
            movement: { fieldId: "speed", legacyPaths: ["speed", "stats.speed"] },
            initiative: { fieldId: "initiative", legacyPaths: ["initiative"] },
            proficiency: { fieldId: "proficiency-bonus", legacyPaths: ["proficiencyBonus", "stats.proficiencyBonus"] },
            threat: { fieldId: "challenge-rating", legacyPaths: ["cr", "stats.cr"] },
            levelRank: { fieldId: "level", legacyPaths: ["level", "rank"] }
        },
        compatibility: {
            attributeLegacyIds: { strength: "str", dexterity: "dex", constitution: "con", intelligence: "int", wisdom: "wis", charisma: "cha" },
            passiveLegacyIds: { "passive-perception": "passivePerception", "passive-investigation": "passiveInvestigation", "passive-insight": "passiveInsight" }
        }
    };

    const FALLBACK_RULES = {
        schemaVersion: 1,
        displayLabels: {
            attributes: "Attributes", skills: "Skills", passiveScores: "Derived Scores",
            savingThrows: "Checks", conditions: "Conditions", status: "Status"
        },
        attributes: [],
        statistics: [
            statistic("current-resource", "Current Resource", "Current", "resource", { enabled: false, persistentBetweenEncounters: true, combatWriteBack: true }),
            statistic("maximum-resource", "Maximum Resource", "Maximum", "resource", { enabled: false, persistentBetweenEncounters: true }),
            statistic("primary-defence", "Defence", "Defence", "defence", { enabled: false }),
            statistic("initiative", "Initiative", "Initiative", "combat", { enabled: false })
        ],
        skills: [], passiveScores: [], savingThrows: [], checks: [], conditions: [], capabilityCategories: [],
        classifications: { sizes: [], creatureTypes: [], alignments: [], levelLabel: "Rank", threatLabel: "Threat" },
        semanticMappings: {
            currentHealth: { fieldId: "current-resource", legacyPaths: [] },
            maximumHealth: { fieldId: "maximum-resource", legacyPaths: [] },
            temporaryHealth: null, primaryDefence: { fieldId: "primary-defence", legacyPaths: [] },
            initiative: { fieldId: "initiative", legacyPaths: [] }, movement: null,
            proficiency: null, threat: null, levelRank: null
        },
        compatibility: { attributeLegacyIds: {}, passiveLegacyIds: {} }
    };

    const DEFAULT_GAME_SYSTEMS = {
        "dnd-2024": { id: "dnd-2024", name: "D&D 2024", description: "Dungeons & Dragons 2024 rules.", rules: DND_2024_RULES },
        "dnd-5e": { id: "dnd-5e", name: "D&D 5e", description: "Compatibility profile using the shared D&D rules schema.", rules: DND_2024_RULES },
        "system-neutral": { id: "system-neutral", name: "System Neutral", description: "A safe fallback for campaigns without a complete rules schema.", rules: FALLBACK_RULES }
    };
    const warnedMappings = new Set();

    function getGameSystems() { return DEFAULT_GAME_SYSTEMS; }
    function getGameSystem(systemId) {
        const selected = DEFAULT_GAME_SYSTEMS[systemId];
        if (selected) return selected;
        return { id: systemId || "system-neutral", name: systemId || "System Neutral", description: "No bundled rules schema.", rules: FALLBACK_RULES };
    }
    function getCurrentGameSystem() {
        const systemId = window.MasterForgeEncounterState?.gameSystemId ||
            window.dmState?.current?.systemId || window.dmState?.current?.gameSystemId || "system-neutral";
        return getGameSystem(systemId);
    }
    function enabled(items) { return (items || []).filter(item => item.enabled !== false).sort((a, b) => Number(a.order || 0) - Number(b.order || 0)); }
    function getRules(systemOrId) {
        if (typeof systemOrId === "string") return getGameSystem(systemOrId).rules || FALLBACK_RULES;
        return systemOrId?.rules || getCurrentGameSystem().rules || FALLBACK_RULES;
    }
    function getByPath(target, path) {
        return String(path || "").split(".").reduce((value, key) => value == null ? undefined : value[key], target);
    }
    function semantic(systemOrId, role) {
        const system = typeof systemOrId === "string" ? getGameSystem(systemOrId) : systemOrId || getCurrentGameSystem();
        const mapping = getRules(system).semanticMappings?.[role] || null;
        if (!mapping && !warnedMappings.has(`${system.id}:${role}`)) {
            warnedMappings.add(`${system.id}:${role}`);
            console.warn(`[MasterForge Rules] Missing semantic mapping "${role}" for system "${system.id}".`);
        }
        return mapping;
    }
    function statisticForRole(systemOrId, role) {
        const rules = getRules(systemOrId);
        const mapping = semantic(systemOrId, role);
        return mapping ? (rules.statistics || []).find(item => item.id === mapping.fieldId) || null : null;
    }
    function readSemantic(record, role, systemOrId) {
        const mapping = semantic(systemOrId, role);
        if (!mapping) return undefined;
        const systemValue = getByPath(record, `systemValues.statistics.${mapping.fieldId}`);
        if (systemValue !== undefined && systemValue !== null && systemValue !== "") return systemValue;
        for (const path of mapping.legacyPaths || []) {
            const value = getByPath(record, path);
            if (value !== undefined && value !== null && value !== "") return value;
        }
        return undefined;
    }
    function readAttribute(record, attributeId, systemOrId) {
        const rules = getRules(systemOrId);
        const stable = getByPath(record, `systemValues.attributes.${attributeId}`);
        if (stable !== undefined && stable !== null && stable !== "") return stable;
        const legacyId = rules.compatibility?.attributeLegacyIds?.[attributeId];
        return legacyId ? (getByPath(record, `abilities.${legacyId}`) ?? getByPath(record, `stats.${legacyId}`)) : undefined;
    }

    window.MasterForgeGameSystems = {
        getAll: getGameSystems,
        get: getGameSystem,
        getCurrent: getCurrentGameSystem,
        getRules,
        getFallbackRules: () => FALLBACK_RULES,
        enabled,
        semantic,
        statisticForRole,
        readSemantic,
        readAttribute
    };
})();
