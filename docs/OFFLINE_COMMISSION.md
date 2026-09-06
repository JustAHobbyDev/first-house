# Durable offline archival-storage commission

This is a fixture of general work coordination, not a prescribed vocation. Its
source corpus, report structure, and acceptance criteria belong to this particular
commission. Shared House machinery records context, invocation, artifact, delivery,
and review; it does not model the report's individual claims or methodology. See
[project intent](PROJECT_INTENT.md).

This milestone uses the user's three supplied records to exercise one complete,
resumable commission. The expected recommendation is North Closet: all twelve
crates fit, moisture conditions compare favorably to the cellar, and weekly access
is workable. The East Study is driest but lacks capacity while its protected desk
remains. The Closet's unexplained post-storm 71% RH spike remains a residual risk.

Every actor, document, report, and review is disposable development material. No
canonical House has been born. The adapter is a **scripted reference fixture**,
not a live reasoning model. It checks that all three exact source records were
rendered as evidence before returning the reference report. This demonstrates
provenance, workflow, and recovery; it does not demonstrate autonomous synthesis.

## Roles and acceptance

- The Steward proposes terms and explicitly accepts the obligation.
- The Steward generates and delivers an immutable artifact. Delivery is not
  acceptance and cannot fulfill the commission.
- The requesting Neighbor reviews the exact latest delivered revision, accepting
  it or requesting revision with recorded feedback.
- Either party can dispute a revision request before new work begins.
- The Regent records a judgment and returns the delivery to Neighbor review or
  requests revision. This does not accept on the Neighbor's behalf.
- Explicit Neighbor acceptance permits a separate fulfillment event. If interrupted
  between those events, resume completes fulfillment from the recorded acceptance.

The CLI is operated by the trusted local human, who plays these fixture roles.
Command names identify the role being exercised; this is not multi-user
authentication or an independent appellate service. No money changes hands.

## Run and inspect

Build once, then run each command in its own process:

```sh
pnpm install --frozen-lockfile
pnpm build
node dist/src/cli/main.js commission init var/dev-storage
node dist/src/cli/main.js commission inspect var/dev-storage
node dist/src/cli/main.js commission accept-terms var/dev-storage
node dist/src/cli/main.js commission advance var/dev-storage
node dist/src/cli/main.js commission report var/dev-storage
```

Use a separate directory from the original bootstrap demo. Initialization is
resumable for the same fixture and refuses a conflicting request. It reads the
source files from `fixtures/archival-storage/`, stores their bytes by hash, and
records evidence receipt, terms, and the commission. Receipt creates no obligation
until `accept-terms`. No expected-answer document is placed in the input context.

Append `--json` to any command for structured output, including source hashes,
work checkpoints, delivery history, review history, and artifact paths. `report`
shows the latest report; `report DIRECTORY 1` retrieves revision 1 even after a
later revision. The `pnpm commission` convenience command builds before passing
arguments to the same CLI; direct `node` commands avoid build output in JSON.

## Review, revise, or dispute

Write the human's actual feedback in a UTF-8 file. To accept delivered revision 1:

```sh
node dist/src/cli/main.js commission review var/dev-storage 1 accept --feedback-file neighbor-feedback.md
```

To request revision instead:

```sh
node dist/src/cli/main.js commission review var/dev-storage 1 revise --feedback-file neighbor-feedback.md
node dist/src/cli/main.js commission advance var/dev-storage
node dist/src/cli/main.js commission report var/dev-storage 2
```

Reviews require the revision number. A stale review cannot accidentally accept a
newer report. Previously delivered bytes and prior reviews remain unchanged.
Feedback is included as evidence in subsequent contexts. The scripted adapter's
later revisions add a fixed clarification of the priority ordering; they are not
general-purpose responses to arbitrary feedback. Human judgment remains explicit,
and automated tests do not grant acceptance in a user's working directory.

To dispute a revision request before advancing work, supply separate UTF-8 files
with the party's grounds and the Regent's reasoning:

```sh
node dist/src/cli/main.js commission dispute var/dev-storage 1 --by steward --reason-file dispute.md
node dist/src/cli/main.js commission resolve var/dev-storage 1 return-to-review --reason-file regent-judgment.md
```

`--by neighbor` also permits a Neighbor-raised dispute. The other resolution is
`revise`. A resolution references an authorized judgment about the exact dispute,
and its consequence must match that judgment's recorded resolution. Dispute
grounds and judgments are evidence in a later revision's context. A disputed
commission cannot advance or be accepted until resolution.

## Restart and replay

```sh
node dist/src/cli/main.js commission resume var/dev-storage
node dist/src/cli/main.js verify var/dev-storage --json
node dist/src/cli/main.js replay var/dev-storage --json
```

`resume` is the same operation as `advance`: it inspects durable state and performs
only the next permitted work. It never invents human acceptance. A commission
awaiting review, in dispute, or already fulfilled is left at that stage. Dormancy
or missing current office authority prevents work while retaining the obligation.
The fixture office tenure remains bounded, ending on 1 January 2027; it is not
silently renewed. Lifecycle changes can be exercised through the existing typed
domain API; no automatic compute-metering service is introduced.

Work checkpoints retain the manifest reference, revision, and intention ID. A
recorded fake result is reused after restart. An existing successful artifact effect
is reconciled before delivery; delivery is not repeated. Interruption immediately
after a manifest commit but before its work checkpoint can leave an unused manifest;
resume compiles a new one without having invoked the adapter on the unused one.
An invocation interrupted before its result commits may be retried: exactly-once
model invocation is not claimed. The tests terminate real child processes at
eight durable checkpoints and resume with the CLI.

Replay only rebuilds projections. It does not invoke the adapter, execute the
broker, deliver work, or accept a report. Use one CLI writer at a time, consistent
with the existing single-writer broker boundary. Failed/denied capability results
remain explicit terminal attempts; this milestone does not add automatic retry
or a general job scheduler. Required context still fails rather than truncates
if accumulated history exceeds the fixed 16,000-token estimate budget, which
reserves 2,048 tokens for output.

## Fixture provenance

| Supplied source ID                     | Internal evidence ID                            |
| -------------------------------------- | ----------------------------------------------- |
| `dev:building-storage-survey-01`       | `dev:evidence:building-storage-survey-01`       |
| `dev:environmental-observation-log-01` | `dev:evidence:environmental-observation-log-01` |
| `dev:steward-storage-note-01`          | `dev:evidence:steward-storage-note-01`          |

The extra namespace component satisfies the existing identity validator. Source
text and original IDs are preserved; citations and pack provenance use the supplied
IDs. The survey's unusual afternoon-sunlight/east-facing-window wording is retained,
not silently corrected. The comparison relies on logged temperature observations.

The expected report lives separately in `expected-report.md`. Tests check its
material claims and citations and exercise a deliberately wrong temperature-only
report through revision. Acceptance is a recorded human decision, not a keyword
score or an automated truth verdict. The scripted adapter intentionally rejects
different source bytes; changing the fixture requires reviewing its reference
report and acceptance tests as well.
