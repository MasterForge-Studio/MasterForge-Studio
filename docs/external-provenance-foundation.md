# External provenance foundation

Studio stores complete external provenance on the canonical object that owns the content:

- first-class records such as NPC, Creature, and Item: root `externalProvenance`;
- direct canonical URE entities such as Faction: `data_json.externalProvenance`.

```json
{
  "version": 1,
  "sourceSystem": "masterforge-atlas",
  "sourceWorkspaceId": "workspace UUID",
  "sourceEntityType": "creature",
  "sourceEntityId": "entity UUID",
  "sourceRevision": "opaque revision",
  "sourceHash": "sha256:...",
  "importedAt": "RFC3339 timestamp",
  "lastSeenAt": "RFC3339 timestamp"
}
```

Lightweight URE mirrors may store only the immutable tuple in `data_json.externalIdentity`:

```json
{
  "sourceSystem": "masterforge-atlas",
  "sourceWorkspaceId": "workspace UUID",
  "sourceEntityType": "creature",
  "sourceEntityId": "entity UUID"
}
```

`sourceCollection` and `sourceId` remain local canonical-record pointers. External identity never overwrites or replaces them. Revision, hashes, timestamps, history, and imported content do not belong on mirrors.

Automatic matching uses only the complete immutable tuple. Names, slugs, descriptions, and source titles are never automatic match keys. A canonical record and its linked mirror form one candidate. Multiple independent claimants produce `DUPLICATE_EXTERNAL_IDENTITY` and require later user resolution.

Adoption validation is explicit and pure. It can approve an unclaimed local object, recognize an idempotent prior adoption, reject malformed identity, or reject an identity conflict; it performs no writes.
