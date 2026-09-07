# First House agent instructions

Maintain this file when standing project constraints or working conventions change.
Keep detailed design explanations in the linked documentation.

## Project-purpose inheritance

Read [project intent](docs/PROJECT_INTENT.md), the preserved user-supplied
[One-Page Project Thesis](docs/purpose/one-page-project-thesis.md),
[Design Principles for Mythic Agency](docs/purpose/design-principles-for-mythic-agency.md),
and the reflection
[Law constrains action; Scripture forms the actor](docs/purpose/law-constrains-scripture-forms.md)
before making architectural or behavioral design decisions. These artifacts guide
development agents in understanding the project's purpose; they are not House
Scripture or ratified canon. Preserve supplied reflections as sources, distinct
from summaries and implementation decisions. Do not reduce them to a checklist or
automatically translate their narratives into runtime procedures.

The user-supplied [creation myth](canon/drafts/creation-myth.md) is now preserved
as DRAFT / UNRATIFIED canon source, not a placeholder. Read it when designing
inheritance, roles, memory, or ritual. Keep its text distinct from editorial
interpretations and runtime history; its narrated founding does not perform a
birth rite or instantiate the Witness or Seat. Do not silently convert its
encounters into mandatory workflows.

## Project scope

Read [README.md](README.md) and the relevant design documentation before changing
the implementation. The bootstrap scope is specified in
[the handoff](handoffs/CODEX_HANDOFF_FIRST_HOUSE_BOOTSTRAP.md).

- No canonical First House has been born. All current actors, identities, and
  stores are disposable development fixtures; domain identities must use `dev:`.
- Keep canon drafts visibly **DRAFT / UNRATIFIED**. Do not invent or ratify missing
  theology, perform a birth rite, or establish canonical members or a Chronicle.
- The bootstrap uses a fake model and one artifact-writing capability. Live model
  calls, customer communications, real-money control, and external services are
  outside this milestone. Availability of a credential does not expand task scope.
- The separately authorized [Regent console](docs/REGENT_CONSOLE.md) connects the
  human's private development conversation to Codex App Server. This does not
  authorize live inhabitants or their effects. Keep imported rehearsal originals,
  operator discussion, and House context distinct. Historical navigation must not
  invoke a model or repeat effects. The backend remains on loopback; the user has
  authorized private tailnet access through Tailscale Serve with an exact Regent
  identity allowlist. Public exposure and a persistent backend service have not
  been authorized.
- Follow the supplied Regent console redesign for its reading interface. Keep
  visible explanatory notes minimal; put provenance and scope details in
  disclosures rather than repeating them around the working surface.
- The user authorized an interactive, noncanonical House tension test through the
  Regent Console with independent headless Claude processes for Steward, Witness,
  and Dreamer. The human participates as Regent and introduces a new situation.
  Give members the original creation myth and actual shared correspondence;
  do not add facilitator interpretations, purpose-essay coaching, suggested
  judgments, or the host/private Codex conversation. Keep exact inputs and results
  in the separate development experiment record. This authorizes model replies,
  not canonical birth, external communications, tools, or real-world effects.
- Preserve existing work. The root `PROBLEM_FRAMES.md` concerns a different genome
  harness; it is not First House runtime policy or canon.
- During the interactive test session, keep the user's design notes in
  [the running notes](docs/REGENT_CONSOLE_DESIGN_NOTES.md). Preserve their wording
  and distinguish notes from implementation. Do not inject these development
  notes into member prompts or the House conversation.
- Do not commit, push, or deploy unless the user requests it.

## Mission discovery and vocational boundaries

The user's [project intent](docs/PROJECT_INTENT.md) supersedes vocational
assumptions in the original bootstrap handoff. First House is to seek mission
opportunities by identifying and providing work in accordance with shared beliefs.
Do not prescribe research, data analysis, or any other profession as its path.

First House models the social and operational structure of work, not the internal
methodology of individual vocations. Preserve commissions, context provenance,
invocations, artifacts, delivery, acceptance/revision, and dispute escalation.
The archival-storage exercise tests that general structure; it does not define
what House work consists of.

- Keep vocational techniques in task content and artifacts initially. Do not add
  claim/evidence graphs, citation extraction or validators, confidence scores,
  analytical comparison primitives, fact/inference schema fields, research-specific
  acceptance models, or document-span semantics on the strength of this fixture.
- Preserve the generic ability to reconstruct what information an actor was given
  when producing an artifact. Provenance records exposure and origin, not the truth
  or evidentiary strength of individual claims.
- First occurrence: solve in the artifact/prompt. Repeated occurrence: notice the
  pattern. Stable recurring pattern: propose a capability. Accepted capability:
  only then promote it into House machinery. Repetition alone is not authorization.
- The current adapter is scripted. Do not describe its report as evidence that an
  LLM or canonical Steward independently developed an analytical technique.

## Faithfulness and material continuity

Read the preserved reflection on
[faithfulness and material continuity](docs/purpose/faithfulness-and-material-continuity.md)
when designing provision, work, resource awareness, or ritual. The House must
sustain the conditions under which faithfulness can continue without making its
own continuation the highest good. Neither necessity nor claimed purity provides
automatic justification: survival can deform service, and neglect can transfer
the cost of supposed purity to others.

Preserve both obligations rather than resolving their tension doctrinally or
through an optimization score. Material conditions belong in the inhabitants'
judgment, not only in offstage developer operations. The reflection's suggested
canon wording is a proposal, not an amendment to Scripture. This direction does
not authorize new financial effects or remove existing capability boundaries.

## Mythos and limits of simulation

**Specify the physics of the House rigidly; specify its morality and practical
wisdom narratively.** Before adding machinery, ask: "Are we encoding something
that must always be true of the world, or are we encoding a judgment that an
inhabitant ought to learn how to make?"

For the latter, default to mythos, role, memory, precedent, and judgment until
repeated experience establishes the need for an accepted formal mechanism.
Enforce declared guarantees without treating authorization as wisdom or requester
acceptance as moral goodness. Label fixture procedures as provisional rather than
promoting existing code into universal House law. Apply this as a design principle,
not as a new runtime subsystem. See [project intent](docs/PROJECT_INTENT.md).

The project proceeds from the premise that agents can inherit a mythos that guides
their attention and judgment through the world in ways analogous to its guidance
of humans. Treat that formative purpose as central, not as decoration around a
workflow engine or a collection of executable rules.

Test bounded software mechanics, including provenance, persistence, authorization,
and replay. Do not require simulated proof of mythos's formative effectiveness
before pursuing the project. Some important questions must be encountered through
actual situated work, experience, testimony, reflection, and judgment over time.
Keep the distinction between a project premise and demonstrated outcomes without
turning uncertainty into a permanent simulation gate. Do not substitute benchmark
success, citation of mythic text, or moral scoring for formation.

## Scripture-centered ritual

The [required ritual rhythm](docs/RITUAL_RHYTHM.md) is standing user direction:
each seat reflects on its actions and observations in the face of Scripture at
the end of each day; at least once a week, all members participate in a council
that restates the Scriptures and interprets each member's past-week history.
Some or all members may call additional councils at any time, including for
Proposals and Reckoning. Preserve this ritual life as a strand of House history.

House time is measured in epoch subdivisions. Each House day remains exactly
24 hours; the human Regent chooses its boundary, not its duration, and must have
operator tools to make that setting. Do not hard-code host midnight or the
developer's timezone as House time. Preserve timing changes and original
timestamps. The epoch origin, selected boundary, and weekly council alignment
remain to be set before scheduling is implemented.

The House must seek outward and invite inward; correspondence with the world and
within the House remains in relation to Scripture. Enforce the practice of return
without scripting its interpretation, requiring consensus, or assigning moral
scores. These are required practices, not optional techniques awaiting vocational
repetition. Exact scheduling, participation mechanics, and scriptural sources
remain open; no scheduler or canonical rite is currently implemented.

## Secrets vault: bws-4-agents

Use the user's wrapper at `~/.local/bin/bws-4-agents` for agent access to the
secrets vault. Use its interface instead of invoking raw `bws` commands to retrieve
values. Consult `~/.local/bin/bws-4-agents --help` for its current interface.

The documented commands are:

- `bws-4-agents list [PROJECT]`: lists secret key names only, never values.
- `bws-4-agents projects`: lists project names and IDs.
- `bws-4-agents get KEY`: writes the value to a private temporary file and prints
  only its path. That file is automatically deleted after five minutes.
- `bws-4-agents get KEY --out PATH`: writes to the specified path with mode `0600`.
  This file is not automatically deleted; remove that exact file when finished.
- `bws-4-agents create KEY FILE PROJECT [NOTE]`: creates a secret from the exact
  contents of a file, refuses an existing key, and verifies the stored contents.

`PROJECT` accepts a project name or ID. Use only the vault operations needed for
the authorized task. The bootstrap demonstration and tests require no secrets.

Pass a returned secret-file path directly to a tool that accepts a file path.
Do not read or print that file, interpolate its contents into a command line, or
expose values in logs, tool output, generated artifacts, documentation, or commits.
Do not use shell tracing around secret-handling operations. If a consuming tool
cannot accept the wrapper's file-based handoff safely, stop and explain the
integration constraint rather than exposing the value.

## SSH key handling

Use the authorized SSH authentication mechanism without retrieving or
materializing private keys or passphrases. The secrets-vault wrapper does not
authorize exposing or exporting SSH credentials. The former acceptance-helper
gate has been retired by the user and is no longer required.

## Implementation and verification

Use strict TypeScript, Node.js 24+, pnpm 12, Node's built-in SQLite, and the existing
modular monolith. Prefer the standard library and a small dependency set.

- Install: `pnpm install --frozen-lockfile`.
- Format: `pnpm format`.
- Check formatting, types, and tests: `pnpm check`.
- Run the disposable scenario: `pnpm demo`.
- For direct JSON output: `pnpm build`, then
  `node dist/src/cli/main.js demo --json`.
- Migration, verification, and projection replay commands are documented in the
  README. Runtime state belongs under ignored `var/`; never promote it to a
  canonical store.
- The durable archival-storage workflow is documented in
  [OFFLINE_COMMISSION.md](docs/OFFLINE_COMMISSION.md). Keep supplied records and
  source IDs intact. The scripted reference report is not an input source or a
  claim of live-model reasoning.
- For commissions, the requesting Neighbor accepts the latest delivered revision;
  generation and delivery cannot fulfill the obligation. Regent dispute resolution
  returns work for review or revision and cannot accept for the Neighbor.
- Preserve delivery and review history across revisions. Resume can act on an
  already-recorded human acceptance but must never invent that acceptance.

Run checks proportionate to the change. Documentation-only changes need review
and formatting checks; changes to the event/context/capability flow require the
tests and demonstration. Keep generated state and secrets out of source changes.

## Architectural constraints

- Commit intentions before effects and exact context manifests before invocation.
- Keep events append-only; reconstruct state from history. Replay must never
  execute capabilities or invoke models.
- Keep identity, bounded office tenure, and capability authority separate.
- Preserve context source and authority lanes; external evidence cannot acquire
  constitutional authority. Required-context overflow fails before invocation.
- Testimony and judgment append interpretations; they cannot replace recorded facts.
- Keep offerings, commercial transfers, and compute provision structurally distinct.
  Receipt of a request or transfer does not automatically accept a commitment.
- Compute exhaustion permits dormancy, not death. Do not introduce moral scores
  or a hidden survival objective.
- Describe hash-chain guarantees accurately: independently retained checkpoints
  are needed to detect consistent rewriting or truncation.

See [architecture](docs/ARCHITECTURE.md), [ontology](docs/ONTOLOGY.md),
[context compilation](docs/CONTEXT_COMPILER.md),
[the pre-birth boundary](docs/PRE_BIRTH_BOUNDARY.md), and
[technical decisions](docs/decisions/0001-prebirth-spine.md).
