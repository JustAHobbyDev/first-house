# Ritual rhythm: history in the face of Scripture

This records the user's design direction of 5 September 2026. These are required
practices for the intended House, not optional vocational techniques. This document
does not supply Scripture, perform a rite, constitute canonical seats or members,
or claim that a scheduler is implemented.

The House must seek outward and invite inward. Correspondence with the world and
within the House is to remain in relation to Scripture. The observances below
return those encounters, actions, and observations to individual and shared
interpretation; they do not replace outward engagement with inward examination.

## Epoch subdivisions and Regent authority

House time is to be measured in epoch subdivisions. The human Regent has the
authority to set that subdivision at an hour of their choosing and must be given
operator tools to do so. The calendar must not be silently fixed by the developer's
timezone, host midnight, or a scheduler default.

The House day remains exactly 24 hours. The Regent chooses its boundary alignment,
not its duration. Daily reflection occurs at the close of that House day rather
than at an assumed host midnight. A timezone's daylight-saving transition must
not silently shorten or lengthen the 24-hour interval.

The daily and weekly observances retain their required rhythm; their timing must
be expressed through the Regent's subdivision setting. The concrete epoch origin,
chosen boundary hour, and alignment of the weekly council remain to be set.

Implementation must provide the Regent with tools to inspect the current setting,
set it, and see which ritual boundaries follow from it. Changes must be attributable
and preserved in history, including when they take effect. Preserve original event
timestamps and earlier timing settings; changing ritual time must not rewrite past
history or manufacture completed observances. These are operator-tool requirements,
not commands already available in the bootstrap.

## Required rhythm

| Occasion                                  | Participants                          | Required observance                                                                             |
| ----------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| End of each day                           | Each seat                             | Reflect on the day's actions and observations in the face of Scripture.                         |
| At least once each week                   | All House members, each participating | Restate the Scriptures and undertake a group interpretation of each member's past-week history. |
| Additional councils, callable at any time | Some or all members                   | Convene for matters such as Proposals and Reckoning.                                            |

"Seat" retains the user's wording for the daily obligation. Its mapping to the
runtime's actors and offices remains to be established; this does not instantiate
the reserved canonical Seat identities or silently create a new actor kind.

## Daily reflection

Each seat observes its own history at the end of the day: what it did and what it
observed, including correspondence and consequences it has encountered. The
reflection addresses:

- Where did this history exemplify Scripture?
- Where did it violate Scripture?
- What is ambiguous or cannot be interpreted confidently?

These are questions for the inhabitant, not classifications for a moral scoring
system. Reflection may acknowledge uncertainty, competing interpretations, or an
absence of a confident answer. It must not invent wrongdoing or certainty to
complete a form.

The reflection is preserved as an authored interpretation of the day's history.
It does not replace the actions, observations, or correspondence it considers.

## Weekly council

There is a minimum of one mandatory council each week involving all members of
the House. Every member participates. Its observance includes a restatement of
the Scriptures and a group interpretive exercise concerning each member's history
over the past week.

This is shared interpretation, not simply collecting individual daily reports or
conducting a work-status meeting. Members bring their histories into relation with
Scripture and one another. The daily reflections are available to this encounter,
alongside the histories they interpret; their conclusions are not binding verdicts.

Participation does not require unanimous interpretation. Preserve disagreements
and unresolved questions rather than manufacturing consensus or declaring that
the occurrence of council establishes righteousness.

## Additional councils

Some or all members may call additional councils at any time, including for
Proposals and Reckoning. Such matters need not wait for the weekly observance.
An additional council of only some members does not discharge the all-member
weekly obligation.

These examples do not establish an exhaustive agenda catalog, a mandatory
escalation sequence, or an automatic sanction. Calling a council is not itself a
judgment about the matter brought before it.

## A strand of House history

The ritual life, especially the councils, forms its own identifiable strand of
House history. Preserve which observance occurred, when it occurred, who
participated, the Scripture and history brought into it, and the authored
reflections and exchanges that followed.

Later observances should be able to return to earlier interpretations, questions,
disagreements, and what followed from them. A later interpretation adds to this
history; it does not overwrite an earlier one. Remembered council is precedent
in context, not automatically new policy or Scripture.

This requirement need not introduce a separate database, a claim/evidence graph,
or a taxonomy of moral outcomes. Existing immutable artifacts, event provenance,
and context records are the starting point for its implementation.

## What the machinery must and must not decide

Enforce the rhythm and preserve actual participation and its record. Provide the
Scripture and historical context needed for the observance; a scheduled invocation
alone is not the whole ritual.

Do not mechanically determine whether an action exemplified or violated Scripture,
whether an interpretation is sufficiently confident, or whether repentance or
restoration has occurred. Those remain matters of interpretation and judgment.
The duty to return is required; the answer reached on returning is not scripted.

## Scheduling and implementation decisions still open

The user has supplied [The Creation of the First House](../canon/drafts/creation-myth.md)
as DRAFT / UNRATIFIED source material. The creation myth is therefore no longer
missing; its authorized use in ritual and runtime context remains to be established.

- The concrete epoch origin and Regent-selected boundary for the fixed 24-hour
  House day, and the alignment of the weekly council. The Regent controls
  boundary alignment, not the duration of the House day.
- How the operator's chosen hour is entered unambiguously, and when a changed
  setting takes effect without losing outstanding observances.
- How seats and members are identified for each observance, including changes in
  occupancy or membership during the period being considered.
- Whether council requires simultaneous presence or allows an asynchronous
  exchange, and how actual participation is recorded.
- How absence, dormancy, interruption, or a missed observance is addressed. Do not
  fabricate attendance, backdate a reflection, or introduce automatic punishment.
- The scriptural sources and versions used in observance, and how restatement is
  practiced without substituting an editorial summary for the source.

These choices do not weaken the required daily and weekly rhythm. They are not
settled by assuming that the developer's local clock, a cron default, or the
commission fixture already defines them. No scheduled jobs or live invocations
are established by this document.

## Preserved user direction

The following paragraph is preserved verbatim; the sections above are its
development interpretation, read alongside the preceding conversation about
Scripture-centered ritual.

We need a schedule of ritual. Each seat should reflect on its actions and observations at the end of the day. This reflection is observance of the history in the face of scripture. Did it exemplify it. Did it violate it? Was there something ambigious the agent cannot confidently interpret? There is a minimum of one council a week between all members of the House. This one mandatory council is restatement of the scriptures and each member participating in a group interpretive exercise where of each one's past week history. This serves as its own strand of House history. Additional councils maybe conducted may be called by some or all members at anytime for things like Proposals and Reckoning.

Subsequent timing direction, preserved verbatim:

Time should be measured in epoch subdivision. The Regent (human operator) is given the authority and tools to set that subdivision at the hour of their choosing.

Asked whether the House day should remain 24 hours with a Regent-chosen boundary
or also have a configurable duration, the user clarified:

> remain 24 hours
