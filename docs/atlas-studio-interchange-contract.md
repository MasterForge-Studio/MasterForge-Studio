# MasterForge Atlas ↔ MasterForge Studio interchange contract

Status: architecture proposal only. No schema, migration, importer, exporter, or UI is implemented by this document.

## 1. Executive architecture

MasterForge Atlas is the authority for durable geographic and ecological facts. MasterForge Studio is the authority for campaign mechanics, private campaign lore, runtime state, and live-session use. Neither application is a runtime dependency of the other. Interchange uses self-contained, versioned JSON packages and optional packaged assets.

The boundary is deliberately asymmetric at first:

1. Atlas selects entities and traverses a bounded dependency graph.
2. Atlas emits an immutable snapshot package.
3. Studio validates the complete package before writing anything.
4. Studio maps imported content into its existing canonical records/entities and URE relationships.
5. Studio retains Atlas provenance so later imports update the same local objects without relying on names or slugs.

Geometry remains Atlas-owned. Studio receives stable geographic references and useful summaries by default, not a copy of every boundary.

## 2. Existing MasterForge Studio audit

### Storage and identifiers

Studio has two overlapping stores in `src/database.js`:

- `records`: globally unique text `id`, `collection`, string `scope`, extensible `data_json`, and timestamps.
- `entities`: composite primary key `(entity_type, id)`, name/description, extensible `data_json`, optional `source_pack`, persistence flag, and timestamps.
- `relationships`: text `id`, typed source and target endpoints, relationship key, numeric strength, notes, extensible `data_json`, timestamps, and cascading foreign keys to `entities`.
- `assets`: text `id`, entity endpoint, asset type, local file path, name, and timestamps.
- `installed_packs`: basic installed content-pack identity and version.

The composite entity reference `{ entityType, entityId }` is already suitable for local URE links. It is not sufficient as external identity because a local ID may be renamed, regenerated, or collide across Atlas workspaces.

### Canonical and source handling

`src/entities/canonical-entity-resolver.js` already distinguishes lightweight URE mirrors from canonical records:

- NPC mirrors resolve through `data_json.npcId` or `sourceCollection/sourceId` to `records:npcs`.
- Creature mirrors resolve through `data_json.creatureId` or `sourceCollection/sourceId` to `records:creatures`.
- Other supported content pointers use `sourceCollection/sourceId`.
- `canonicalSource`, `sourceTitle`, and `sourceReference` already flow into Reference Browser attribution.
- Unknown JSON fields are generally retained, making a namespaced provenance extension possible without changing SQL tables initially.

This resolver should remain the read seam after import. Import code should create/update canonical records first and then create/update the corresponding URE mirror; it should not turn the mirror into a second canonical copy.

### Geographic references now

Studio geography is currently distributed:

- generic entity `data_json.scope` can hold campaign/world/region/location IDs;
- NPC canonical records use `overview.currentLocation`, `locationState`, `world`, `region`, and `locationId`;
- Creature records use `world`, `region`, `location`, and `foundInLocationIds` with several legacy location fallbacks;
- factions can carry scope/location fields and URE location relationships, but have no single authoritative presence/range model;
- location and region records exist in the universal records store, with URE mirrors used where relationships require endpoints;
- current-location relationships such as `located_in`, `aboard`, and `stationed_at` can participate in movement behavior.

These fields mix runtime position, authored placement, and descriptive prose. Atlas imports must not overwrite NPC current position or other session state with ecological range data.

### Relationship capabilities

The URE supports directional and symmetric types, inverse presentation, typed endpoints, visibility, status, start/end dates, strength, notes, and arbitrary metadata. Existing useful canonical types include:

- geography/movement: `located_in`, `inside`, `contained_in`, `operates_from`, `stationed_at`, `aboard`, `assigned_to`;
- social/ownership: `allied_with`, `rival_of`, `owns`, `member_of`, `secretly_member_of`;
- hierarchy: `answers_to`, `commands`, `leads`, `subfaction_of`, `contains_subfaction`;
- companions/captivity: `travels_with`, `companion_of`, `bonded_to`, `handler_of`, `handled_by`, `captured_by`, `holds_captive`, `prisoner_of`, `has_prisoner`.

Relationship `data_json` is intentionally extensible. The metadata registry already establishes visibility-sensitive faction titles and shared keys but is not a closed schema.

### Assets and packs

Studio can associate local file-backed assets with URE entities and can store data-URL portraits/emblems inside canonical records. Content packs record source ownership through `source_pack`/`contentPack`, but current pack install/removal is not an Atlas synchronization protocol. Atlas packages should use a separate provenance namespace and should not masquerade as existing DLC packs.

### Reuse unchanged

- canonical resolver and mirror-to-record rules;
- `{ entityType, entityId }` local references;
- URE endpoint, direction, status, visibility, notes, and metadata representation;
- `sourceCollection/sourceId` for local canonical pointers;
- `canonicalSource`, `sourceTitle`, and `sourceReference` for display attribution;
- generic JSON extension preservation;
- existing NPC, Creature, Faction Lore, hierarchy, capability, and game-system schemas;
- asset table for extracted local files.

### Conflicts to address in an adapter

- record IDs are globally unique while entity IDs are unique only within type;
- canonical ownership differs by type: NPC/Creature use record plus mirror, while generic Factions can be canonical entities;
- names, WordPress slugs, and Studio IDs are not cross-system identities;
- `scope` and current-location fields are campaign/runtime concepts, not ecological distribution;
- existing Creature `environment` and `foundInLocationIds` are too loose for deterministic Atlas queries;
- current relationship keys lack most ecology/range semantics;
- `strength` is numeric but undefined across domains and must not silently stand in for ecology confidence or frequency;
- assets may be data URLs or managed files and need a package-level hash/mime contract.

## 3. Existing MasterForge Atlas audit

Atlas is currently a WordPress plugin with these public post types:

- hierarchical `mfa_region`;
- `mfa_location` with a parent Region reference;
- globally reusable `mfa_creature` and `mfa_faction`;
- `mfa_map` for a featured base-map image and overlay configuration.

There are no first-class Atlas NPC, Item, Resource, Territory, Route, Hazard, Settlement, Landmark, Biome, Environment, or Lair post types yet. Several of those concepts are currently `mfa_location` classifications (`settlement`, `landmark`, `route`, `hazard`, `cave`, and others). Terrain and Biome are hierarchical WordPress taxonomies assigned to Region, Location, Creature, Faction, and Map.

Every supported Atlas post gets an immutable, protected UUIDv4 in `_mfa_entity_uuid`. Import eligibility is explicit through `_mfa_import_enabled`. `_rsi_canonical_key` is a separate structured-importer identity and may be slug-like; it is not the immutable Atlas entity identity.

Atlas's `mfa_relationships` table stores:

- `source_uuid`, `relationship_type`, `target_uuid`, and non-null `scope_uuid`;
- `importance`, `import_policy`, notes, and timestamps;
- a uniqueness constraint over source, type, target, and scope.

The current RSI profile allows only:

- `contains_location`, `contains_creature`, `contains_faction`;
- `hosts_creature`, `hosts_faction`;
- `connects_to_location`;
- `allied_with_faction`.

These are closed adapter mappings and do not generate inverses or inferred/transitive edges. Atlas currently imports RSI manifests; it does not export the proposed Studio package.

Map geometry is a versioned overlay document on `mfa_map`. It supports reviewed SVG paths or polygon points in a normalized `0 0 100 100` coordinate space, label anchors, ordering, enabled state, and a linked Region UUID. The base map is a WordPress featured image with recorded intrinsic dimensions. Geometry is Region-overlay geometry, not a general GIS feature store. Public serialization is purpose-built for Region pages and returns map/overlay cards plus scoped Creature/Faction cards; it is not an interchange API.

Atlas already provides strong reusable foundations: immutable UUIDs, parent geography, terrain/biome classification, opt-in import controls, typed UUID relationships, featured media, classification/licensing metadata, and guarded RSI adapters. Missing foundations are an immutable workspace identity, ecology/range schemas, broader entity vocabulary, relationship visibility/metadata, per-entity revisions/hashes, and outbound package generation.

## 4. Stable identity contract

### External identity

The immutable external key is the tuple:

```json
{
  "sourceSystem": "masterforge-atlas",
  "sourceWorkspaceId": "8a896cbc-2316-4f4d-8b7f-d73a06ad8089",
  "sourceEntityType": "creature",
  "sourceEntityId": "73d9e606-f4ad-4bd9-81be-d27bf606f241"
}
```

`sourceEntityId` is Atlas's protected UUIDv4. UUID is preferred to slug because titles and slugs can change. `sourceWorkspaceId` must be a generated, immutable UUID for the logical Atlas workspace/site, retained across normal upgrades and backups. It prevents collisions when WordPress sites are cloned or independent Atlas installations happen to contain imported content with the same canonical key.

`sourceEntityType` is part of validation and diagnostics, but the workspace UUID plus entity UUID should be globally unique in a well-formed Atlas workspace. Import must fail closed if the same UUID resolves to multiple types.

### Studio storage

Do not overload `sourceId`, which already participates in local record resolution. Store external provenance as an extension on the canonical Studio object:

```json
{
  "interchange": {
    "origin": {
      "sourceSystem": "masterforge-atlas",
      "sourceWorkspaceId": "8a896cbc-2316-4f4d-8b7f-d73a06ad8089",
      "sourceEntityType": "creature",
      "sourceEntityId": "73d9e606-f4ad-4bd9-81be-d27bf606f241"
    },
    "sourceRevision": "2026-09-14T10:22:31Z",
    "contentHash": "sha256:…",
    "importedAt": "2026-09-14T10:30:00Z"
  },
  "canonicalSource": "masterforge-atlas"
}
```

For NPC/Creature mirrors, retain existing `sourceCollection/sourceId` or `npcId`/`creatureId` as the pointer to the local canonical record. Copy only enough provenance to the mirror for indexing if required; the canonical record remains authoritative.

### Matching and linking

Import lookup order:

1. exact origin tuple on an existing canonical Studio object;
2. an explicit user-approved link from a local object to that origin tuple;
3. otherwise create a new local canonical object and mirror as required.

Never auto-match by name or slug. A Studio-local entity can later become Atlas-linked through an explicit adoption operation that writes the origin tuple after checking type and uniqueness. Adoption must not change the Studio local ID.

## 5. Shared entity vocabulary

| Type | Authority and import behavior | Geometry |
|---|---|---|
| `world` | Shared context identity; Atlas owns geographic definition, Studio maps it to campaign/world context explicitly | Optional Atlas overview only |
| `region` | Atlas-owned; import as canonical geographic record plus URE reference when links need it | Atlas-owned; summary optional |
| `location` | Atlas-owned geography; import as canonical Location | Point/overlay reference optional |
| `settlement` | Atlas-owned geographic subtype initially; Studio canonical Location with `kind: settlement` unless first-class support exists | Optional point/boundary |
| `landmark` | Atlas-owned Location subtype; Studio canonical Location | Optional point |
| `lair` | Atlas-owned Location/site subtype; Studio canonical Location | Optional point/small boundary |
| `route` | Atlas-owned geographic object; import as read-only reference unless Studio gains route behavior | Line geometry optional, never embedded per traveler |
| `territory` | Atlas-owned spatial claim; import reference/summary plus relationships, not as a Faction field blob | Boundary belongs to Atlas |
| `hazard` | Shared: Atlas owns placement/environment; Studio may own mechanics | Optional point/area |
| `biome` | Atlas-owned controlled classification, imported as referenced vocabulary | No per-term geometry |
| `environment` | Shared controlled descriptors; Atlas owns geographic assignment | No direct geometry |
| `creature` | Shared canonical entity: Atlas owns ecology/placement; Studio owns mechanics and campaign state | Range via geographic relationships |
| `npc` | Shared canonical entity: Atlas owns residence/activity links; Studio owns personality, mechanics, secrets, runtime position | Area links only |
| `faction` | Shared canonical entity: Atlas owns presence/territory; Studio owns hierarchy, capabilities, campaign lore/secrets | Territory reference only |
| `item` | Primarily Studio-owned; Atlas may reference geographic resources/relic placement | Usually none |
| `resource` | Atlas-owned ecological/economic resource; Studio may import as Item/reference depending use | Optional occurrence areas |

`map` is a package asset/geography support object, not a URE entity by default. `site` should be an alias rejected or normalized to the more specific `location`, `landmark`, or `lair`; it should not become a parallel canonical type.

## 6. Geographic relationship vocabulary

Store one directed edge and derive the inverse label in presentation.

| Canonical type | Valid source → target | Inverse label | Owner / override | Metadata |
|---|---|---|---|---|
| `contained_in` | Region/Location/Settlement/Landmark/Lair → Region/Location | contains | Atlas; Studio may add local edges, not overwrite origin edge | optional `presence` only |
| `located_in` | NPC/Item/Hazard → Location/Settlement/Region | contains | Studio for current runtime position; Atlas only for durable placement | `temporal`, `precision` |
| `based_in` | Faction/NPC → Location/Settlement/Region | base of | Atlas default; Studio overlay allowed | `presence`, `since` |
| `active_in` | Faction/NPC → geography | activity by | Atlas baseline; Studio overlay allowed | `presence`, `seasonality` |
| `found_in` | Creature/Resource/Hazard → geography | contains sightings of | Atlas | ecology-presence metadata |
| `native_to` | Creature/Resource → Region/Biome/Location | native range of | Atlas | ecology-presence metadata |
| `migrates_through` | Creature → Region/Location/Route | migration path of | Atlas | `seasonality`, `frequency` |
| `nests_at` | Creature → Location/Landmark | nesting site of | Atlas | `seasonality`, `frequency` |
| `lairs_at` | Creature → Lair/Location | lair of | Atlas | `occupancy`, `visibility` |
| `hunts_in` | Creature → geography | hunting ground of | Atlas | `frequency`, `seasonality` |
| `patrols` | Faction/NPC/Creature → geography/Route | patrolled by | Shared overlay | `frequency`, `schedule` |
| `controls` | Faction → Territory/Region/Location/Route | controlled by | Atlas baseline; Studio overlay | `strength`, `contested` |
| `claims` | Faction → Territory/geography | claimed by | Atlas baseline; Studio overlay | `strength`, `contested` |
| `influences` | Faction → geography/Settlement | influenced by | Atlas baseline; Studio overlay | `strength` |
| `trades_with` | Faction/Settlement → Faction/Settlement | trades with | Shared | `frequency`, `goods` |
| `travels_via` | NPC/Faction → Route | used by | Shared | `frequency`, `seasonality` |
| `connects_to` | Route/Location → Route/Location | connects to | Atlas | `travelMode`, `distance`, `difficulty` |
| `borders` | Region/Territory → same | borders | Atlas | optional `disputed` |
| `near` | Location/Landmark → geography | near | Atlas | `distance`, `precision` |

Reuse Studio `contained_in` and `located_in`. Add new controlled keys only where existing semantics are not equivalent. Normalize Atlas's current `contains_location` to inverse `contained_in`, `contains_creature`/`hosts_creature` to the appropriate `found_in` or `native_to` only when Atlas explicitly knows which meaning applies, `hosts_faction` to `active_in` or `based_in`, `connects_to_location` to `connects_to`, and `allied_with_faction` to `allied_with`. Do not guess these distinctions during import; retain a legacy mapped type until the Atlas editor supplies the intended semantic.

Runtime `located_in` must be a Studio-owned overlay distinct from Atlas placement. An origin relationship must retain its provenance and must never activate URE movement behavior unless the contract explicitly marks it `runtimePosition: true` (Atlas exports should not).

## 7. Ecology relationship vocabulary

| Canonical type | Source → target | Inverse label | Symmetry |
|---|---|---|---|
| `preys_on` | Creature → Creature/Resource | preyed on by | directed |
| `hunted_by` | Creature → NPC/Faction | hunts | directed |
| `symbiotic_with` | Creature → Creature/Plant/Resource | symbiotic with | symmetric |
| `parasitic_on` | Creature → Creature/Plant | host to | directed |
| `competes_with` | Creature → Creature/Faction | competes with | symmetric |
| `territorial_rival` | Creature → Creature/Faction | territorial rival | symmetric |
| `domesticated_by` | Creature → NPC/Faction/Settlement | domesticates | directed |
| `mounts_for` | Creature → NPC/Faction | uses as mounts | directed |
| `scavenges_from` | Creature → Creature/Resource/Location | scavenged by | directed |
| `avoids` | Creature → Creature/Faction/geography | avoided by | directed |
| `attracted_to` | Creature → Creature/Resource/geography | attracts | directed |

Do not add `preyed_on_by`, `predator_of`, or a second `hunts` edge; they are inverse labels of `preys_on` or `hunted_by`. Reuse `allied_with` and `rival_of` for social hostility where appropriate; ecology-specific competition should use `competes_with` or `territorial_rival`.

Ecology relationship metadata v1:

```json
{
  "strength": "moderate",
  "frequency": "common",
  "seasonality": ["wet-season"],
  "confidence": "observed",
  "visibility": "public",
  "notes": "Short authored context"
}
```

Each field is optional. Controlled values should be small: strength `weak|moderate|strong`, frequency `rare|occasional|common|constant`, confidence `rumour|inferred|observed|authoritative`, and visibility `public|gm|hidden`. Notes are supplementary and never the only source of relationship meaning.

## 8. Creature ecology schema proposal

Creature-owned descriptive ecology is separate from geographic and entity edges:

```json
{
  "version": 1,
  "description": "Short ecological summary",
  "behaviour": "Hunts from cliff thermals.",
  "temperament": "Territorial near nesting sites.",
  "diet": ["carnivore", "fish", "large-insects"],
  "socialStructure": "mated-pairs",
  "activityCycle": ["crepuscular"],
  "reproductiveNotes": "One clutch during the dry season.",
  "ecologyNotes": "Longer optional GM-facing context.",
  "habitatPreferences": {
    "biomes": ["coastal-rainforest"],
    "terrain": ["sea-cliffs", "mountains"],
    "climate": ["tropical"],
    "elevation": {"minMetres": 100, "maxMetres": 1800},
    "waterProximity": ["coastal"],
    "temperature": ["warm", "hot"],
    "humidity": ["humid"],
    "settlementProximity": ["remote", "fringe"],
    "activityPeriod": ["dawn", "dusk"],
    "seasonality": ["year-round"]
  }
}
```

Use stable vocabulary IDs, with display labels maintained separately. Free prose remains valuable but is not queried for placement. Do not put Region or Location IDs inside `habitatPreferences`; actual placement/range uses relationships. Do not put prey, predators, factions, or lairs inside this object; those are graph edges.

Studio should add this only as a versioned canonical Creature extension in a later slice. Atlas should expose equivalent fields on its Creature model before exporting them.

## 9. Geography and range model

Ranges are relationship assertions, not copied geometry:

- native range: `native_to` Creature → Region/Biome;
- current range: `found_in` with `presence: current`;
- hunting ground: `hunts_in`;
- migration: `migrates_through` Route/Region plus seasonality;
- nesting/lair: `nests_at` or `lairs_at`;
- rare sighting: `found_in` with `frequency: rare`, confidence, and optional observed date;
- faction territory: `controls`, `claims`, or `influences` to Territory/geography;
- NPC residence: `based_in` with `presence: resident`;
- NPC activity area: `active_in`.

Studio imports stable geographic identities, names/summaries needed offline, hierarchy links, and relationship metadata. No geometry is imported by default. A package may include one simplified geometry object only when the selection explicitly requests `geometryMode: simplified`; it belongs in the package `geography` section and is referenced by ID. Full Atlas overlay documents and base map images are never duplicated onto every entity.

## 10. Atlas → Studio package manifest v1

```json
{
  "contract": "masterforge-interchange",
  "manifestVersion": 1,
  "packageId": "uuid",
  "source": {
    "system": "masterforge-atlas",
    "workspaceId": "uuid",
    "exportedAt": "RFC3339 timestamp",
    "workspaceRevision": "opaque revision"
  },
  "selection": [{"type": "creature", "id": "uuid"}],
  "mode": "required",
  "entities": [],
  "relationships": [],
  "geography": [],
  "assets": [],
  "dependencies": [],
  "packageHash": "sha256:canonical-json-hash"
}
```

Every entity contains `identity`, `revision`, `contentHash`, `visibility`, `name`, optional attribution, and a type-specific `data` object. Every relationship has its own stable Atlas UUID (Atlas must add this), typed endpoint identities, canonical relationship type, visibility, metadata, revision, and hash. `dependencies` records why an included or omitted object is needed; it is not a second copy of the object.

Assets are descriptors:

```json
{
  "assetId": "uuid",
  "owner": {"type": "creature", "id": "uuid"},
  "slot": "portrait",
  "path": "assets/sha256.webp",
  "mimeType": "image/webp",
  "byteLength": 48122,
  "sha256": "…",
  "visibility": "public",
  "license": "original"
}
```

Paths must be package-relative, traversal-safe, hash-verified, size-limited, and allowlisted by MIME. Remote URLs are references only and are not downloaded implicitly during Studio import.

### Example A: single Creature

```json
{
  "contract": "masterforge-interchange",
  "manifestVersion": 1,
  "packageId": "1a8e81ad-7a86-4fe1-8774-acde499463ef",
  "source": {"system": "masterforge-atlas", "workspaceId": "8a896cbc-2316-4f4d-8b7f-d73a06ad8089", "exportedAt": "2026-09-14T10:30:00Z", "workspaceRevision": "184"},
  "selection": [{"type": "creature", "id": "73d9e606-f4ad-4bd9-81be-d27bf606f241"}],
  "mode": "ecology-context",
  "entities": [
    {"identity": {"type": "creature", "id": "73d9e606-f4ad-4bd9-81be-d27bf606f241"}, "revision": "2026-09-14T10:22:31Z", "contentHash": "sha256:c1", "visibility": "public", "name": "Cinderwatch Wyrm", "attribution": {"title": "Mistcliff Field Notes", "reference": "Entry 12"}, "data": {"description": "A cliff-dwelling storm predator.", "ecology": {"version": 1, "diet": ["carnivore"], "activityCycle": ["crepuscular"], "habitatPreferences": {"biomes": ["coastal-rainforest"], "terrain": ["sea-cliffs"]}}}},
    {"identity": {"type": "region", "id": "65256d90-fac7-4e20-93d4-acdeee7f2cee"}, "revision": "2026-09-12T09:00:00Z", "contentHash": "sha256:r1", "visibility": "public", "name": "Mistcliff Coast", "data": {"regionType": "coast", "biomes": ["coastal-rainforest"], "terrain": ["sea-cliffs"]}}
  ],
  "relationships": [
    {"id": "09a88a18-3ad5-4234-acde-59ee84f52ba7", "type": "native_to", "source": {"type": "creature", "id": "73d9e606-f4ad-4bd9-81be-d27bf606f241"}, "target": {"type": "region", "id": "65256d90-fac7-4e20-93d4-acdeee7f2cee"}, "visibility": "public", "metadata": {"frequency": "common", "confidence": "observed"}, "revision": "2026-09-14T10:22:31Z", "contentHash": "sha256:e1"}
  ],
  "geography": [],
  "assets": [],
  "dependencies": [{"identity": {"type": "region", "id": "65256d90-fac7-4e20-93d4-acdeee7f2cee"}, "class": "required", "reason": "relationship-endpoint"}],
  "packageHash": "sha256:package"
}
```

### Example B: Region with Creature, Faction, and NPC links

```json
{
  "contract": "masterforge-interchange",
  "manifestVersion": 1,
  "packageId": "752eaf13-0cb6-4668-bb50-444d40f78945",
  "source": {"system": "masterforge-atlas", "workspaceId": "8a896cbc-2316-4f4d-8b7f-d73a06ad8089", "exportedAt": "2026-09-14T11:00:00Z", "workspaceRevision": "185"},
  "selection": [{"type": "region", "id": "65256d90-fac7-4e20-93d4-acdeee7f2cee"}],
  "mode": "ecology-context",
  "entities": [
    {"identity": {"type": "region", "id": "65256d90-fac7-4e20-93d4-acdeee7f2cee"}, "revision": "185", "contentHash": "sha256:r1", "visibility": "public", "name": "Mistcliff Coast", "data": {"regionType": "coast", "biomes": ["coastal-rainforest"]}},
    {"identity": {"type": "creature", "id": "73d9e606-f4ad-4bd9-81be-d27bf606f241"}, "revision": "44", "contentHash": "sha256:c1", "visibility": "public", "name": "Cinderwatch Wyrm", "data": {"ecology": {"version": 1, "diet": ["carnivore"]}}},
    {"identity": {"type": "faction", "id": "c3d1330b-9d66-4d2c-baf6-3fd49b58b840"}, "revision": "19", "contentHash": "sha256:f1", "visibility": "public", "name": "Galeclaw", "data": {"summary": "Storm-watchers of the western cliffs."}},
    {"identity": {"type": "npc", "id": "2d9567a2-43ea-42d9-8a69-09284bf89888"}, "revision": "7", "contentHash": "sha256:n1", "visibility": "gm", "name": "Warden Rook", "data": {"summary": "Galeclaw patrol leader."}}
  ],
  "relationships": [
    {"id": "e1", "type": "native_to", "source": {"type": "creature", "id": "73d9e606-f4ad-4bd9-81be-d27bf606f241"}, "target": {"type": "region", "id": "65256d90-fac7-4e20-93d4-acdeee7f2cee"}, "visibility": "public", "metadata": {"frequency": "common"}},
    {"id": "e2", "type": "patrols", "source": {"type": "faction", "id": "c3d1330b-9d66-4d2c-baf6-3fd49b58b840"}, "target": {"type": "region", "id": "65256d90-fac7-4e20-93d4-acdeee7f2cee"}, "visibility": "public", "metadata": {"frequency": "common"}},
    {"id": "e3", "type": "member_of", "source": {"type": "npc", "id": "2d9567a2-43ea-42d9-8a69-09284bf89888"}, "target": {"type": "faction", "id": "c3d1330b-9d66-4d2c-baf6-3fd49b58b840"}, "visibility": "gm", "metadata": {"role": "Warden"}}
  ],
  "geography": [],
  "assets": [],
  "dependencies": [
    {"identity": {"type": "creature", "id": "73d9e606-f4ad-4bd9-81be-d27bf606f241"}, "class": "contextual", "reason": "region-ecology"},
    {"identity": {"type": "faction", "id": "c3d1330b-9d66-4d2c-baf6-3fd49b58b840"}, "class": "contextual", "reason": "region-presence"},
    {"identity": {"type": "npc", "id": "2d9567a2-43ea-42d9-8a69-09284bf89888"}, "class": "optional", "reason": "faction-member"}
  ],
  "packageHash": "sha256:package"
}
```

Production validation should require UUID relationship IDs; the short `e1` values above keep the example readable.

## 11. Dependency policy

Four explicit modes:

1. `selected-only`: selected entities plus no edges whose endpoints are absent.
2. `required`: selected entities, containment ancestors needed to identify them, asset descriptors selected for inclusion, and both endpoints of included required edges.
3. `ecology-context`: required plus one hop of configured ecology/range/presence relationships.
4. `full-bounded`: configured relationship traversal up to explicit limits; never an unbounded world export.

Dependency classes:

- required: needed to preserve identity, containment, or an included edge;
- contextual: useful one-hop context such as prey or faction presence;
- optional: display enrichment such as a portrait or secondary related entity.

Default limits should be depth 1 for ecology context, depth 2 for full bounded, 250 entities, 500 relationships, 100 assets, and a configured byte ceiling. The exporter keeps a visited set keyed by the full origin tuple, stops cycles, emits each object once, and records truncation warnings. Containment traversal may walk ancestors to the World root but must not walk siblings or descendants unless the selected Region policy explicitly includes descendants. Secret edges never cause public packages to pull secret endpoints.

Studio deduplicates by origin tuple before allocating local IDs. Relationship dedupe uses source-origin + type + target-origin + scope-origin; the Atlas relationship UUID remains provenance, not Studio's sole local key.

## 12. Ownership and conflict policy

| Domain | Authority | Import behavior |
|---|---|---|
| geography hierarchy, biome, terrain, routes, boundaries | Atlas | replace Atlas-owned snapshot fields when revision/hash changes |
| habitat, range, ecology placement, territory/presence | Atlas | replace only edges/fields carrying the same Atlas origin |
| NPC/Creature mechanics and capabilities | Studio | preserve local; fill only absent values on first import unless package explicitly declares Studio-compatible mechanics ownership |
| Faction hierarchy, Ability Packs, traits | Studio | preserve local |
| campaign secrets, GM notes, session/combat state | Studio | never overwrite from normal Atlas update |
| names, public summary, public tags | shared | source-specific overlay; preserve Studio override and retain incoming Atlas value for comparison |
| images/assets | shared | update Atlas-owned slot only when locally unmodified; otherwise preserve and flag conflict |
| relationships added in Studio | Studio | retain alongside Atlas edges; never delete because absent from Atlas |

Every imported field or edge must be attributable to an origin. Updates replace only the prior Atlas-owned layer. Local overrides are stored separately from the last imported snapshot; destructive three-way merging is deferred. Until conflict UI exists, safe defaults are `replace-origin`, `preserve-local`, or `fill-if-empty` per field—never silent whole-object overwrite.

## 13. Visibility and security policy

Visibility is structural metadata on entities, fields where necessary, relationships, geography, and assets: `public`, `gm`, or `hidden`. Packages declare an audience (`public` or `gm`) and must be projected at export time. A public package must not contain GM/hidden objects, fields, relationship endpoints, dependency reasons, asset paths, or hashes that reveal their existence.

Studio imports the already projected payload and preserves visibility on URE relationships and canonical extensions. It must still validate that a public package contains no forbidden visibility values. Secret relationship metadata is not flattened into notes. Atlas's present relationship table needs an explicit visibility column or versioned metadata document before secret ecology/presence can be exported safely; `notes` alone is insufficient.

Content classification/licensing is separate from visibility. `restricted` content must be excluded from export even in GM mode unless a future explicit license policy permits it.

## 14. Revision and provenance strategy

- identity: immutable Atlas workspace UUID + entity UUID;
- `revision`: opaque monotonically changing value where Atlas can provide one, otherwise normalized WordPress `post_modified_gmt` plus post revision ID;
- `contentHash`: SHA-256 over canonical JSON for the exported, visibility-projected object, excluding timestamps and package position;
- `exportedAt`: package audit time, never an update decision by itself;
- `importedAt`: Studio audit time;
- `packageHash`: SHA-256 over the canonicalized manifest excluding `packageHash` itself.

An update is available when the origin tuple matches and the incoming content hash differs. A local modification exists when Studio's owned/overridable field hash differs from the stored post-import baseline. Timestamps are diagnostic; hashes decide content equality.

## 15. Round-trip considerations

Decisions required now for future Studio → Atlas support:

- keep external origin identity separate from both applications' local IDs;
- assign stable UUIDs to relationship assertions, assets, and future geography objects;
- retain per-field/edge ownership and provenance rather than flattening imported and local content;
- use the same controlled type and relationship vocabulary in both directions;
- allow explicit adoption/linking of an existing local object without replacing its local identity;
- represent deletions later as revisioned tombstones scoped to the owning source, not absence from a partial package;
- preserve unknown namespaced extensions through validation and storage.

Atlas may later accept Studio-owned mechanics or campaign overlays, but must not let those writes replace Atlas geography. Studio-created NPCs can be placed by linking their Studio origin in Atlas; Atlas should assign its own local UUID and retain the Studio origin tuple as provenance.

## 16. Recommended implementation slices

1. Publish a dependency-free shared contract package: JSON Schemas, controlled entity/relationship constants, canonical JSON/hash rules, fixture payloads, and compatibility policy.
2. Add immutable Atlas workspace identity plus UUID/revision/visibility for relationships and assets; migrate no Studio data yet.
3. Add the versioned Creature ecology object and controlled vocabularies to Studio normalization, with lossless unknown-field behavior and fixtures.
4. Add Studio Creature ecology editor and read-only Reference Browser ecology presentation.
5. Add equivalent Atlas Creature ecology fields, range/presence relationship editing, NPC/Item references only as needed, and query fixtures.
6. Implement a pure Atlas dependency compiler and package validator before any download UI.
7. Add Atlas export UI for selected-only and required modes; add ecology-context after traversal tests.
8. Implement Studio dry-run importer with origin index, type adapter matrix, validation report, and transactional writes; support Region/Location/Creature/Faction first.
9. Add assets, bounded dependency modes, update detection, and source-specific conflict reporting.
10. Add explicit adoption/linking and only then design limited Studio → Atlas overlays.

The shared contract comes first because implementing ecology independently in both applications would create avoidable translation debt. Studio ecology normalization comes before Atlas export so the receiving canonical shape and lossless behavior are testable.

## 17. Explicit non-goals

- no live Atlas connection or required Atlas installation;
- no automatic bidirectional synchronization;
- no name/slug identity matching;
- no full GIS interchange or geometry duplication per entity;
- no scientific ecosystem simulation;
- no automatic prose-to-relationship inference;
- no combat/session state export from Studio;
- no whole-world traversal from a single entity by default;
- no silent conflict resolution or deletion by omission;
- no UI, database schema, migration, importer, exporter, version, build, or release work in this audit.
