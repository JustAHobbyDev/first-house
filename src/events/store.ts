import type { DatabaseSync } from "node:sqlite";
import { canonicalJson, clone, digest } from "../domain/json.js";
import { commandArtifactRefs, parseCommand } from "../domain/commands.js";
import type { Command, EventData, EventType } from "../domain/types.js";
import * as v from "../domain/validation.js";
import type { ArtifactStore } from "../artifacts/store.js";

export interface Envelope {
  id: string;
  occurredAt: string;
  actorId: string | null;
  subjectId: string | null;
  causedBy: string | null;
  correlationId: string;
  canonVersion: string;
  recordedBy: "runtime" | "regent" | "seat";
}
export type HouseEvent = {
  [K in EventType]: Envelope & {
    type: K;
    data: EventData[K];
    sequence: number;
    artifactRefs: string[];
    previousHash: string | null;
    hash: string;
  };
}[EventType];
export function eventHash(
  event: Omit<HouseEvent, "hash"> | HouseEvent,
): string {
  const { hash: _hash, ...body } = event as HouseEvent;
  return digest(canonicalJson(body));
}
export interface Verification {
  valid: boolean;
  count: number;
  head: string | null;
  errors: string[];
}

export class EventStore {
  constructor(
    readonly db: DatabaseSync,
    readonly artifacts: ArtifactStore,
  ) {}
  read(from = 1, to = Number.MAX_SAFE_INTEGER): HouseEvent[] {
    v.integer(from, 1);
    v.integer(to);
    return this.db
      .prepare(
        "SELECT json FROM events WHERE sequence >= ? AND sequence <= ? ORDER BY sequence",
      )
      .all(from, to)
      .map((r) => JSON.parse(r.json as string) as HouseEvent);
  }
  correlation(id: string): HouseEvent[] {
    return this.db
      .prepare(
        "SELECT json FROM events WHERE correlation_id = ? ORDER BY sequence",
      )
      .all(v.devId(id))
      .map((r) => JSON.parse(r.json as string) as HouseEvent);
  }
  head(): HouseEvent | null {
    const row = this.db
      .prepare("SELECT json FROM events ORDER BY sequence DESC LIMIT 1")
      .get();
    return row ? (JSON.parse(row.json as string) as HouseEvent) : null;
  }
  append(
    commandInput: Command,
    envelopeInput: Envelope,
    validate?: (events: HouseEvent[]) => void,
  ): HouseEvent {
    const command = parseCommand(commandInput);
    const e = v.object(envelopeInput);
    v.exact(e, [
      "id",
      "occurredAt",
      "actorId",
      "subjectId",
      "causedBy",
      "correlationId",
      "canonVersion",
      "recordedBy",
    ]);
    const envelope: Envelope = {
      id: v.devId(e.id),
      occurredAt: v.timestamp(e.occurredAt),
      actorId: v.nullable(e.actorId, v.devId),
      subjectId: v.nullable(e.subjectId, v.devId),
      causedBy: v.nullable(e.causedBy, v.devId),
      correlationId: v.devId(e.correlationId),
      canonVersion: v.text(e.canonVersion),
      recordedBy: v.choice(e.recordedBy, ["runtime", "regent", "seat"]),
    };
    const artifactRefs = commandArtifactRefs(command);
    for (const ref of artifactRefs) this.artifacts.get(ref);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const verification = this.verify();
      if (!verification.valid)
        throw new Error(
          `Cannot append to invalid record: ${verification.errors.join("; ")}`,
        );
      const events = this.read();
      validate?.(events);
      if (
        envelope.causedBy !== null &&
        !events.some((event) => event.id === envelope.causedBy)
      )
        throw new Error("Unknown causal event");
      const previous = events.at(-1);
      const body = {
        ...envelope,
        ...command,
        sequence: (previous?.sequence ?? 0) + 1,
        artifactRefs,
        previousHash: previous?.hash ?? null,
      };
      const event = {
        ...body,
        hash: eventHash(body as Omit<HouseEvent, "hash">),
      } as HouseEvent;
      this.db
        .prepare(
          "INSERT INTO events(sequence,id,correlation_id,json,hash) VALUES (?,?,?,?,?)",
        )
        .run(
          event.sequence,
          event.id,
          event.correlationId,
          canonicalJson(event),
          event.hash,
        );
      this.db.exec("COMMIT");
      return clone(event);
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  verify(checkpoint?: { sequence: number; hash: string }): Verification {
    const errors: string[] = [];
    let previous: string | null = null;
    const rows = this.db
      .prepare(
        "SELECT sequence,id,correlation_id,json,hash FROM events ORDER BY sequence",
      )
      .all();
    rows.forEach((row, index) => {
      try {
        const e = JSON.parse(row.json as string) as HouseEvent;
        parseCommand({ type: e.type, data: e.data });
        if (e.sequence !== index + 1 || row.sequence !== e.sequence)
          throw new Error("Sequence mismatch");
        if (
          row.id !== e.id ||
          row.correlation_id !== e.correlationId ||
          row.hash !== e.hash
        )
          throw new Error("Row/envelope mismatch");
        if (e.previousHash !== previous || eventHash(e) !== e.hash)
          throw new Error("Hash-chain mismatch");
        if (
          canonicalJson(e.artifactRefs) !==
          canonicalJson(
            commandArtifactRefs({ type: e.type, data: e.data } as Command),
          )
        )
          throw new Error("Artifact references mismatch");
        for (const ref of e.artifactRefs) this.artifacts.get(ref);
        if (e.type === "ContextManifestCompiled") {
          const manifest = v.object(
            JSON.parse(this.artifacts.text(e.data.manifestRef)),
          );
          if (
            manifest.renderedRef !== e.data.renderedRef ||
            manifest.actorId !== e.data.actorId ||
            manifest.cursor !== e.data.cursor
          )
            throw new Error("Manifest/event provenance mismatch");
          v.array(manifest.candidates, (candidate) => {
            const pack = v.object(v.object(candidate).pack);
            const ref = v.hashRef(pack.bodyRef);
            if (pack.contentHash !== ref)
              throw new Error("Manifest pack hash mismatch");
            this.artifacts.get(ref);
          });
        }
        previous = e.hash;
      } catch (error) {
        errors.push(`Sequence ${index + 1}: ${String(error)}`);
      }
    });
    if (checkpoint) {
      v.integer(checkpoint.sequence, 1);
      v.hashRef(checkpoint.hash);
      if (rows[checkpoint.sequence - 1]?.hash !== checkpoint.hash)
        errors.push("Independent checkpoint mismatch or missing suffix");
    }
    return {
      valid: errors.length === 0,
      count: rows.length,
      head: previous,
      errors,
    };
  }
}
