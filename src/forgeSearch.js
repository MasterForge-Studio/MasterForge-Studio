// =====================================================
// MasterForge Studio
// Forge Search Engine v0.1
// Shared search/filter engine for builders and global search
// =====================================================

window.forgeSearch = (() => {

  function normaliseText(value) {
    return String(value || "")
      .toLowerCase()
      .trim();
  }

  function includesSearch(record, searchTerm, fields = []) {
    const query = normaliseText(searchTerm);

    if (!query) return true;

    const searchableText = fields
      .map(field => getNestedValue(record, field))
      .join(" ")
      .toLowerCase();

    return searchableText.includes(query);
  }

  function getNestedValue(record, path) {
    return String(path || "")
      .split(".")
      .reduce((value, key) => {
        if (value === undefined || value === null) return "";
        return value[key];
      }, record) || "";
  }

  function getCreatureSource(creature) {
    return normaliseText(
      creature.source ||
      creature.origin ||
      creature.contentSource ||
      ""
    );
  }

  function isHomebrewCreature(creature) {
    const source = getCreatureSource(creature);

    return (
      creature.flags?.homebrew === true ||
      creature.homebrew === true ||
      source === "homebrew"
    );
  }

  function isCampaignCreature(creature) {
    const source = getCreatureSource(creature);

    return (
      source === "campaign" ||
      !!creature.campaign
    );
  }

  function matchesCreatureFilter(creature, filters = {}) {
    const sourceFilter = filters.source || "all";
    const typeFilter = filters.type || "all";
    const sizeFilter = filters.size || "all";
    const locationFilter = filters.location || "all";

    if (sourceFilter === "homebrew" && !isHomebrewCreature(creature)) {
      return false;
    }

    if (sourceFilter === "campaign" && !isCampaignCreature(creature)) {
      return false;
    }

    if (
      typeFilter !== "all" &&
      normaliseText(creature.type) !== normaliseText(typeFilter)
    ) {
      return false;
    }

    if (
      sizeFilter !== "all" &&
      normaliseText(creature.size) !== normaliseText(sizeFilter)
    ) {
      return false;
    }

    if (locationFilter !== "all") {
      const foundIn = Array.isArray(creature.foundInLocationIds)
        ? creature.foundInLocationIds
        : creature.location
          ? [creature.location]
          : [];

      if (!foundIn.includes(locationFilter)) {
        return false;
      }
    }

    return true;
  }

  function searchCreatures(creatures = [], options = {}) {
    const searchTerm = options.searchTerm || "";
    const filters = options.filters || {};

    const fields = options.fields || [
      "name",
      "type",
      "size",
      "cr",
      "source",
      "tags",
      "environment",
      "alignment",
      "description",
      "notes.campaign",
      "notes.dm",
      "notes.adventure"
    ];

    return creatures
      .filter(creature => includesSearch(creature, searchTerm, fields))
      .filter(creature => matchesCreatureFilter(creature, filters))
      .sort((a, b) => {
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
  }

  function getSearchSuggestions(records = [], options = {}) {
    const searchTerm = normaliseText(options.searchTerm || "");
    const fields = options.fields || ["name"];
    const limit = options.limit || 8;

    if (searchTerm.length < 3) return [];

    const suggestions = [];

    records.forEach(record => {
      fields.forEach(field => {
        const value = getNestedValue(record, field);

        if (!value) return;

        const text = String(value);

        if (
          normaliseText(text).includes(searchTerm) &&
          !suggestions.includes(text)
        ) {
          suggestions.push(text);
        }
      });
    });

    return suggestions.slice(0, limit);
  }

  async function getAllSearchResults(options = {}) {
    const query = normaliseText(options.searchTerm || "");
    const typeFilter = options.type || "all";

    if (query.length < 3) {
      return [];
    }

    const results = [];

    // Characters / PCs
    if (typeFilter === "all" || typeFilter === "characters") {
      try {
        const characters = window.dmStorage?.getCharacters
          ? await window.dmStorage.getCharacters()
          : [];

        characters
          .filter(character => includesSearch(character, query, [
            "name",
            "species",
            "class",
            "subclass",
            "status",
            "playerName"
          ]))
          .forEach(character => {
            results.push({
              type: "characters",
              icon: "🧙",
              image:
                character.image?.portrait ||
                character.portrait ||
                "",
              title: character.name || "Unnamed Character",
              subtitle: `${character.species || "Unknown Species"} · ${character.class || "Unknown Class"} · Lv ${character.level || "?"}`,
              description: character.status || "",
              id: character.id,
              record: character
            });
          });
      } catch (error) {
        console.warn("Could not search characters:", error);
      }
    }

    // Creatures
    if (typeFilter === "all" || typeFilter === "creatures") {
      try {
        const creatures = await window.dmAPI.getRecords(
          "creatures",
          window.dmState.current.campaign
        );

        searchCreatures(creatures, {
          searchTerm: query,
          filters: options.filters || {}
        }).forEach(creature => {
          results.push({
            type: "creatures",
            icon: "🐲",
            image:
              creature.image?.portrait ||
              creature.portrait ||
              "",
            title: creature.name || "Unnamed Creature",
            subtitle: `CR ${creature.cr || "?"} · ${creature.size || ""} ${creature.type || ""}`,
            description: creature.environment || creature.tags || creature.description || "",
            id: creature.id,
            record: creature
          });
        });
      } catch (error) {
        console.warn("Could not search creatures:", error);
      }
    }

    // Sessions
    if (typeFilter === "all" || typeFilter === "sessions") {
      try {
        const sessions = await window.dmAPI.getRecords(
          "sessions",
          window.dmState.current.campaign
        );

        sessions
          .filter(session => includesSearch(session, query, [
            "title",
            "opening",
            "prep",
            "secrets",
            "liveNotes",
            "summary",
            "next"
          ]))
          .forEach(session => {
            results.push({
              type: "sessions",
              icon: "📝",
              image: "",
              title: session.title || "Untitled Session",
              subtitle: session.date || "No date",
              description: session.prep || session.opening || session.summary || "",
              id: session.id,
              record: session
            });
          });
      } catch (error) {
        console.warn("Could not search sessions:", error);
      }
    }

    // Planned Encounters (current campaign scope only)
    if (typeFilter === "all" || typeFilter === "planned-encounters") {
      try {
        const campaignId = String(window.dmState.current.campaign || "").trim();
        const encounters = await window.dmAPI.getRecords(
          "planned-encounters",
          campaignId || "global"
        );
        const context = await getPlannedEncounterSearchContext(encounters);

        encounters
          .filter(encounter => !encounter.campaignId || String(encounter.campaignId) === campaignId)
          .map(encounter => {
            const worldName = context.worlds.get(String(encounter.worldId || "")) ||
              (encounter.worldId ? `Missing World: ${encounter.worldId}` : "");
            const regionName = context.regions.get(String(encounter.regionId || "")) ||
              (encounter.regionId ? `Missing Region: ${encounter.regionId}` : "");
            const locationName = context.locations.get(String(encounter.locationId || "")) ||
              (encounter.locationId ? `Missing Location: ${encounter.locationId}` : "Unassigned location");
            const participantNames = (Array.isArray(encounter.participants) ? encounter.participants : [])
              .flatMap(participant => [participant.displayName, participant.subtitle])
              .filter(Boolean);
            return {
              encounter,
              worldName,
              regionName,
              locationName,
              searchText: [
                encounter.name,
                encounter.description,
                encounter.gmNotes,
                encounter.encounterType,
                encounter.difficulty,
                encounter.environment,
                encounter.timeOfDay,
                encounter.weather,
                worldName,
                regionName,
                locationName,
                ...participantNames,
                encounter.status
              ].filter(Boolean).join(" ")
            };
          })
          .filter(item => normaliseText(item.searchText).includes(query))
          .forEach(item => {
            const encounterType = formatSearchLabel(item.encounter.encounterType || "combat");
            const status = formatSearchLabel(item.encounter.status || "planned");
            results.push({
              type: "planned-encounters",
              icon: "🎲",
              image: "",
              title: item.encounter.name || "Untitled Encounter",
              subtitle: `${encounterType} · ${item.locationName} · ${status}`,
              description: item.encounter.description || "",
              id: item.encounter.id,
              campaignId,
              record: item.encounter
            });
          });
      } catch (error) {
        console.warn("Could not search planned encounters:", error);
      }
    }

    // Regions and Locations
    if (typeFilter === "all" || typeFilter === "locations" || typeFilter === "regions") {
      try {
        const places = await getAllWorldPlacesForSearch();

        places
          .filter(place => includesSearch(place, query, [
            "name",
            "id",
            "summary",
            "regionName",
            "regionId",
            "worldName",
            "kind"
          ]))
          .forEach(place => {
            results.push({
              type: place.kind === "region" ? "regions" : "locations",
              icon: place.kind === "region" ? "🧭" : "🗺",
              image: "",
              title: place.name || place.id,
              subtitle:
                place.kind === "region"
                  ? `Region · ${place.worldName || window.dmState.current.world}`
                  : `Location · ${place.regionName || place.regionId || ""}`,
              description: place.summary || "",
              id: place.id,
              record: place
            });
          });
      } catch (error) {
        console.warn("Could not search regions/locations:", error);
      }
    }

    // Entities
    if (typeFilter === "all" || typeFilter === "entities") {
      try {
        const entities = await getAllEntitiesForSearch();

        entities
          .filter(entity => includesSearch(entity, query, [
            "name",
            "entity_type",
            "description"
          ]))
          .forEach(entity => {
            results.push({
              type: "entities",
              icon: getEntitySearchIcon(entity.entity_type),
              image: "",
              title: entity.name || entity.id,
              subtitle: entity.entity_type || "Entity",
              description: entity.description || "",
              id: entity.id,
              record: entity
            });
          });
      } catch (error) {
        console.warn("Could not search entities:", error);
      }
    }

    return results.sort((a, b) => {
      return String(a.title || "").localeCompare(String(b.title || ""));
    });
  }

  async function getAllWorldPlacesForSearch() {
    const worldId = window.dmState.current.world;
    const worlds = window.dmState.worlds || [];
    const world = worlds.find(item => item.id === worldId);

    const regions = await window.dmAPI.listRegions(worldId);
    const results = [];

    for (const region of regions) {
      results.push({
        ...region,
        kind: "region",
        worldId,
        worldName: world?.name || worldId
      });

      const locations = await window.dmAPI.listLocations(region.id);

      locations.forEach(location => {
        results.push({
          ...location,
          kind: "location",
          regionId: region.id,
          regionName: region.name,
          worldId,
          worldName: world?.name || worldId
        });
      });
    }

    return results;
  }

  async function getPlannedEncounterSearchContext(encounters = []) {
    const worlds = new Map();
    const regions = new Map();
    const locations = new Map();
    const worldRecords = await window.dmAPI.listWorlds();
    const referencedWorldIds = new Set((encounters || []).map(item => String(item.worldId || "")).filter(Boolean));

    for (const world of worldRecords || []) {
      worlds.set(String(world.id), world.name || world.id);
      if (!referencedWorldIds.has(String(world.id))) continue;
      const regionRecords = await window.dmAPI.listRegions(world.id);
      for (const region of regionRecords || []) {
        regions.set(String(region.id), region.name || region.id);
        const locationRecords = await window.dmAPI.listLocations(region.id);
        for (const location of locationRecords || []) {
          locations.set(String(location.id), location.name || location.id);
        }
      }
    }

    return { worlds, regions, locations };
  }

  function formatSearchLabel(value) {
    return String(value || "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, letter => letter.toUpperCase());
  }

  async function getAllLocationsForSearch() {
    const places = await getAllWorldPlacesForSearch();

    return places.filter(place => place.kind === "location");
  }

  async function getAllEntitiesForSearch() {
    const types = ["ship", "faction", "npc", "creature"];
    const results = [];

    for (const type of types) {
      if (!window.dmAPI.getEntitiesByType) continue;

      try {
        const records = await window.dmAPI.getEntitiesByType(type);
        results.push(...records);
      } catch (error) {
        console.warn(`Could not search entity type: ${type}`, error);
      }
    }

    return results;
  }

  function getEntitySearchIcon(type) {
    const icons = {
      ship: "🚢",
      faction: "🏴",
      npc: "🧍",
      creature: "🐲",
      location: "🗺",
      item: "💎",
      quest: "📜"
    };

    return icons[type] || "🔗";
  }

  return {
    searchCreatures,
    getSearchSuggestions,
    getAllSearchResults,
    getAllLocationsForSearch,
    getAllWorldPlacesForSearch,
    getAllEntitiesForSearch,
    normaliseText,
    includesSearch,
    getNestedValue
  };

})();
