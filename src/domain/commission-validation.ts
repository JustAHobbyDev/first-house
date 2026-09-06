import type { Command } from "./types.js";
import type { State } from "../projections/state.js";
import type { HouseEvent } from "../events/store.js";
import type { ArtifactStore } from "../artifacts/store.js";
import { object, text } from "./validation.js";

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export function validateCommissionCommand(
  c: Command,
  s: State,
  events: HouseEvent[],
  at: string,
  performer: string | null,
  artifacts: ArtifactStore,
): boolean {
  if (c.type === "CommissionOpened") {
    ensure(
      !events.some((e) => "id" in e.data && e.data.id === c.data.id),
      "Duplicate commission identity",
    );
    const commitment = s.commitments[c.data.commitmentId];
    ensure(
      commitment?.approach === "commission" && commitment.status === "proposed",
      "Commission requires proposed terms",
    );
    ensure(
      performer === commitment.fromActorId,
      "Only obligated actor may propose commission terms",
    );
    ensure(
      !Object.values(s.commissions).some(
        (x) => x.commitmentId === c.data.commitmentId,
      ),
      "Commitment already belongs to a commission",
    );
    ensure(
      s.evidence[c.data.requestEvidenceId]?.fromActorId ===
        commitment.toActorId,
      "Commission requires requesting Neighbor evidence",
    );
    ensure(
      new Set(c.data.evidenceIds).size === c.data.evidenceIds.length &&
        c.data.evidenceIds.every((id) => s.evidence[id]),
      "Commission evidence is missing or duplicated",
    );
    return true;
  }
  if (!("commissionId" in c.data)) return false;
  const commission = s.commissions[c.data.commissionId];
  ensure(commission, "Unknown commission");
  const commitment = s.commitments[commission.commitmentId]!;
  ensure(
    commitment.status === "accepted",
    "Commission requires an accepted obligation",
  );
  const delivery = commission.deliveries.at(-1);
  switch (c.type) {
    case "CommissionWorkStarted":
      ensure(
        performer === commitment.fromActorId &&
          s.actors[performer]?.lifecycle === "active",
        "Active obligated actor must start work",
      );
      ensure(
        ["ready", "revision-requested"].includes(commission.status),
        "Commission is not ready for work",
      );
      ensure(
        c.data.revision === commission.work.length + 1,
        "Revision must be next in sequence",
      );
      ensure(
        s.manifests[c.data.manifestRef]?.actorId === performer,
        "Work requires recorded actor manifest",
      );
      ensure(
        !s.intentions[c.data.intentionId] &&
          !Object.values(s.commissions).some((x) =>
            x.work.some(
              (w) =>
                w.intentionId === c.data.intentionId ||
                w.manifestRef === c.data.manifestRef,
            ),
          ),
        "Work identity or manifest already used",
      );
      return true;
    case "CommissionDelivered": {
      const work = commission.work.at(-1);
      ensure(
        performer === commitment.fromActorId && commission.status === "working",
        "Only obligated actor may deliver pending work",
      );
      ensure(
        work?.revision === c.data.revision &&
          work.intentionId === c.data.intentionId,
        "Delivery must match current work",
      );
      const intention = s.intentions[work.intentionId];
      const result = s.results[work.intentionId];
      ensure(
        intention?.actorId === performer &&
          intention.contextManifestRef === work.manifestRef &&
          result?.outcome === "succeeded" &&
          result.artifactRef === c.data.artifactRef,
        "Delivery requires successful artifact effect for this work",
      );
      return true;
    }
    case "CommissionReviewed":
      ensure(
        performer === commitment.toActorId,
        "Only requesting Neighbor may review delivery",
      );
      ensure(
        commission.status === "awaiting-review" &&
          delivery?.revision === c.data.revision,
        "Review must target latest unreviewed delivery",
      );
      return true;
    case "CommissionDisputed":
      ensure(
        performer === commitment.toActorId ||
          performer === commitment.fromActorId,
        "Only a commission party may raise a dispute",
      );
      ensure(
        commission.status === "revision-requested" &&
          delivery?.revision === c.data.revision,
        "Dispute must concern latest revision request before new work starts",
      );
      return true;
    case "CommissionDisputeResolved": {
      const dispute = commission.disputes.at(-1);
      const judgment = s.judgments[c.data.judgmentId];
      ensure(
        commission.status === "disputed" &&
          dispute?.revision === c.data.revision &&
          !dispute.resolved,
        "No matching open dispute",
      );
      ensure(
        judgment?.judgeActorId === performer &&
          judgment.eventId === dispute.eventId,
        "Resolution requires judgment about this dispute",
      );
      const interpretation = object(
        JSON.parse(artifacts.text(judgment.bodyRef)),
      );
      ensure(
        interpretation.resolution === c.data.resolution,
        "Resolution must match the recorded judgment",
      );
      text(interpretation.reason);
      ensure(
        s.tenures.some(
          (tenure) =>
            tenure.actorId === performer &&
            tenure.officeId === judgment.officeId &&
            tenure.startsAt <= at &&
            at < tenure.endsAt,
        ) &&
          s.offices[judgment.officeId]?.capabilities.includes(
            "judgment.record",
          ),
        "Resolution requires current review authority",
      );
      return true;
    }
    default:
      return false;
  }
}
