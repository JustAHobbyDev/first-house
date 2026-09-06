# Decision 0001: explicit pre-birth event and context spine

Status: implemented for disposable development only.

- Use Node 24, strict TypeScript, pnpm, Node's test runner, and built-in SQLite.
  The only npm dependencies are development tools. The observed host versions
  are Node 24.20.0 and pnpm 12.0.0; dependency versions are locked.
- Keep one modular process and synchronous transactional domain commands.
  Replay-based validation is intentionally simple and linear in history size;
  the fixture scale does not justify additional databases or caching services.
- Use explicit command schemas and discriminated domain events. Reject unknown
  fields, unsupported capabilities, nondevelopment IDs, and invalid transitions.
- Use canonical JSON and SHA-256 for linked event envelopes and immutable bodies.
  This provides verifiable consistency, not privileged-administrator resistance.
- Keep occurrence time and IDs injectable. The demo fixes both; normal runtime
  defaults use the current UTC clock and random UUID-based development IDs.
- Persist artifact bytes before referencing commits; publish them atomically.
  Allow unreferenced artifacts after interruption rather than overwrite or silently
  repair hash-named content. No garbage collector is included.
- Treat required-context overflow as explicit failure. Preserve lane provenance
  during deduplication and pin exact rendered bytes as well as source versions.
- Use only the fake adapter and artifact.write capability. Record permission before
  effect; reconcile expected bytes after interruption without claiming exactly-once
  execution for general external systems.
- Keep financial purposes and compute provision structurally separate. Neither
  transfer receipt nor evidence receipt automatically accepts a commitment.
- Preserve the supplied genome-harness problem-frames document without adopting
  its unrelated lifecycle or provisioning assumptions.

Scope refinements: canon IDs name immutable versions in this first schema; there
is no stable-ID amendment mechanism. Cross-lane rendering retains duplicate bytes
to preserve authority provenance. Canon YAML is descriptive draft source material,
not an executed configuration language. These keep the first slice small without
claiming canonical authority.

Next milestone: exercise a second offline request with accepted commitments,
testimony and explicit review, including unresolved/denied intentions and dormancy.
Review operational independence of appeal before designing canonical identities
or admitting live capabilities.
