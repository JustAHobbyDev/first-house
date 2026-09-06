import type { ArtifactStore } from "../artifacts/store.js";
import { clone, digest } from "../domain/json.js";
import * as v from "../domain/validation.js";

export const lanes = [
  "root",
  "constitution",
  "office",
  "state",
  "precedent",
  "evidence",
  "task",
] as const;
export type Lane = (typeof lanes)[number];
export const sourceLanes = {
  fixture: [
    "root",
    "constitution",
    "office",
    "state",
    "precedent",
    "evidence",
    "task",
  ],
  canon: ["constitution"],
  record: ["office", "state", "evidence"],
  chronicle: ["precedent", "evidence"],
  external: ["evidence"],
  task: ["task"],
} as const;
export type SourceKind = keyof typeof sourceLanes;
export type Purpose =
  | "identity"
  | "appellate-rights"
  | "office"
  | "state"
  | "task"
  | "evidence"
  | "motif"
  | "precedent";
export interface ContextPack {
  id: string;
  version: string;
  lane: Lane;
  purpose: Purpose;
  scope: string;
  bodyRef: string;
  contentHash: string;
  sourceKind: SourceKind;
  sourceRef: string;
  audience: string[];
  priority: number;
  tokenEstimate: number;
  required: boolean;
  validFromCursor: number;
  validToCursor: number | null;
  selectionReason: string;
  tags: string[];
}
export function estimateTokens(body: string): number {
  return Math.ceil(Buffer.byteLength(body, "utf8") / 4);
}

export function parsePack(
  value: unknown,
  artifacts: ArtifactStore,
): ContextPack {
  const o = v.object(value);
  v.exact(o, [
    "id",
    "version",
    "lane",
    "purpose",
    "scope",
    "bodyRef",
    "contentHash",
    "sourceKind",
    "sourceRef",
    "audience",
    "priority",
    "tokenEstimate",
    "required",
    "validFromCursor",
    "validToCursor",
    "selectionReason",
    "tags",
  ]);
  const pack: ContextPack = {
    id: v.devId(o.id),
    version: v.text(o.version),
    lane: v.choice(o.lane, lanes),
    purpose: v.choice(o.purpose, [
      "identity",
      "appellate-rights",
      "office",
      "state",
      "task",
      "evidence",
      "motif",
      "precedent",
    ]),
    scope: v.devId(o.scope),
    bodyRef: v.hashRef(o.bodyRef),
    contentHash: v.hashRef(o.contentHash),
    sourceKind: v.choice(
      o.sourceKind,
      Object.keys(sourceLanes) as SourceKind[],
    ),
    sourceRef: v.text(o.sourceRef),
    audience: v.array(o.audience, v.devId),
    priority: v.integer(o.priority),
    tokenEstimate: v.integer(o.tokenEstimate),
    required: v.boolean(o.required),
    validFromCursor: v.integer(o.validFromCursor),
    validToCursor: v.nullable(o.validToCursor, v.integer),
    selectionReason: v.text(o.selectionReason),
    tags: v.array(o.tags, (x) => v.text(x)),
  };
  if (!(sourceLanes[pack.sourceKind] as readonly string[]).includes(pack.lane))
    throw new Error("Source cannot enter this authority lane");
  const expectedLane: Record<Purpose, readonly Lane[]> = {
    identity: ["root"],
    "appellate-rights": ["root", "constitution"],
    office: ["office"],
    state: ["state"],
    task: ["task"],
    evidence: ["evidence"],
    motif: ["constitution"],
    precedent: ["precedent"],
  };
  if (!expectedLane[pack.purpose].includes(pack.lane))
    throw new Error("Purpose/lane mismatch");
  if (pack.validToCursor !== null && pack.validToCursor < pack.validFromCursor)
    throw new Error("Invalid pack cursor range");
  const body = artifacts.text(pack.bodyRef);
  if (pack.contentHash !== pack.bodyRef || digest(body) !== pack.contentHash)
    throw new Error("Pack content hash mismatch");
  if (pack.tokenEstimate < estimateTokens(body))
    throw new Error("Pack token estimate understates body");
  if (pack.sourceKind === "canon" && !body.includes("DRAFT / UNRATIFIED"))
    throw new Error("Canon pack must remain DRAFT / UNRATIFIED");
  return pack;
}
export class ContextRegistry {
  private readonly packs = new Map<string, ContextPack>();
  constructor(readonly artifacts: ArtifactStore) {}
  register(input: unknown): void {
    const pack = parsePack(input, this.artifacts);
    const key = `${pack.id}@${pack.version}`;
    if (this.packs.has(key)) throw new Error("Pack version already registered");
    this.packs.set(key, clone(pack));
  }
  all(): ContextPack[] {
    return [...this.packs.values()].map(clone);
  }
}
