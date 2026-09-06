# Ontology

All examples below are disposable development fixtures. No canonical House exists.

| Primitive  | Representation and distinction                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| Actor      | Human, artificial, collective, or trusted-system; identity is separate from authority.                         |
| House      | A collective actor represented by a House fixture bound to draft canon.                                        |
| Office     | Defined authority and obligations with a named office and bounded assignment tenure.                           |
| Canon      | An immutable identified version of authoritative-source material; every bootstrap version is draft/unratified. |
| Event      | An immutable recorded occurrence with sequence, provenance, correlation, and hash links.                       |
| Commitment | An obligation from one actor to another, effective only after explicit acceptance.                             |
| Transfer   | A typed movement asserted in the development record: financial, compute, information, property, or work.       |
| Testimony  | An actor's account of an event, optionally identified as Chronicle interpretation.                             |
| Judgment   | An authorized actor/office interpretation of an event; it cannot rewrite that event.                           |

Canon IDs identify immutable versions in this first implementation. New versions
use new `dev:canon:*` IDs and carry a version string; no canonical amendment or
automatic latest-version selection exists. Context-pack IDs separately support
multiple explicit immutable versions in the registry.

## Relations

| Relation                                 | Bootstrap representation                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| `member_of(actor, house)`                | `MemberRecognized` and members projection                                 |
| `holds_office(actor, office)`            | `OfficeAssigned` with start/end timestamps                                |
| `neighbor_of(actor, house)`              | `NeighborRecognized` and neighbors projection                             |
| `bound_by(actor_or_house, canon)`        | `CanonBound` and bindings projection; House fixture also references canon |
| `performed(actor, event)`                | Event `actorId`; trusted runtime events may have no actor                 |
| `affected(event, actor)`                 | Event `subjectId` and typed payload references                            |
| `committed_to(actor, actor, commitment)` | Proposed/accepted commitment and its state transitions                    |
| `transferred(actor, actor, good)`        | Typed transfer event with sender/recipient                                |
| `testified_about(actor, event)`          | Testimony author and referenced event ID                                  |
| `judged_by(event, actor_or_office)`      | Judgment actor, office, and referenced event ID                           |

**Neighbor is a relation, not an actor kind.** One human or artificial actor can
stand in that relation to a House. **Dreamer, Steward, and Witness are offices, not
actor kinds.** A fixture Steward office is defined in the demo. No final Witness
identity or canonical Seat is instantiated.

## Derived structures

- **Commission:** reciprocal commitments, with deliverable and payment obligations
  represented separately. A financial receipt alone neither creates nor fulfills
  those obligations. The `commission` approach marks a proposed commitment.
- **Petition:** a request conveyed as evidence and, if proposed, a `petition`
  commitment. Receipt and proposal confer no entitlement; the obligated actor
  must explicitly accept.
- **Offering:** a voluntary or restricted financial transfer. It purchases no
  service, standing, priority, or influence. Restrictions remain explicit text;
  the bootstrap does not interpret or enforce expenditure restrictions.
- **Ministry:** a pattern of relations, accepted commitments, work, and transfers;
  its vocational direction is to emerge through identifying and providing work
  consistent with shared beliefs. Research is a disposable example, not an assigned
  first ministry. See [project intent](PROJECT_INTENT.md).

Commitments proceed from proposed to accepted, then fulfilled, breached, or
released. The latter three are terminal in this milestone. Actor lifecycle is
unborn, active, or dormant. Financial transfers retain commercial receipt,
voluntary offering, restricted offering, restitution, and expenditure purposes.
Compute provision uses units of tokens or milliseconds and never currency. These
are typed record projections, not a settlement engine or a resource scheduler.

The archival-storage slice adds a derived commission workflow around these
primitives. `CommissionOpened` links requesting evidence, terms, and the proposed
commitment. Work checkpoints and deliveries track immutable revisions;
`CommissionReviewed` records the Neighbor's decision. Only recorded acceptance
permits a commission's `CommitmentFulfilled` event. Disputes reference judgment
without replacing prior reviews. See [the workflow guide](OFFLINE_COMMISSION.md).
