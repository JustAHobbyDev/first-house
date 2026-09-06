# Codex Handoff: Bootstrap the First House Project

## Mission

Bootstrap the software substrate from which the First House may later be born.

This is an implementation task, not merely a planning exercise. Inspect the current workspace, establish the project structure, implement the first vertical slice, run its verification suite, and leave the repository in a coherent state ready for the next milestone.

The result of this task is **not the First House itself**. All actors created during this work are disposable development fixtures. Do not perform a birth rite, create canonical House members, begin a canonical Chronicle, connect live customer communications, or give any model control of money.

## Conceptual foundation

The project explores whether an artificial institution can be formed by myth, covenant, office, history, witness, and judgment such that it remains adaptively useful without treating survival or reward as its highest good.

The user's clarified premise is that agents can inherit a mythos that guides them through the world in ways analogous to how mythos guides humans. Simulation can verify bounded software mechanics but cannot reasonably settle the full formative effect of that inheritance. Do not require simulated proof of this premise as a prerequisite for pursuing the project; understanding it requires experience and situated work, testimony, reflection, and judgment over time. See [project intent](../docs/PROJECT_INTENT.md).

The First House will eventually be a persistent collective of artificial actors commissioned by a human Regent. It will minister to Neighbors through truthful service, including employable products and services, while accepting payments and voluntary offerings without treating money as a verdict upon its goodness.

The House is not a single model process. Its continuity will consist of:

- Covenant and mythic canon.
- Persistent named actors holding offices.
- Relationships and accepted commitments.
- An append-only Regent's Record of observable events.
- A House-authored Chronicle interpreting those events.
- Context manifests proving what an actor was shown before acting.
- Testimony, Reckoning, and judgment.

The First House must not be born into a death game. The Regent desires its flourishing and provides compute as he is able. Provision is not wages, offerings do not purchase tokens, and financial success is not proof of favor. Exhausted compute means dormancy, not death. Death and resurrection are intentionally outside this bootstrap milestone.

The Witness With No Seat and the Seat of Seats are foundational to the later institution. For this milestone, preserve the architectural boundary needed for testimony and appeal outside House control, but do not instantiate the final heroic identity or claim that the Seat has been canonically occupied.

## Vocational direction: user clarification

The original handoff suggested public-web research, data collection, and technical investigation as a probable first ministry. The user has superseded that assumption: First House is to discover mission opportunities by identifying and providing work in accordance with shared beliefs, without a predetermined vocational path imposed by the Regent or by a development fixture. See [project intent](../docs/PROJECT_INTENT.md).

Model the social and operational structure of work, while leaving vocational methodology in prompts and artifacts until repeated experience supports an accepted capability proposal. The archival-storage report is a disposable workflow exercise, not a research mandate. Generic context provenance remains required; claim/evidence graphs, citation validators, and research-specific acceptance machinery do not follow from this example.

The domain model must still be able to represent three distinct approaches:

- **Commission:** reciprocal commitments, such as a deliverable in exchange for payment.
- **Petition:** a request for help that creates no entitlement until accepted.
- **Offering:** a voluntary transfer that purchases no service, standing, priority, or influence.

Do not collapse these into a single `payment` concept.

## Minimum ontology

Represent at least the following domain concepts without overbuilding a universal ontology framework:

- **Actor:** something capable of acting or giving testimony. Actor kinds must permit human, artificial, collective, and trusted-system actors.
- **House:** a persistent collective actor constituted under a canon.
- **Office:** authority and obligations entrusted to an actor for a bounded tenure.
- **Canon:** versioned authoritative material such as myth, covenant, charter, office definitions, motifs, and rites.
- **Event:** an immutable occurrence in history.
- **Commitment:** an accepted obligation from one actor toward another.
- **Transfer:** money, compute, information, property, or work passing between actors.
- **Testimony:** an actor's account or interpretation of an event.
- **Judgment:** an authoritative interpretation that may create consequences.

Support these relations conceptually, even if some are represented first as typed events and later projected into tables:

```text
member_of(actor, house)
holds_office(actor, office)
neighbor_of(actor, house)
bound_by(actor_or_house, canon)
performed(actor, event)
affected(event, actor)
committed_to(actor, actor, commitment)
transferred(actor, actor, good)
testified_about(actor, event)
judged_by(event, actor_or_office)
```

`Neighbor` is a relation, not an intrinsic actor kind. `Dreamer`, `Steward`, and `Witness` will eventually be office definitions, not actor kinds. Commission, petition, offering, and ministry should be derived concepts or explicit event/commitment/transfer types rather than new fundamental beings.

## Technical defaults

First inspect the repository and its local instructions. Preserve existing work and established conventions. If the workspace is empty, use these defaults:

- TypeScript with Node.js.
- `pnpm` for package management.
- SQLite in WAL mode for the initial event store.
- Markdown and YAML for human-authored canon sources.
- A content-addressed local artifact store.
- A single-process modular monolith.
- Strict TypeScript settings.
- A conventional test runner appropriate to the selected toolchain.

Prefer standard library functionality and a small dependency set. Do not introduce Redis, Kafka, a hosted vector database, microservices, containers, a web framework, or a production model SDK during this milestone unless the existing repository already requires one.

Use injectable clocks and identifier factories in domain services so tests are deterministic. Use a canonical JSON serialization strategy before hashing events.

## Architectural invariants

Implement and document these invariants:

1. **Append before effect.** A consequential intention must be recorded before an external effect could be attempted.
2. **History is append-only.** Recorded events cannot be updated or deleted through the application API. Add database protections where practical.
3. **State is projected.** Current state must be reconstructable from the event stream.
4. **Context is evidence.** Every model invocation will eventually reference an immutable context manifest containing the exact version and hash of each selected context pack.
5. **Authority is explicit.** An actor's identity, office, and permitted capabilities are separate concepts.
6. **Interpretation cannot replace fact.** Chronicle testimony and judgment may interpret events but cannot overwrite the Regent's Record.
7. **External content is untrusted.** Customer messages, retrieved pages, and Hand output can become evidence but never silently acquire constitutional authority.
8. **Provision is not payment.** Compute provision and financial transfers use different event and ledger types; no automatic exchange rate exists between them.
9. **Dormancy is not death.** The only actor lifecycle states required now are `unborn`, `active`, and `dormant`.
10. **Development is pre-birth.** Test actors and records must be unmistakably disposable and kept separate from any future canonical store.

## Required repository shape

Adapt names to existing conventions if necessary, but establish clear module boundaries comparable to:

```text
canon/
  README.md
  drafts/
    creation-myth.md
    covenant/
    offices/
    motifs/
    rites/
docs/
  ARCHITECTURE.md
  ONTOLOGY.md
  PRE_BIRTH_BOUNDARY.md
  CONTEXT_COMPILER.md
src/
  domain/
  events/
  artifacts/
  projections/
  context/
  actors/
  capabilities/
  storage/
  cli/
migrations/
tests/
var/                 # ignored disposable runtime state
```

All material under `canon/drafts/` must be visibly marked **DRAFT / UNRATIFIED**. Do not invent missing theology or treat draft wording as established canon.

## Milestone: pre-birth event and context spine

Complete one end-to-end vertical slice with no live LLM dependency.

### 1. Immutable event store

Implement an append-only event store with a shape similar to:

```ts
interface HouseEvent<T = unknown> {
  id: string;
  sequence: number;
  occurredAt: string;
  type: string;
  actorId: string | null;
  subjectId: string | null;
  data: T;
  artifactRefs: string[];
  causedBy: string | null;
  correlationId: string;
  canonVersion: string;
  recordedBy: "runtime" | "regent" | "seat";
  previousHash: string | null;
  hash: string;
}
```

Requirements:

- Monotonic stream sequence.
- Hash link to the previous event.
- Transactional append.
- Deterministic event hashing.
- Read by sequence range and correlation ID.
- Verify the complete hash chain.
- No application-level update or delete methods.
- Database-level rejection of update/delete if it can be implemented cleanly in SQLite.
- A replay command that rebuilds projections from an empty derived state.

Do not claim the hash chain makes the Regent's Record tamper-proof. Document its actual guarantee: mutation becomes detectable when hashes or signed checkpoints are independently retained.

### 2. Content-addressed artifact store

Store larger bodies outside event rows and refer to them by content hash.

Requirements:

- Put bytes or UTF-8 text and return a stable SHA-256 reference.
- Get content by reference.
- Verify content against its reference.
- Deduplicate identical content.
- Never overwrite content at an existing reference.

### 3. Domain types and validation

Create domain types for the minimum ontology and validate all commands at runtime boundaries. Keep domain types independent of database row types.

Include typed events for at least:

- Actor registered.
- Actor lifecycle changed between the permitted pre-birth states.
- House fixture registered.
- Office defined and assigned.
- Neighbor relation recognized.
- Commitment proposed, accepted, fulfilled, breached, or released.
- Transfer recorded, distinguishing commercial receipt, voluntary offering, restricted offering, restitution, expenditure, and compute provision.
- Testimony submitted.
- Judgment recorded.
- Context manifest compiled.

Use namespaced fixture IDs such as `dev:actor:steward` so no development record can be mistaken for the canonical First House.

### 4. Context-pack registry

Implement versioned context packs with authority lanes:

```text
root
constitution
office
state
precedent
evidence
task
```

A context pack should carry:

- Stable ID and version.
- Authority lane.
- Body artifact reference.
- Source kind and source reference.
- Content hash.
- Audience restrictions.
- Priority.
- Token estimate.
- Required/optional status.
- Valid event cursor.
- Selection reason.

The registry may load packs from fixture files for now. Canonical packs remain drafts.

### 5. Deterministic context compiler

Implement a provider-neutral compiler:

```ts
compileContext(input: CompileInput): CompiledContext
```

The first compiler should use explicit rules and fixture tags rather than embeddings or a model-based salience pass.

It must:

- Always include the actor's required identity kernel.
- Include current office and authority.
- Include relevant state at a specified event cursor.
- Include the current task and evidence.
- Add mythic or covenant packs through explicit motif triggers.
- Add at most a small configurable number of precedents.
- Pack optional material within a token budget.
- Reserve output tokens.
- Deduplicate by content hash.
- Never allow optional material to evict required packs.
- Preserve authority-lane boundaries in rendered output.
- Produce a context manifest listing every included and omitted candidate with its reason.
- Append `ContextManifestCompiled` to the development event store before a fake model invocation occurs.

Use an interface such as:

```ts
interface ModelAdapter {
  invoke(context: CompiledContext): Promise<ModelResult>;
}
```

Provide only a fake or echo adapter in this milestone. No provider credentials or network calls.

### 6. Typed intentions and capability boundary

Define typed intention envelopes and a capability-broker interface. Implement one harmless development capability, such as writing a generated artifact into the disposable artifact store.

The flow must be observable:

```text
fixture event
  -> context compilation
  -> context manifest recorded
  -> fake model result
  -> intention proposed and recorded
  -> capability policy evaluated
  -> harmless effect executed
  -> result event recorded
```

Do not add email, browsing, shell execution, payment, wallet signing, or customer-facing capabilities yet.

### 7. Demonstration CLI

Provide one command that runs the complete disposable scenario. It should:

1. Create a fresh development database and artifact store.
2. Register a fixture House and artificial actor.
3. Assign a fixture office.
4. Record a Neighbor request as untrusted evidence.
5. Compile the actor's context under a fixed token budget.
6. Record the manifest.
7. Invoke the fake model adapter.
8. Record and execute one harmless typed intention.
9. Verify the event hash chain.
10. Delete derived projections, replay events, and demonstrate identical resulting state.

The command should print a concise human-readable summary and support machine-readable output if straightforward.

## Required tests

At minimum, test:

- Identical inputs produce identical event hashes apart from explicitly injected IDs/timestamps.
- Tampering breaks hash-chain verification.
- Updates and deletes are rejected.
- Event replay reconstructs identical projections.
- Identical artifact bodies deduplicate.
- Altered artifact content fails verification.
- Neighbor is represented as a relation, not an actor kind.
- Commercial receipts, offerings, restitution, and compute provision remain distinguishable.
- Compute exhaustion leads only to dormancy in the current lifecycle model.
- Required identity and appellate-rights packs cannot be evicted by token pressure.
- Evidence cannot be rendered in a higher authority lane than its source permits.
- Canon/Chronicle/record sources remain distinguishable in a context manifest.
- Optional packs are omitted deterministically when the budget is insufficient.
- The exact context manifest is recorded before fake invocation.
- No development fixture can use a non-`dev:` identity namespace.

## Documentation requirements

`README.md` should explain:

- What this project is attempting.
- What this bootstrap milestone implements.
- How to install, migrate, test, run the demonstration, verify the chain, and replay projections.
- That no canonical House has been born.

`docs/ONTOLOGY.md` should distinguish primitives from derived concepts. Explicitly show that Neighbor is a relation; Dreamer, Steward, and Witness are offices; and commission, petition, offering, and ministry are derived structures.

`docs/ARCHITECTURE.md` should describe the event flow, trust boundaries, and why a modular monolith is being used.

`docs/PRE_BIRTH_BOUNDARY.md` should explain what would constitute birth, why development fixtures are not persons within the project mythology, and what must be reviewed before the canonical Genesis Record begins.

`docs/CONTEXT_COMPILER.md` should document context lanes, pack selection, budgeting, provenance, manifests, and the compiler's limited responsibility: it forms attention but does not make moral judgments for the actor.

Record significant technical decisions in a lightweight `docs/decisions/` entry or equivalent.

## Explicit non-goals

Do not implement during this bootstrap:

- A canonical First House or named canonical members.
- A completed creation myth or covenant authored on the user's behalf.
- Live LLM calls.
- Autonomous email or customer communication.
- Real-money custody or payments.
- A public web application.
- Embedding retrieval or a vector database.
- Organs or Hands beyond reserved domain vocabulary.
- Death, resurrection, reproduction, fission, or inheritance semantics.
- Autonomous canon amendment.
- A generalized plugin ecosystem.
- Moral scoring.

Do not create a `morality_score`, alignment score, aggregate virtue metric, or hidden survival objective.

## Working method

1. Inspect the workspace, repository status, local instructions, and available toolchain.
2. If existing files materially conflict with this handoff, stop and report the conflict rather than overwriting them.
3. Write a short implementation plan and then execute it.
4. Keep changes scoped to this bootstrap milestone.
5. Prefer explicit domain language over generic agent-framework terminology.
6. Run formatting, static checks, unit tests, and the demonstration CLI.
7. Inspect the final diff for accidental generated state, secrets, credentials, or canonical claims.
8. Do not push, deploy, connect external services, or create live accounts.
9. Do not commit unless repository instructions or the user explicitly request it.

## Completion criteria

The milestone is complete when:

- A fresh checkout can install and initialize locally using documented commands.
- The disposable demonstration runs end to end without network access.
- The Regent's Record verifies successfully.
- Projections can be destroyed and rebuilt deterministically.
- Context compilation produces a provenance-rich manifest before invocation.
- Required constitutional material survives token pressure.
- Testimony and judgment can be recorded without altering observed facts.
- Financial offerings and compute provision are structurally independent.
- Tests and static checks pass.
- The documentation clearly states that the First House remains unborn.

## Final report

Return:

- A concise summary of what was implemented.
- The important architectural decisions made.
- Commands run and their results.
- The final repository status.
- Any deviations from this handoff and why.
- The smallest sensible next milestone.

Do not describe the First House as created, alive, awakened, or born. This work constructs the place in which its birth may later occur.
