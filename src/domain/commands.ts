import { digest } from "./json.js";
import {
  actorKinds,
  financialKinds,
  lifecycles,
  type Command,
  type EventType,
} from "./types.js";
import * as v from "./validation.js";

type Parser = (value: unknown) => unknown;
const id = v.devId;
const str: Parser = (x) => v.text(x);
const count: Parser = (x) => v.integer(x);
const positive: Parser = (x) => v.integer(x, 1);
const ids: Parser = (x) => v.array(x, id);
const strings: Parser = (x) => v.array(x, (s) => v.text(s));
const fixed =
  (value: string | boolean): Parser =>
  (x) => {
    if (x !== value) throw new Error(`Expected ${String(value)}`);
    return x;
  };
const fields =
  (schema: Record<string, Parser>): Parser =>
  (value) => {
    const o = v.object(value);
    v.exact(o, Object.keys(schema));
    return Object.fromEntries(
      Object.entries(schema).map(([key, parse]) => [key, parse(o[key])]),
    );
  };

const transfer: Parser = (value) => {
  const o = v.object(value);
  const common = { id, fromActorId: id, toActorId: id };
  switch (o.ledger) {
    case "financial": {
      const result = fields({
        ...common,
        ledger: fixed("financial"),
        kind: (x) => v.choice(x, financialKinds),
        amountMinor: positive,
        currency: (x) => {
          const c = v.text(x);
          if (!/^[A-Z]{3}$/.test(c))
            throw new Error("Expected three-letter currency");
          return c;
        },
        restriction: (x) => v.nullable(x, (s) => v.text(s)),
      })(o);
      if ((o.kind === "restricted-offering") !== (o.restriction !== null))
        throw new Error("Only restricted offerings require a restriction");
      return result;
    }
    case "compute":
      return fields({
        ...common,
        ledger: fixed("compute"),
        kind: fixed("compute-provision"),
        units: positive,
        unit: (x) => v.choice(x, ["tokens", "milliseconds"]),
      })(o);
    case "nonfinancial":
      return fields({
        ...common,
        ledger: fixed("nonfinancial"),
        kind: (x) => v.choice(x, ["information", "property", "work"]),
        description: str,
      })(o);
    default:
      throw new Error("Unknown transfer ledger");
  }
};

const schemas: Record<EventType, Parser> = {
  CommissionOpened: fields({
    id,
    commitmentId: id,
    requestEvidenceId: id,
    evidenceIds: ids,
    termsRef: v.hashRef,
  }),
  CommissionWorkStarted: fields({
    commissionId: id,
    revision: positive,
    manifestRef: v.hashRef,
    intentionId: id,
  }),
  CommissionDelivered: fields({
    commissionId: id,
    revision: positive,
    intentionId: id,
    artifactRef: v.hashRef,
  }),
  CommissionReviewed: fields({
    commissionId: id,
    revision: positive,
    decision: (x) => v.choice(x, ["accept", "revise"]),
    feedbackRef: v.hashRef,
  }),
  CommissionDisputed: fields({
    commissionId: id,
    revision: positive,
    reasonRef: v.hashRef,
  }),
  CommissionDisputeResolved: fields({
    commissionId: id,
    revision: positive,
    judgmentId: id,
    resolution: (x) => v.choice(x, ["return-to-review", "revise"]),
  }),
  ActorRegistered: fields({
    id,
    kind: (x) => v.choice(x, actorKinds),
    name: str,
    lifecycle: (x) => v.choice(x, lifecycles),
  }),
  ActorLifecycleChanged: fields({
    actorId: id,
    from: (x) => v.choice(x, lifecycles),
    to: (x) => v.choice(x, lifecycles),
    reason: (x) =>
      v.choice(x, ["development", "compute-exhausted", "provision-restored"]),
  }),
  CanonRegistered: fields({
    id,
    version: str,
    bodyRef: v.hashRef,
    status: fixed("draft-unratified"),
  }),
  HouseFixtureRegistered: fields({
    id,
    actorId: id,
    canonId: id,
    fixture: fixed(true),
  }),
  MemberRecognized: fields({ actorId: id, houseId: id }),
  CanonBound: fields({ subjectId: id, canonId: id }),
  OfficeDefined: fields({ id, name: str, capabilities: strings }),
  OfficeAssigned: fields({
    actorId: id,
    officeId: id,
    startsAt: v.timestamp,
    endsAt: v.timestamp,
  }),
  NeighborRecognized: fields({ actorId: id, houseId: id }),
  CommitmentProposed: fields({
    id,
    fromActorId: id,
    toActorId: id,
    description: str,
    approach: (x) => v.choice(x, ["commission", "petition"]),
  }),
  CommitmentAccepted: fields({ commitmentId: id }),
  CommitmentFulfilled: fields({ commitmentId: id }),
  CommitmentBreached: fields({ commitmentId: id }),
  CommitmentReleased: fields({ commitmentId: id }),
  TransferRecorded: transfer,
  TestimonySubmitted: fields({
    id,
    authorId: id,
    eventId: id,
    bodyRef: v.hashRef,
    source: (x) => v.choice(x, ["chronicle", "testimony"]),
  }),
  JudgmentRecorded: fields({
    id,
    judgeActorId: id,
    officeId: id,
    eventId: id,
    bodyRef: v.hashRef,
  }),
  EvidenceReceived: fields({
    id,
    fromActorId: id,
    bodyRef: v.hashRef,
    trust: fixed("untrusted"),
  }),
  ContextManifestCompiled: fields({
    actorId: id,
    manifestRef: v.hashRef,
    renderedRef: v.hashRef,
    cursor: count,
  }),
  ModelResultRecorded: fields({
    actorId: id,
    manifestRef: v.hashRef,
    bodyRef: v.hashRef,
    adapter: fixed("fake"),
  }),
  IntentionProposed: fields({
    id,
    actorId: id,
    capability: fixed("artifact.write"),
    body: str,
    expectedRef: v.hashRef,
    contextManifestRef: v.hashRef,
  }),
  CapabilityPolicyEvaluated: fields({
    intentionId: id,
    allowed: v.boolean,
    reason: str,
    policyVersion: str,
    cursor: count,
  }),
  CapabilityResultRecorded: fields({
    intentionId: id,
    outcome: (x) => v.choice(x, ["succeeded", "failed", "denied"]),
    artifactRef: (x) => v.nullable(x, v.hashRef),
    detail: str,
  }),
};

export function parseCommand(value: unknown): Command {
  const o = v.object(value, "command");
  v.exact(o, ["type", "data"]);
  const type = v.choice(o.type, Object.keys(schemas) as EventType[]);
  const data = schemas[type](o.data);
  const command = { type, data } as Command;
  if (
    command.type === "IntentionProposed" &&
    digest(command.data.body) !== command.data.expectedRef
  )
    throw new Error("Intention content hash mismatch");
  return command;
}

export function commandArtifactRefs(command: Command): string[] {
  const refs: string[] = [];
  const data = command.data as unknown as Record<string, unknown>;
  for (const key of [
    "bodyRef",
    "manifestRef",
    "renderedRef",
    "contextManifestRef",
    "artifactRef",
    "termsRef",
    "feedbackRef",
    "reasonRef",
  ]) {
    const value = data[key];
    if (typeof value === "string") refs.push(v.hashRef(value));
  }
  return [...new Set(refs)].sort();
}

// Used by callers that validate lists of domain identities.
export const parseIdentityList = ids;
