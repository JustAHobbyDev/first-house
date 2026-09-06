import { randomUUID } from "node:crypto";
import { parseCommand } from "./commands.js";
import type { Command } from "./types.js";
import type { Envelope, EventStore, HouseEvent } from "../events/store.js";
import { project, type State } from "../projections/state.js";
import * as v from "./validation.js";
import { validateCommissionCommand } from "./commission-validation.js";

export interface Dependencies {
  clock: () => string;
  id: () => string;
}
export const defaultDependencies: Dependencies = {
  clock: () => new Date().toISOString(),
  id: () => `dev:event:${randomUUID()}`,
};
export function currentOffices(
  state: State,
  actorId: string,
  at: string,
): string[] {
  v.timestamp(at);
  return state.tenures
    .filter((t) => t.actorId === actorId && t.startsAt <= at && at < t.endsAt)
    .map((t) => t.officeId)
    .sort();
}
function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export class DomainService {
  constructor(
    readonly store: EventStore,
    readonly deps: Dependencies = defaultDependencies,
  ) {}
  state(cursor?: number): State {
    return project(this.store.read(1, cursor));
  }
  record(
    input: unknown,
    meta: {
      actorId?: string | null;
      subjectId?: string | null;
      causedBy?: string | null;
      correlationId?: string;
      recordedBy?: Envelope["recordedBy"];
    } = {},
  ): HouseEvent {
    const command = parseCommand(input);
    const at = this.deps.clock();
    const eventId = this.deps.id();
    return this.store.append(
      command,
      {
        id: eventId,
        occurredAt: at,
        actorId: meta.actorId ?? null,
        subjectId: meta.subjectId ?? null,
        causedBy: meta.causedBy ?? null,
        correlationId: meta.correlationId ?? "dev:correlation:bootstrap",
        canonVersion: "dev:canon:unratified-v1",
        recordedBy: meta.recordedBy ?? "regent",
      },
      (events) => {
        const state = project(events);
        if (meta.actorId)
          ensure(state.actors[meta.actorId], "Unknown performing actor");
        this.validate(command, state, events, at, meta.actorId ?? null);
      },
    );
  }
  private validate(
    c: Command,
    s: State,
    events: HouseEvent[],
    at: string,
    performer: string | null,
  ): void {
    if (
      validateCommissionCommand(
        c,
        s,
        events,
        at,
        performer,
        this.store.artifacts,
      )
    )
      return;
    const actor = (id: string) => {
      ensure(s.actors[id], `Unknown actor: ${id}`);
      return s.actors[id];
    };
    const event = (id: string) =>
      ensure(
        events.some((e) => e.id === id),
        "Unknown referenced event",
      );
    const unique = (id: string) =>
      ensure(
        !events.some((e) => "id" in e.data && e.data.id === id),
        "Duplicate domain identity",
      );
    switch (c.type) {
      case "ActorRegistered":
        unique(c.data.id);
        break;
      case "CanonRegistered":
        unique(c.data.id);
        break;
      case "HouseFixtureRegistered":
        unique(c.data.id);
        ensure(
          actor(c.data.actorId).kind === "collective",
          "House must be a collective actor",
        );
        ensure(s.canons[c.data.canonId], "Unknown canon");
        break;
      case "MemberRecognized":
      case "NeighborRecognized": {
        actor(c.data.actorId);
        ensure(s.houses[c.data.houseId], "Unknown House fixture");
        const relations =
          c.type === "MemberRecognized" ? s.members : s.neighbors;
        ensure(
          !relations.some(
            (r) => r.actorId === c.data.actorId && r.houseId === c.data.houseId,
          ),
          "Duplicate relation",
        );
        break;
      }
      case "CanonBound":
        ensure(
          s.actors[c.data.subjectId] || s.houses[c.data.subjectId],
          "Unknown canon subject",
        );
        ensure(s.canons[c.data.canonId], "Unknown canon");
        break;
      case "ActorLifecycleChanged": {
        const existing = actor(c.data.actorId);
        ensure(
          existing.lifecycle === c.data.from,
          "Lifecycle from-state mismatch",
        );
        const allowed = {
          unborn: ["active"],
          active: ["dormant"],
          dormant: ["active"],
        };
        ensure(
          allowed[c.data.from].includes(c.data.to),
          "Invalid lifecycle transition",
        );
        if (c.data.reason === "compute-exhausted")
          ensure(
            c.data.from === "active" && c.data.to === "dormant",
            "Compute exhaustion means dormancy",
          );
        if (c.data.reason === "provision-restored")
          ensure(
            c.data.from === "dormant" && c.data.to === "active",
            "Provision restores dormant fixtures",
          );
        break;
      }
      case "OfficeDefined":
        unique(c.data.id);
        ensure(
          c.data.capabilities.every((x) =>
            ["artifact.write", "judgment.record"].includes(x),
          ),
          "Unsupported fixture capability",
        );
        break;
      case "OfficeAssigned":
        actor(c.data.actorId);
        ensure(s.offices[c.data.officeId], "Unknown office");
        ensure(
          c.data.startsAt < c.data.endsAt,
          "Tenure must have a bounded positive duration",
        );
        ensure(
          !s.tenures.some(
            (t) =>
              t.officeId === c.data.officeId &&
              t.startsAt < c.data.endsAt &&
              c.data.startsAt < t.endsAt,
          ),
          "Office tenure overlaps",
        );
        break;
      case "CommitmentProposed":
        unique(c.data.id);
        actor(c.data.fromActorId);
        actor(c.data.toActorId);
        break;
      case "CommitmentAccepted":
      case "CommitmentFulfilled":
      case "CommitmentBreached":
      case "CommitmentReleased": {
        const existing = s.commitments[c.data.commitmentId];
        ensure(existing, "Unknown commitment");
        ensure(
          c.type === "CommitmentAccepted"
            ? existing.status === "proposed"
            : existing.status === "accepted",
          "Invalid commitment transition",
        );
        if (c.type === "CommitmentAccepted")
          ensure(
            performer === existing.fromActorId,
            "Only the obligated actor can accept a commitment",
          );
        const commission = Object.values(s.commissions).find(
          (x) => x.commitmentId === existing.id,
        );
        if (
          existing.approach === "commission" &&
          c.type === "CommitmentFulfilled"
        ) {
          ensure(
            performer === existing.toActorId &&
              commission?.status === "accepted" &&
              commission.reviews.at(-1)?.decision === "accept",
            "Commission fulfillment requires requesting Neighbor acceptance",
          );
        }
        break;
      }
      case "TransferRecorded":
        unique(c.data.id);
        actor(c.data.fromActorId);
        actor(c.data.toActorId);
        break;
      case "TestimonySubmitted":
        unique(c.data.id);
        actor(c.data.authorId);
        event(c.data.eventId);
        ensure(performer === c.data.authorId, "Testimony author mismatch");
        break;
      case "JudgmentRecorded":
        unique(c.data.id);
        actor(c.data.judgeActorId);
        event(c.data.eventId);
        ensure(
          performer === c.data.judgeActorId &&
            currentOffices(s, c.data.judgeActorId, at).includes(
              c.data.officeId,
            ) &&
            s.offices[c.data.officeId]?.capabilities.includes(
              "judgment.record",
            ),
          "Judgment requires current explicit authority",
        );
        break;
      case "EvidenceReceived":
        unique(c.data.id);
        actor(c.data.fromActorId);
        break;
      case "ContextManifestCompiled":
        actor(c.data.actorId);
        ensure(c.data.cursor <= s.cursor, "Context cursor is in the future");
        ensure(!s.manifests[c.data.manifestRef], "Manifest already recorded");
        break;
      case "ModelResultRecorded":
        actor(c.data.actorId);
        ensure(
          s.manifests[c.data.manifestRef]?.actorId === c.data.actorId,
          "Model result requires recorded actor manifest",
        );
        break;
      case "IntentionProposed":
        unique(c.data.id);
        actor(c.data.actorId);
        ensure(
          s.manifests[c.data.contextManifestRef]?.actorId === c.data.actorId,
          "Intention requires actor manifest",
        );
        ensure(performer === c.data.actorId, "Intention actor mismatch");
        break;
      case "CapabilityPolicyEvaluated":
        ensure(
          s.intentions[c.data.intentionId],
          "Policy requires recorded intention",
        );
        ensure(!s.results[c.data.intentionId], "Intention already completed");
        ensure(
          c.data.cursor === s.cursor,
          "Policy cursor must reflect current state",
        );
        break;
      case "CapabilityResultRecorded": {
        const intention = s.intentions[c.data.intentionId];
        const policy = s.policies[c.data.intentionId];
        ensure(intention && policy, "Result requires intention and policy");
        ensure(!s.results[c.data.intentionId], "Intention already completed");
        if (c.data.outcome === "succeeded")
          ensure(
            policy.allowed && c.data.artifactRef === intention.expectedRef,
            "Success requires permission and expected artifact",
          );
        else
          ensure(
            c.data.artifactRef === null,
            "Non-success has no output reference",
          );
        if (c.data.outcome === "denied")
          ensure(!policy.allowed, "Denied result requires denied policy");
        break;
      }
    }
  }
}
