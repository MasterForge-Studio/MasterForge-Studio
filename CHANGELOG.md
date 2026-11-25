# MasterForge Studio Changelog

## Unreleased

### Security

- Added a Content Security Policy to the main and activation windows, so text from content packs or campaigns can no longer run script.
- Escaped pack and campaign text in the older Sessions, Party, World Notes, generator, faction, encounter and vendor views.
- The window now stays on the app's own pages: remote navigation, new windows and webviews are blocked, and only clipboard writing is permitted.
- Theme settings can no longer change the data folder; it changes only through the folder picker. Data writes are limited to `.json` files inside the data folder, including through links and junctions.
- Content packs install only from the file chosen in the install dialog, and archives are checked for size, entry count, duplicate names and zip-bomb compression before extraction.
- Installer download links open in the browser only for GitHub and masterforgestudio.com.
- Upgraded adm-zip to 0.6.1 and js-yaml to 4.3.2 (`npm audit --omit=dev` reports no runtime vulnerabilities).

## v0.3.6-alpha

### Highlights

- Added the In Game Reference Browser with full read-only Faction, NPC, Creature and Item views.
- Added the first-class Item Builder and expanded Creature ecology and habitat data.
- Improved Faction Lore with dedicated editing, emblem support and refined presentation.
- Introduced sourcebook-style reading surfaces with responsive editorial layouts and a shared artwork rail.
- Added the Atlas import dry-run preview foundation without applying live changes.

### Improvements

- Refined the Entity Library browser rail and consolidated entity actions in the Action Console.
- Added canonical read resolution and improved cross-reference relationship navigation.
- Improved image, emblem and portrait presentation with safe fallbacks.
- Kept mechanical and stat information structured for quick live-session scanning.

### Atlas / Interchange

- Added the external provenance identity foundation and documented the Atlas ↔ Studio interchange contract.
- Added Atlas package parsing, entity matching and dry-run import previews.
- Live Atlas import/apply remains unavailable in this release.

### Notes

- This is an Alpha release.
- The Windows installer remains unsigned, so Windows SmartScreen or antivirus warnings may appear.

## v0.3.1-alpha

- Added automatic startup into the campaign creation wizard when no campaigns exist.
- Separated development and installed user-data profiles.
- Retained shared activation data across development and installed builds.
- Added Git source control and connected the project to GitHub.
- Added automated GitHub release-to-WordPress synchronisation.
- Added secure release metadata syncing for version, notes, installer URL, publication date and SHA-256 checksum.
- Added the PowerShell release pipeline with dry-run, build-only and release safety checks.
- Updated MasterForge Studio to version 0.3.1-alpha.

## v0.3.0-alpha

- Reorganised navigation around In Game, Pre-Game, World Building and Settings workflows.
- Added the persistent contextual Action Console and Home orientation screen.
- Integrated planned-encounter lifecycle and participant actions with the Action Console.
- Added compact Location Overview category counts, search and quick-open drill-down.
- Added safe faction hierarchy copying with Merge/Replace modes and fresh node-ID remapping.
- Added campaign-scoped planned encounters to global search.

## v0.2.0-alpha

Relationship Engine Build

Planned:

- Universal Entity System
- Relationship Database
- Asset Manager
- NPC Profiles
- Campaign Tree View

---

## v0.1.0-alpha

Session Zero Build

Released:
25 June 2026

Added:

- Electron application
- SQLite database
- Themes
- Content packs
- Worlds
- Locations
- Regions
- Encounter tables
- Loot tables
- Weather tables
- Session Prep
- Session Summary

First live test:
Bean Rounders Session Zero
