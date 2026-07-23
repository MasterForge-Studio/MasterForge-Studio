console.log("gameSystems.js loaded");

(function () {
    const DEFAULT_GAME_SYSTEMS = {
        "dnd-2024": {
            id: "dnd-2024",
            name: "D&D 2024",

            stats: [
                { key: "ac", label: "AC", type: "number", default: "" },
                { key: "maxHp", label: "Max HP", type: "number", default: 0 },
                { key: "currentHp", label: "Current HP", type: "number", default: 0 },
                { key: "tempHp", label: "Temp HP", type: "number", default: 0 },
                { key: "passivePerception", label: "Passive Perception", type: "number", default: "" },
                { key: "speed", label: "Speed", type: "text", default: "" }
            ],

            conditions: [
                { id: "blinded", name: "Blinded", description: "" },
                { id: "charmed", name: "Charmed", description: "" },
                { id: "deafened", name: "Deafened", description: "" },
                { id: "frightened", name: "Frightened", description: "" },
                { id: "grappled", name: "Grappled", description: "" },
                { id: "incapacitated", name: "Incapacitated", description: "" },
                { id: "invisible", name: "Invisible", description: "" },
                { id: "paralysed", name: "Paralysed", description: "" },
                { id: "petrified", name: "Petrified", description: "" },
                { id: "poisoned", name: "Poisoned", description: "" },
                { id: "prone", name: "Prone", description: "" },
                { id: "restrained", name: "Restrained", description: "" },
                { id: "stunned", name: "Stunned", description: "" },
                { id: "unconscious", name: "Unconscious", description: "" },
                { id: "exhaustion", name: "Exhaustion", hasValue: true, valueLabel: "Level", description: "" }
            ]
        }
    };

    function getGameSystems() {
        return DEFAULT_GAME_SYSTEMS;
    }

    function getGameSystem(systemId) {
        return DEFAULT_GAME_SYSTEMS[systemId] || DEFAULT_GAME_SYSTEMS["dnd-2024"];
    }

    function getCurrentGameSystem() {
        const systemId =
            window.MasterForgeEncounterState?.gameSystemId ||
            window.dmState?.current?.gameSystemId ||
            "dnd-2024";

        return getGameSystem(systemId);
    }

    window.MasterForgeGameSystems = {
        getAll: getGameSystems,
        get: getGameSystem,
        getCurrent: getCurrentGameSystem
    };
})();