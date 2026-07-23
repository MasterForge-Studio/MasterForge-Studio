# Forgotten Realms Core v2

MasterForge import pack using the new hierarchy:

World → Region → Location → Content

## Includes
- 1 world: Forgotten Realms
- 5 regions
- 14 locations
- Location-scoped weather, encounter, loot and vendor tables
- Scene backgrounds with fallback support

## Scope rules
- Regions are scoped by `worldId`
- Locations are scoped by `regionId`
- Encounters, loot, weather, vendors and NPCs are scoped by `locationId`

Remove older Forgotten Realms test packs before importing this version.
