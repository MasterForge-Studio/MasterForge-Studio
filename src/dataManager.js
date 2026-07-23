window.dmStorage = {
  async initialise() {
    const structure = {
      
      "rules/species.json": [
  "Aasimar",
  "Dragonborn",
  "Dwarf",
  "Elf",
  "Gnome",
  "Goliath",
  "Halfling",
  "Human",
  "Orc",
  "Tiefling",
  "Legacy / Homebrew"
],

"rules/classes.json": [
  "Barbarian",
  "Bard",
  "Cleric",
  "Druid",
  "Fighter",
  "Monk",
  "Paladin",
  "Ranger",
  "Rogue",
  "Sorcerer",
  "Warlock",
  "Wizard",
  "Multiclass / Homebrew"
]
    };
      
    for (const file in structure) {
      const existing = await window.dmAPI.readJson(file, null);

      if (!existing) {
        await window.dmAPI.writeJson(file, structure[file]);
      }
    }
  },
  async ensureCampaign(campaignName) {

    const base =
      `campaigns/${campaignName}`;


    const campaign =
      await window.dmAPI.readJson(
        `${base}/campaign.json`,
        null
      );


    if (!campaign) {

      await window.dmAPI.writeJson(
        `${base}/campaign.json`,
        {
          name: campaignName,
          world: window.dmState.current.world,
          location: window.dmState.current.location,
          region: window.dmState.current.region,
          created: new Date().toISOString()
        }
      );


      await window.dmAPI.writeJson(
        `${base}/party.json`,
        {
          characters:[]
        }
      );


      await window.dmAPI.writeJson(
        `${base}/scripts/session-one.json`,
        {
          id:"session-one",

          title:"Session One",

          readAloud:
`Your adventure begins...`,

          notes:
`Add GM Notes here`
        }
      );

    }

},

  slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  },

  getCurrentCampaignFolder() {
    return `campaigns/${window.dmState.current.campaign}`;
  },

  async listScripts() {
    const folder = `${this.getCurrentCampaignFolder()}/scripts`;
    return await window.dmAPI.listJson(folder);
  },

  async loadScript(fileName) {
    return await window.dmAPI.readJson(
      `${this.getCurrentCampaignFolder()}/scripts/${fileName}`,
      null
    );
  },

  async saveScript(script) {
    const id = script.id || this.slugify(script.title || "untitled-script");
    script.id = id;

    await window.dmAPI.writeJson(
      `${this.getCurrentCampaignFolder()}/scripts/${id}.json`,
      script
    );

    return script;
  },

  async deleteScript(fileName) {
    // Delete comes later. For now we avoid adding destructive file actions.
    alert("Delete file support will be added after the save/load flow is tested.");
  }
  ,

async getPlayers(){

 const dbPlayers =
 await this.getDbRecords(
   "players"
 );

 if(dbPlayers.length){
   return dbPlayers;
 }


 const jsonPlayers =
 await window.dmAPI.readJson(
   "players/index.json",
   []
 );


 for(const player of jsonPlayers){

   await this.saveDbRecord(
     "players",
     player.id,
     player
   );

 }


 return jsonPlayers;

},


async savePlayers(players){

 for(const player of players){

   await this.saveDbRecord(
     "players",
     player.id,
     player
   );

 }


 await window.dmAPI.writeJson(
   "players/index.json",
   players
 );

},


async getCharacters(){

 const dbChars =
 await this.getDbRecords(
   "characters"
 );


 if(dbChars.length){
   return dbChars;
 }


 const jsonChars =
 await window.dmAPI.readJson(
   "characters/index.json",
   []
 );


 for(const char of jsonChars){

   await this.saveDbRecord(
     "characters",
     char.id,
     char
   );

 }


 return jsonChars;

},


async saveCharacters(chars){

 for(const char of chars){

   await this.saveDbRecord(
     "characters",
     char.id,
     char
   );

 }


 await window.dmAPI.writeJson(
   "characters/index.json",
   chars
 );

},


async getCampaignParty(){

 return await window.dmAPI.readJson(
   `${this.getCurrentCampaignFolder()}/party.json`,
   {characters:[]}
 );

},


async saveCampaignParty(party){

 await window.dmAPI.writeJson(
   `${this.getCurrentCampaignFolder()}/party.json`,
   party
 );

},

async getSpeciesList() {
  return await window.dmAPI.readJson(
    "rules/species.json",
    []
  );
},

async getClassList() {
  return await window.dmAPI.readJson(
    "rules/classes.json",
    []
  );
},

async getSavedNpcs(){

 const dbNpcs =
 await this.getDbRecords(
   "npcs",
   window.dmState.current.campaign
 );


 if(dbNpcs.length){
   return dbNpcs;
 }


 const jsonNpcs =
 await window.dmAPI.readJson(
   "npcs/index.json",
   []
 );


 for(const npc of jsonNpcs){

   await this.saveDbRecord(
     "npcs",
     npc.id,
     npc,
     window.dmState.current.campaign
   );

 }


 return jsonNpcs;

},

async saveSavedNpcs(npcs){

 for(const npc of npcs){

   await this.saveDbRecord(
     "npcs",
     npc.id,
     npc,
     window.dmState.current.campaign
   );

 }

 await window.dmAPI.writeJson(
   "npcs/index.json",
   npcs
 );

},

async getFactions() {
  const dbFactions = await this.getDbRecords("factions");

  if (dbFactions.length) {
    return dbFactions;
  }

  const jsonFactions = await window.dmAPI.readJson(
    "factions/index.json",
    []
  );

  for (const faction of jsonFactions) {
    await this.saveDbRecord(
      "factions",
      faction.id,
      faction
    );
  }

  return jsonFactions;
},

async saveFactions(factions) {
  for (const faction of factions) {
    await this.saveDbRecord(
      "factions",
      faction.id,
      faction
    );
  }

  await window.dmAPI.writeJson(
    "factions/index.json",
    factions
  );
},

async saveDbRecord(collection, id, data, scope = "global") {
  if (!window.dmAPI.saveRecord) return false;
  return await window.dmAPI.saveRecord(collection, id, data, scope);
},

async getDbRecords(collection, scope = "global") {
  if (!window.dmAPI.getRecords) return [];
  return await window.dmAPI.getRecords(collection, scope);
},

async getWorldNotes(){

 return await this.getDbRecords(
   "world-notes",
   window.dmState.current.world
 );

},


async saveWorldNotes(notes){

 for(const note of notes){

   await this.saveDbRecord(
     "world-notes",
     note.id,
     note,
     window.dmState.current.world
   );

 }

},

async deleteDbRecord(id) {
  if (!window.dmAPI.deleteRecord) return false;
  return await window.dmAPI.deleteRecord(id);
}

};