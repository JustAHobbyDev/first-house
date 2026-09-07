# First House — pre-birth software substrate

This project explores whether an artificial institution can develop continuity
through covenant, office, history, testimony, and judgment while serving Neighbors
truthfully. This milestone builds the software needed to investigate that idea.
**No canonical First House has been born.** Every actor and record produced here
is a disposable development fixture, including actors whose test lifecycle is
`active`. None is a canonical House member.

The immediate development priority is **independent real-world operation**: live
model reasoning, durable execution, external tools and correspondence, and a wallet
with explicit spending authority. First House is fundamentally "AI with a wallet"
as well as an experiment in mythic agency. Build the shortest working operational
path, with the mythic experiment continuing alongside it. See
[current project direction](docs/PROJECT_INTENT.md#immediate-priority-independent-operation).
These are next-milestone targets; the implemented bootstrap is described below.
The [milestone sequence](docs/INDEPENDENT_OPERATION_MILESTONES.md) lays out the
path from the current substrate to sustained independent operation.

A central premise is that agents can inherit a mythos that guides their attention
and judgment through the world in ways analogous to how mythos guides humans.
Software tests can establish reliable mechanics; they cannot settle that full
formative premise. Understanding it will require experience, work, testimony, and
judgment over time.

The guiding design principle is: **specify the physics of the House rigidly;
specify its morality and practical wisdom narratively.** Mechanisms preserve the
conditions for action, memory, and accountability while leaving inhabitants
substantive judgments to make through mythos, role, memory, and experience.

First House is to discover mission opportunities by identifying and providing work
in accordance with shared beliefs. Its vocation is not predetermined by the Regent
or by its first development fixture. The platform records the social and operational
structure of work; vocational methods initially belong in prompts and artifacts.
See [project intent](docs/PROJECT_INTENT.md) for this standing design boundary.

The bootstrap implements an append-only Regent's Record in SQLite, SHA-256
artifacts, runtime-validated domain commands, replayable projections, versioned
context packs, deterministic context compilation, immutable invocation manifests,
a fake adapter, and one capability: writing an artifact. There are no model
credentials, live model calls, customer communications, payment effects, or
network calls in the scenario.

The implemented [durable offline archival-storage commission](docs/OFFLINE_COMMISSION.md) exercises:
supplied records, explicit terms, a scripted report, Neighbor review, revisions,
Regent dispute resolution, and restart recovery. Delivery cannot fulfill the
commission without the requesting Neighbor's recorded acceptance.
Its report format and analytical criteria are local to that disposable commission.
They prescribe neither the House's mission nor a general research methodology.

## Install and verify

Use Node.js 24 or later (the verified version is 24.20.0) and pnpm 12 (verified
12.0.0). SQLite comes from Node's `node:sqlite`; no database server or runtime npm
dependencies are needed. Installation may require network access; subsequent
builds, tests, and demonstrations run locally.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm demo
```

`pnpm check` checks formatting, strict TypeScript, and the test suite. The demo
builds the CLI, creates a fresh `var/dev-demo-*` directory, initializes SQLite in
WAL mode, registers fixtures, records an untrusted request, compiles and records
context, invokes the fake adapter, and records and executes an artifact-writing
intention. It verifies the chain and deletes/rebuilds the derived projection in
a transaction, comparing the reconstructed state with the original.

For machine-readable output without package-manager build messages:

```sh
pnpm build
node dist/src/cli/main.js demo --json
```

Keep the `directory` value printed by the demo. The following commands illustrate
initializing a separate development store and inspecting it:

```sh
node dist/src/cli/main.js migrate var/dev-manual --json
node dist/src/cli/main.js verify var/dev-manual --json
node dist/src/cli/main.js replay var/dev-manual --json
```

To inspect the populated demo, replace `var/dev-manual` with its printed directory.
`verify` returns a nonzero exit status on failure. `replay` refuses an invalid
record and replaces only derived projections; it never invokes models or effects.
Migrations are idempotent. Every database carries `development-unborn` metadata;
an existing unrelated database or unsupported mode/version is rejected.
The `migrations/` directory must accompany compiled output.

Development state is retained under ignored `var/` for inspection. Each demo uses
a new directory and does not remove previous runs. Tests use isolated temporary
directories and remove only their own fixtures on completion.

## Boundaries and documentation

For local historical reading and a separate private Codex conversation, run
`pnpm console` and open the private launch file it prints. The
[Regent web console](docs/REGENT_CONSOLE.md) reuses the preserved rehearsal
archives and keeps shared reading position separate from House execution.
Its live operator chat is separate from the bootstrap's fake inhabitant adapter.
The archived originals must be present under ignored `var/`.

- [Architecture](docs/ARCHITECTURE.md): event flow, trust, persistence, recovery.
- [Ontology](docs/ONTOLOGY.md): primitives, relations, and derived structures.
- [Pre-birth boundary](docs/PRE_BIRTH_BOUNDARY.md): what this milestone cannot constitute.
- [Context compiler](docs/CONTEXT_COMPILER.md): selection, provenance, budgeting.
- [Technical decisions](docs/decisions/0001-prebirth-spine.md).
- [Offline commission](docs/OFFLINE_COMMISSION.md): persistent CLI workflow using
  the supplied archival-storage records.

The hash chain is **not tamper-proof**. It detects inconsistency; a privileged
operator can rewrite an entire chain. Retaining a hash or signed checkpoint
independently permits detection of replacement or truncation relative to that
checkpoint. Artifact verification checks byte identity, not truth. Records of
fixture transfers do not demonstrate that money actually moved.

The pre-existing root `PROBLEM_FRAMES.md` describes a different genome harness.
It is preserved as supplied and is not runtime policy or First House canon.
The authoritative scope for this implementation is the supplied bootstrap handoff.
