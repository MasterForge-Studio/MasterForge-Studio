(() => {
  "use strict";

  const VERSION = 1;

  function createId(prefix) {
    const value = globalThis.crypto?.randomUUID?.() ||
      `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    return `${prefix}_${value}`;
  }

  function uniqueIds(values) {
    return [...new Set((Array.isArray(values) ? values : []).filter(value =>
      typeof value === "string" && value.trim()
    ).map(value => value.trim()))];
  }

  function normaliseTags(value) {
    if (Array.isArray(value)) return uniqueIds(value);
    return String(value || "").split(",").map(tag => tag.trim()).filter(Boolean);
  }

  function normaliseAbility(ability = {}) {
    const source = ability && typeof ability === "object" && !Array.isArray(ability) ? ability : {};
    return {
      ...source,
      id: typeof source.id === "string" && source.id ? source.id : createId("ability"),
      name: typeof source.name === "string" ? source.name : "",
      type: typeof source.type === "string" ? source.type : "",
      actionType: typeof source.actionType === "string" ? source.actionType : "",
      activation: typeof source.activation === "string" ? source.activation : "",
      range: typeof source.range === "string" ? source.range : "",
      target: typeof source.target === "string" ? source.target : "",
      duration: typeof source.duration === "string" ? source.duration : "",
      uses: typeof source.uses === "string" ? source.uses : "",
      recharge: typeof source.recharge === "string" ? source.recharge : "",
      description: typeof source.description === "string" ? source.description : "",
      rulesText: typeof source.rulesText === "string" ? source.rulesText : "",
      tags: normaliseTags(source.tags),
      active: source.active !== false,
      systemData: source.systemData && typeof source.systemData === "object" && !Array.isArray(source.systemData)
        ? { ...source.systemData }
        : {}
    };
  }

  function normaliseTrait(trait = {}) {
    const source = trait && typeof trait === "object" && !Array.isArray(trait) ? trait : {};
    return {
      ...source,
      id: typeof source.id === "string" && source.id ? source.id : createId("trait"),
      name: typeof source.name === "string" ? source.name : "",
      category: typeof source.category === "string" ? source.category : "",
      description: typeof source.description === "string" ? source.description : "",
      rulesText: typeof source.rulesText === "string" ? source.rulesText : "",
      tags: normaliseTags(source.tags),
      active: source.active !== false,
      systemData: source.systemData && typeof source.systemData === "object" && !Array.isArray(source.systemData)
        ? { ...source.systemData }
        : {}
    };
  }

  function normalisePackData(data = {}) {
    const source = data && typeof data === "object" && !Array.isArray(data) ? data : {};
    return {
      ...source,
      version: Number.isFinite(Number(source.version)) ? Number(source.version) : VERSION,
      category: typeof source.category === "string" ? source.category : "",
      systemId: typeof source.systemId === "string" ? source.systemId : "",
      tags: normaliseTags(source.tags),
      active: source.active !== false,
      abilities: (Array.isArray(source.abilities) ? source.abilities : []).map(normaliseAbility),
      traits: (Array.isArray(source.traits) ? source.traits : []).map(normaliseTrait)
    };
  }

  function validateNamedItems(items, label) {
    const errors = [];
    const warnings = [];
    const ids = new Set();
    const names = new Set();
    items.forEach((item, index) => {
      if (!String(item.name || "").trim()) errors.push(`${label} ${index + 1} requires a name.`);
      if (!item.id) errors.push(`${label} ${index + 1} requires a stable ID.`);
      else if (ids.has(item.id)) errors.push(`Duplicate ${label.toLowerCase()} ID: ${item.id}.`);
      ids.add(item.id);
      const name = String(item.name || "").trim().toLowerCase();
      if (name && names.has(name)) warnings.push(`Duplicate ${label.toLowerCase()} name: ${item.name}.`);
      names.add(name);
    });
    return { errors, warnings };
  }

  function validatePackData(data = {}) {
    const pack = normalisePackData(data);
    const abilityResult = validateNamedItems(pack.abilities, "Ability");
    const traitResult = validateNamedItems(pack.traits, "Trait");
    const errors = [...abilityResult.errors, ...traitResult.errors];
    return { valid: errors.length === 0, errors, warnings: [...abilityResult.warnings, ...traitResult.warnings] };
  }

  function countContents(data = {}) {
    const pack = normalisePackData(data);
    return {
      abilities: pack.abilities.length,
      activeAbilities: pack.abilities.filter(item => item.active).length,
      traits: pack.traits.length,
      activeTraits: pack.traits.filter(item => item.active).length
    };
  }

  window.MasterForgeAbilityPacks = Object.freeze({
    VERSION,
    createAbilityId: () => createId("ability"),
    createTraitId: () => createId("trait"),
    uniqueIds,
    normaliseTags,
    normaliseAbility,
    normaliseTrait,
    normalisePackData,
    validatePackData,
    countContents
  });
})();
