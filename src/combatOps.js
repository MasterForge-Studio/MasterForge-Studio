console.log("combatOps.js loaded");

(function () {
    const STORAGE_KEY = "masterforge.combatOperations.v1";
    const freshState = () => ({ mode: "selection", round: 1, activeIndex: 0, encounterId: "", encounterName: "", combatants: [], encounters: [], deploymentStrategies: {}, deploymentWarnings: [], diagnostic: "Combat module initialised", diagnosticHistory: ["Combat module initialised"], loading: false, error: "" });
    const combatOpsState = freshState();
    let encounterLoadInProgress = false;
    let pendingDeploymentChoice = null;
    let pendingCombatDialog = null;
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
    function portraitOf(source = {}) { source = source || {}; return source.image?.portrait || source.image?.token || source.portrait || source.token || ""; }
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
            return stored.map(record => ({ ...record, _combatCanonicalStore: "characters" }));
        }
        if (["npc", "creature"].includes(type)) {
            const entities = window.dmAPI?.getEntitiesByType ? (await window.dmAPI.getEntitiesByType(type)) || [] : [];
            const collection = `${type}s`;
            const records = window.dmAPI?.getAllRecordsInCollection ? (await window.dmAPI.getAllRecordsInCollection(collection)) || [] : [];
            const seen = new Set();
            return [
                ...entities.map(record => ({ ...record, _combatCanonicalStore: "entity" })),
                ...records.map(record => ({ ...record, _combatCanonicalStore: "record" }))
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
    function makeSnapshot(participant, source, runtimeId, name) {
        const type = participant.sourceType;
        const sourceData = source?.data_json || {};
        const characterData = sourceData.character || {};
        const canonical = { ...sourceData, ...characterData, ...(source || {}) };
        const stats = { ...(sourceData.stats || {}), ...(canonical.stats || {}) };
        const abilities = type === "pc" ? (canonical.abilities || sourceData.abilities || {}) : (canonical.abilities || stats);
        const maxHp = type === "pc" ? firstFinite(canonical.maxHP, canonical.maxHp, stats.maxHp, stats.hp) : firstFinite(canonical.maxHP, canonical.maxHp, stats.maxHp, stats.maximumHp, parseStatNumber(stats.hp));
        const currentHp = firstFinite(canonical.currentHP, canonical.currentHp, stats.currentHP, stats.currentHp, maxHp);
        const ac = firstFinite(canonical.ac, parseStatNumber(stats.ac), canonical.armourClass, canonical.armorClass);
        const persistentConditions = normaliseEntries(canonical.persistentConditions || canonical.conditions).filter(value => typeof value === "string" && value.trim());
        return {
            id: runtimeId, sourceParticipantId: String(participant.id || ""), sourceType: type, sourceId: String(source?.id || participant.sourceId || ""), sourceEntityId: String(source?.entityId || source?.id || participant.sourceId || ""), sourceStore: source?._combatCanonicalStore || "", sourceScope: String(source?.scope || "global"), sourceWriteBackEligible: Boolean(source?.id), sourceDisplayName: canonical.name || participant.displayName || "Combatant", importedAt: new Date().toISOString(), snapshotVersion: 2,
            name: name || canonical.name || participant.displayName || "Combatant", subtitle: participant.subtitle || [canonical.size, canonical.type || canonical.species, canonical.class].filter(Boolean).join(" ") || type,
            portrait: portraitOf(canonical), systemId: canonical.systemId || "", level: canonical.level ?? null, cr: canonical.cr || "", className: canonical.class || "", subtype: canonical.species || canonical.subtype || "", size: canonical.size || "", creatureType: canonical.type || "", alignment: canonical.alignment || "",
            initiative: participant.initiativeOverride ?? "", initiativeModifier: abilityModifier(abilities.dex), proficiencyBonus: canonical.proficiencyBonus || "", ac, hp: currentHp, maxHp, tempHp: firstFinite(canonical.temporaryHP, canonical.temporaryHp, canonical.tempHP, canonical.tempHp, stats.tempHp, 0), speed: canonical.speed || stats.speed || "",
            abilities: Object.fromEntries(["str","dex","con","int","wis","cha"].map(key => [key, firstFinite(abilities[key])])), savingThrows: canonical.savingThrows || "", skills: sourceSkills(canonical), senses: canonical.senses || "", languages: canonical.languages || "", passivePerception: firstFinite(canonical.passivePerception), passiveInvestigation: firstFinite(canonical.passiveInvestigation), passiveInsight: firstFinite(canonical.passiveInsight),
            damageVulnerabilities: canonical.damageVulnerabilities || stats.damageVulnerabilities || "", damageResistances: canonical.damageResistances || stats.damageResistances || "", damageImmunities: canonical.damageImmunities || stats.damageImmunities || "", conditionImmunities: canonical.conditionImmunities || stats.conditionImmunities || "",
            traits: normaliseEntries(canonical.traits), actions: normaliseEntries(canonical.actions), bonusActions: normaliseEntries(canonical.bonusActions), reactions: normaliseEntries(canonical.reactions), legendaryActions: normaliseEntries(canonical.legendaryActions), spellcasting: normaliseEntries(canonical.spellcasting || canonical.spells), equipment: normaliseEntries(canonical.equipment),
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
            return members.map(member => makeSnapshot({ ...participant, sourceType: "pc", sourceId: member.id }, member, `${participant.id}-pc-${member.id}`, member.name));
        }
        const resolved = await getCanonicalSource(participant.sourceType, participant);
        const source = resolved.source;
        if (!source) combatOpsState.deploymentWarnings.push(`${participant.displayName || "Combatant"}: ${resolved.resolution}; references preserved: ${canonicalIds(participant).join(", ") || "none"}.`);
        const quantity = participant.sourceType === "creature" ? Math.max(1, Number(participant.quantity || 1)) : 1;
        const strategy = await chooseQuantityDeployment(participant, quantity);
        if (strategy === "individual") return Array.from({ length: quantity }, (_, memberIndex) => {
            const snapshot = makeSnapshot(participant, source, quantity > 1 ? `${participant.id}-${memberIndex + 1}` : String(participant.id || `participant-${index}`), quantity > 1 ? `${source?.name || participant.displayName || "Combatant"} ${memberIndex + 1}` : undefined);
            if (quantity > 1) snapshot.sourceWriteBackEligible = false;
            return snapshot;
        });
        const snapshot = makeSnapshot(participant, source, String(participant.id || `participant-${index}`));
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
        return `<div class="combatOpsShell"><div class="combatOpsTopBar"><div><h2>Combat Readiness</h2><p>${esc(combatOpsState.encounterName)} · initiative, AC and HP are required. Start Combat is available in Actions.</p></div><div class="combatOpsTurnButtons"><button id="combatOpsCancelInitiativeBtn">Back</button></div></div>${combatOpsState.deploymentWarnings.length ? `<div class="combatOpsReadinessWarnings">${combatOpsState.deploymentWarnings.map(esc).join("<br>")}</div>` : ""}<div class="combatOpsInitiativeSetupList">${combatOpsState.combatants.map((c, index) => { const missing = [c.ac == null ? "AC" : "", c.hp == null || c.maxHp == null ? "HP" : ""].filter(Boolean); return `<div class="combatOpsInitiativeSetupItem ${missing.length ? "is-incomplete" : ""}"><div class="combatOpsReadinessIdentity">${renderPortrait(c)}<div><strong>${esc(c.hidden ? "Hidden Enemy" : c.name)}</strong><span>${renderTypeBadge(c)}${renderGroupBadge(c)} ${esc(c.subtitle)}</span>${renderConditionBadges(c)}${missing.length ? `<em>Missing ${esc(missing.join(" and "))}</em>` : `<em>${esc(c.status || "Active")}</em>`}</div></div><label>AC<input class="combatOpsReadinessInput" data-readiness-field="ac" data-combatant-index="${index}" type="number" value="${c.ac ?? ""}" placeholder="Not set"></label><label>Current HP<input class="combatOpsReadinessInput" data-readiness-field="hp" data-combatant-index="${index}" type="number" min="0" value="${c.hp ?? ""}" placeholder="Not set"></label><label>Max HP<input class="combatOpsReadinessInput" data-readiness-field="maxHp" data-combatant-index="${index}" type="number" min="1" value="${c.maxHp ?? ""}" placeholder="Not set"></label><label>Initiative<input class="combatOpsInitiativeInput" data-combatant-index="${index}" type="number" value="${esc(c.initiative ?? "")}" placeholder="Init"></label></div>`; }).join("")}</div></div>`;
    }

    function combatTypeLabel(type = "") { return ({ pc: "PC", npc: "NPC", creature: "Creature", vehicle: "Vehicle", ship: "Vehicle", party: "Party", party_group: "Party Group" })[type] || "Combatant"; }
    function renderTypeBadge(c) { return `<span class="combatTypeBadge combatTypeBadge--${esc(c.sourceType || "other")}">${esc(combatTypeLabel(c.sourceType))}</span>`; }
    function renderGroupBadge(c) { return c.groupQuantity ? `<span class="combatGroupBadge">Group ×${esc(c.groupQuantity)}</span>` : ""; }
    function renderConditionBadges(c) { return c.conditions?.length ? `<span class="combatConditionBadges">${c.conditions.map(condition => `<span>${esc(condition)}</span>`).join("")}</span>` : ""; }
    function renderPortrait(c, className = "") { return c.portrait ? `<img class="combatOpsPortraitImage ${className}" src="${esc(c.portrait)}" alt="">` : `<div class="combatOpsPortrait combatOpsPortraitFallback ${className}" aria-label="No participant image">◆</div>`; }

    function renderInitiativeCard(c, index) {
        const percent = c.maxHp ? Math.max(0, Math.min(100, c.hp / c.maxHp * 100)) : 0;
        return `<button class="combatOpsInitiativeCard ${index === combatOpsState.activeIndex ? "active" : ""} ${c.hidden ? "hiddenCombatant" : ""}" data-combatant-index="${index}">${renderPortrait(c)}<div class="combatOpsInitName">${esc(c.hidden ? "Hidden Enemy" : c.name)}</div><div class="combatOpsCardBadges">${renderTypeBadge(c)}${renderGroupBadge(c)}</div>${c.hp != null && c.maxHp ? `<div class="combatOpsHpMini"><span style="width:${percent}%"></span></div>` : ""}${renderConditionBadges(c)}<div class="combatOpsInitMeta"><span>HP ${c.hp == null || c.maxHp == null ? "Not set" : esc(`${c.hp}/${c.maxHp}`)}</span><span>${esc(c.status || "Active")}</span><span>Init ${esc(c.initiative || "—")}</span></div></button>`;
    }

    function renderReferenceValue(title, value) { return value ? `<section class="combatStatReference"><h3>${esc(title)}</h3><p>${esc(value)}</p></section>` : ""; }
    function renderReferenceEntries(title, entries) { return entries?.length ? `<section class="combatStatReference"><h3>${esc(title)}</h3>${entries.map(entry => {
        if (typeof entry === "string") return `<p>${esc(entry)}</p>`;
        const details = [entry.attackType || entry.type, entry.attackBonus !== null && entry.attackBonus !== undefined && entry.attackBonus !== "" ? `Attack ${entry.attackBonus}` : "", entry.reach || entry.range, entry.target || entry.targets, entry.damage, entry.damageType, entry.saveDC != null ? `Save DC ${entry.saveDC}` : "", entry.recharge, entry.usage].filter(Boolean).join(" · ");
        const description = entry.description || entry.notes || entry.automationNotes || "";
        return `<article><strong>${esc(entry.name || entry.title || title)}</strong>${details ? `<small>${esc(details)}</small>` : ""}${description ? `<p>${esc(description)}</p>` : ""}</article>`;
    }).join("")}</section>` : ""; }
    function renderActiveStatBlock(c) {
        const abilityRow = ["str","dex","con","int","wis","cha"].map(key => { const score = c.abilities?.[key]; const mod = abilityModifier(score); return `<div><strong>${key.toUpperCase()}</strong><span>${score == null ? "—" : `${score} (${mod >= 0 ? "+" : ""}${mod})`}</span></div>`; }).join("");
        return `<div class="statBlockCard combatStatBlock"><header class="combatStatHeader">${renderPortrait(c, "combatStatPortrait")}<div><h1>${esc(c.hidden ? "Hidden Enemy" : c.name)}</h1><div class="combatOpsCardBadges">${renderTypeBadge(c)}${renderGroupBadge(c)}</div>${renderConditionBadges(c)}<p>${esc([c.size, c.creatureType || c.subtype || c.className, c.alignment].filter(Boolean).join(" · ") || c.subtitle)}</p><small>${esc(c.level ? `Level ${c.level}` : c.cr ? `CR ${c.cr}` : combatTypeLabel(c.sourceType))} · ${esc(c.status || "Active")}</small></div></header><div class="combatStatDefence"><div><strong>Armour Class</strong><span>${c.ac ?? "Not set"}</span></div><div><strong>Hit Points</strong><span>${c.hp == null || c.maxHp == null ? "Not set" : `${c.hp} / ${c.maxHp}`}</span></div><div><strong>Speed</strong><span>${esc(c.speed || "Not set")}</span></div></div><div class="combatStatAbilities">${abilityRow}</div><div class="combatStatReferences">${renderReferenceValue("Saving Throws", c.savingThrows)}${renderReferenceValue("Skills", typeof c.skills === "string" ? c.skills : "")}${renderReferenceValue("Passive Scores", [c.passivePerception != null ? `Perception ${c.passivePerception}` : "", c.passiveInvestigation != null ? `Investigation ${c.passiveInvestigation}` : "", c.passiveInsight != null ? `Insight ${c.passiveInsight}` : ""].filter(Boolean).join(" · "))}${renderReferenceValue("Damage Vulnerabilities", c.damageVulnerabilities)}${renderReferenceValue("Damage Resistances", c.damageResistances)}${renderReferenceValue("Damage Immunities", c.damageImmunities)}${renderReferenceValue("Condition Immunities", c.conditionImmunities)}${renderReferenceValue("Senses", c.senses)}${renderReferenceValue("Languages", c.languages)}${renderReferenceValue("Challenge / Proficiency Bonus", [c.cr ? `CR ${c.cr}` : "", c.proficiencyBonus ? `PB ${c.proficiencyBonus}` : ""].filter(Boolean).join(" · "))}${renderReferenceEntries("Traits", c.traits)}${renderReferenceEntries("Actions", c.actions)}${renderReferenceEntries("Bonus Actions", c.bonusActions)}${renderReferenceEntries("Reactions", c.reactions)}${renderReferenceEntries("Legendary Actions", c.legendaryActions)}${renderReferenceEntries("Spellcasting", c.spellcasting)}${renderReferenceEntries("Equipment", c.equipment)}${renderReferenceValue("Notes", c.notes)}</div>${c.hidden ? `<button class="combatOpsRevealBtn">Reveal Combatant</button>` : ""}</div>`;
    }

    function renderTrackingPanel(c) {
        return `<div class="combatOpsPanel"><h3>HP / Conditions / Tracking</h3><label>Current HP<input id="combatOpsHpInput" type="number" value="${c.hp ?? ""}" placeholder="Not set"></label><label>Maximum HP<input id="combatOpsMaxHpInput" type="number" min="1" value="${c.maxHp ?? ""}" placeholder="Not set"></label><label>Temporary HP<input id="combatOpsTempHpInput" type="number" min="0" value="${esc(c.tempHp || 0)}"></label><label>Armour Class<input id="combatOpsAcInput" type="number" value="${c.ac ?? ""}" placeholder="Not set"></label><label>Conditions</label><div class="combatOpsConditionList">${(c.conditions || []).length ? c.conditions.map(condition => `<span>${esc(condition)}</span>`).join("") : `<em>None</em>`}</div><label>Status<select id="combatOpsStatusInput">${["Active", "Unconscious", "Defeated", "Dead", "Fled"].map(status => `<option ${c.status === status ? "selected" : ""}>${status}</option>`).join("")}</select></label><label>Notes<textarea id="combatOpsNotesInput">${esc(c.notes || "")}</textarea></label></div>`;
    }

    function renderCombatOperationsCentre() {
        if (combatOpsState.mode === "selection" || !combatOpsState.combatants.length) return renderEncounterSelection();
        if (combatOpsState.mode === "initiative") return renderInitiativeSetup();
        const active = getActiveCombatant();
        return `<div class="combatOpsShell"><div class="combatOpsTopBar"><div><h2>Combat Operations Centre</h2><p>${esc(combatOpsState.encounterName)} · ${combatOpsState.mode === "active" ? `Round ${combatOpsState.round} · ${active.name} is active` : "Encounter loaded · Set initiative when ready"}</p></div><div class="combatOpsTurnButtons"><button id="combatOpsChooseEncounterBtn">Encounters</button><button id="toggleCombatOpsModeBtn">${document.body.classList.contains("combatOpsMode") ? "Exit Focus" : "Focus Mode"}</button>${combatOpsState.mode === "setup" ? `<button id="combatOpsSetInitiativeBtn" class="primaryBtn">Set Initiative</button>` : ""}</div></div><div class="combatOpsInitiativeRibbon">${combatOpsState.combatants.map(renderInitiativeCard).join("")}</div><div class="combatOpsWorkspace"><section class="combatOpsStatBlock">${renderActiveStatBlock(active)}</section><aside class="combatOpsTracker">${renderTrackingPanel(active)}</aside></div></div>`;
    }

    function rerenderCombatOps() { const container = getContainer(); if (!container) return; container.innerHTML = `${combatOpsState.error ? `<p class="combatOpsLoadError" role="alert">${esc(combatOpsState.error)}</p>` : ""}${renderCombatOperationsCentre()}`; container.querySelector(".combatOpsTopBar")?.insertAdjacentHTML("afterend", `<p class="combatOpsDiagnostic" data-combat-diagnostic data-status="info" aria-live="polite">${esc(combatOpsState.diagnostic || "Combat module initialised")}</p>`); wireCombatOpsControls(); window.MasterForgeActionConsole?.refresh(); }
    function updateInitiativeValuesFromInputs() { document.querySelectorAll(".combatOpsInitiativeInput").forEach(input => { const c = combatOpsState.combatants[Number(input.dataset.combatantIndex)]; if (c) c.initiative = input.value === "" ? "" : Number(input.value); }); }
    function sortCombatantsByInitiative() { combatOpsState.combatants.sort((a,b) => Number(b.initiative || 0) - Number(a.initiative || 0) || (a.name || "").localeCompare(b.name || "")); }
    function isCombatantReady(c) { return c && c.ac != null && c.hp != null && c.maxHp != null && c.maxHp > 0; }
    async function startCombat() { updateInitiativeValuesFromInputs(); const incomplete = combatOpsState.combatants.filter(c => !isCombatantReady(c)); if (incomplete.length) { await showCombatDialog({ title: "Combatants Not Ready", message: `Complete AC and HP for: ${incomplete.map(c => c.name).join(", ")}.`, confirmLabel: "Return to Readiness", cancelLabel: "Close" }); return; } sortCombatantsByInitiative(); combatOpsState.mode = "active"; combatOpsState.round = 1; combatOpsState.activeIndex = 0; saveCombatState(); rerenderCombatOps(); }
    function nextTurn(delta = 1) { if (!combatOpsState.combatants.length) return; combatOpsState.activeIndex += delta; if (combatOpsState.activeIndex >= combatOpsState.combatants.length) { combatOpsState.activeIndex = 0; combatOpsState.round++; } else if (combatOpsState.activeIndex < 0) { combatOpsState.activeIndex = combatOpsState.combatants.length - 1; combatOpsState.round = Math.max(1, combatOpsState.round - 1); } saveCombatState(); rerenderCombatOps(); }
    function adjustHp(amount) { const c = getActiveCombatant(); if (!c || c.hp == null || c.maxHp == null) return; const delta = Number(amount); c.hp = Math.max(0, Math.min(c.maxHp, c.hp + delta)); if (c.groupMode === "individual-counters" && Array.isArray(c.memberHp)) { let remaining = Math.abs(delta); if (delta < 0) { for (let i = c.memberHp.length - 1; i >= 0 && remaining > 0; i--) { const applied = Math.min(c.memberHp[i], remaining); c.memberHp[i] -= applied; remaining -= applied; } } else { for (let i = 0; i < c.memberHp.length && remaining > 0; i++) { const capacity = Math.max(0, c.standardMemberHp - c.memberHp[i]); const applied = Math.min(capacity, remaining); c.memberHp[i] += applied; remaining -= applied; } } c.groupQuantity = c.memberHp.filter(value => value > 0).length; } if (c.hp === 0 && c.status === "Active") c.status = "Unconscious"; else if (delta > 0 && c.hp > 0 && c.status === "Unconscious") c.status = "Active"; saveCombatState(); rerenderCombatOps(); }
    async function addCondition() {
        const c = getActiveCombatant();
        if (!c) return;
        const registered = window.MasterForgeGameSystems?.getCurrent?.()?.conditions || [];
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
    async function addLateParticipant() { const name = await showCombatDialog({ title: "Add Late Participant", message: "This participant exists only in the current combat and will not write back to a canonical record.", confirmLabel: "Add Participant", input: { label: "Participant name", placeholder: "Name" } }); if (!name) return; combatOpsState.combatants.push({ id: `late-${Date.now()}`, sourceParticipantId: "", sourceType: "other", sourceId: "", sourceEntityId: "", sourceDisplayName: name, sourceWriteBackEligible: false, importedAt: new Date().toISOString(), snapshotVersion: 2, name, subtitle: "Late participant", portrait: "", initiative: "", ac: null, hp: null, maxHp: null, tempHp: 0, abilities: {}, conditions: [], hidden: false, status: "Active", notes: "", traits: [], actions: [], bonusActions: [], reactions: [], legendaryActions: [], spellcasting: [], equipment: [] }); saveCombatState(); rerenderCombatOps(); }
    async function removeActiveParticipant() { const c = getActiveCombatant(); if (!c || !await showCombatDialog({ title: "Remove Combat Participant?", message: `Remove ${c.name} from this runtime combat? The planned encounter will not be changed.`, confirmLabel: "Remove Participant", danger: true })) return; combatOpsState.combatants.splice(combatOpsState.activeIndex, 1); combatOpsState.activeIndex = Math.max(0, Math.min(combatOpsState.activeIndex, combatOpsState.combatants.length - 1)); saveCombatState(); rerenderCombatOps(); }
    function applyCanonicalPcFields(target, combatant) {
        const updated = { ...target, currentHP: combatant.hp, temporaryHP: combatant.tempHp || 0, status: combatant.status };
        if (Array.isArray(target?.conditions)) updated.conditions = [...(combatant.conditions || [])];
        else updated.persistentConditions = [...(combatant.conditions || [])];
        return updated;
    }
    function applyEntityCombatFields(target, combatant) {
        const updated = { ...target, status: combatant.status };
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
        document.querySelector("#toggleCombatOpsModeBtn")?.addEventListener("click", () => { document.body.classList.toggle("combatOpsMode"); rerenderCombatOps(); });
        document.querySelector("#combatOpsSetInitiativeBtn")?.addEventListener("click", () => { combatOpsState.mode = "initiative"; rerenderCombatOps(); });
        document.querySelector("#combatOpsCancelInitiativeBtn")?.addEventListener("click", () => { combatOpsState.mode = "setup"; rerenderCombatOps(); });
        document.querySelector("#combatOpsStartCombatBtn")?.addEventListener("click", startCombat);
        document.querySelector("#combatOpsNextTurnBtn")?.addEventListener("click", () => nextTurn(1)); document.querySelector("#combatOpsPreviousTurnBtn")?.addEventListener("click", () => nextTurn(-1));
        document.querySelector("#combatOpsEndBtn")?.addEventListener("click", endCombat);
        document.querySelectorAll(".combatOpsReadinessInput").forEach(input => input.addEventListener("change", () => { const c = combatOpsState.combatants[Number(input.dataset.combatantIndex)]; if (!c) return; c[input.dataset.readinessField] = input.value === "" ? null : Number(input.value); saveCombatState(); rerenderCombatOps(); }));
        document.querySelectorAll(".combatOpsInitiativeCard").forEach(card => card.onclick = () => { combatOpsState.activeIndex = Number(card.dataset.combatantIndex); saveCombatState(); rerenderCombatOps(); });
        document.querySelectorAll(".combatOpsDamageBtn").forEach(button => button.onclick = () => adjustHp(-Number(button.dataset.amount))); document.querySelectorAll(".combatOpsHealBtn").forEach(button => button.onclick = () => adjustHp(Number(button.dataset.amount)));
        document.querySelector(".combatOpsRevealBtn")?.addEventListener("click", () => { getActiveCombatant().hidden = false; saveCombatState(); rerenderCombatOps(); });
        const bindNumber = (selector, field, minimum = -Infinity) => document.querySelector(selector)?.addEventListener("change", event => { const c = getActiveCombatant(); c[field] = event.currentTarget.value === "" ? null : Math.max(minimum, Number(event.currentTarget.value)); if (field === "maxHp" && c.hp != null && c.maxHp != null) c.hp = Math.min(c.hp, c.maxHp); saveCombatState(); rerenderCombatOps(); });
        bindNumber("#combatOpsHpInput", "hp", 0); bindNumber("#combatOpsMaxHpInput", "maxHp", 1); bindNumber("#combatOpsTempHpInput", "tempHp", 0); bindNumber("#combatOpsAcInput", "ac");
        document.querySelector("#combatOpsStatusInput")?.addEventListener("change", event => { const c = getActiveCombatant(); if (event.currentTarget.value === "Active" && Number(c.hp) <= 0) { event.currentTarget.value = c.status; return; } c.status = event.currentTarget.value; saveCombatState(); });
        document.querySelector("#combatOpsNotesInput")?.addEventListener("change", event => { getActiveCombatant().notes = event.currentTarget.value; saveCombatState(); });
    }

    async function open() { restoreCombatState(); rerenderCombatOps(); updateCombatDiagnostic("Combat module initialised"); await loadEncounters(); }
    restoreCombatState();
    window.MasterForgeCombatOps = { open, render: renderCombatOperationsCentre, wire: wireCombatOpsControls, state: combatOpsState, startCombat, nextTurn, adjustHp, addCondition, removeCondition, setActiveStatus, addLateParticipant, removeActiveParticipant, endCombat, getActiveCombatant, isCombatantReady };
    initialiseCombatOps();
})();
