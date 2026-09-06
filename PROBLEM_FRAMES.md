# Problem Frames — genome harness

## Entry #1 — 2026-08-29 — WO-4: post-exit vitals

### Domains

- **D1. The wake's transcript (JSONL)** — Lexical. Authored by the `claude`
  CLI (an external causal process, not ours) during the session; frozen
  once written, though a killed session can leave it truncated mid-line.
  `vitals.py`: read-only. Path is deterministic given cwd + session_id
  (findings/01's formula). Each assistant-turn entry carries its own
  `model` and full `usage` block (verified empirically today — see below)
  — this is what makes a uniform token-accounting path possible across all
  exit kinds, since the alternative source (D2) doesn't exist for a killed
  session.

- **D2. The `claude -p` child process's own termination** — the wake's
  exit code (bash `$?`) always crosses into `wake.sh`; the process's own
  `--output-format json` blob (`is_error`, `result`, `num_turns`,
  `total_cost_usd`, `usage`, ...) crosses too, but *only* when the process
  got to exit normally. A killed process (SIGTERM) produces no parseable
  JSON at all — `wake.sh` only has the bash exit code (128+signal) to go
  on. `wake.sh` currently short-circuits (`exit "$CLAUDE_EXIT"`) on any
  nonzero code *before* it would invoke `vitals.py` — the reason "killed"
  doesn't currently produce a vitals record isn't a missing feature, it's
  this control-flow gap.

- **D3. `epigenome.toml`'s price table** — Lexical, authored (by the
  harness builder, same footing as `mock/treasury.json` — not
  organism-generated, not runtime-derived). BUILD_PLAN's WO-4 text already
  places the price table here, so *where* it lives isn't open; only *what
  numbers* is, and that's a factual lookup (current Anthropic API pricing),
  not a design decision — see Invariance test.

- **D4. `ledger/vitals.jsonl`** — Lexical, the machine's own output domain.
  Created and owned entirely by `vitals.py`, append-only (findings/02's
  hard-rule enforcement: nothing else may write it).

- **D5. Wall-clock time of the wake** — Not reliably derivable from D1 or
  D2 in the killed case (no JSON `duration_ms`, and a transcript's own
  timestamps could be sparse near a truncated tail). This is really an
  attribute of `wake.sh`'s own process clock: it must timestamp
  start/end itself around the `claude -p` invocation, independent of
  what the child process reports.

### Frame split

One frame, not several: derive a single vitals record by reading how the
wake's process ended (D2, when available) and its transcript (D1),
cross-referenced against the price table (D3), and write the result as a
new record in the harness's own output domain (D4). This is
Transformation-shaped (the machine derives a new lexical domain from
existing ones as a one-shot step after the source data is frozen) — with
one caveat where Jackson's vocabulary strains: classifying *how a process
terminated* isn't a classic readable domain the way a file is; it's a fact
about an external causal process's one-time behavior, observed via an exit
code rather than queried. Naming the strain rather than forcing "process
exit status" into a clean Domain box.

### Requirements

**In scope:** given a wake that has just exited, by any means, the harness
produces exactly one `vitals.jsonl` record: tokens by type
(input/cache-read/cache-write/output, summed per-model across every
transcript turn, not from D2's aggregate — see default #3 below), an
API-shadow $ cost from D3, wall time (measured by `wake.sh` itself —
default #2), exit kind, `stop_hook_blocks`, and `num_turns` (counted from
the transcript, not trusted from D2 — same reason). Regardless of whether
D2 (the process's own JSON) exists at all.

**Out of scope:** *why* or *when* a wake gets killed — no watchdog/timeout
mechanism exists in Phase 0/1 (VPS provisioning, where that would live, is
explicitly out of scope per BUILD_PLAN's ground rules); WO-4 only has to
correctly *record* a kill once one happens, and the test that proves it
has to simulate the SIGTERM itself. Server-tool (web_search/web_fetch)
per-request costs are not priced — token costs only, for now; flagged as a
known gap, not silently absorbed into token pricing.

### Invariance test

Two things this frame leans on staying stable enough to build against:

- D1's transcript JSON shape. This is not a new risk — findings/01 and
  findings/03 already flagged that this moves across Claude Code versions,
  and it joins the same empirical-contract-suite re-verification duty
  named in BUILD_PLAN's WO-8.
- D3's price table content: Anthropic's own API pricing, which genuinely
  moves independently of this codebase over time. This is exactly *why*
  BUILD_PLAN specifies it as an external, editable config file rather than
  constants in `vitals.py` — the design already externalizes the one
  moving part into data. Confirmed current rates (via the `claude-api`
  skill, cached 2026-06-24): Sonnet 5 input $2.00/output $10.00 per MTok,
  Haiku 4.5 input $1.00/output $5.00 per MTok; cache reads run ~0.1× base
  input, cache writes 1.25× (5-min TTL) or 2× (1-hour TTL) — this
  environment's sessions were observed using 1-hour-TTL cache creation
  exclusively, but the price table carries both rates and `vitals.py` sums
  each transcript turn's actual `ephemeral_1h`/`ephemeral_5m` split rather
  than assuming one.

  One more reason D3 (not D2's self-reported `total_cost_usd`) is the
  right source, worth recording since it isn't stated outright anywhere
  else: the organism's real bill (spec §3) is a flat Max-tier subscription
  delta, not pay-as-you-go API pricing — `total_cost_usd` reflects a
  billing model the organism isn't actually under. The "shadow" in
  API-shadow cost is doing real work: it's an internal attribution metric
  for a flat-fee resource, not a restatement of an invoice line.

### Stakeholder test

Not triggered — WO-4 isn't modeled on an existing tool or borrowed
pattern; there's no analogy to check the originating stakeholder of.

### Open questions — decided here, with reasoning

1. **wake.sh must invoke `vitals.py` on every exit path**, not short-circuit
   on nonzero exit as it does today. Decided (not asked): this is required
   by the requirement itself, not a judgment call — a killed wake that
   never produces a vitals record isn't a design option BUILD_PLAN's
   accept criteria allow.
2. **Wall time is measured by `wake.sh`**, wrapping the `claude -p`
   invocation with its own timestamps, not parsed from D2. Decided: the
   killed case has no D2 to parse, so this is the only source that works
   uniformly.
3. **Token totals and `num_turns` are computed from D1 (summed per
   transcript turn), not D2's aggregate fields.** Decided: same reason,
   plus it means every exit kind is accounted for identically rather than
   two different code paths depending on how the wake ended.
4. **Multi-model sessions**: since each transcript turn carries its own
   `model`, `vitals.py` prices each turn against D3's row for *that* turn's
   model rather than assuming one model for the whole session. Decided:
   this is what the data actually supports, and Phase 2's reproduction
   machinery (subagents, different-tier delegates) will need it eventually
   even though it isn't exercised by Phase 1's mock wakes.
5. **A truncated final transcript line (killed mid-write) is skipped, not
   fatal.** Decided: `vitals.py` parses line-by-line and tolerates one
   unparseable trailing line; anything else is a real error.

**Genuinely asked, not decided here:** BUILD_PLAN names exactly three exit
kinds (clean/surrendered/killed). `is_error: true` with a normal (non-SIGTERM)
exit code — a real API/application error Claude Code itself reports,
distinct from a hook-forced surrender or a kill signal — doesn't fit any of
the three. Raised to the user as an AskUserQuestion rather than decided
unilaterally, since it's a taxonomy gap that shapes what the Phase-1 exit
memo and WO-5's stillbirth analysis can later distinguish, not an
implementation detail.

### Carried forward

- The empirical-contract-suite re-verification duty (BUILD_PLAN WO-8) now
  also covers D1's per-turn `usage`/`model` shape, confirmed today —
  it's one more fact that could move with a Claude Code upgrade.
- Server-tool cost pricing remains an open gap for a future work order if
  wakes start using WebSearch/WebFetch in earnest (WO-0's own test
  transcripts already showed a wake checking external reachability
  unprompted).

## Entry #2 — 2026-08-31 — WO-P1 Part B: body provisioning

### Domains

- **D1. The fresh VPS host** — Causal, external. Ubuntu 24.04 (Hetzner
  CX default image), root shell, nothing else guaranteed. Provisioning
  may assume apt, systemd, and outbound network; nothing about nested
  user namespaces is assumed until verified on the real host (a podman
  rehearsal cannot settle it — findings note will say which case ran).
- **D2. The repository at a pinned ref** — Lexical. Identity is the
  files at last commit (Article 1); provisioning *reads* it, never
  authors organism/ content.
- **D3. Owner writes (Dan's commits to origin)** — Causal, asynchronous.
  Accepted any time; the frame requirement (CONTRACTS "Owner-write
  serialization") is that they become visible only at wake boundaries.
  The connection domain is `origin` itself: the runner's pre-boot
  ff-merge is the only inbound path into the body clone, so mid-wake
  origin commits are invisible by construction, not by lock.
- **D4. The watcher host** — Causal, external to D1 by requirement
  (spec dead-man's-switch: host-external, dual channels, self-aliveness
  signal, never a death claim). Channels: origin's last-commit time
  (pushed post-wake by the runner) and the body's heartbeat endpoint.
  The watcher shares no fate with the body host or its clock.
- **D5. Sealed secrets** — Lexical, encrypted at rest (age; recipients:
  Dan's key + host key). Live values exist only in the runner's process
  env (Part A's allowlist passthrough) and never inside the body tree;
  the post-wake transcript scan is the detector, not the wall.

### Frame

Commanded behaviour (provision.sh commands D1 into a body) plus a
required-behaviour sub-frame (watcher observes silence and emits staged
notices). Misfit risks: D1 nesting (bwrap under podman) — record, don't
infer; D3 race window between fetch and boot — closed by doing both in
one runner invocation with no wake in flight; D4 clock skew — stages
computed from observed channel times, not the body's own claims.
