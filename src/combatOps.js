console.log("combatOps.js loaded");

(function () {
    const STORAGE_KEY = "masterforge.combatOperations.v1";
    const freshState = () => ({ mode: "selection", round: 1, activeIndex: 0, encounterId: "", encounterName: "", combatants: [], encounters: [], deploymentStrategies: {}, deploymentWarnings: [], diagnostic: "Combat module initialised", diagnosticHistory: ["Combat module initialised"], loading: false, error: "" });
    const combatOpsState = freshState();
    let focusModeScrollPosition = 0;
    let encounterLoadInProgress = false;
    let pendingDeploymentChoice = null;
    let pendingCombatDialog = null;
    const referenceHighlightTimers = new WeakMap();
    let combatDialogSequence = 0;
    const esc = value => typeof escapeHtml === "function" ? escapeHtml(String(value ?? "")) : String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

    function showCombatDialog({ title, message = "", confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false, input = null, selectOptions = null, choices = null } = {}) {
        pendingCombatDialog?.cancel();
        return new Promise(resolve => {
            const dialogId = `combatDialogTitle-${++combatDialogSequence}`;
            const backdrop = document.createElement("div");
            backdrop.className = "combatDeploymentBackdrop combatDialogBackdrop";
            const inputMarkup = input ? `<label class="combatDialogField">${esc(input.label || "Value")}<input type="${esc(input.type || "text")}" data-combat-dialog-input value="${esc(input.value || "")}" placeholder="${esc(input.placeholder || "")}" ${input.required === false ? "" : "required"}></label>` : "";
            const selectMarkup = Array.isArray(selectOptions) && selectOptions.length ? `<label class="combatDialogField">${esc(selectOptions.label || "Choose an option")}<select data-combat-dialog-select>${selectOptions.map(option => `<option value="${esc(option.value)}">${esc(option.label)}</option>`).join("")}<option value="__custom">Custom condition…</option></select></label><label class="combatDialogField hidden" data-combat-custom-field>Custom condition<input type="text" data-combat-dialog-custom placeholder="Enter a condition"></label>` : "";
            const choicesMarkup = Array.isArray(choices) && choices.length ? `<div class="combatDialogChoices">${choices.map(choice => `<button type="button" data-combat-dialog-choice="${esc(choice.value)}"><strong>${esc(choice.label)}</strong>${choice.description ? `<span>${esc(choice.description)}</span>` : ""}</button>`).join("")}</div>` : "";
            backdrop.innerHTML = `<section class="combatDeploymentDialog combatDialog" role="dialog" aria-modal="true" aria-labelledby="${dialogId}"><header><div><h2 id="${dialogId}">${esc(title || "MasterForge Studio")}</h2>${message ? `<p>${esc(message)}</p>` : ""}</div><button type="button" data-combat-dialog-cancel aria-label="Close dialog">Close</button></header>${inputMarkup}${selectMarkup}${choicesMarkup}${choicesMarkup ? "" : `<footer><button type="button" class="${danger ? "dangerBtn" : "primaryBtn"}" data-combat-dialog-confirm>${esc(confirmLabel)}</button><button type="button" data-combat-dialog-cancel>${esc(cancelLabel)}</button></footer>`}</section>`;
            document.body.appendChild(backdrop);
            document.body.classList.add("masterforgeModalOpen");
            const previousFocus = document.activeElement;
            const dialog = backdrop.querySelector(".combatDialog");
            const textInput = backdrop.querySelector("[data-combat-dialog-input]");
            const select = backdrop.querySelector("[data-combat-dialog-select]");
            const customField = backdrop.querySelector("[data-combat-custom-field]");
            const customInput = backdrop.querySelector("[data-combat-dialog-custom]");
            const finish = value => {
                if (pendingCombatDialog?.backdrop !== backdrop) return;
                pendingCombatDialog = null;
                document.removeEventListener("keydown", handleKeydown);
                backdrop.remove();
                if (!pendingDeploymentChoice) document.body.classList.remove("masterforgeModalOpen");
                previousFocus?.focus?.();
                resolve(value);
            };
            const submit = () => {
                if (textInput) {
                    const value = textInput.value.trim();
                    if (!value && input.required !== false) { textInput.focus(); return; }
                    finish(value || null);
                    return;
                }
                if (select) {
                    const value = select.value === "__custom" ? customInput.value.trim() : select.value;
                    if (!value) { (select.value === "__custom" ? customInput : select).focus(); return; }
                    finish(value);
                    return;
                }
                finish(true);
            };
            const handleKeydown = event => {
                if (event.key === "Escape") {
                    event.preventDefault();
                    finish(null);
                    return;
                }
                if (event.key === "Enter" && event.target.tagName !== "BUTTON" && !choicesMarkup) {
                    event.preventDefault();
                    submit();
                    return;
                }
                if (event.key === "Tab") {
                    const focusable = [...dialog.querySelectorAll("button:not([disabled]), input:not([disabled]):not(.hidden), select:not([disabled])")].filter(element => !element.closest(".hidden"));
                    if (!focusable.length) return;
                    const first = focusable[0];
                    const last = focusable[focusable.length - 1];
                    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
                }
            };
            pendingCombatDialog = { backdrop, cancel: () => finish(null) };
            document.addEventListener("keydown", handleKeydown);
            backdrop.addEventListener("click", event => {
                const choice = event.target.closest?.("[data-combat-dialog-choice]");
                if (choice) finish(choice.dataset.combatDialogChoice);
                else if (event.target.closest?.("[data-combat-dialog-confirm]")) submit();
                else if (event.target === backdrop || event.target.closest?.("[data-combat-dialog-cancel]")) finish(null);
            });
            select?.addEventListener("change", () => {
                const custom = select.value === "__custom";
                customField.classList.toggle("hidden", !custom);
                if (custom) customInput.focus();
            });
            (textInput || select || backdrop.querySelector("[data-combat-dialog-choice]") || backdrop.querySelector("[data-combat-dialog-confirm]"))?.focus();
        });
    }

    function saveCombatState() {
        try {
            const { encounters, loading, error, ...saved } = combatOpsState;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
        } catch (error) { console.warn("Could not persist combat state:", error); }
    }

    function restoreCombatState() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
            if (!saved || !Array.isArray(saved.combatants)) return;
            Object.assign(combatOpsState, freshState(), saved, { encounters: [], loading: false, error: "" });
            combatOpsState.combatants.forEach(combatant => {
                if (combatant.snapshotVersion) return;
                if (combatant.hp === 1 && combatant.maxHp === 1) combatant.hp = combatant.maxHp = null;
                if (combatant.ac === 10) combatant.ac = null;
            });
        } catch (error) { console.warn("Could not restore combat state:", error); }
    }

    function getContainer() { return document.querySelector("#combat-operations"); }
    function updateCombatDiagnostic(message, status = "info") {
        combatOpsState.diagnostic = message;
        if (!Array.isArray(combatOpsState.diagnosticHistory)) combatOpsState.diagnosticHistory = [];
        if (combatOpsState.diagnosticHistory[combatOpsState.diagnosticHistory.length - 1] !== message) combatOpsState.diagnosticHistory = [...combatOpsState.diagnosticHistory.slice(-11), message];
        const diagnostic = document.querySelector("#combat-operations [data-combat-diagnostic]");
        if (diagnostic) { diagnostic.textContent = message; diagnostic.dataset.status = status; }
    }
    function getActiveCombatant() { return combatOpsState.combatants[combatOpsState.activeIndex] || combatOpsState.combatants[0] || null; }
    function currentCampaignScope() { return String(window.dmState?.current?.campaign || "").trim() || "global"; }
    function contextMatches(record) {
        const current = window.dmState?.current || {};
        if (record.campaignId && String(record.campaignId) !== String(current.campaign || "")) return false;
        if (record.worldId && current.world && String(record.worldId) !== String(current.world)) return false;
        if (record.regionId && current.region && String(record.regionId) !== String(current.region)) return false;
        if (record.locationId && current.location && String(record.locationId) !== String(current.location)) return false;
        return record.status !== "archived" && record.status !== "completed";
    }

    async function loadEncounters() {
        combatOpsState.loading = true;
        combatOpsState.error = "";
        rerenderCombatOps();
        try {
            const records = await window.dmAPI.getAllRecordsInCollection("planned-encounters");
            const campaignId = currentCampaignScope();
            combatOpsState.encounters = (records || []).filter(record =>
                String(record.campaignId || "global") === campaignId &&
                record.status !== "archived" && record.status !== "completed"
            ).sort((a, b) => Number(contextMatches(b)) - Number(contextMatches(a)) || String(a.name || "").localeCompare(String(b.name || "")));
        } catch (error) {
            console.error("Could not load planned encounters for combat:", error);
            combatOpsState.error = "Planned encounters could not be loaded.";
        } finally { combatOpsState.loading = false; rerenderCombatOps(); }
    }

    function firstFinite(...values) {
        const value = values.filter(item => item !== null && item !== undefined && item !== "").map(Number).find(Number.isFinite);
        return value == null ? null : value;
    }

    function parseStatNumber(value) {
        if (value === null || value === undefined || value === "") return null;
        if (Number.isFinite(Number(value))) return Number(value);
        const match = String(value).match(/-?\d+/);
        return match ? Number(match[0]) : null;
    }
    function abilityModifier(score) { return Number.isFinite(Number(score)) ? Math.floor((Number(score) - 10) / 2) : null; }
    function portraitOf(source = {}) {
        source = source || {};
        return source.image?.portrait ||
            source.data_json?.character?.image?.portrait ||
            source.data_json?.portrait ||
            source.portrait ||
            source.image?.token ||
            source.data_json?.character?.image?.token ||
            source.token ||
            "";
    }
    function normaliseEntries(value) { return Array.isArray(value) ? value : value ? [value] : []; }
    function sourceNotes(source = {}) {
        source = source || {};
        if (typeof source.notes === "string") return source.notes;
        return [source.notes?.dm, source.notes?.campaign, source.notes?.adventure, source.overview?.summary, source.personality?.hook].filter(Boolean).join("\n");
    }
    function sourceSkills(source = {}) {
        source = source || {};
        if (typeof source.skills === "string") return source.skills;
        return Object.entries(source.skills || {}).filter(([, value]) => value?.proficient || value?.expertise).map(([name, value]) => `${name}${value.expertise ? " (expertise)" : ""}`).join(", ");
    }
    function canonicalIds(record = {}) {
        return [record.sourceId, record.sourceEntityId, record.builderRecordId, record.id, record.entityId, record.npcId, record.pcId, record.creatureId, record.legacyId, record._id, record.data_json?.sourceId, record.data_json?.sourceEntityId, record.data_json?.npcId, record.data_json?.entityId]
            .filter(value => value !== null && value !== undefined && String(value).trim()).map(String);
    }
    function normalisedName(value) { return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase(); }
    function formatSourceReference(source, sourceTitle, sourceReference) {
        if (String(source || "").trim().toLowerCase().replace(/\s+/g, "-") === "homebrew") return "";
        const title = String(sourceTitle || "").trim();
        const reference = String(sourceReference || "").trim();
        if (title && reference) return `Source: ${title} · ${reference}`;
        if (title) return `Source: ${title}`;
        if (reference) return `Source Reference: ${reference}`;
        return "";
    }
    function combatSystem(systemId) { return window.MasterForgeGameSystems?.get?.(systemId) || window.MasterForgeGameSystems?.getCurrent?.() || {}; }
    function combatRules(systemId) { return window.MasterForgeGameSystems?.getRules?.(combatSystem(systemId)) || {}; }
    function semanticStat(systemId, role) { return window.MasterForgeGameSystems?.statisticForRole?.(combatSystem(systemId), role) || null; }
    function semanticLabel(systemId, role, fallback, short = false) {
        const definition = semanticStat(systemId, role);
        return (short ? definition?.shortLabel : definition?.name) || definition?.name || fallback;
    }
    function readSemantic(source, role, systemId) { return window.MasterForgeGameSystems?.readSemantic?.(source, role, combatSystem(systemId)); }
    function sourceScopeMatches(record, participant) {
        const current = window.dmState?.current || {};
        const scope = record.scope || {};
        const campaign = record.campaignId || record.campaign || scope.campaignId || record.data_json?.scope?.campaignId;
        const system = record.systemId || record.data_json?.systemId;
        return (!campaign || String(campaign) === String(participant.campaignId || current.campaign || "")) &&
            (!system || !participant.systemId || String(system) === String(participant.systemId));
    }
    async function canonicalRecords(type) {
        if (type === "pc") {
            const stored = (await window.dmStorage.getCharacters()) || [];
            const records = window.dmAPI?.getAllRecordsInCollection
                ? (await window.dmAPI.getAllRecordsInCollection("characters")) || []
                : [];
            const seen = new Set();
            return [
                ...stored.map(record => ({ ...record, _combatCanonicalStore: "characters" })),
                ...records.map(record => ({ ...record, _combatCanonicalStore: "record" }))
            ].filter(record => {
                const id = String(record.id || "").trim();
                if (!id || seen.has(id)) return false;
                seen.add(id);
                return true;
            });
        }
        if (["npc", "creature", "vehicle", "ship"].includes(type)) {
            const entities = window.dmAPI?.getEntitiesByType ? (await window.dmAPI.getEntitiesByType(type)) || [] : [];
            const collection = `${type}s`;
            const records = window.dmAPI?.getAllRecordsInCollection ? (await window.dmAPI.getAllRecordsInCollection(collection)) || [] : [];
            const seen = new Set();
            return [
                ...records.map(record => ({ ...record, _combatCanonicalStore: "record" })),
                ...entities.map(record => ({ ...record, _combatCanonicalStore: "entity" }))
            ].filter(record => {
                const id = String(record.id || "").trim();
                if (!id || seen.has(id)) return false;
                seen.add(id);
                return true;
            });
        }
        return [];
    }
    async function getCanonicalSource(type, participant) {
        const records = await canonicalRecords(type);
        const references = canonicalIds(participant);
        for (const reference of references) {
            const exact = records.filter(record => canonicalIds(record).includes(reference));
            if (exact.length === 1) return { source: exact[0], resolution: `exact identifier ${reference}` };
            if (exact.length > 1) {
                const scoped = exact.filter(record => sourceScopeMatches(record, participant));
                if (scoped.length === 1) return { source: scoped[0], resolution: `scoped identifier ${reference}` };
            }
        }
        const wantedName = normalisedName(participant.displayName || participant.name);
        const named = wantedName ? records.filter(record => normalisedName(record.name) === wantedName && sourceScopeMatches(record, participant)) : [];
        if (named.length === 1) return { source: named[0], resolution: "unambiguous scoped name" };
        return { source: null, resolution: named.length > 1 ? `ambiguous canonical source (${named.length} name matches)` : "canonical source not found", references };
    }
    async function refreshMissingSourceReferences() {
        let changed = false;
        for (const combatant of combatOpsState.combatants) {
            if (!["npc", "creature"].includes(combatant?.sourceType)) continue;
            if (normalisedName(combatant.source) === "homebrew") continue;
            if (String(combatant.sourceTitle || "").trim() || String(combatant.sourceReference || "").trim()) continue;
            try {
                const { source } = await getCanonicalSource(combatant.sourceType, combatant);
                if (!source) continue;
                const canonical = { ...(source.data_json || {}), ...(source || {}) };
                const profile = await resolveCombatProfile(
                    combatant.sourceType,
                    source,
                    combatant.systemId || canonical.systemId
                );
                const canonicalSource = canonical.canonicalSource || profile.source || canonical.source || "";
                const sourceTitle = canonical.sourceTitle || profile.sourceTitle || "";
                const sourceReference = canonical.sourceReference || profile.sourceReference || "";
                if (!formatSourceReference(canonicalSource, sourceTitle, sourceReference)) continue;
                combatant.source = canonicalSource;
                combatant.sourceTitle = sourceTitle;
                combatant.sourceReference = sourceReference;
                changed = true;
            } catch (error) {
                console.warn(`Could not refresh source reference for ${combatant.name || combatant.id}:`, error);
            }
        }
        if (changed) saveCombatState();
        return changed;
    }
    function initialiseCapabilityRuntime(profile = {}, canonical = {}) {
        const legendaryMaximum = firstFinite(canonical.legendaryActionPoints, canonical.legendaryActionsPerRound, canonical.flags?.legendaryActionPoints);
        return {
            ...profile,
            resources: {
                legendaryActions: legendaryMaximum == null ? null : { maximum: legendaryMaximum, remaining: legendaryMaximum },
                spellSlots: canonical.spellSlots && typeof canonical.spellSlots === "object" ? JSON.parse(JSON.stringify(canonical.spellSlots)) : null
            },
            categories: (profile.categories || []).map(category => ({
                ...category,
                entries: (category.entries || []).map(entry => {
                    const usesValue = entry.usesRemaining ?? entry.remainingUses ?? entry.maxUses ?? entry.uses;
                    const parsedUses = typeof usesValue === "number" ? usesValue : Number(String(usesValue || "").match(/\d+/)?.[0]);
                    const maximumUses = Number.isFinite(parsedUses) ? Math.max(0, parsedUses) : null;
                    const persisted = category.persistentRuntime ? canonical.systemValues?.capabilityRuntime?.[category.id]?.[entry.id] : null;
                    return {
                        ...entry,
                        runtime: category.canTrackUses ? {
                            maximumUses,
                            usesRemaining: maximumUses,
                            rechargeState: entry.recharge ? "ready" : "",
                            usedThisTurn: false,
                            usedThisRound: false,
                            ...(persisted || {})
                        } : null
                    };
                })
            }))
        };
    }
    async function resolveCombatProfile(type, source, systemId) {
        const engine = window.MasterForgeInheritanceEngine;
        if (!engine?.resolveCombatProfile || !source?.id) return { systemId, categories: [], warnings: [], conflicts: [] };
        const entity = source.entity_type
            ? source
            : await window.dmAPI?.getEntity?.(type, source.id) || {
                id: source.id,
                entity_type: type,
                name: source.name || source.id,
                data_json: type === "pc" ? { characterId: source.id, systemId } : { [`${type}Id`]: source.id, systemId }
            };
        return engine.resolveCombatProfile(entity, { systemId, visibilityMode: "gm", includeHidden: true });
    }
    async function makeSnapshot(participant, source, runtimeId, name) {
        const type = participant.sourceType;
        const sourceData = source?.data_json || {};
        const characterData = sourceData.character || {};
        const canonical = { ...sourceData, ...characterData, ...(source || {}) };
        const stats = { ...(sourceData.stats || {}), ...(canonical.stats || {}) };
        const systemId = canonical.systemId || sourceData.systemId || participant.systemId || window.dmState?.current?.systemId || "system-neutral";
        const rules = combatRules(systemId);
        const abilities = type === "pc" ? (canonical.abilities || sourceData.abilities || {}) : (canonical.abilities || stats);
        const attributes = Object.fromEntries((window.MasterForgeGameSystems?.enabled?.(rules.attributes) || []).map(definition => [
            definition.id,
            firstFinite(window.MasterForgeGameSystems?.readAttribute?.(canonical, definition.id, combatSystem(systemId)), definition.defaultValue)
        ]));
        const maxHp = firstFinite(readSemantic(canonical, "maximumHealth", systemId), parseStatNumber(stats.hp));
        const currentHp = firstFinite(readSemantic(canonical, "currentHealth", systemId), maxHp);
        const ac = firstFinite(readSemantic(canonical, "primaryDefence", systemId));
        const passiveScores = Object.fromEntries((window.MasterForgeGameSystems?.enabled?.(rules.passiveScores) || []).map(definition => {
            const legacyId = rules.compatibility?.passiveLegacyIds?.[definition.id];
            return [definition.id, canonical.systemValues?.passiveScores?.[definition.id] ?? (legacyId ? canonical[legacyId] : undefined)];
        }));
        const capabilityProfile = initialiseCapabilityRuntime(await resolveCombatProfile(type, source, systemId), canonical);
        const persistentConditions = normaliseEntries(canonical.persistentConditions || canonical.conditions).filter(value => typeof value === "string" && value.trim());
        return {
            id: runtimeId, sourceParticipantId: String(participant.id || ""), sourceType: type, sourceId: String(source?.id || participant.sourceId || ""), sourceEntityId: String(source?.entityId || source?.id || participant.sourceId || ""), sourceStore: source?._combatCanonicalStore || "", sourceScope: String(source?.scope || "global"), sourceWriteBackEligible: Boolean(source?.id), sourceDisplayName: canonical.name || participant.displayName || "Combatant", importedAt: new Date().toISOString(), snapshotVersion: 2,
            name: name || canonical.name || participant.displayName || "Combatant", subtitle: participant.subtitle || [canonical.size, canonical.type || canonical.species, canonical.class].filter(Boolean).join(" ") || type,
            portrait: portraitOf(canonical), systemId, level: readSemantic(canonical, "levelRank", systemId) ?? null, cr: readSemantic(canonical, "threat", systemId) || "", className: canonical.class || "", subtype: canonical.species || canonical.subtype || "", size: canonical.size || "", creatureType: canonical.type || "", alignment: canonical.alignment || "",
            source: canonical.canonicalSource || capabilityProfile.source || canonical.source || "", sourceTitle: canonical.sourceTitle || capabilityProfile.sourceTitle || "", sourceReference: canonical.sourceReference || capabilityProfile.sourceReference || "",
            initiative: participant.initiativeOverride ?? "", initiativeModifier: abilityModifier(abilities.dex), proficiencyBonus: readSemantic(canonical, "proficiency", systemId) || "", ac, hp: currentHp, maxHp, tempHp: firstFinite(readSemantic(canonical, "temporaryHealth", systemId), 0), speed: readSemantic(canonical, "movement", systemId) || "",
            attributes, abilities, savingThrows: canonical.savingThrows || "", skills: sourceSkills(canonical), senses: canonical.senses || "", languages: canonical.languages || "", passiveScores, capabilityProfile,
            damageVulnerabilities: canonical.damageVulnerabilities || stats.damageVulnerabilities || "", damageResistances: canonical.damageResistances || stats.damageResistances || "", damageImmunities: canonical.damageImmunities || stats.damageImmunities || "", conditionImmunities: canonical.conditionImmunities || stats.conditionImmunities || "",
            traits: normaliseEntries(canonical.systemCapabilities?.traits ?? canonical.traits), actions: normaliseEntries(canonical.systemCapabilities?.actions ?? canonical.actions), bonusActions: normaliseEntries(canonical.systemCapabilities?.["bonus-actions"] ?? canonical.bonusActions), reactions: normaliseEntries(canonical.systemCapabilities?.reactions ?? canonical.reactions), legendaryActions: normaliseEntries(canonical.systemCapabilities?.["legendary-actions"] ?? canonical.legendaryActions), lairActions: normaliseEntries(canonical.systemCapabilities?.["lair-actions"] ?? canonical.lairActions), mythicActions: normaliseEntries(canonical.systemCapabilities?.["mythic-actions"] ?? canonical.mythicActions), spellcasting: normaliseEntries(canonical.systemCapabilities?.spellcasting ?? canonical.spellcasting ?? canonical.spells), innateSpellcasting: normaliseEntries(canonical.systemCapabilities?.["innate-spellcasting"] ?? canonical.innateSpellcasting), equipment: normaliseEntries(canonical.systemCapabilities?.equipment ?? canonical.equipmentActions ?? canonical.equipment), loot: normaliseEntries(canonical.loot ?? canonical.harvest ?? canonical.harvestLoot),
            group: participant.disposition === "hostile" ? "Enemies" : participant.disposition === "friendly" ? "Allies" : "Neutral", conditions: persistentConditions, hidden: Boolean(participant.hidden || participant.startsInvisible), status: ["alive", "active"].includes(String(canonical.status || "").toLowerCase()) ? "Active" : canonical.status || "Active", notes: [participant.notes, sourceNotes(canonical)].filter(Boolean).join("\n")
        };
    }
    async function resolvePartyMembers(participant) {
        const storedCharacters = (await window.dmStorage.getCharacters()) || [];
        const canonicalCharacters = window.dmAPI?.getAllRecordsInCollection ? (await window.dmAPI.getAllRecordsInCollection("characters")) || [] : [];
        const characters = [...storedCharacters, ...canonicalCharacters].filter((character, index, all) => all.findIndex(item => String(item.id) === String(character.id)) === index);
        let ids = [];
        if (participant.sourceType === "party") {
            const parties = window.dmAPI?.getAllRecordsInCollection ? (await window.dmAPI.getAllRecordsInCollection("parties")) || [] : [];
            const canonicalParty = parties.find(party => canonicalIds(party).includes(String(participant.sourceId || "")));
            ids = canonicalParty?.characters || (await window.dmStorage.getCampaignParty())?.characters || [];
        }
        if (participant.sourceType === "party_group") {
            const group = await window.dmAPI.getEntity("party_group", participant.sourceId);
            ids = group?.data_json?.characterIds || [];
        }
        return ids.map(id => characters.find(character => String(character.id) === String(id))).filter(character => character && !["inactive","dead","retired"].includes(String(character.status || "").toLowerCase()));
    }
    async function chooseQuantityDeployment(participant, quantity) {
        if (quantity <= 1) return "individual";
        const saved = combatOpsState.deploymentStrategies[participant.id];
        if (saved) return saved;
        updateCombatDiagnostic(`Awaiting deployment choice: ${participant.displayName || "group"}`);
        return new Promise((resolve, reject) => {
            const modal = document.createElement("div");
            modal.className = "combatDeploymentBackdrop";
            modal.innerHTML = `<section class="combatDeploymentDialog" role="dialog" aria-modal="true" aria-labelledby="combatDeploymentTitle" aria-describedby="combatDeploymentDescription"><header><div><h2 id="combatDeploymentTitle">Deploy ${esc(participant.displayName || "Group")}</h2><p id="combatDeploymentDescription">${quantity} members are planned. Choose how they should be tracked in this combat.</p></div><button type="button" data-deployment-cancel aria-label="Close deployment chooser">Close</button></header><button type="button" data-deployment="individual"><strong>Separate combatants</strong><span>${quantity} independent participants with their own HP, conditions, initiative and turns.</span></button><button type="button" data-deployment="grouped"><strong>One grouped combatant</strong><span>One runtime participant retaining the planned quantity as group metadata.</span></button><footer><button type="button" data-deployment-cancel>Cancel encounter load</button></footer></section>`;
            document.body.appendChild(modal);
            const previousFocus = document.activeElement;
            const finish = (strategy = null) => {
                if (pendingDeploymentChoice?.modal !== modal) return;
                pendingDeploymentChoice = null;
                document.removeEventListener("keydown", handleKeydown);
                document.body.classList.remove("masterforgeModalOpen");
                modal.remove();
                previousFocus?.focus?.();
                if (!strategy) {
                    const error = new Error("Encounter loading cancelled.");
                    error.name = "DeploymentChoiceCancelled";
                    reject(error);
                    return;
                }
                combatOpsState.deploymentStrategies[participant.id] = strategy;
                resolve(strategy);
            };
            const handleKeydown = event => {
                if (event.key === "Escape") {
                    event.preventDefault();
                    finish();
                }
            };
            pendingDeploymentChoice = { modal, cancel: () => finish() };
            document.body.classList.add("masterforgeModalOpen");
            document.addEventListener("keydown", handleKeydown);
            modal.addEventListener("click", event => {
                const choice = event.target.closest?.("[data-deployment]");
                if (choice) finish(choice.dataset.deployment);
                else if (event.target === modal || event.target.closest?.("[data-deployment-cancel]")) finish();
            });
            modal.querySelector("[data-deployment]")?.focus();
        });
    }
    async function deployParticipant(participant, index) {
        if (["party", "party_group"].includes(participant.sourceType)) {
            const members = await resolvePartyMembers(participant);
            if (!members.length) { combatOpsState.deploymentWarnings.push(`${participant.displayName || "Party"}: no resolvable active PC members.`); return []; }
            return Promise.all(members.map(member => makeSnapshot({ ...participant, sourceType: "pc", sourceId: member.id }, member, `${participant.id}-pc-${member.id}`, member.name)));
        }
        const resolved = await getCanonicalSource(participant.sourceType, participant);
        const source = resolved.source;
        if (!source) combatOpsState.deploymentWarnings.push(`${participant.displayName || "Combatant"}: ${resolved.resolution}; references preserved: ${canonicalIds(participant).join(", ") || "none"}.`);
        const quantity = participant.sourceType === "creature" ? Math.max(1, Number(participant.quantity || 1)) : 1;
        const strategy = await chooseQuantityDeployment(participant, quantity);
        if (strategy === "individual") return Promise.all(Array.from({ length: quantity }, async (_, memberIndex) => {
            const snapshot = await makeSnapshot(participant, source, quantity > 1 ? `${participant.id}-${memberIndex + 1}` : String(participant.id || `participant-${index}`), quantity > 1 ? `${source?.name || participant.displayName || "Combatant"} ${memberIndex + 1}` : undefined);
            if (quantity > 1) snapshot.sourceWriteBackEligible = false;
            return snapshot;
        }));
        const snapshot = await makeSnapshot(participant, source, String(participant.id || `participant-${index}`));
        snapshot.groupQuantity = quantity; snapshot.groupMode = strategy; snapshot.sourceWriteBackEligible = false;
        if (strategy === "shared-pool" && snapshot.maxHp != null) { snapshot.standardMemberHp = snapshot.maxHp; snapshot.maxHp *= quantity; snapshot.hp = snapshot.maxHp; }
        if (strategy === "individual-counters") { snapshot.standardMemberHp = snapshot.maxHp; snapshot.memberHp = Array.from({ length: quantity }, () => snapshot.maxHp); if (snapshot.maxHp != null) { snapshot.maxHp *= quantity; snapshot.hp = snapshot.maxHp; } }
        return [snapshot];
    }

    async function loadEncounter(encounterId) {
        const encounter = combatOpsState.encounters.find(item => String(item.id) === String(encounterId));
        if (!encounter) throw new Error(`The selected planned encounter (${encounterId || "no ID"}) is no longer available.`);
        updateCombatDiagnostic(`Encounter resolved: ${encounter.name || encounter.id}`);
        const sameEncounter = combatOpsState.encounterId === String(encounter.id);
        if (combatOpsState.mode === "active" && !sameEncounter) {
            updateCombatDiagnostic(`Combat is active for ${combatOpsState.encounterName || "another encounter"}; end it before loading another.`, "warning");
            return false;
        }
        if (sameEncounter && combatOpsState.combatants.length && !await showCombatDialog({ title: "Reload Encounter?", message: "Reloading will reset the current runtime combat state.", confirmLabel: "Reload Encounter", danger: true })) { updateCombatDiagnostic("Current combat setup retained."); return false; }
        if (!sameEncounter && combatOpsState.combatants.length && !await showCombatDialog({ title: "Replace Combat Setup?", message: `Replace the current combat setup with ${encounter.name || "this encounter"}?`, confirmLabel: "Replace Setup", danger: true })) { updateCombatDiagnostic("Current combat setup retained."); return false; }
        if (!sameEncounter) combatOpsState.deploymentStrategies = {};
        const deploymentWarnings = [];
        combatOpsState.deploymentWarnings = deploymentWarnings;
        updateCombatDiagnostic("Hydrating participants");
        const deployed = [];
        for (const [index, participant] of (encounter.participants || []).entries()) {
            deployed.push(...await deployParticipant(participant, index));
        }
        const seenPcs = new Set();
        const combatants = deployed.filter(combatant => combatant.sourceType !== "pc" || (!seenPcs.has(combatant.sourceId) && seenPcs.add(combatant.sourceId)));
        combatOpsState.encounterId = String(encounter.id); combatOpsState.encounterName = encounter.name || "Unnamed Encounter";
        combatOpsState.deploymentWarnings = deploymentWarnings;
        combatOpsState.combatants = combatants;
        combatOpsState.mode = "setup"; combatOpsState.round = 1; combatOpsState.activeIndex = 0;
        combatOpsState.error = "";
        saveCombatState(); rerenderCombatOps();
        updateCombatDiagnostic("Combat setup loaded", "success");
        window.MasterForgeActionConsole?.updateContext({ pageId: "combat-operations", recordType: "planned-encounter", recordId: String(encounter.id), selectionType: "combatant", selectionId: combatants[0]?.id || null });
        return true;
    }

    async function loadEncounterFromButton(encounterId, clickedButton = null) {
        if (encounterLoadInProgress) { updateCombatDiagnostic("An encounter is already loading.", "warning"); return; }
        encounterLoadInProgress = true;
        const previous = { encounterId: combatOpsState.encounterId, encounterName: combatOpsState.encounterName, combatants: combatOpsState.combatants, mode: combatOpsState.mode, round: combatOpsState.round, activeIndex: combatOpsState.activeIndex, deploymentStrategies: { ...combatOpsState.deploymentStrategies }, deploymentWarnings: [...combatOpsState.deploymentWarnings] };
        combatOpsState.error = "";
        updateCombatDiagnostic(`Loading encounter… (${encounterId || "missing ID"})`);
        if (clickedButton) clickedButton.disabled = true;
        try {
            await loadEncounter(String(encounterId || ""));
        } catch (error) {
            Object.assign(combatOpsState, previous);
            const cancelled = error?.name === "DeploymentChoiceCancelled";
            combatOpsState.error = cancelled ? "" : `Encounter could not be loaded: ${error?.message || "Unknown error"}`;
            combatOpsState.diagnostic = cancelled ? "Encounter loading cancelled." : `Error: ${error?.message || "Unknown error"}`;
            if (!cancelled) console.error("Combat encounter loading failed:", error);
            rerenderCombatOps();
        } finally {
            pendingDeploymentChoice?.cancel();
            pendingDeploymentChoice = null;
            encounterLoadInProgress = false;
            if (clickedButton?.isConnected) clickedButton.disabled = false;
        }
    }

    function handleCombatOperationsClick(event) {
        const button = event.target.closest?.("#combat-operations [data-combat-encounter]");
        if (!button) return;
        event.preventDefault();
        updateCombatDiagnostic("Load click received");
        loadEncounterFromButton(button.dataset.combatEncounter, button);
    }

    function initialiseCombatOps() {
        if (window.__masterForgeCombatOpsClickHandler) document.removeEventListener("click", window.__masterForgeCombatOpsClickHandler);
        window.__masterForgeCombatOpsClickHandler = handleCombatOperationsClick;
        document.addEventListener("click", handleCombatOperationsClick);
        updateCombatDiagnostic("Combat module initialised");
    }

    function renderEncounterSelection() {
        return `<div class="combatOpsShell combatOpsSelection"><div class="combatOpsTopBar"><div><h2>Combat Operations Centre</h2><p>Select a prepared encounter for the current campaign and location.</p></div><button type="button" id="combatOpsRefreshBtn">Refresh</button></div><div class="combatOpsEncounterList">${combatOpsState.loading ? `<p class="forgeEmptyState">Loading encounters…</p>` : combatOpsState.encounters.length ? combatOpsState.encounters.map(encounter => `<article class="infoCard"><div><h3>${esc(encounter.name || "Unnamed Encounter")}</h3><p>${esc(encounter.description || `${(encounter.participants || []).length} planned participants`)}</p></div><button type="button" data-combat-encounter="${esc(encounter.id)}">Load Encounter</button></article>`).join("") : `<p class="forgeEmptyState">No planned encounters match the current campaign/location context.</p>`}</div></div>`;
    }

    function renderInitiativeSetup() {
        const currentSystemId = combatOpsState.combatants[0]?.systemId;
        const required = (combatRules(currentSystemId).statistics || []).filter(item => item.enabled !== false && item.requiredForCombat);
        const requiredNames = required.map(item => item.shortLabel || item.name);
        const readinessFields = [
            { role: "primaryDefence", runtime: "ac" },
            { role: "currentHealth", runtime: "hp", min: 0 },
            { role: "maximumHealth", runtime: "maxHp", min: 1 }
        ].filter(item => semanticStat(currentSystemId, item.role)?.enabled !== false && semanticStat(currentSystemId, item.role)?.requiredForCombat);
        return `<div class="combatOpsShell"><div class="combatOpsTopBar"><div><h2>Combat Readiness</h2><p>${esc(combatOpsState.encounterName)} · ${esc(requiredNames.length ? `${requiredNames.join(", ")} are required` : "no system statistics are required")}. Start Combat is available in Actions.</p></div><div class="combatOpsTurnButtons"><button id="combatOpsCancelInitiativeBtn">Back</button></div></div>${combatOpsState.deploymentWarnings.length ? `<div class="combatOpsReadinessWarnings">${combatOpsState.deploymentWarnings.map(esc).join("<br>")}</div>` : ""}<div class="combatOpsInitiativeSetupList">${combatOpsState.combatants.map((c, index) => { const missing = readinessFields.filter(item => c[item.runtime] == null || (item.runtime === "maxHp" && Number(c[item.runtime]) <= 0)).map(item => semanticLabel(c.systemId, item.role, item.runtime)); return `<div class="combatOpsInitiativeSetupItem ${missing.length ? "is-incomplete" : ""}"><div class="combatOpsReadinessIdentity">${renderPortrait(c)}<div><strong>${esc(c.hidden ? "Hidden Enemy" : c.name)}</strong><span>${renderTypeBadge(c)}${renderGroupBadge(c)} ${esc(c.subtitle)}</span>${renderConditionBadges(c)}${missing.length ? `<em>Missing ${esc(missing.join(" and "))}</em>` : `<em>${esc(c.status || "Active")}</em>`}</div></div>${readinessFields.map(item => `<label>${esc(semanticLabel(c.systemId, item.role, item.runtime))}<input class="combatOpsReadinessInput" data-readiness-field="${item.runtime}" data-combatant-index="${index}" type="number" ${item.min != null ? `min="${item.min}"` : ""} value="${c[item.runtime] ?? ""}" placeholder="Not set"></label>`).join("")}<label>${esc(semanticLabel(c.systemId, "initiative", "Initiative"))}<input class="combatOpsInitiativeInput" data-combatant-index="${index}" type="number" value="${esc(c.initiative ?? "")}" placeholder="${esc(semanticLabel(c.systemId, "initiative", "Init", true))}"></label></div>`; }).join("")}</div></div>`;
    }

    function combatTypeLabel(type = "") { return ({ pc: "PC", npc: "NPC", creature: "Creature", vehicle: "Vehicle", ship: "Vehicle", party: "Party", party_group: "Party Group" })[type] || "Combatant"; }
    function renderTypeBadge(c) { return `<span class="combatTypeBadge combatTypeBadge--${esc(c.sourceType || "other")}">${esc(combatTypeLabel(c.sourceType))}</span>`; }
    function renderGroupBadge(c) { return c.groupQuantity ? `<span class="combatGroupBadge">Group ×${esc(c.groupQuantity)}</span>` : ""; }
    function renderQuickBadge(c) { return c.quickParticipant ? `<span class="combatQuickBadge">Quick · Temporary</span>` : ""; }
    function renderConditionBadges(c) { return c.conditions?.length ? `<span class="combatConditionBadges">${c.conditions.map(condition => `<span>${esc(condition)}</span>`).join("")}</span>` : ""; }
    function renderPortrait(c, className = "") { return c.portrait ? `<img class="combatOpsPortraitImage ${className}" src="${esc(c.portrait)}" alt="">` : `<div class="combatOpsPortrait combatOpsPortraitFallback ${className}" aria-label="No participant image">◆</div>`; }
    function combatantStateClasses(c, index = -1) {
        const status = String(c?.status || "active").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
        return [
            "no-portrait",
            c?.hidden ? "is-hidden" : "",
            c?.groupQuantity ? "is-grouped" : "",
            ["unconscious", "inactive", "defeated", "dead"].includes(status) ? `is-${status}` : "",
            index === combatOpsState.activeIndex ? "is-active-turn selected-participant" : ""
        ].filter(Boolean).join(" ");
    }
    function participantClassification(c) {
        return [c?.subtype, c?.creatureType, c?.className, c?.size]
            .filter(Boolean)
            .filter((value, index, values) => values.indexOf(value) === index)
            .join(" · ") || c?.subtitle || combatTypeLabel(c?.sourceType);
    }

    function renderInitiativeCard(c, index) {
        const percent = c.maxHp ? Math.max(0, Math.min(100, c.hp / c.maxHp * 100)) : 0;
        const visibleName = c.hidden ? "Hidden Enemy" : c.name;
        const healthText = c.hp == null || c.maxHp == null ? "Not set" : `${c.hp} / ${c.maxHp}`;
        const temporaryHpText = Number(c.tempHp) > 0 ? ` · Temp ${c.tempHp}` : "";
        const initiativeText = c.initiative === "" || c.initiative == null ? "—" : c.initiative;
        const keyCombatLine = `HP ${healthText}${temporaryHpText} · Init ${initiativeText}`;
        const ariaLabel = `${visibleName}, ${combatTypeLabel(c.sourceType)}, ${keyCombatLine}, ${c.status || "Active"}`;
        return `<button type="button" class="combatOpsInitiativeCard ${combatantStateClasses(c, index)}" data-combatant-index="${index}" aria-label="${esc(ariaLabel)}" aria-pressed="${index === combatOpsState.activeIndex}"><span class="combatOpsCardImage" data-combat-portrait-index="${index}" aria-hidden="true"></span><span class="combatOpsCardOverlay" aria-hidden="true"></span><span class="combatOpsCardTop"><span class="combatOpsCardBadges">${renderTypeBadge(c)}${renderGroupBadge(c)}${renderQuickBadge(c)}</span>${renderConditionBadges(c)}</span><span class="combatOpsCardIdentity"><strong class="combatOpsInitName">${esc(visibleName)}</strong><small>${esc(participantClassification(c))}</small><span class="combatOpsInitMeta"><span class="combatOpsKeyStats">${esc(keyCombatLine)}</span><span class="combatOpsCardStatus">${esc(c.status || "Active")}</span></span></span>${c.hp != null && c.maxHp ? `<span class="combatOpsHpMini" aria-label="${esc(`${semanticLabel(c.systemId, "currentHealth", "Resource")} ${healthText}`)}"><span style="width:${percent}%"></span></span>` : ""}</button>`;
    }

    function renderReferenceValue(title, value, reference = "") { return value ? `<section class="combatStatReference"${reference ? ` data-combat-reference="${esc(reference)}"` : ""}><h3>${esc(title)}</h3><p>${esc(value)}</p></section>` : ""; }
    function renderReferenceEntries(title, entries, reference = "") { return entries?.length ? `<section class="combatStatReference"${reference ? ` data-combat-reference="${esc(reference)}"` : ""}><h3>${esc(title)}</h3>${entries.map(entry => {
        if (typeof entry === "string") return `<p>${esc(entry)}</p>`;
        const details = [entry.attackType || entry.type, entry.attackBonus !== null && entry.attackBonus !== undefined && entry.attackBonus !== "" ? `Attack ${entry.attackBonus}` : "", entry.reach || entry.range, entry.target || entry.targets, entry.damage, entry.damageType, entry.saveDC != null ? `Save DC ${entry.saveDC}` : "", entry.recharge, entry.usage].filter(Boolean).join(" · ");
        const description = entry.description || entry.notes || entry.automationNotes || "";
        return `<article><strong>${esc(entry.name || entry.title || title)}</strong>${details ? `<small>${esc(details)}</small>` : ""}${description ? `<p>${esc(description)}</p>` : ""}</article>`;
    }).join("")}</section>` : ""; }
    function renderCapabilityTracking(category, entry) {
        if (!entry.runtime) return "";
        const uses = entry.runtime.maximumUses != null
            ? `<span class="combatCapabilityUses"><button type="button" data-capability-action="decrement" aria-label="Use ${esc(entry.name)}">−</button><strong>${esc(entry.runtime.usesRemaining)} / ${esc(entry.runtime.maximumUses)}</strong><button type="button" data-capability-action="increment" aria-label="Restore use of ${esc(entry.name)}">+</button></span>`
            : "";
        const recharge = entry.recharge
            ? `<button type="button" data-capability-action="recharge" class="${entry.runtime.rechargeState === "spent" ? "is-spent" : ""}">${esc(entry.recharge)} · ${entry.runtime.rechargeState === "spent" ? "Spent" : "Ready"}</button>`
            : "";
        const turn = entry.oncePerTurn ? `<button type="button" data-capability-action="turn">${entry.runtime.usedThisTurn ? "Used this turn" : "Available this turn"}</button>` : "";
        const round = entry.oncePerRound ? `<button type="button" data-capability-action="round">${entry.runtime.usedThisRound ? "Used this round" : "Available this round"}</button>` : "";
        return uses || recharge || turn || round ? `<div class="combatCapabilityTracking">${uses}${recharge}${turn}${round}</div>` : "";
    }
    function renderCapabilityEntry(category, entry) {
        const details = [
            entry.activation || entry.actionType || entry.attackType || entry.type,
            entry.attackBonus !== null && entry.attackBonus !== undefined && entry.attackBonus !== "" ? `Attack ${entry.attackBonus}` : "",
            entry.reach || entry.range,
            entry.target || entry.targets,
            entry.damage,
            entry.damageType,
            entry.healing,
            entry.saveDC != null ? `Save DC ${entry.saveDC}` : "",
            entry.recharge,
            entry.uses
        ].filter(Boolean).join(" · ");
        const rulesText = entry.rulesText || entry.description || entry.text || entry.notes || "";
        return `<article class="combatCapabilityEntry" data-capability-id="${esc(entry.id)}"><header><strong>${esc(entry.name || category.singularLabel)}</strong>${entry.provenance ? `<small>${esc(entry.provenance)}</small>` : ""}</header>${details ? `<p class="combatCapabilitySummary">${esc(details)}</p>` : ""}${rulesText ? `<p>${esc(rulesText)}</p>` : ""}${renderCapabilityTracking(category, entry)}</article>`;
    }
    function renderCapabilityProfile(c) {
        const categories = c.capabilityProfile?.categories || [];
        if (!categories.length) return "";
        const populated = categories.filter(category => category.entries?.length);
        if (!populated.length) return "";
        const index = `<nav class="combatCapabilityIndex" aria-label="Combat capabilities">${populated.map(category => `<a href="#combat-capability-${esc(category.id)}">${esc(category.pluralLabel || category.name)} <span>${category.entries.length}</span></a>`).join("")}</nav>`;
        const resources = c.capabilityProfile?.resources || {};
        const legendaryLabel = populated.find(category => category.id === "legendary-actions")?.resourceLabel || "Resource";
        const spellSlotLabel = populated.find(category => category.id === "spellcasting")?.resourceLabel || "Spell Resources";
        const resourcePanel = `${resources.legendaryActions ? `<div class="combatCapabilityResource" data-capability-resource="legendaryActions"><strong>${esc(legendaryLabel)}</strong><button type="button" data-resource-action="decrement">−</button><span>${esc(resources.legendaryActions.remaining)} / ${esc(resources.legendaryActions.maximum)}</span><button type="button" data-resource-action="increment">+</button></div>` : ""}${resources.spellSlots ? `<div class="combatCapabilityResource combatSpellSlots" data-capability-resource="spellSlots"><strong>${esc(spellSlotLabel)}</strong>${Object.entries(resources.spellSlots).map(([level, value]) => { const current = typeof value === "object" ? value.remaining ?? value.current ?? value.max ?? 0 : value; const maximum = typeof value === "object" ? value.maximum ?? value.max ?? value.total ?? current : current; return `<span data-resource-key="${esc(level)}"><small>${esc(level)}</small><button type="button" data-resource-action="decrement">−</button><b>${esc(current)} / ${esc(maximum)}</b><button type="button" data-resource-action="increment">+</button></span>`; }).join("")}</div>` : ""}`;
        return `<section class="combatCapabilities">${index}${resourcePanel}${populated.map(category => `<details id="combat-capability-${esc(category.id)}" data-combat-reference="${esc(category.id)}" class="combatCapabilitySection ${category.prominent ? "is-prominent" : ""}" ${category.prominent ? "open" : ""}><summary><span>${category.icon ? `${esc(category.icon)} ` : ""}${esc(category.pluralLabel || category.name)}</span><small>${category.entries.length}</small></summary><div>${category.entries.map(entry => renderCapabilityEntry(category, entry)).join("")}</div></details>`).join("")}</section>`;
    }
    function renderActiveStatBlock(c) {
        const rules = combatRules(c.systemId);
        const abilityRow = (window.MasterForgeGameSystems?.enabled?.(rules.attributes) || []).map(definition => { const score = c.attributes?.[definition.id]; const mod = definition.calculationKey === "ability-modifier" ? abilityModifier(score) : null; return `<div><strong>${esc(definition.shortLabel || definition.name)}</strong><span>${score == null ? "—" : `${score}${mod == null ? "" : ` (${mod >= 0 ? "+" : ""}${mod})`}`}</span></div>`; }).join("");
        const passiveText = (window.MasterForgeGameSystems?.enabled?.(rules.passiveScores) || []).map(definition => c.passiveScores?.[definition.id] != null ? `${definition.name} ${c.passiveScores[definition.id]}` : "").filter(Boolean).join(" · ");
        const progressLabel = c.level ? `${rules.classifications?.levelLabel || "Rank"} ${c.level}` : c.cr ? `${rules.classifications?.threatLabel || "Threat"} ${c.cr}` : combatTypeLabel(c.sourceType);
        const savingThrows = renderReferenceValue(rules.displayLabels?.savingThrows || "Saving Throws", c.savingThrows, "saving-throws");
        const skills = renderReferenceValue(rules.displayLabels?.skills || "Skills", typeof c.skills === "string" ? c.skills : "", "skills");
        const sensesAndLanguages = c.senses || c.languages
            ? `<section class="combatStatReference combatStatReferenceGroup" data-combat-reference="senses-languages"><h3>Senses and Languages</h3>${c.senses ? `<p><strong>Senses</strong> ${esc(c.senses)}</p>` : ""}${c.languages ? `<p><strong>Languages</strong> ${esc(c.languages)}</p>` : ""}</section>`
            : "";
        const progression = [c.cr ? `${semanticLabel(c.systemId, "threat", "Threat", true)} ${c.cr}` : "", c.proficiencyBonus ? `${semanticLabel(c.systemId, "proficiency", "Bonus", true)} ${c.proficiencyBonus}` : ""].filter(Boolean).join(" · ");
        const sourceReference = formatSourceReference(c.source, c.sourceTitle, c.sourceReference);
        return `
          <div class="statBlockCard combatStatBlock ${combatantStateClasses(c)}" data-combat-reference="overview">
            <header class="combatStatHeader">
              <span class="combatStatHeroImage" data-combat-active-portrait aria-hidden="true"></span>
              <span class="combatStatHeroOverlay" aria-hidden="true"></span>
              <div class="combatStatHeroContent">
                <div class="combatOpsCardBadges">${renderTypeBadge(c)}${renderGroupBadge(c)}${renderQuickBadge(c)}</div>
                ${renderConditionBadges(c)}
                <h1>${esc(c.hidden ? "Hidden Enemy" : c.name)}</h1>
                <p>${esc(participantClassification(c))}</p>
                <small>${esc(progressLabel)} · ${esc(c.status || "Active")}</small>
                ${sourceReference ? `<small data-combat-source-reference>${esc(sourceReference)}</small>` : ""}
              </div>
            </header>
            <div class="combatStatDefence">
              ${semanticStat(c.systemId, "primaryDefence")?.enabled !== false ? `<div><strong>${esc(semanticLabel(c.systemId, "primaryDefence", "Defence"))}</strong><span>${c.ac ?? "Not set"}</span></div>` : ""}
              ${semanticStat(c.systemId, "currentHealth")?.enabled !== false ? `<div><strong>${esc(semanticLabel(c.systemId, "currentHealth", "Resource"))}</strong><span>${c.hp == null || c.maxHp == null ? "Not set" : `${c.hp} / ${c.maxHp}`}</span>${Number(c.tempHp) > 0 ? `<small class="combatTempHpSummary" data-combat-temp-hp-summary>+ ${esc(c.tempHp)} Temporary HP</small>` : ""}</div>` : ""}
              ${semanticStat(c.systemId, "movement")?.enabled !== false ? `<div><strong>${esc(semanticLabel(c.systemId, "movement", "Movement"))}</strong><span>${esc(c.speed || "Not set")}</span></div>` : ""}
            </div>
            ${abilityRow ? `<div class="combatStatAbilities">${abilityRow}</div>` : ""}
            <div class="combatStatReferences">
              ${savingThrows}
              ${skills}
              ${renderReferenceValue(rules.displayLabels?.passiveScores || "Derived Scores", passiveText)}
              ${renderReferenceValue("Damage Vulnerabilities", c.damageVulnerabilities)}
              ${renderReferenceValue("Damage Resistances", c.damageResistances)}
              ${renderReferenceValue("Damage Immunities", c.damageImmunities)}
              ${renderReferenceValue("Condition Immunities", c.conditionImmunities)}
              ${sensesAndLanguages}
              ${renderReferenceValue("Progression / Threat", progression)}
              ${renderCapabilityProfile(c)}
              ${renderReferenceEntries("Harvest / Loot", c.loot, "harvest-loot")}
              ${renderReferenceValue("Notes", c.notes, "notes")}
            </div>
            ${c.hidden ? `<button class="combatOpsRevealBtn">Reveal Combatant</button>` : ""}
          </div>`;
    }

    function renderTrackingPanel(c) {
        const labels = combatRules(c.systemId).displayLabels || {};
        return `<div class="combatOpsPanel"><h3>Combat Tracking</h3>${semanticStat(c.systemId, "currentHealth")?.enabled !== false ? `<label>${esc(semanticLabel(c.systemId, "currentHealth", "Current Resource"))}<input id="combatOpsHpInput" type="number" value="${c.hp ?? ""}" placeholder="Not set"></label>` : ""}${semanticStat(c.systemId, "maximumHealth")?.enabled !== false ? `<label>${esc(semanticLabel(c.systemId, "maximumHealth", "Maximum Resource"))}<input id="combatOpsMaxHpInput" type="number" min="1" value="${c.maxHp ?? ""}" placeholder="Not set"></label>` : ""}${semanticStat(c.systemId, "temporaryHealth")?.enabled !== false ? `<label>${esc(semanticLabel(c.systemId, "temporaryHealth", "Temporary Resource"))}<input id="combatOpsTempHpInput" type="number" min="0" value="${esc(c.tempHp || 0)}"></label>` : ""}${semanticStat(c.systemId, "primaryDefence")?.enabled !== false ? `<label>${esc(semanticLabel(c.systemId, "primaryDefence", "Defence"))}<input id="combatOpsAcInput" type="number" value="${c.ac ?? ""}" placeholder="Not set"></label>` : ""}<label>${esc(labels.conditions || "Conditions")}</label><div class="combatOpsConditionList">${(c.conditions || []).length ? c.conditions.map(condition => `<span>${esc(condition)}</span>`).join("") : `<em>None</em>`}</div><label>${esc(labels.status || "Status")}<select id="combatOpsStatusInput">${["Active", "Unconscious", "Defeated", "Dead", "Fled"].map(status => `<option ${c.status === status ? "selected" : ""}>${status}</option>`).join("")}</select></label><label>Notes<textarea id="combatOpsNotesInput">${esc(c.notes || "")}</textarea></label></div>`;
    }

    function renderCombatOperationsCentre() {
        if (combatOpsState.mode === "selection" || !combatOpsState.combatants.length) return renderEncounterSelection();
        if (combatOpsState.mode === "initiative") return renderInitiativeSetup();
        const active = getActiveCombatant();
        return `<div class="combatOpsShell"><div class="combatOpsTopBar"><div><h2>Combat Operations Centre</h2><p>${esc(combatOpsState.encounterName)} · ${combatOpsState.mode === "active" ? `Round ${combatOpsState.round} · ${active.name} is active` : "Encounter loaded · Set initiative when ready"}</p></div><div class="combatOpsTurnButtons"><button id="combatOpsChooseEncounterBtn">Encounters</button><button id="toggleCombatOpsModeBtn">${document.body.classList.contains("combatOpsMode") ? "Exit Focus" : "Focus Mode"}</button>${combatOpsState.mode === "setup" ? `<button id="combatOpsSetInitiativeBtn" class="primaryBtn">Set Initiative</button>` : ""}</div></div><div class="combatOpsInitiativeRibbon">${combatOpsState.combatants.map(renderInitiativeCard).join("")}</div><div class="combatOpsWorkspace"><section class="combatOpsStatBlock">${renderActiveStatBlock(active)}</section><aside class="combatOpsTracker">${renderTrackingPanel(active)}</aside></div></div>`;
    }

    function applyPortraitBackground(layer, portrait, owner) {
        const value = typeof portrait === "string" ? portrait.trim() : "";
        owner?.classList.remove("has-portrait");
        owner?.classList.add("no-portrait");
        layer.style.backgroundImage = "";
        if (!value) return;

        layer.style.backgroundImage = `url(${JSON.stringify(value)})`;
        const probe = new Image();
        probe.onload = () => {
            if (!layer.isConnected) return;
            owner?.classList.remove("no-portrait");
            owner?.classList.add("has-portrait");
        };
        probe.onerror = () => {
            if (!layer.isConnected) return;
            layer.style.backgroundImage = "";
            owner?.classList.remove("has-portrait");
            owner?.classList.add("no-portrait");
        };
        probe.src = value;
    }

    function applyCombatPortraitLayers(container) {
        container.querySelectorAll("[data-combat-portrait-index]").forEach(layer => {
            const combatant = combatOpsState.combatants[Number(layer.dataset.combatPortraitIndex)];
            applyPortraitBackground(layer, combatant?.portrait, layer.closest(".combatOpsInitiativeCard"));
        });
        const heroLayer = container.querySelector("[data-combat-active-portrait]");
        if (heroLayer) {
            applyPortraitBackground(heroLayer, getActiveCombatant()?.portrait, heroLayer.closest(".combatStatBlock"));
        }
    }

    function getActiveReferenceDestinations() {
        const combatant = getActiveCombatant();
        if (!combatant || !["setup", "active"].includes(combatOpsState.mode)) return [];
        const destinations = [{ key: "overview", label: "Overview" }];
        if (String(combatant.savingThrows || "").trim()) destinations.push({ key: "saving-throws", label: "Saving Throws" });
        if (typeof combatant.skills === "string" && combatant.skills.trim()) destinations.push({ key: "skills", label: "Skills" });
        if (String(combatant.senses || "").trim() || String(combatant.languages || "").trim()) destinations.push({ key: "senses-languages", label: "Senses and Languages" });
        (combatant.capabilityProfile?.categories || [])
            .filter(category => category.entries?.length)
            .forEach(category => destinations.push({
                key: String(category.id),
                label: category.pluralLabel || category.name || category.id
            }));
        if (combatant.loot?.length) destinations.push({ key: "harvest-loot", label: "Harvest / Loot" });
        if (String(combatant.notes || "").trim()) destinations.push({ key: "notes", label: "Notes" });
        return destinations;
    }

    function navigateActiveReference(reference) {
        const container = getContainer();
        const destination = [...(container?.querySelectorAll("[data-combat-reference]") || [])]
            .find(element => element.dataset.combatReference === reference);
        if (!destination) return false;
        const previousTimer = referenceHighlightTimers.get(destination);
        if (previousTimer) clearTimeout(previousTimer);
        destination.classList.remove("combatReferenceHighlight");
        void destination.offsetWidth;
        destination.classList.add("combatReferenceHighlight");
        const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        destination.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start", inline: "nearest" });
        referenceHighlightTimers.set(destination, setTimeout(() => {
            destination.classList.remove("combatReferenceHighlight");
            referenceHighlightTimers.delete(destination);
        }, 1500));
        return true;
    }

    function rerenderCombatOps() {
        const container = getContainer();
        if (!container) return;
        container.innerHTML = `${combatOpsState.error ? `<p class="combatOpsLoadError" role="alert">${esc(combatOpsState.error)}</p>` : ""}${renderCombatOperationsCentre()}`;
        container.querySelector(".combatOpsTopBar")?.insertAdjacentHTML("afterend", `<p class="combatOpsDiagnostic" data-combat-diagnostic data-status="info" aria-live="polite">${esc(combatOpsState.diagnostic || "Combat module initialised")}</p>`);
        applyCombatPortraitLayers(container);
        wireCombatOpsControls();
        window.MasterForgeActionConsole?.refresh();
    }
    function updateInitiativeValuesFromInputs() { document.querySelectorAll(".combatOpsInitiativeInput").forEach(input => { const c = combatOpsState.combatants[Number(input.dataset.combatantIndex)]; if (c) c.initiative = input.value === "" ? "" : Number(input.value); }); }
    function sortCombatantsByInitiative() { combatOpsState.combatants.sort((a,b) => Number(b.initiative || 0) - Number(a.initiative || 0) || (a.name || "").localeCompare(b.name || "")); }
    function isCombatantReady(c) {
        if (!c) return false;
        const requiredRoles = [
            ["primaryDefence", "ac"],
            ["currentHealth", "hp"],
            ["maximumHealth", "maxHp"]
        ].filter(([role]) => semanticStat(c.systemId, role)?.enabled !== false && semanticStat(c.systemId, role)?.requiredForCombat);
        return requiredRoles.every(([, field]) => c[field] != null && (field !== "maxHp" || Number(c[field]) > 0));
    }
    async function startCombat() { updateInitiativeValuesFromInputs(); const incomplete = combatOpsState.combatants.filter(c => !isCombatantReady(c)); if (incomplete.length) { await showCombatDialog({ title: "Combatants Not Ready", message: `Complete the active system's required combat statistics for: ${incomplete.map(c => c.name).join(", ")}.`, confirmLabel: "Return to Readiness", cancelLabel: "Close" }); return; } sortCombatantsByInitiative(); combatOpsState.mode = "active"; combatOpsState.round = 1; combatOpsState.activeIndex = 0; saveCombatState(); rerenderCombatOps(); }
    function resetCapabilityUsage(combatant, period) {
        combatant?.capabilityProfile?.categories?.forEach(category => category.entries?.forEach(entry => {
            if (!entry.runtime) return;
            if (period === "turn") entry.runtime.usedThisTurn = false;
            if (period === "round") entry.runtime.usedThisRound = false;
        }));
    }
    function nextTurn(delta = 1) {
        if (!combatOpsState.combatants.length) return;
        const priorRound = combatOpsState.round;
        combatOpsState.activeIndex += delta;
        if (combatOpsState.activeIndex >= combatOpsState.combatants.length) { combatOpsState.activeIndex = 0; combatOpsState.round++; }
        else if (combatOpsState.activeIndex < 0) { combatOpsState.activeIndex = combatOpsState.combatants.length - 1; combatOpsState.round = Math.max(1, combatOpsState.round - 1); }
        resetCapabilityUsage(getActiveCombatant(), "turn");
        if (combatOpsState.round !== priorRound) combatOpsState.combatants.forEach(combatant => resetCapabilityUsage(combatant, "round"));
        saveCombatState();
        rerenderCombatOps();
    }
    function resolveHitPointAdjustment(combatant, amount) {
        const delta = Number(amount);
        if (!combatant || combatant.hp == null || combatant.maxHp == null || !Number.isFinite(delta)) return null;
        if (delta < 0) {
            const damage = Math.abs(delta);
            const temporaryHp = Math.max(0, Number(combatant.tempHp) || 0);
            const absorbed = Math.min(temporaryHp, damage);
            combatant.tempHp = temporaryHp - absorbed;
            const currentHpDamage = damage - absorbed;
            combatant.hp = Math.max(0, Number(combatant.hp) - currentHpDamage);
            return { currentHpDelta: -currentHpDamage, temporaryHpDelta: -absorbed };
        }
        const previousHp = Number(combatant.hp);
        combatant.hp = Math.max(0, Math.min(Number(combatant.maxHp), previousHp + delta));
        return { currentHpDelta: combatant.hp - previousHp, temporaryHpDelta: 0 };
    }
    function adjustHp(amount) {
        const c = getActiveCombatant();
        const result = resolveHitPointAdjustment(c, amount);
        if (!result) return;
        const currentHpDelta = result.currentHpDelta;
        if (c.groupMode === "individual-counters" && Array.isArray(c.memberHp)) {
            let remaining = Math.abs(currentHpDelta);
            if (currentHpDelta < 0) {
                for (let i = c.memberHp.length - 1; i >= 0 && remaining > 0; i--) { const applied = Math.min(c.memberHp[i], remaining); c.memberHp[i] -= applied; remaining -= applied; }
            } else {
                for (let i = 0; i < c.memberHp.length && remaining > 0; i++) { const capacity = Math.max(0, c.standardMemberHp - c.memberHp[i]); const applied = Math.min(capacity, remaining); c.memberHp[i] += applied; remaining -= applied; }
            }
            c.groupQuantity = c.memberHp.filter(value => value > 0).length;
        }
        if (c.hp === 0 && c.status === "Active") c.status = "Unconscious";
        else if (currentHpDelta > 0 && c.hp > 0 && c.status === "Unconscious") c.status = "Active";
        saveCombatState();
        rerenderCombatOps();
    }
    function updateCapabilityRuntime(categoryId, entryId, action) {
        const c = getActiveCombatant();
        const category = c?.capabilityProfile?.categories?.find(item => item.id === categoryId);
        const entry = category?.entries?.find(item => String(item.id) === String(entryId));
        if (!entry?.runtime) return;
        if (action === "decrement" && entry.runtime.usesRemaining != null) entry.runtime.usesRemaining = Math.max(0, entry.runtime.usesRemaining - 1);
        if (action === "increment" && entry.runtime.usesRemaining != null) entry.runtime.usesRemaining = Math.min(entry.runtime.maximumUses, entry.runtime.usesRemaining + 1);
        if (action === "recharge") entry.runtime.rechargeState = entry.runtime.rechargeState === "spent" ? "ready" : "spent";
        if (action === "turn") entry.runtime.usedThisTurn = !entry.runtime.usedThisTurn;
        if (action === "round") entry.runtime.usedThisRound = !entry.runtime.usedThisRound;
        saveCombatState();
        rerenderCombatOps();
    }
    function updateCapabilityResource(resourceId, key, delta) {
        const resources = getActiveCombatant()?.capabilityProfile?.resources;
        if (!resources) return;
        if (resourceId === "legendaryActions" && resources.legendaryActions) {
            resources.legendaryActions.remaining = Math.max(0, Math.min(resources.legendaryActions.maximum, resources.legendaryActions.remaining + delta));
        }
        if (resourceId === "spellSlots" && resources.spellSlots?.[key] != null) {
            const slot = resources.spellSlots[key];
            if (typeof slot === "number") resources.spellSlots[key] = Math.max(0, slot + delta);
            else {
                const maximum = Number(slot.maximum ?? slot.max ?? slot.total ?? slot.remaining ?? slot.current ?? 0);
                const currentKey = Object.prototype.hasOwnProperty.call(slot, "remaining") ? "remaining" : "current";
                slot[currentKey] = Math.max(0, Math.min(maximum, Number(slot[currentKey] ?? maximum) + delta));
            }
        }
        saveCombatState();
        rerenderCombatOps();
    }
    async function addCondition() {
        const c = getActiveCombatant();
        if (!c) return;
        const registered = window.MasterForgeGameSystems?.enabled?.(combatRules(c.systemId).conditions) || [];
        const value = registered.length
            ? await showCombatDialog({ title: `Add Condition to ${c.name}`, message: "Choose a system condition or enter a temporary custom condition.", confirmLabel: "Add Condition", selectOptions: registered.map(condition => ({ value: condition.name || condition.id, label: condition.name || condition.id })) })
            : await showCombatDialog({ title: `Add Condition to ${c.name}`, message: "The system condition registry is unavailable. Enter a temporary condition.", confirmLabel: "Add Condition", input: { label: "Condition", placeholder: "Condition name" } });
        if (value && !c.conditions.some(condition => condition.toLowerCase() === value.toLowerCase())) { c.conditions.push(value); saveCombatState(); rerenderCombatOps(); }
    }
    async function removeCondition() {
        const c = getActiveCombatant();
        if (!c?.conditions?.length) return;
        const value = await showCombatDialog({ title: `Remove Condition from ${c.name}`, message: "Choose the condition to remove.", choices: c.conditions.map(condition => ({ value: condition, label: condition })) });
        if (value) { c.conditions = c.conditions.filter(item => item.toLowerCase() !== value.toLowerCase()); saveCombatState(); rerenderCombatOps(); }
    }
    function setActiveStatus(status) { const c = getActiveCombatant(); if (!c || (status === "Active" && Number(c.hp) <= 0)) return; c.status = status; saveCombatState(); rerenderCombatOps(); }

    function lateParticipantTypeMatches(left, right) {
        if (left === right) return true;
        return ["vehicle", "ship"].includes(left) && ["vehicle", "ship"].includes(right);
    }

    function isCanonicalParticipantInCombat(type, record) {
        const references = new Set(canonicalIds(record));
        return combatOpsState.combatants.some(combatant =>
            !combatant.quickParticipant &&
            lateParticipantTypeMatches(type, combatant.sourceType) &&
            [combatant.sourceId, combatant.sourceEntityId, combatant.sourceParticipantId]
                .filter(Boolean)
                .some(reference => references.has(String(reference)))
        );
    }

    function makeLateParticipantPreview(type, record) {
        const sourceData = record?.data_json || {};
        const characterData = sourceData.character || {};
        const canonical = { ...sourceData, ...characterData, ...(record || {}) };
        const stats = { ...(sourceData.stats || {}), ...(canonical.stats || {}) };
        const systemId = canonical.systemId || sourceData.systemId || window.dmState?.current?.systemId || "system-neutral";
        const maxHp = firstFinite(readSemantic(canonical, "maximumHealth", systemId), parseStatNumber(stats.hp));
        return {
            key: `${type}:${record.id}`,
            type,
            record,
            id: String(record.id),
            name: canonical.name || record.name || "Unnamed Participant",
            portrait: portraitOf(canonical),
            category: canonical.type || canonical.species || canonical.vehicleType || canonical.class || combatTypeLabel(type),
            cr: readSemantic(canonical, "threat", systemId) || "",
            level: readSemantic(canonical, "levelRank", systemId) ?? "",
            ac: firstFinite(readSemantic(canonical, "primaryDefence", systemId)),
            maxHp,
            alreadyPresent: isCanonicalParticipantInCombat(type, record)
        };
    }

    async function loadLateParticipantSources() {
        const types = ["pc", "npc", "creature", "vehicle", "ship"];
        const loaded = await Promise.all(types.map(async type => {
            try {
                return (await canonicalRecords(type))
                    .filter(record => {
                        const status = String(record.status || record.data_json?.status || "").toLowerCase();
                        return !["archived", "deleted"].includes(status) &&
                            sourceScopeMatches(record, {
                                campaignId: currentCampaignScope(),
                                systemId: window.dmState?.current?.systemId || ""
                            });
                    })
                    .map(record => makeLateParticipantPreview(type, record));
            } catch (error) {
                console.warn(`Could not load ${type} records for late participant picker:`, error);
                return [];
            }
        }));
        return loaded.flat().sort((left, right) =>
            left.name.localeCompare(right.name) || left.type.localeCompare(right.type)
        );
    }

    function quickParticipantSnapshot(values) {
        const numberOr = (value, fallback) => value === "" || !Number.isFinite(Number(value)) ? fallback : Number(value);
        const currentHp = Math.max(0, numberOr(values.currentHp, 1));
        const maximumHp = Math.max(1, numberOr(values.maximumHp, currentHp || 1));
        const type = values.type || "creature";
        const name = values.name.trim();
        return {
            id: `quick-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            sourceParticipantId: "",
            sourceType: type,
            sourceId: "",
            sourceEntityId: "",
            sourceStore: "",
            sourceScope: "combat-runtime",
            sourceWriteBackEligible: false,
            sourceDisplayName: name,
            importedAt: new Date().toISOString(),
            snapshotVersion: 2,
            quickParticipant: true,
            temporary: true,
            name,
            subtitle: `Quick ${combatTypeLabel(type)} · Temporary`,
            portrait: values.portrait || "",
            systemId: window.dmState?.current?.systemId || "system-neutral",
            level: null,
            cr: "",
            className: "",
            subtype: "",
            size: "",
            creatureType: "",
            alignment: "",
            initiative: values.initiative === "" ? "" : numberOr(values.initiative, ""),
            initiativeModifier: null,
            proficiencyBonus: "",
            ac: Math.max(0, numberOr(values.ac, 10)),
            hp: Math.min(currentHp, maximumHp),
            maxHp: maximumHp,
            tempHp: 0,
            speed: values.speed || "30",
            attributes: {},
            abilities: {},
            savingThrows: "",
            skills: "",
            senses: "",
            languages: "",
            passiveScores: {},
            capabilityProfile: { systemId: window.dmState?.current?.systemId || "system-neutral", categories: [], warnings: [], conflicts: [], resources: { legendaryActions: null, spellSlots: null } },
            damageVulnerabilities: "",
            damageResistances: "",
            damageImmunities: "",
            conditionImmunities: "",
            traits: [],
            actions: [],
            bonusActions: [],
            reactions: [],
            legendaryActions: [],
            lairActions: [],
            mythicActions: [],
            spellcasting: [],
            innateSpellcasting: [],
            equipment: [],
            loot: [],
            group: type === "pc" ? "Allies" : "Enemies",
            conditions: [],
            hidden: false,
            status: "Active",
            notes: values.notes || ""
        };
    }

    async function showLateParticipantDialog() {
        pendingCombatDialog?.cancel();
        const previousFocus = document.activeElement;
        const backdrop = document.createElement("div");
        backdrop.className = "combatDeploymentBackdrop combatLateParticipantBackdrop";
        backdrop.innerHTML = `
          <section class="combatDeploymentDialog combatLateParticipantDialog" role="dialog" aria-modal="true" aria-labelledby="lateParticipantDialogTitle">
            <header>
              <div><h2 id="lateParticipantDialogTitle">Add Late Participant</h2><p>Add a canonical MasterForge record or create a temporary combat-only participant.</p></div>
              <button type="button" data-late-close aria-label="Close late participant dialog">Close</button>
            </header>
            <div class="combatLateParticipantModes" role="tablist" aria-label="Participant source">
              <button type="button" role="tab" aria-selected="true" data-late-mode="canonical">From MasterForge</button>
              <button type="button" role="tab" aria-selected="false" data-late-mode="quick">Quick Add</button>
            </div>
            <section data-late-panel="canonical" role="tabpanel">
              <div class="combatLateParticipantFilters">
                <label>Search<input type="search" data-late-search placeholder="Search PCs, NPCs, creatures and vehicles."></label>
                <label>Record Type<select data-late-type><option value="all">All Types</option><option value="pc">PC</option><option value="npc">NPC</option><option value="creature">Creature</option><option value="vehicle">Vehicle</option></select></label>
              </div>
              <div class="combatLateParticipantBrowser">
                <div class="combatLateParticipantResults" data-late-results><p class="forgeEmptyState">Loading MasterForge records…</p></div>
                <aside class="combatLateParticipantPreview" data-late-preview><p class="forgeEmptyState">Select a participant to preview it.</p></aside>
              </div>
            </section>
            <section data-late-panel="quick" role="tabpanel" hidden>
              <div class="combatLateParticipantQuickGrid">
                <label class="combatLateParticipantWide">Name <span aria-hidden="true">*</span><input data-quick-name required autocomplete="off"></label>
                <label>Participant Type<select data-quick-type><option value="creature">Creature</option><option value="npc">NPC</option><option value="pc">PC</option><option value="vehicle">Vehicle</option><option value="other">Other</option></select></label>
                <label>Current HP<input data-quick-current-hp type="number" min="0" value="1"></label>
                <label>Maximum HP<input data-quick-max-hp type="number" min="1" value="1"></label>
                <label>Armour Class<input data-quick-ac type="number" min="0" value="10"></label>
                <label>Initiative<input data-quick-initiative type="number" placeholder="Optional"></label>
                <label>Speed<input data-quick-speed value="30"></label>
                <label class="combatLateParticipantWide">Portrait<input data-quick-portrait type="file" accept="image/*"><small data-quick-portrait-status>No portrait selected.</small></label>
                <label class="combatLateParticipantWide">Notes<textarea data-quick-notes rows="3"></textarea></label>
              </div>
            </section>
            <p class="combatLateParticipantStatus" data-late-status aria-live="polite"></p>
            <footer><button type="button" data-late-cancel>Cancel</button><button type="button" class="primaryBtn" data-late-add disabled>Add Participant</button></footer>
          </section>
        `;
        document.body.appendChild(backdrop);
        document.body.classList.add("masterforgeModalOpen");

        const dialog = backdrop.querySelector(".combatLateParticipantDialog");
        const searchInput = backdrop.querySelector("[data-late-search]");
        const typeInput = backdrop.querySelector("[data-late-type]");
        const results = backdrop.querySelector("[data-late-results]");
        const preview = backdrop.querySelector("[data-late-preview]");
        const status = backdrop.querySelector("[data-late-status]");
        const addButton = backdrop.querySelector("[data-late-add]");
        const quickName = backdrop.querySelector("[data-quick-name]");
        const quickCurrentHp = backdrop.querySelector("[data-quick-current-hp]");
        const quickMaxHp = backdrop.querySelector("[data-quick-max-hp]");
        const quickPortraitInput = backdrop.querySelector("[data-quick-portrait]");
        const quickPortraitStatus = backdrop.querySelector("[data-quick-portrait-status]");
        let mode = "canonical";
        let sources = [];
        let selected = null;
        let quickPortrait = "";
        let maximumHpWasEdited = false;
        let closed = false;

        const isQuickValid = () => Boolean(quickName.value.trim()) &&
            Number(quickCurrentHp.value) >= 0 &&
            Number(quickMaxHp.value) >= 1;
        const updateValidity = () => {
            addButton.disabled = mode === "canonical" ? !selected : !isQuickValid();
        };
        const previewStats = source => [
            source.cr !== "" ? `CR ${source.cr}` : "",
            source.level !== "" ? `Level ${source.level}` : "",
            source.ac != null ? `AC ${source.ac}` : "AC not set",
            source.maxHp != null ? `HP ${source.maxHp}` : "HP not set"
        ].filter(Boolean).join(" · ");
        const renderPreview = () => {
            if (!selected) {
                preview.innerHTML = `<p class="forgeEmptyState">Select a participant to preview it.</p>`;
                return;
            }
            preview.innerHTML = `
              <div class="combatLateParticipantPreviewPortrait">${selected.portrait ? `<img src="${esc(selected.portrait)}" alt="">` : `<span aria-label="No portrait">◆</span>`}</div>
              <div><span class="combatTypeBadge combatTypeBadge--${esc(selected.type)}">${esc(combatTypeLabel(selected.type))}</span><h3>${esc(selected.name)}</h3><p>${esc(selected.category)}</p><small>${esc(previewStats(selected))}</small></div>
            `;
        };
        const renderResults = () => {
            const search = normalisedName(searchInput.value);
            const filter = typeInput.value;
            const matches = sources.filter(source =>
                (!search || normalisedName(`${source.name} ${source.category}`).includes(search)) &&
                (filter === "all" || (filter === "vehicle" ? ["vehicle", "ship"].includes(source.type) : source.type === filter))
            );
            const available = matches.filter(source => !source.alreadyPresent);
            if (!available.length) {
                const duplicateOnly = matches.length && matches.every(source => source.alreadyPresent);
                results.innerHTML = `<p class="forgeEmptyState">${duplicateOnly ? "This participant is already in the current combat." : search ? "No matching MasterForge records found." : "Search PCs, NPCs, creatures and vehicles."}</p>`;
                selected = null;
                renderPreview();
                updateValidity();
                return;
            }
            results.innerHTML = available.map(source => `
              <button type="button" class="combatLateParticipantResult ${selected?.key === source.key ? "is-selected" : ""}" data-late-source="${esc(source.key)}" aria-pressed="${selected?.key === source.key}">
                <span class="combatLateParticipantThumb">${source.portrait ? `<img src="${esc(source.portrait)}" alt="">` : "◆"}</span>
                <span><strong>${esc(source.name)}</strong><small>${esc(`${combatTypeLabel(source.type)} · ${source.category}`)}</small><small>${esc(previewStats(source))}</small></span>
              </button>
            `).join("");
        };
        const setMode = nextMode => {
            mode = nextMode;
            backdrop.querySelectorAll("[data-late-mode]").forEach(button => {
                const active = button.dataset.lateMode === mode;
                button.setAttribute("aria-selected", String(active));
                button.classList.toggle("is-active", active);
            });
            backdrop.querySelectorAll("[data-late-panel]").forEach(panel => {
                panel.hidden = panel.dataset.latePanel !== mode;
            });
            status.textContent = mode === "quick" ? "Quick participants are temporary and exist only in this combat." : "";
            updateValidity();
            requestAnimationFrame(() => (mode === "quick" ? quickName : searchInput).focus());
        };
        const finish = () => {
            if (closed) return;
            closed = true;
            if (pendingCombatDialog?.backdrop === backdrop) pendingCombatDialog = null;
            document.removeEventListener("keydown", handleKeydown);
            backdrop.remove();
            document.body.classList.remove("masterforgeModalOpen");
            previousFocus?.focus?.();
        };
        pendingCombatDialog = { backdrop, cancel: finish };
        const submit = async () => {
            if (addButton.disabled) return;
            addButton.disabled = true;
            status.textContent = "Adding participant…";
            try {
                if (mode === "canonical") {
                    const participant = {
                        id: `late-canonical-${selected.type}-${selected.id}-${Date.now()}`,
                        sourceType: selected.type,
                        sourceId: selected.id,
                        sourceEntityId: selected.id,
                        displayName: selected.name,
                        disposition: selected.type === "pc" ? "friendly" : "hostile",
                        quantity: 1
                    };
                    const deployed = await deployParticipant(participant, combatOpsState.combatants.length);
                    if (!deployed.length) throw new Error("The selected canonical participant could not be resolved.");
                    combatOpsState.combatants.push(...deployed);
                } else {
                    combatOpsState.combatants.push(quickParticipantSnapshot({
                        name: quickName.value,
                        type: backdrop.querySelector("[data-quick-type]").value,
                        currentHp: quickCurrentHp.value,
                        maximumHp: quickMaxHp.value,
                        ac: backdrop.querySelector("[data-quick-ac]").value,
                        initiative: backdrop.querySelector("[data-quick-initiative]").value,
                        speed: backdrop.querySelector("[data-quick-speed]").value,
                        portrait: quickPortrait,
                        notes: backdrop.querySelector("[data-quick-notes]").value
                    }));
                }
                saveCombatState();
                finish();
                rerenderCombatOps();
            } catch (error) {
                console.error("Could not add late combat participant:", error);
                status.textContent = error?.message || "Participant could not be added.";
                updateValidity();
            }
        };
        const handleKeydown = event => {
            if (event.key === "Escape") {
                event.preventDefault();
                finish();
                return;
            }
            if (event.key === "Enter" && event.target.tagName !== "TEXTAREA" && !event.target.closest("[data-late-source]")) {
                if (!addButton.disabled) {
                    event.preventDefault();
                    submit();
                }
                return;
            }
            if (event.key === "Tab") {
                const focusable = [...dialog.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])")]
                    .filter(element => !element.closest("[hidden]"));
                if (!focusable.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }
        };

        backdrop.onclick = event => {
            const modeButton = event.target.closest("[data-late-mode]");
            const resultButton = event.target.closest("[data-late-source]");
            if (modeButton) setMode(modeButton.dataset.lateMode);
            else if (resultButton) {
                selected = sources.find(source => source.key === resultButton.dataset.lateSource) || null;
                renderResults();
                renderPreview();
                updateValidity();
            } else if (event.target === backdrop || event.target.closest("[data-late-close], [data-late-cancel]")) finish();
            else if (event.target.closest("[data-late-add]")) submit();
        };
        searchInput.oninput = renderResults;
        typeInput.onchange = renderResults;
        backdrop.querySelectorAll("[data-quick-name], [data-quick-current-hp], [data-quick-max-hp]").forEach(input => {
            input.addEventListener("input", updateValidity);
        });
        quickCurrentHp.oninput = () => {
            if (!maximumHpWasEdited) quickMaxHp.value = Math.max(1, Number(quickCurrentHp.value || 1));
            updateValidity();
        };
        quickMaxHp.oninput = () => {
            maximumHpWasEdited = true;
            updateValidity();
        };
        quickPortraitInput.onchange = () => {
            const file = quickPortraitInput.files?.[0];
            if (!file) {
                quickPortrait = "";
                quickPortraitStatus.textContent = "No portrait selected.";
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                quickPortrait = String(reader.result || "");
                quickPortraitStatus.textContent = file.name;
            };
            reader.onerror = () => {
                quickPortrait = "";
                quickPortraitStatus.textContent = "Portrait could not be loaded.";
            };
            reader.readAsDataURL(file);
        };
        document.addEventListener("keydown", handleKeydown);
        setMode("canonical");
        try {
            sources = await loadLateParticipantSources();
            renderResults();
        } catch (error) {
            console.error("Could not load late participant sources:", error);
            results.innerHTML = `<p class="forgeEmptyState">MasterForge records could not be loaded.</p>`;
        }
    }

    async function addLateParticipant() {
        await showLateParticipantDialog();
    }
    async function removeActiveParticipant() { const c = getActiveCombatant(); if (!c || !await showCombatDialog({ title: "Remove Combat Participant?", message: `Remove ${c.name} from this runtime combat? The planned encounter will not be changed.`, confirmLabel: "Remove Participant", danger: true })) return; combatOpsState.combatants.splice(combatOpsState.activeIndex, 1); combatOpsState.activeIndex = Math.max(0, Math.min(combatOpsState.activeIndex, combatOpsState.combatants.length - 1)); saveCombatState(); rerenderCombatOps(); }
    function applySystemCombatValues(target, combatant) {
        const statistics = { ...(target?.systemValues?.statistics || {}) };
        const capabilityRuntime = { ...(target?.systemValues?.capabilityRuntime || {}) };
        [
            ["currentHealth", combatant.hp],
            ["temporaryHealth", combatant.tempHp || 0]
        ].forEach(([role, value]) => {
            const definition = semanticStat(combatant.systemId, role);
            if (definition?.combatWriteBack) statistics[definition.id] = value;
        });
        (combatant.capabilityProfile?.categories || []).filter(category => category.persistentRuntime).forEach(category => {
            capabilityRuntime[category.id] = Object.fromEntries(
                (category.entries || []).filter(entry => entry.runtime).map(entry => [entry.id, { ...entry.runtime }])
            );
        });
        return {
            ...(target?.systemValues || {}),
            systemId: combatant.systemId,
            schemaVersion: combatRules(combatant.systemId).schemaVersion || 1,
            statistics,
            capabilityRuntime
        };
    }
    function applyCanonicalPcFields(target, combatant) {
        const updated = { ...target, currentHP: combatant.hp, temporaryHP: combatant.tempHp || 0, status: combatant.status, systemValues: applySystemCombatValues(target, combatant) };
        if (Array.isArray(target?.conditions)) updated.conditions = [...(combatant.conditions || [])];
        else updated.persistentConditions = [...(combatant.conditions || [])];
        return updated;
    }
    function applyEntityCombatFields(target, combatant) {
        const updated = { ...target, status: combatant.status, systemValues: applySystemCombatValues(target, combatant) };
        if (Array.isArray(target?.conditions)) updated.conditions = [...(combatant.conditions || [])];
        else updated.persistentConditions = [...(combatant.conditions || [])];
        updated.stats = {
            ...(target?.stats || {}),
            currentHp: combatant.hp,
            tempHp: combatant.tempHp || 0
        };
        return updated;
    }
    async function writeBackCombatant(combatant) {
        if (!combatant?.sourceWriteBackEligible || combatant.groupMode || !combatant.sourceId || !["pc", "npc", "creature"].includes(combatant.sourceType)) return false;
        if (combatant.sourceType === "pc") {
            const characters = await window.dmStorage.getCharacters();
            const index = characters.findIndex(character => String(character.id) === String(combatant.sourceId));
            if (index < 0) throw new Error(`Canonical PC not found for ${combatant.name}.`);
            const originalCharacter = characters[index];
            characters[index] = applyCanonicalPcFields(characters[index], combatant);
            await window.dmStorage.saveCharacters(characters);

            const savedCharacters = await window.dmStorage.getCharacters();
            const savedCharacter = savedCharacters.find(character => String(character.id) === String(combatant.sourceId));
            if (!savedCharacter || Number(savedCharacter.currentHP) !== Number(combatant.hp)) {
                throw new Error(`Canonical HP verification failed for ${combatant.name}.`);
            }

            const entity = await window.dmAPI.getEntity("pc", combatant.sourceId);
            if (entity) {
                const data = entity.data_json || {};
                await window.dmAPI.updateEntity("pc", combatant.sourceId, {
                    ...entity,
                    data_json: {
                        ...data,
                        character: {
                            ...(data.character || {}),
                            currentHP: savedCharacter.currentHP,
                            temporaryHP: savedCharacter.temporaryHP || 0,
                            status: savedCharacter.status,
                            systemValues: savedCharacter.systemValues,
                            persistentConditions: [...(savedCharacter.persistentConditions || savedCharacter.conditions || [])]
                        }
                    }
                });
                const savedEntity = await window.dmAPI.getEntity("pc", combatant.sourceId);
                if (Number(savedEntity?.data_json?.character?.currentHP) !== Number(savedCharacter.currentHP)) {
                    throw new Error(`PC entity mirror verification failed for ${combatant.name}.`);
                }
            }
            console.info("[MasterForge Combat] PC write-back verified", {
                runtimeSourceId: combatant.sourceId,
                matchedCharacterId: savedCharacter.id,
                hpBeforeWriteBack: originalCharacter.currentHP,
                runtimeHp: combatant.hp,
                hpAfterSavedReload: savedCharacter.currentHP
            });
            return true;
        }
        const entity = await window.dmAPI.getEntity(combatant.sourceType, combatant.sourceId);
        if (entity) {
            const data = applyEntityCombatFields(entity.data_json || {}, combatant);
            await window.dmAPI.updateEntity(combatant.sourceType, combatant.sourceId, { ...entity, data_json: data });
            return true;
        }
        if (combatant.sourceStore === "record") {
            const collection = `${combatant.sourceType}s`;
            const record = await window.dmAPI.getRecord(combatant.sourceId);
            if (!record) throw new Error(`Canonical ${combatant.sourceType} not found for ${combatant.name}.`);
            await window.dmAPI.saveRecord(collection, combatant.sourceId, applyEntityCombatFields(record, combatant), combatant.sourceScope || "global");
            return true;
        }
        return false;
    }
    async function writeBackCombatState() {
        let persisted = 0;
        for (const combatant of combatOpsState.combatants) {
            if (await writeBackCombatant(combatant)) persisted += 1;
        }
        return persisted;
    }
    async function endCombat() {
        const confirmed = await showCombatDialog({
            title: "End Combat?",
            message: "Current HP, temporary HP, status and persistent conditions will be written back to eligible canonical PCs, NPCs and creatures before runtime combat state is cleared. Grouped combatants, quantity clones, unresolved participants and runtime-only participants will be skipped. The planned encounter will not be changed.",
            confirmLabel: "Write Back and End Combat",
            danger: true
        });
        if (!confirmed) return;
        updateCombatDiagnostic("Writing combat results back to canonical records");
        try {
            const persisted = await writeBackCombatState();
            console.info(`[MasterForge Combat] Wrote back ${persisted} canonical participant${persisted === 1 ? "" : "s"}.`);
            localStorage.removeItem(STORAGE_KEY);
            Object.assign(combatOpsState, freshState());
            document.body.classList.remove("combatOpsMode");
            document.querySelector("#mainLayout")?.classList.remove("is-combat-focus-mode");
            await loadEncounters();
            if (typeof window.renderParty === "function") {
                try {
                    await window.renderParty();
                } catch (error) {
                    console.warn("Combat ended, but Party Manager could not be refreshed:", error);
                }
            }
        } catch (error) {
            console.error("Combat write-back failed:", error);
            combatOpsState.error = `Combat could not be ended safely: ${error?.message || "Write-back failed."}`;
            updateCombatDiagnostic("Combat write-back failed; runtime state was retained.", "error");
            rerenderCombatOps();
        }
    }

    function wireCombatOpsControls() {
        document.querySelector("#combatOpsRefreshBtn")?.addEventListener("click", loadEncounters);
        document.querySelector("#combatOpsChooseEncounterBtn")?.addEventListener("click", () => { combatOpsState.mode = "selection"; rerenderCombatOps(); if (!combatOpsState.encounters.length) loadEncounters(); });
        document.querySelector("#toggleCombatOpsModeBtn")?.addEventListener("click", () => {
            const content = document.querySelector("#content");
            const entering = !document.body.classList.contains("combatOpsMode");
            if (entering) focusModeScrollPosition = content?.scrollTop || 0;
            document.body.classList.toggle("combatOpsMode", entering);
            document.querySelector("#mainLayout")?.classList.toggle("is-combat-focus-mode", entering);
            rerenderCombatOps();
            requestAnimationFrame(() => {
                if (content) content.scrollTop = focusModeScrollPosition;
            });
        });
        document.querySelector("#combatOpsSetInitiativeBtn")?.addEventListener("click", () => { combatOpsState.mode = "initiative"; rerenderCombatOps(); });
        document.querySelector("#combatOpsCancelInitiativeBtn")?.addEventListener("click", () => { combatOpsState.mode = "setup"; rerenderCombatOps(); });
        document.querySelector("#combatOpsStartCombatBtn")?.addEventListener("click", startCombat);
        document.querySelector("#combatOpsNextTurnBtn")?.addEventListener("click", () => nextTurn(1)); document.querySelector("#combatOpsPreviousTurnBtn")?.addEventListener("click", () => nextTurn(-1));
        document.querySelector("#combatOpsEndBtn")?.addEventListener("click", endCombat);
        document.querySelectorAll(".combatOpsReadinessInput").forEach(input => input.addEventListener("change", () => { const c = combatOpsState.combatants[Number(input.dataset.combatantIndex)]; if (!c) return; c[input.dataset.readinessField] = input.value === "" ? null : Number(input.value); saveCombatState(); rerenderCombatOps(); }));
        document.querySelectorAll(".combatOpsInitiativeCard").forEach(card => card.onclick = () => { combatOpsState.activeIndex = Number(card.dataset.combatantIndex); saveCombatState(); rerenderCombatOps(); });
        document.querySelectorAll(".combatOpsDamageBtn").forEach(button => button.onclick = () => adjustHp(-Number(button.dataset.amount))); document.querySelectorAll(".combatOpsHealBtn").forEach(button => button.onclick = () => adjustHp(Number(button.dataset.amount)));
        document.querySelectorAll("[data-capability-action]").forEach(button => button.onclick = () => {
            const entry = button.closest("[data-capability-id]");
            const section = button.closest(".combatCapabilitySection");
            if (entry && section) updateCapabilityRuntime(section.id.replace("combat-capability-", ""), entry.dataset.capabilityId, button.dataset.capabilityAction);
        });
        document.querySelectorAll("[data-resource-action]").forEach(button => button.onclick = () => {
            const resource = button.closest("[data-capability-resource]");
            const key = button.closest("[data-resource-key]")?.dataset.resourceKey || "";
            updateCapabilityResource(resource?.dataset.capabilityResource, key, button.dataset.resourceAction === "increment" ? 1 : -1);
        });
        document.querySelector(".combatOpsRevealBtn")?.addEventListener("click", () => { getActiveCombatant().hidden = false; saveCombatState(); rerenderCombatOps(); });
        const bindNumber = (selector, field, minimum = -Infinity) => document.querySelector(selector)?.addEventListener("change", event => { const c = getActiveCombatant(); c[field] = event.currentTarget.value === "" ? null : Math.max(minimum, Number(event.currentTarget.value)); if (field === "maxHp" && c.hp != null && c.maxHp != null) c.hp = Math.min(c.hp, c.maxHp); saveCombatState(); rerenderCombatOps(); });
        bindNumber("#combatOpsHpInput", "hp", 0); bindNumber("#combatOpsMaxHpInput", "maxHp", 1); bindNumber("#combatOpsTempHpInput", "tempHp", 0); bindNumber("#combatOpsAcInput", "ac");
        document.querySelector("#combatOpsStatusInput")?.addEventListener("change", event => { const c = getActiveCombatant(); if (event.currentTarget.value === "Active" && Number(c.hp) <= 0) { event.currentTarget.value = c.status; return; } c.status = event.currentTarget.value; saveCombatState(); });
        document.querySelector("#combatOpsNotesInput")?.addEventListener("change", event => { getActiveCombatant().notes = event.currentTarget.value; saveCombatState(); });
    }

    async function open() {
        restoreCombatState();
        rerenderCombatOps();
        updateCombatDiagnostic("Combat module initialised");
        await Promise.all([loadEncounters(), refreshMissingSourceReferences()]);
        rerenderCombatOps();
    }
    restoreCombatState();
    window.MasterForgeCombatOps = { open, render: renderCombatOperationsCentre, wire: wireCombatOpsControls, state: combatOpsState, startCombat, nextTurn, adjustHp, resolveHitPointAdjustment, formatSourceReference, refreshMissingSourceReferences, addCondition, removeCondition, setActiveStatus, addLateParticipant, removeActiveParticipant, endCombat, getActiveCombatant, getActiveReferenceDestinations, navigateActiveReference, isCombatantReady };
    initialiseCombatOps();
})();
