# Context compiler

The compiler forms attention; it does not make moral judgments for an actor.
It uses explicit fixture rules, tags, and deterministic budgeting. There are no
embeddings, model salience calls, provider credentials, or network dependencies.

Mythos's intended formative role extends beyond the compiler's pack-selection
rules. This component can establish what an actor was shown; it cannot decide
whether that inheritance effectively guides the actor through unfamiliar work.
That limitation does not make simulated proof of formation a prerequisite for
the project. See the formative premise in [project intent](PROJECT_INTENT.md).

Context provenance applies to any kind of work. The evidence lane records supplied
material without granting it constitutional authority; it does not imply a
claim/evidence model, citation semantics, or mandatory research documents. The
compiler preserves what an actor was shown, not a proof of its reasoning. See
[project intent](PROJECT_INTENT.md).

## Lanes and provenance

Rendered output is a deterministic JSON document with separate ordered lane
objects: `root`, `constitution`, `office`, `state`, `precedent`, `evidence`, `task`.
Pack bodies are JSON string values, so body text cannot syntactically close one
lane and create another. These boundaries preserve provenance; they cannot prove
that a future language model will obey the intended instruction hierarchy.

| Source                      | Permitted lanes                                |
| --------------------------- | ---------------------------------------------- |
| Trusted development fixture | Any lane, explicitly authored by the developer |
| Draft canon                 | Constitution, visibly DRAFT / UNRATIFIED       |
| Regent Record               | Office, state, evidence                        |
| Chronicle interpretation    | Precedent, evidence                            |
| External content            | Evidence only                                  |
| Task instruction            | Task only                                      |

Source classification is assigned at trusted ingestion, never inferred from a
document's claims about itself. Fixture packs cannot be accepted from untrusted
model or Neighbor output. Every pack records ID/version, purpose/scope, lane,
body hash/reference, source kind/reference, audience, priority, token estimate,
required flag, valid event cursor range, tags, and selection reason.

The registry accepts immutable versions. It rejects registering an existing
ID/version; the compiler rejects ambiguous simultaneously eligible versions of
one pack ID. Old versions may remain candidates outside their cursor ranges.

## Selection and budgeting

1. Validate each pack and verify its body bytes, source/lane permissions, purpose,
   estimate, and development identity.
2. Select candidates by actor, task, evidence IDs, and explicit motif tags.
   Preserve every excluded candidate with its exclusion reason.
3. Enforce audience and event cursor validity. A relevant required pack that is
   unavailable causes compilation failure.
4. Require identity, appellate rights, current office/authority, state, task, and
   every requested evidence item. State and office snapshots must exactly match
   the supplied projection and pin the source event, cursor, and occurrence time.
   The orchestration layer derives these from the development record.
5. Include required material first. Sort optional candidates by descending priority,
   then lexicographic ID and version; include only those fitting the remaining
   budget and the configured precedent limit. Motifs require explicit triggers.
6. Serialize the lane document and construct the full provenance manifest.

The estimator is `ceil(UTF-8 byte length / 4)`, versioned as
`utf8-bytes-div-4-v1`. Costs include the complete rendered envelope and any pack
estimate above this body's minimum estimate. Output tokens are reserved before
input selection. This is a deterministic fixture estimate, not a guarantee about
any provider tokenizer. A future adapter needs provider-specific budget checks.

If required material plus output reserve exceeds the budget, compilation fails
and no invocation occurs. Required material is not truncated or evicted.

Storage deduplicates globally by body hash. Rendering deduplicates identical
content **within a lane** while preserving all candidate provenance and a
`duplicateOf` reference. Cross-lane duplicates remain rendered in each lane;
sharing bytes does not allow evidence to acquire constitutional authority. This
is a deliberate refinement of the handoff's unqualified deduplication requirement.

## Manifest and invocation ordering

The immutable manifest includes every included/omitted candidate and reason,
source versions/hashes, actor, task, evidence IDs, motif triggers, historical
cursor and event/time, budget/reserve, estimated input cost, precedent limit,
compiler/estimator versions, and rendered-content reference. Its own SHA-256
reference identifies the exact manifest body.

The orchestration layer verifies referenced bodies, persists the rendered context
and manifest, then commits `ContextManifestCompiled`. Only afterward may
`invokeRecorded` call the fake adapter. That boundary compares exact manifest and
rendered bytes to their committed references, checks the actor remains active,
and passes a detached copy to the adapter. The result is validated and recorded.

Historical context does not grant permanent capability authority. The broker
evaluates current lifecycle and tenure after the intention is proposed. Retaining
manifests and artifact bytes permits reconstruction independently of later registry
changes, and testimony can interpret their contents without altering them.
