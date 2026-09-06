import { currentOffices, type DomainService } from "../domain/service.js";
import type { EventData } from "../domain/types.js";
import * as v from "../domain/validation.js";

export interface CapabilityBroker {
  execute(intentionId: string): EventData["CapabilityResultRecorded"];
}
export class DevelopmentBroker implements CapabilityBroker {
  constructor(
    private readonly service: DomainService,
    private readonly afterEffect?: () => void,
  ) {}
  execute(intentionId: string): EventData["CapabilityResultRecorded"] {
    v.devId(intentionId);
    const { service } = this;
    const state = service.state();
    const intention = state.intentions[intentionId];
    if (!intention) throw new Error("Effect requires recorded intention");
    if (state.results[intentionId]) return state.results[intentionId];
    const intentionEvent = service.store
      .read()
      .find(
        (e) => e.type === "IntentionProposed" && e.data.id === intentionId,
      )!;
    const finish = (
      outcome: "succeeded" | "failed" | "denied",
      detail: string,
    ): EventData["CapabilityResultRecorded"] => {
      const data: EventData["CapabilityResultRecorded"] = {
        intentionId,
        outcome,
        artifactRef: outcome === "succeeded" ? intention.expectedRef : null,
        detail,
      };
      service.record(
        { type: "CapabilityResultRecorded", data },
        {
          actorId: intention.actorId,
          recordedBy: "runtime",
          causedBy: intentionEvent.id,
        },
      );
      return data;
    };
    // Recovery establishes the desired bytes exist after a previously allowed attempt.
    // It does not claim to determine which process originally created deduplicated bytes.
    if (
      state.policies[intentionId]?.allowed &&
      service.store.artifacts.has(intention.expectedRef)
    ) {
      try {
        service.store.artifacts.get(intention.expectedRef);
      } catch (error) {
        return finish("failed", `Recovery integrity failure: ${String(error)}`);
      }
      return finish(
        "succeeded",
        "Reconciled existing verified artifact after recorded permission",
      );
    }
    const at = service.deps.clock();
    const permitted = currentOffices(state, intention.actorId, at).some(
      (officeId) =>
        state.offices[officeId]?.capabilities.includes(intention.capability),
    );
    const allowed =
      state.actors[intention.actorId]?.lifecycle === "active" && permitted;
    service.record(
      {
        type: "CapabilityPolicyEvaluated",
        data: {
          intentionId,
          allowed,
          reason: allowed
            ? "Active fixture with current artifact.write tenure"
            : "Actor inactive or no current capability grant",
          policyVersion: "dev:policy:artifact-v1",
          cursor: state.cursor,
        },
      },
      {
        actorId: intention.actorId,
        recordedBy: "runtime",
        causedBy: intentionEvent.id,
      },
    );
    if (!allowed) return finish("denied", "No artifact effect attempted");
    try {
      service.store.artifacts.put(intention.body);
    } catch (error) {
      return finish("failed", String(error));
    }
    // Test seam models process interruption after effect but before completion recording.
    this.afterEffect?.();
    return finish("succeeded", "Verified immutable artifact written");
  }
}
