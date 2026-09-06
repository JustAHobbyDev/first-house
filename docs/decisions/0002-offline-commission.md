# Decision 0002: durable offline archival-storage commission

Status: implemented and verified for disposable development only.

Subsequent direction: [project intent](../PROJECT_INTENT.md) clarifies that this
example exercises general work coordination. It does not prescribe a research
vocation or justify promoting report-specific methodology into shared machinery.

The user supplied three disposable archival-storage records and a requesting
Neighbor's priorities. Preserve their source IDs and wording. Internal evidence
IDs add the `dev:evidence:` namespace required by the domain validator; original
IDs remain in source text and context provenance.

Use the existing event store and artifact-writing broker. Add typed workflow
events and projections rather than a separate mutable job database. A commission
is a derived workflow around an explicitly accepted commitment, not a new primitive.

The obligated Steward accepts the terms; the requesting Neighbor accepts or
requests revision of the latest delivered artifact. Artifact generation, delivery,
acceptance, and fulfillment are distinct. The Regent may resolve a dispute by
returning work for revision or returning the delivery to Neighbor review. The
Regent does not silently accept on the Neighbor's behalf.

The fake adapter is a scripted, fixture-specific reference response. Its success
tests provenance and workflow, not model reasoning or archival expertise. The
expected report is not included in the actor's input packs. No live model,
network, vault access, payment, or canonical birth is introduced.

Commands persist work checkpoints so a fresh process can continue after manifest
commit, fake result recording, intention proposal, artifact write, delivery, and
Neighbor acceptance. Replay remains effect-free. Revisions retain prior artifacts
and all reviews. Human feedback and dispute grounds are evidence, not canon.
