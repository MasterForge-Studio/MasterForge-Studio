# Atlas import preview foundation

## Parser responsibility

`atlas-package-parser.js` accepts an in-memory package object, clones it, validates Atlas manifest v1 and source identity, and returns a stable package-neutral representation. It normalizes external entity identities, relationship endpoints, dependencies, visibility, revisions, and hashes without creating Studio records. Missing optional arrays become empty arrays. Unknown top-level and entry fields remain inspectable.

Unsupported manifest versions, malformed Atlas UUID identities, duplicate package identities, duplicate relationship IDs, invalid endpoints, malformed dependencies, and configured graph-ceiling violations are structured validation errors. Structurally valid future entity types remain in the result with an unsupported warning.

Geography and ecology blocks are preserved, not mapped. Asset descriptors are classified as embedded, referenced, unsupported, or missing metadata; no asset is decoded, downloaded, or installed.

## Preview responsibility

`atlas-import-preview.js` consumes a parsed package and injected read dependencies. It reuses the external identity matcher and revision/hash comparison helper. Entity actions are classified as:

- `create`: no immutable provenance match;
- `update`: exact identity with changed revision or hash;
- `unchanged`: exact identity with known equal revision/hash;
- `manual_review`: ambiguous local claims or unknown source comparison;
- `unsupported`: unsupported external entity type;
- `skip`: reserved for later policy decisions.

Relationship actions are `create_candidate`, `manual_review`, or `skip`. A relationship is never applied and no inverse edge is generated.

## Dependencies and graph safety

Dependencies retain `required`, `optional`, or `contextual` class and are classified as present in the package, existing in Studio, missing, unsupported, or ambiguous. Missing required dependencies warn; missing optional dependencies remain informational. Analysis never fetches outside the supplied package and injected Studio reads.

The parser enforces configurable entity, relationship, and total-reference ceilings. Preview traversal uses a visited/active graph, detects cycles without recursion loops, and enforces a configurable dependency-depth ceiling.

## Visibility and ownership

Entity, relationship, dependency, geography, ecology, and asset visibility metadata remains structural. The GM-side preview does not flatten visibility or reinterpret a public-projected package. Future apply code must preserve the package audience boundary.

The preview reports ownership domains only. It does not merge them. Atlas geography, range, habitat placement, ecology placement, and geographic presence remain distinguishable from Studio mechanics, capabilities, hierarchy, campaign secrets, and runtime state.

## Deliberate non-goals

There is no package transport, file chooser, production UI, Atlas connection, canonical mapping, geography/ecology application, relationship creation, asset import, conflict merge, migration, mirror sync, or write API in this layer.

A future apply step must consume the normalized identity, proposed action, existing local match, revision/hash comparison, normalized payload, dependency state, visibility, and ownership summary. It must revalidate the plan before making transactional writes; preview output alone is not authorization to import.
