# Milestones toward independent operation

Proposed implementation sequence, 6 September 2026, following the user's
[priority shift](PROJECT_INTENT.md#immediate-priority-independent-operation).
These are completion targets, not claims of implemented behavior or authorization
to activate unspecified accounts or funds.

The objective is an app that can notice opportunities, communicate, undertake
work, receive and spend money, and continue from the consequences without the
Regent manually driving each turn. The Regent grants authority and provision;
the actors exercise judgment within them.

## Starting point

The bootstrap already provides append-only events, immutable artifacts, context
manifests, authority checks, replay, and a durable offline commission workflow.
Its model result and broker support only artifact writing. The console's live
member conversations run separately and have no tools; they are not yet the
operational House runtime. Reuse the substrate and suitable integration code.
Keep experiment originals and private operator conversation separate.

## 1. A live actor in the recorded runtime

See the [milestone 1 specification](MILESTONE_1_LIVE_ACTOR.md) for the console flow,
turn contract, implementation deliverables, and acceptance tests. Its unit of work
is one manually submitted task, one live invocation, and at most one local artifact
effect. Automatic continuation begins in milestone 2.

Replace the scripted response path with one real model adapter connected to the
existing context and event flow. Preserve the exact application-supplied request,
model identity and settings, returned output, usage, and failures. Allow the actor
to propose a supported action, respond, or wait; validate its output before effects.
Keep artifact writing as the first capability and retain the fake adapter for tests.

Choose one provider and the initial development actor's source context. Inherited
myth and role material must remain distinct from developer commentary and private
operator chat. Give the actor its relevant history and resource allowance.

**Complete when:** an unscripted task produces a real model-authored artifact through
the broker, and the retained record reconstructs the supplied context and result.
Malformed output and provider failure leave a recoverable, truthful record.

## 2. Durable independent execution

Add a single-worker loop that resumes from recorded work, invokes the actor, routes
intentions through the broker, returns outcomes to context, and continues or waits.
Support incoming-event wakeups and explicit task wake times. Persist pending work,
invocation attempts, and effect attempts; distinguish uncertain outcomes from known
failures. Prevent concurrent executors from claiming the same action.

Add turn and compute budgets, pause/resume, authority revocation, and visible
activity in the Regent console. Authority is checked at execution time. Exhaustion
permits dormancy and later resumption. These controls start here rather than being
left for launch. Task wake times do not choose the House's ritual calendar.

**Complete when:** the actor completes a task requiring several actions without
manual turn dispatch, survives a process restart, and resumes from recorded work.
Pause and revocation stop new effects; replay invokes nothing. An interrupted
model call is recorded as uncertain and any new attempt has its own record.

## 3. First direct interaction with the world

Connect one external information source and one bidirectional correspondence
channel. The actor can retrieve fresh information, receive a message, decide what
to do, and send a reply within granted authority. Preserve exact correspondence,
source identifiers, recipients, attachments, and observed delivery status. Make
this history available for Witness review without asserting canonical office.

Extend the broker to asynchronous external effects. Use provider idempotency and
status lookup where available; ambiguous delivery must remain unresolved until
reconciled, with no blind resend. Keep credentials behind the capability boundary
and external text in its source authority lane. Select the channel, account, and
initial permitted interactions before activation.

**Complete when:** a permitted external participant sends a real request and
receives an actor-generated reply without Regent copying or dispatching. The
actor can obtain relevant external information itself. Duplicate ingress and an
interrupted send do not silently produce duplicate work or correspondence.

## 4. A usable wallet with delegated spending authority

Connect one money rail that supports the first intended receipt and expenditure.
Choose its account or custody arrangement, currency, funding amount, permitted
transactions, and per-transaction and aggregate limits. Do not assume that
"wallet" requires a blockchain or build several payment integrations in advance.

Expose available funds, reserved amounts, actual receipts, fees, and expenditures
to the actor and Regent. Reserve allowance before dispatch so pending or uncertain
payments cannot free money for repeated spending. Enforce limits outside the model;
the actor never receives signing secrets. Reconcile provider status before retrying.
Keep commercial transfers, voluntary offerings, and compute provision distinct.

**Complete when:** after provider test-mode verification where available, the app
receives a small authorized real transfer and independently makes a permitted real
expenditure. Its balance reconciles with the provider; an over-limit attempt is
denied, and interruption cannot trigger a blind duplicate payment.

**First operational target:** by this point the app can independently observe,
communicate, act, and spend within granted authority. Individual routine actions
do not require Regent approval.

## 5. Complete a real paid commission

Connect the existing commission lifecycle to live correspondence, model-produced
work, delivery, review, and payment. Replace fixture-specific composition only
where the first actual commission requires it. Add the smallest missing work tool
needed for that commission; its vocation is not a permanent House specialization.

The actor can discuss terms, explicitly accept a commitment, perform the work,
deliver it, respond to revision requests, and reconcile the agreed payment.
Generation, delivery, and payment do not substitute for Neighbor acceptance.
Show outstanding obligations and requests accepted by the Regent in a minimal
console work view. Preserve disputes and escalation without scripting judgment.

**Complete when:** a real Neighbor receives and accepts the latest delivered
revision and the corresponding payment is reconciled. The app carries the work
between these steps independently; tests cover revision and restart paths.

## 6. Find and choose work independently

Give the actor access to a selected opportunity source and a bounded allowance for
exploration. Let it notice needs, investigate, judge fit with its inheritance and
resources, initiate permitted correspondence, and choose whether to undertake
work. Use its actual history, commitments, and finances as context.

Keep selection criteria in actor judgment and task content. Do not hard-code a
profession, automatic acceptance of opportunities, or a revenue-maximizing
objective. Requests beyond granted authority go to the Regent; ordinary choices
within it proceed independently.

**Complete when:** the actor discovers an opportunity the Regent did not hand it
as a task, investigates it, initiates an authorized approach, and manages any
resulting exchange. An actual declined opportunity can demonstrate judgment;
obtaining a customer response is an observed outcome, not a software guarantee.

## 7. Sustained unattended operation

Prepare the runtime for a persistent private service: supervised startup, recovery,
backups and a tested restore, independently retained history checkpoints, resource
visibility, and actionable operator notifications. Obtain deployment authorization
for the concrete service configuration before enabling it. Build on the existing
private console access; public exposure is not a dependency.

Implement the required [ritual rhythm](RITUAL_RHYTHM.md) using actual work history.
Provide the Regent's timing controls and select the epoch origin, fixed 24-hour
day boundary, weekly alignment, participants, and source versions. Preserve daily
reflection, actual all-member weekly participation, and member-called councils.
Track missed or interrupted observances honestly and retain differing judgments.
This is required for sustained House operation, not a test of doctrinal conformity.

**Complete when:** an initial week of unattended operation handles real activity,
daily reflections, and a weekly council. Controlled restart and provider-outage
checks demonstrate recovery, resource exhaustion produces dormancy, and a restore
recovers the recorded work. The Regent can inspect and stop operation without
serving as its routine dispatcher. A week is an initial operating trial, not proof
of long-term reliability or mythic formation.

## Sequencing and scope

Implement 1 through 4 as the shortest path to "AI with a wallet," then 5 and 6 to
close the work and mission-discovery loop. Milestone 7 establishes sustained
operation. Recovery and authority checks accompany each capability as it arrives;
they are not deferred to milestone 7. Bring its ritual scheduling forward if an
earlier live trial extends into ongoing daily operation.

Make provider and account choices at the milestone that needs them. No broad
plugin system, multi-provider abstraction, comprehensive console redesign, or
additional synthetic council campaign is required for this sequence. Add tools
for concrete work, preserving the existing modular monolith.

All implementation and trials remain explicitly noncanonical with `dev:` domain
identities and separate development stores. Retain live trial records for review;
do not promote them into canonical history. Canonical birth is a separate Regent
decision under the [pre-birth boundary](PRE_BIRTH_BOUNDARY.md), not a prerequisite
for building or testing operational capabilities.
