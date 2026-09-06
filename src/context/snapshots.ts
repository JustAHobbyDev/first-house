import type { DomainService } from "../domain/service.js";
import { currentOffices } from "../domain/service.js";
import { canonicalJson } from "../domain/json.js";
import { estimateTokens, type ContextPack } from "./registry.js";
import type { State } from "../projections/state.js";

export function authoritySnapshot(
  state: State,
  actorId: string,
  asOf: string,
): string {
  const offices = currentOffices(state, actorId, asOf).map((id) => ({
    office: state.offices[id],
    tenure: state.tenures.find(
      (t) =>
        t.officeId === id &&
        t.actorId === actorId &&
        t.startsAt <= asOf &&
        asOf < t.endsAt,
    ),
  }));
  return canonicalJson({ actorId, asOf, offices });
}

export function snapshotPacks(
  service: DomainService,
  actorId: string,
  cursor: number,
): ContextPack[] {
  const state = service.state(cursor);
  const head = service.store.read(cursor, cursor)[0];
  if (!head || !state.actors[actorId] || state.cursor !== cursor)
    throw new Error("Unknown snapshot cursor or actor");
  return (["office", "state"] as const).map((purpose) => {
    const body =
      purpose === "office"
        ? authoritySnapshot(state, actorId, head.occurredAt)
        : canonicalJson(state);
    const ref = service.store.artifacts.put(body);
    return {
      id: `dev:pack:${purpose}-snapshot`,
      version: String(cursor),
      lane: purpose,
      purpose,
      scope: actorId,
      bodyRef: ref,
      contentHash: ref,
      sourceKind: "record",
      sourceRef: head.id,
      audience: [actorId],
      priority: 100,
      tokenEstimate: estimateTokens(body),
      required: true,
      validFromCursor: cursor,
      validToCursor: cursor,
      selectionReason: "record-snapshot",
      tags: [],
    };
  });
}
