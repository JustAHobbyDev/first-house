import type { ArtifactStore } from "../artifacts/store.js";
import { canonicalJson, digest } from "../domain/json.js";
import * as v from "../domain/validation.js";
import type { State } from "../projections/state.js";
import {
  estimateTokens,
  lanes,
  parsePack,
  type ContextPack,
  type Lane,
} from "./registry.js";
import { authoritySnapshot } from "./snapshots.js";

export interface CompileInput {
  actorId: string;
  cursor: number;
  cursorEventId: string;
  asOf: string;
  state: State;
  taskId: string;
  evidenceIds: string[];
  motifs: string[];
  packs: ContextPack[];
  artifacts: ArtifactStore;
  tokenBudget: number;
  reservedOutputTokens: number;
  maxPrecedents: number;
}
export interface Candidate {
  pack: ContextPack;
  included: boolean;
  reason: string;
  duplicateOf: string | null;
}
export interface ContextManifest {
  schemaVersion: "dev:manifest:v1";
  compilerVersion: "dev:compiler:v1";
  actorId: string;
  cursor: number;
  cursorEventId: string;
  asOf: string;
  taskId: string;
  evidenceIds: string[];
  motifs: string[];
  tokenBudget: number;
  reservedOutputTokens: number;
  estimatedInputTokens: number;
  maxPrecedents: number;
  estimator: "utf8-bytes-div-4-v1";
  renderedRef: string;
  candidates: Candidate[];
}
export interface CompiledContext {
  rendered: string;
  manifest: ContextManifest;
  manifestRef: string;
}
const compare = (a: ContextPack, b: ContextPack): number =>
  b.priority - a.priority ||
  (a.id < b.id
    ? -1
    : a.id > b.id
      ? 1
      : a.version < b.version
        ? -1
        : a.version > b.version
          ? 1
          : 0);

export function compileContext(input: CompileInput): CompiledContext {
  v.devId(input.actorId);
  v.devId(input.taskId);
  v.integer(input.cursor);
  v.devId(input.cursorEventId);
  v.timestamp(input.asOf);
  v.array(input.evidenceIds, v.devId);
  v.array(input.motifs, (x) => v.text(x));
  v.integer(input.tokenBudget, 1);
  v.integer(input.reservedOutputTokens);
  v.integer(input.maxPrecedents);
  if (input.state.cursor !== input.cursor || !input.state.actors[input.actorId])
    throw new Error("Context requires actor state at the exact cursor");
  const packs = input.packs
    .map((p) => parsePack(p, input.artifacts))
    .sort(compare);
  if (new Set(packs.map((p) => `${p.id}@${p.version}`)).size !== packs.length)
    throw new Error("Duplicate pack version");
  const records: Candidate[] = [];
  const relevant = (p: ContextPack): boolean => {
    switch (p.purpose) {
      case "identity":
      case "appellate-rights":
      case "office":
      case "state":
        return p.scope === input.actorId;
      case "task":
        return p.scope === input.taskId;
      case "evidence":
        return input.evidenceIds.includes(p.scope);
      case "motif":
        return p.tags.some((tag) => input.motifs.includes(tag));
      case "precedent":
        return (
          p.tags.some((tag) => input.motifs.includes(tag)) ||
          p.scope === input.taskId
        );
    }
  };
  for (const pack of packs) {
    let reason: string | null = null;
    if (!relevant(pack)) reason = "not-relevant";
    else if (!pack.audience.includes(input.actorId))
      reason = "audience-restricted";
    else if (
      pack.validFromCursor > input.cursor ||
      (pack.validToCursor !== null && pack.validToCursor < input.cursor)
    )
      reason = "invalid-at-cursor";
    if (reason && reason !== "not-relevant" && pack.required)
      throw new Error(`Required pack unavailable: ${pack.id} (${reason})`);
    records.push({
      pack,
      included: false,
      reason: reason ?? "candidate",
      duplicateOf: null,
    });
  }
  const available = records.filter((r) => r.reason === "candidate");
  if (new Set(available.map((r) => r.pack.id)).size !== available.length)
    throw new Error("Ambiguous active pack versions");
  for (const purpose of [
    "identity",
    "appellate-rights",
    "office",
    "state",
    "task",
  ] as const) {
    const matching = available.filter((r) => r.pack.purpose === purpose);
    if (matching.length !== 1 || !matching[0]?.pack.required)
      throw new Error(`Exactly one required ${purpose} pack must be available`);
  }
  for (const evidenceId of input.evidenceIds) {
    if (
      !input.state.evidence[evidenceId] ||
      !available.some(
        (r) =>
          r.pack.purpose === "evidence" &&
          r.pack.scope === evidenceId &&
          r.pack.required &&
          r.pack.bodyRef === input.state.evidence[evidenceId]?.bodyRef,
      )
    )
      throw new Error("Missing required recorded evidence pack");
  }
  for (const purpose of ["office", "state"] as const) {
    const pack = available.find((r) => r.pack.purpose === purpose)!.pack;
    if (
      pack.sourceKind !== "record" ||
      pack.validFromCursor !== input.cursor ||
      pack.validToCursor !== input.cursor
    )
      throw new Error(
        "State and authority packs must pin the exact record cursor",
      );
    const expected =
      purpose === "state"
        ? canonicalJson(input.state)
        : authoritySnapshot(input.state, input.actorId, input.asOf);
    if (
      pack.sourceRef !== input.cursorEventId ||
      input.artifacts.text(pack.bodyRef) !== expected
    )
      throw new Error(
        "Snapshot pack does not match projected state or authority",
      );
  }
  const selected: ContextPack[] = [];
  const render = (selection: ContextPack[]): string =>
    canonicalJson({
      format: "dev:context:v1",
      lanes: lanes.map((lane) => ({
        lane,
        packs: selection
          .filter((p) => p.lane === lane)
          .sort(compare)
          .map((p) => ({
            id: p.id,
            version: p.version,
            sourceKind: p.sourceKind,
            sourceRef: p.sourceRef,
            body: input.artifacts.text(p.bodyRef),
          })),
      })),
    });
  const cost = (selection: ContextPack[]): number =>
    estimateTokens(render(selection)) +
    selection.reduce(
      (sum, p) =>
        sum + p.tokenEstimate - estimateTokens(input.artifacts.text(p.bodyRef)),
      0,
    );
  const capacity = input.tokenBudget - input.reservedOutputTokens;
  const seen = new Map<string, ContextPack>();
  const include = (record: Candidate): void => {
    // Cross-lane duplicates retain distinct renderings: authority is not a property of bytes.
    const key = `${record.pack.lane}:${record.pack.contentHash}`;
    const duplicate = seen.get(key);
    if (duplicate) {
      record.reason = "duplicate-content-in-lane";
      record.duplicateOf = `${duplicate.id}@${duplicate.version}`;
      return;
    }
    record.included = true;
    record.reason = record.pack.required
      ? "required"
      : record.pack.selectionReason;
    selected.push(record.pack);
    seen.set(key, record.pack);
  };
  for (const record of available.filter((r) => r.pack.required))
    include(record);
  let precedents = selected.filter((p) => p.purpose === "precedent").length;
  if (precedents > input.maxPrecedents)
    throw new Error("Required precedents exceed configured limit");
  if (cost(selected) > capacity)
    throw new Error(
      "Required context exceeds input budget; invocation forbidden",
    );
  for (const record of available.filter((r) => !r.pack.required)) {
    if (seen.has(`${record.pack.lane}:${record.pack.contentHash}`)) {
      include(record);
      continue;
    }
    if (
      record.pack.purpose === "precedent" &&
      precedents >= input.maxPrecedents
    ) {
      record.reason = "precedent-limit";
      continue;
    }
    if (cost([...selected, record.pack]) > capacity) {
      record.reason = "token-budget";
      continue;
    }
    include(record);
    if (record.pack.purpose === "precedent") precedents++;
  }
  const rendered = render(selected);
  const manifest: ContextManifest = {
    schemaVersion: "dev:manifest:v1",
    compilerVersion: "dev:compiler:v1",
    actorId: input.actorId,
    cursor: input.cursor,
    cursorEventId: input.cursorEventId,
    asOf: input.asOf,
    taskId: input.taskId,
    evidenceIds: [...input.evidenceIds].sort(),
    motifs: [...input.motifs].sort(),
    tokenBudget: input.tokenBudget,
    reservedOutputTokens: input.reservedOutputTokens,
    estimatedInputTokens: cost(selected),
    maxPrecedents: input.maxPrecedents,
    estimator: "utf8-bytes-div-4-v1",
    renderedRef: digest(rendered),
    candidates: records,
  };
  return { rendered, manifest, manifestRef: digest(canonicalJson(manifest)) };
}

export function renderedLane(context: CompiledContext, lane: Lane): unknown {
  const body = JSON.parse(context.rendered) as {
    lanes: { lane: Lane; packs: unknown[] }[];
  };
  return body.lanes.find((entry) => entry.lane === lane)?.packs;
}
