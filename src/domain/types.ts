export const actorKinds = [
  "human",
  "artificial",
  "collective",
  "trusted-system",
] as const;
export const lifecycles = ["unborn", "active", "dormant"] as const;
export type Lifecycle = (typeof lifecycles)[number];
export interface Actor {
  id: string;
  kind: (typeof actorKinds)[number];
  name: string;
  lifecycle: Lifecycle;
}
export interface House {
  id: string;
  actorId: string;
  canonId: string;
  fixture: true;
}
export interface Canon {
  id: string;
  version: string;
  bodyRef: string;
  status: "draft-unratified";
}
export interface Office {
  id: string;
  name: string;
  capabilities: string[];
}
export interface Tenure {
  actorId: string;
  officeId: string;
  startsAt: string;
  endsAt: string;
}
export interface Commitment {
  id: string;
  fromActorId: string;
  toActorId: string;
  description: string;
  approach: "commission" | "petition";
  status: "proposed" | "accepted" | "fulfilled" | "breached" | "released";
}
export const financialKinds = [
  "commercial-receipt",
  "voluntary-offering",
  "restricted-offering",
  "restitution",
  "expenditure",
] as const;
export type Transfer = {
  id: string;
  fromActorId: string;
  toActorId: string;
} & (
  | {
      ledger: "financial";
      kind: (typeof financialKinds)[number];
      amountMinor: number;
      currency: string;
      restriction: string | null;
    }
  | {
      ledger: "compute";
      kind: "compute-provision";
      units: number;
      unit: "tokens" | "milliseconds";
    }
  | {
      ledger: "nonfinancial";
      kind: "information" | "property" | "work";
      description: string;
    }
);
export interface Testimony {
  id: string;
  authorId: string;
  eventId: string;
  bodyRef: string;
  source: "chronicle" | "testimony";
}
export interface Judgment {
  id: string;
  judgeActorId: string;
  officeId: string;
  eventId: string;
  bodyRef: string;
}
export interface Intention {
  id: string;
  actorId: string;
  capability: "artifact.write";
  body: string;
  expectedRef: string;
  contextManifestRef: string;
}

export interface CommissionTerms {
  id: string;
  commitmentId: string;
  requestEvidenceId: string;
  evidenceIds: string[];
  termsRef: string;
}
export interface CommissionWork {
  commissionId: string;
  revision: number;
  manifestRef: string;
  intentionId: string;
}
export interface CommissionDelivery {
  commissionId: string;
  revision: number;
  intentionId: string;
  artifactRef: string;
}
export interface CommissionReview {
  commissionId: string;
  revision: number;
  decision: "accept" | "revise";
  feedbackRef: string;
}
export interface CommissionDispute {
  commissionId: string;
  revision: number;
  reasonRef: string;
}
export interface Commission extends CommissionTerms {
  status:
    | "proposed"
    | "ready"
    | "working"
    | "awaiting-review"
    | "revision-requested"
    | "accepted"
    | "fulfilled"
    | "disputed"
    | "released"
    | "breached";
  work: CommissionWork[];
  deliveries: CommissionDelivery[];
  reviews: CommissionReview[];
  disputes: (CommissionDispute & { eventId: string; resolved: boolean })[];
}

export interface EventData {
  CommissionOpened: CommissionTerms;
  CommissionWorkStarted: CommissionWork;
  CommissionDelivered: CommissionDelivery;
  CommissionReviewed: CommissionReview;
  CommissionDisputed: CommissionDispute;
  CommissionDisputeResolved: {
    commissionId: string;
    revision: number;
    judgmentId: string;
    resolution: "return-to-review" | "revise";
  };
  ActorRegistered: Actor;
  ActorLifecycleChanged: {
    actorId: string;
    from: Lifecycle;
    to: Lifecycle;
    reason: "development" | "compute-exhausted" | "provision-restored";
  };
  CanonRegistered: Canon;
  HouseFixtureRegistered: House;
  MemberRecognized: { actorId: string; houseId: string };
  CanonBound: { subjectId: string; canonId: string };
  OfficeDefined: Office;
  OfficeAssigned: Tenure;
  NeighborRecognized: { actorId: string; houseId: string };
  CommitmentProposed: Omit<Commitment, "status">;
  CommitmentAccepted: { commitmentId: string };
  CommitmentFulfilled: { commitmentId: string };
  CommitmentBreached: { commitmentId: string };
  CommitmentReleased: { commitmentId: string };
  TransferRecorded: Transfer;
  TestimonySubmitted: Testimony;
  JudgmentRecorded: Judgment;
  EvidenceReceived: {
    id: string;
    fromActorId: string;
    bodyRef: string;
    trust: "untrusted";
  };
  ContextManifestCompiled: {
    actorId: string;
    manifestRef: string;
    renderedRef: string;
    cursor: number;
  };
  ModelResultRecorded: {
    actorId: string;
    manifestRef: string;
    bodyRef: string;
    adapter: "fake";
  };
  IntentionProposed: Intention;
  CapabilityPolicyEvaluated: {
    intentionId: string;
    allowed: boolean;
    reason: string;
    policyVersion: string;
    cursor: number;
  };
  CapabilityResultRecorded: {
    intentionId: string;
    outcome: "succeeded" | "failed" | "denied";
    artifactRef: string | null;
    detail: string;
  };
}
export type EventType = keyof EventData;
export type Command = {
  [K in EventType]: { type: K; data: EventData[K] };
}[EventType];
