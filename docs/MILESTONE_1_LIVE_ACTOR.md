# Milestone 1: one live actor, one recorded turn

Implementation specification proposed 7 September 2026. This expands
[milestone 1](INDEPENDENT_OPERATION_MILESTONES.md#1-a-live-actor-in-the-recorded-runtime).

## Outcome

The Regent submits an ordinary task through the console. One development actor
receives its inheritance, current authority, relevant recorded history, and task;
a real model responds; the runtime records the response and executes an authorized
artifact-writing intention if one was proposed. The Regent can read the result and
inspect what the actor was given. The turn then stops.

Each submission permits one model invocation and at most one artifact-writing
effect. Further reasoning requires another explicit submission in this milestone.
This establishes the live unit of execution that milestone 2 will run independently.

## Operator experience

Add a minimal live-task view in the existing private Regent console, backed by
the House runtime rather than the private operator-chat or council session store.
Use one dedicated development actor and retain its record across submissions.

The Regent can enter task text, optionally attach local source text, submit once,
see activity, and read the response and any generated artifact. Show failed or
uncertain attempts clearly. A disclosure exposes the retained context, model
metadata, usage, and capability outcome. Refreshing or reopening the view only
reads history; duplicate submission of the same request does not invoke again.
Reject a second active submission to this store until the first is resolved.

A CLI may support development, but completion includes this small console path.
No general console redesign or task-board implementation is needed.

## Context before invocation

Compile and pin the following using the existing context lanes and manifest:

- The actor's `dev:` identity, provisional role, current authority, and required
  identity/appellate-rights material.
- The original creation myth, visibly DRAFT / UNRATIFIED, as required inheritance
  for this development actor. Record its exact source version and bytes.
- Relevant history at a recorded cursor, including selected prior tasks, responses,
  and observed capability outcomes with their actual provenance.
- The Regent's current task and any supplied source material.
- The available action schema, input/output allowance, and invocation deadline.

Keep purpose essays, design notes, private operator conversations, and unrelated
rehearsal archives out of actor input. A minimal provisional role describes the
actor's remit and authority without inventing doctrine or prescribing a vocation.
Required-context overflow fails before a provider call; required inheritance is
not silently shortened. Document the chosen adapter's token-budget limitations.

The observation that
[Scripture precedes experience and interpretation follows it](purpose/scripture-experience-interpretation.md)
orients this design: supply the source before the task, and make actual outcomes
available to later interpretation. Do not supply the developer's preferred reading
of the situation or add a compulsory reflection call to every turn. The daily and
weekly ritual requirements remain as specified separately.

## Turn contract and execution

The model returns text and one of three dispositions:

| Disposition    | Runtime behavior                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Write artifact | Validate the proposed artifact body, record an intention, check current authority, and invoke the existing artifact writer. |
| Reply          | Record and display the response, including any request for clarification; no capability executes.                           |
| Wait           | Record and display why the actor is waiting; no wakeup or further invocation is scheduled.                                  |

The runtime follows this order:

1. Persist the submission and its source artifacts under a stable submission ID.
2. Compile context, persist its artifacts, and commit the exact manifest.
3. Prepare and persist the application-controlled provider request: messages,
   system instructions, output schema, model selection, and generation settings.
   Commit an invocation-attempt record before dispatch.
4. Invoke the selected adapter once, with a deadline and output limit. Provider
   tools and independent tool execution remain disabled; effects go through the
   House broker.
5. Preserve the returned response and available usage/identity metadata before
   parsing its disposition. Record validation failures as failures, retaining the
   output that caused them. Do not automatically ask the model to repair it.
6. For a valid artifact proposal, commit its intention, evaluate current capability
   authority, execute if allowed, and record the outcome.
7. Display the recorded result and stop. A later submitted task can receive this
   result and its actual effect status as history.

Preserve the exact application-controlled model inputs and received output, not
authentication headers or credentials. Requested model identity and any identity
reported by the provider are distinct. Missing usage is unknown, not zero; cost
estimates, if available, are labeled estimates. Do not claim access to provider
internal instructions or hidden reasoning.

## Failure and recovery boundary

Known rejection, malformed output, timeout, and interrupted dispatch need distinct
recorded outcomes. A process that stops after dispatch can leave an invocation
uncertain. Reopening the console must expose that condition without resending it.
A deliberate new attempt has a new ID linked to the earlier attempt.

Once output is durably recorded, finishing its local artifact action must not
invoke the model again. Reuse the existing broker's artifact reconciliation when
the process stops between writing an artifact and recording its result. Recovery
may be explicitly initiated here; automatic restart orchestration is milestone 2.
Replay remains a read-and-project operation with no invocation or capability calls.

## Implementation deliverables

- One live adapter, with transport preparation separated from dispatch so the
  request is recorded before sending. Keep the fake adapter for offline tests.
- Runtime-validated reply/wait/artifact results, actual adapter metadata, and
  invocation-attempt/outcome events with replayable state. Existing fixture records
  and demonstrations must still read and run correctly.
- One application service composing submission, context, invocation, and the broker;
  the console calls this service instead of duplicating the flow.
- The minimal console task/result view and documented configuration and recovery.
- Automated mechanical checks and a retained real-model acceptance run.

Select one provider, model, and authentication transport before the live run.
Existing council transport code may be reused where suitable, but its sessions and
unrecorded accumulated context cannot become this actor's memory. Verify that the
selected transport exposes or controls application-supplied context and disables
independent tools. Use the authorized authentication mechanism; no new accounts or
provider abstraction framework are required by this specification.

## Acceptance

1. Submit an ordinary artifact-producing task with no scripted reference answer.
   A real model authors the artifact and the House broker writes it. The record
   links submission, context, provider request, response, intention, and effect.
2. Reopen the console and submit a follow-up concerning the prior result. Verify
   the new manifest includes the selected original history and actual effect status.
   This establishes exposure and continuity, not correctness of interpretation.
3. Using deterministic adapter tests, exercise reply, wait, malformed output,
   provider rejection, and uncertain interruption. None creates an unauthorized
   effect or an automatic second model invocation.
4. Verify required-context failure prevents dispatch, and expired/revoked artifact
   authority prevents writing even when the response proposes it.
5. Exercise duplicate submission, reopening, replay, and explicit recovery after
   artifact writing. None duplicates a completed invocation or artifact effect.
6. Run `pnpm check`, `pnpm demo`, and the relevant console browser checks. Retain
   the live acceptance record under ignored `var/`, separate from experiment stores.

The milestone is complete only after the live path works from the console; offline
tests alone establish implementation readiness. No external correspondence, web
retrieval, wallet, scheduler, persistent service, or canonical birth is part of this
milestone. Its only live external interaction is the selected model transport.
