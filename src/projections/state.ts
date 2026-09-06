import type { DatabaseSync } from "node:sqlite";
import { canonicalJson, clone } from "../domain/json.js";
import type {
  Actor,
  Canon,
  Commitment,
  Commission,
  EventData,
  House,
  Intention,
  Judgment,
  Office,
  Tenure,
  Testimony,
  Transfer,
} from "../domain/types.js";
import type { EventStore, HouseEvent } from "../events/store.js";

export interface State {
  cursor: number;
  actors: Record<string, Actor>;
  houses: Record<string, House>;
  canons: Record<string, Canon>;
  offices: Record<string, Office>;
  tenures: Tenure[];
  members: { actorId: string; houseId: string }[];
  neighbors: { actorId: string; houseId: string }[];
  bindings: { subjectId: string; canonId: string }[];
  commitments: Record<string, Commitment>;
  commissions: Record<string, Commission>;
  financialTransfers: Record<string, Transfer & { ledger: "financial" }>;
  computeProvisions: Record<string, Transfer & { ledger: "compute" }>;
  nonfinancialTransfers: Record<string, Transfer & { ledger: "nonfinancial" }>;
  testimony: Record<string, Testimony>;
  judgments: Record<string, Judgment>;
  evidence: Record<string, EventData["EvidenceReceived"]>;
  manifests: Record<string, EventData["ContextManifestCompiled"]>;
  modelResults: EventData["ModelResultRecorded"][];
  intentions: Record<string, Intention>;
  policies: Record<string, EventData["CapabilityPolicyEvaluated"]>;
  results: Record<string, EventData["CapabilityResultRecorded"]>;
}
export function emptyState(): State {
  return {
    cursor: 0,
    actors: {},
    houses: {},
    canons: {},
    offices: {},
    tenures: [],
    members: [],
    neighbors: [],
    bindings: [],
    commitments: {},
    commissions: {},
    financialTransfers: {},
    computeProvisions: {},
    nonfinancialTransfers: {},
    testimony: {},
    judgments: {},
    evidence: {},
    manifests: {},
    modelResults: [],
    intentions: {},
    policies: {},
    results: {},
  };
}
export function project(events: readonly HouseEvent[]): State {
  const state = emptyState();
  for (const event of events) {
    if (event.sequence !== state.cursor + 1)
      throw new Error(
        "Projection requires a contiguous stream from sequence 1",
      );
    switch (event.type) {
      case "CommissionOpened":
        state.commissions[event.data.id] = {
          ...clone(event.data),
          status: "proposed",
          work: [],
          deliveries: [],
          reviews: [],
          disputes: [],
        };
        break;
      case "CommissionWorkStarted": {
        const commission = state.commissions[event.data.commissionId]!;
        commission.work.push(clone(event.data));
        commission.status = "working";
        break;
      }
      case "CommissionDelivered": {
        const commission = state.commissions[event.data.commissionId]!;
        commission.deliveries.push(clone(event.data));
        commission.status = "awaiting-review";
        break;
      }
      case "CommissionReviewed": {
        const commission = state.commissions[event.data.commissionId]!;
        commission.reviews.push(clone(event.data));
        commission.status =
          event.data.decision === "accept" ? "accepted" : "revision-requested";
        break;
      }
      case "CommissionDisputed": {
        const commission = state.commissions[event.data.commissionId]!;
        commission.disputes.push({
          ...clone(event.data),
          eventId: event.id,
          resolved: false,
        });
        commission.status = "disputed";
        break;
      }
      case "CommissionDisputeResolved": {
        const commission = state.commissions[event.data.commissionId]!;
        commission.disputes.at(-1)!.resolved = true;
        commission.status =
          event.data.resolution === "return-to-review"
            ? "awaiting-review"
            : "revision-requested";
        break;
      }
      case "ActorRegistered":
        state.actors[event.data.id] = clone(event.data);
        break;
      case "ActorLifecycleChanged": {
        const actor = state.actors[event.data.actorId];
        if (!actor) throw new Error("Missing projected actor");
        actor.lifecycle = event.data.to;
        break;
      }
      case "CanonRegistered":
        state.canons[event.data.id] = clone(event.data);
        break;
      case "HouseFixtureRegistered":
        state.houses[event.data.id] = clone(event.data);
        break;
      case "OfficeDefined":
        state.offices[event.data.id] = clone(event.data);
        break;
      case "OfficeAssigned":
        state.tenures.push(clone(event.data));
        break;
      case "MemberRecognized":
        state.members.push(clone(event.data));
        break;
      case "NeighborRecognized":
        state.neighbors.push(clone(event.data));
        break;
      case "CanonBound":
        state.bindings.push(clone(event.data));
        break;
      case "CommitmentProposed":
        state.commitments[event.data.id] = {
          ...clone(event.data),
          status: "proposed",
        };
        break;
      case "CommitmentAccepted":
      case "CommitmentFulfilled":
      case "CommitmentBreached":
      case "CommitmentReleased": {
        const commitment = state.commitments[event.data.commitmentId];
        if (!commitment) throw new Error("Missing projected commitment");
        const statuses = {
          CommitmentAccepted: "accepted",
          CommitmentFulfilled: "fulfilled",
          CommitmentBreached: "breached",
          CommitmentReleased: "released",
        } as const;
        commitment.status = statuses[event.type];
        for (const commission of Object.values(state.commissions)) {
          if (commission.commitmentId === event.data.commitmentId)
            commission.status =
              event.type === "CommitmentAccepted"
                ? "ready"
                : statuses[event.type];
        }
        break;
      }
      case "TransferRecorded": {
        const transfer = clone(event.data);
        if (transfer.ledger === "financial")
          state.financialTransfers[transfer.id] = transfer;
        else if (transfer.ledger === "compute")
          state.computeProvisions[transfer.id] = transfer;
        else state.nonfinancialTransfers[transfer.id] = transfer;
        break;
      }
      case "TestimonySubmitted":
        state.testimony[event.data.id] = clone(event.data);
        break;
      case "JudgmentRecorded":
        state.judgments[event.data.id] = clone(event.data);
        break;
      case "EvidenceReceived":
        state.evidence[event.data.id] = clone(event.data);
        break;
      case "ContextManifestCompiled":
        state.manifests[event.data.manifestRef] = clone(event.data);
        break;
      case "ModelResultRecorded":
        state.modelResults.push(clone(event.data));
        break;
      case "IntentionProposed":
        state.intentions[event.data.id] = clone(event.data);
        break;
      case "CapabilityPolicyEvaluated":
        state.policies[event.data.intentionId] = clone(event.data);
        break;
      case "CapabilityResultRecorded":
        state.results[event.data.intentionId] = clone(event.data);
        break;
    }
    state.cursor = event.sequence;
  }
  return state;
}
export function saveProjection(db: DatabaseSync, state: State): void {
  db.prepare(
    "INSERT INTO projections(name,cursor,json) VALUES ('state',?,?) ON CONFLICT(name) DO UPDATE SET cursor=excluded.cursor,json=excluded.json",
  ).run(state.cursor, canonicalJson(state));
}
export function replay(store: EventStore): State {
  store.db.exec("BEGIN IMMEDIATE");
  try {
    const verification = store.verify();
    if (!verification.valid) throw new Error(verification.errors.join("\n"));
    const state = project(store.read());
    store.db.exec("DELETE FROM projections");
    saveProjection(store.db, state);
    store.db.exec("COMMIT");
    return state;
  } catch (error) {
    store.db.exec("ROLLBACK");
    throw error;
  }
}
