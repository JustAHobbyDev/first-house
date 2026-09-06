import { readFileSync } from "node:fs";
import { digest } from "../domain/json.js";
import type { CompiledContext } from "../context/compiler.js";
import type { ModelAdapter, ModelResult } from "../actors/model.js";

export const commissionId = "dev:commission:archival-storage-01";
export const commitmentId = "dev:commitment:archival-storage-01";
export const sources = [
  {
    id: "dev:evidence:building-storage-survey-01",
    originalId: "dev:building-storage-survey-01",
    file: "building-storage-survey.md",
  },
  {
    id: "dev:evidence:environmental-observation-log-01",
    originalId: "dev:environmental-observation-log-01",
    file: "environmental-observation-log.md",
  },
  {
    id: "dev:evidence:steward-storage-note-01",
    originalId: "dev:steward-storage-note-01",
    file: "storage-operations-note.md",
  },
] as const;
export function fixtureText(file: string): string {
  if (
    ![
      "request.md",
      "expected-report.md",
      ...sources.map((s) => s.file),
    ].includes(file)
  )
    throw new Error("Unknown archival-storage fixture file");
  return readFileSync(
    new URL(`../../../fixtures/archival-storage/${file}`, import.meta.url),
    "utf8",
  );
}
export const terms = `Disposable archival-storage commission. Produce a cited comparison of all three supplied locations for 12 paper-record crates. Apply moisture protection, complete-shipment capacity, practical weekly access, then temperature stability. Respect the instruction to retain the working desk. Distinguish documented observations, inference, and unresolved risks; use only the supplied evidence. Acceptance belongs to the requesting Neighbor. The Steward reports delivery; the Regent may resolve disputes by returning the report for review or revision. No payment or custody is involved.`;

/** Scripted fixture adapter, not a reasoning model or a general research service. */
export class StorageFixtureAdapter implements ModelAdapter {
  calls = 0;
  constructor(readonly revision: number) {}
  async invoke(context: CompiledContext): Promise<ModelResult> {
    const rendered = JSON.parse(context.rendered) as {
      lanes: { lane: string; packs: { sourceRef: string; body: string }[] }[];
    };
    const evidence =
      rendered.lanes.find((lane) => lane.lane === "evidence")?.packs ?? [];
    for (const source of sources) {
      const pack = evidence.find((p) => p.sourceRef === source.originalId);
      if (!pack || digest(pack.body) !== digest(fixtureText(source.file)))
        throw new Error(
          "Scripted adapter requires the exact supplied archival-storage records",
        );
    }
    this.calls++;
    const revisionNote =
      this.revision > 1
        ? `\n## Revision ${this.revision}\n\nThis revised delivery retains the documented comparison and makes the priority reasoning explicit: the Cellar's steadier temperature does not override moisture concerns, and the Study's dryness does not supply the missing two crate spaces while its desk remains in use. The Closet's storm-related humidity spike remains unresolved. [S][E][O]\n`
        : "";
    const body = fixtureText("expected-report.md") + revisionNote;
    return {
      text: `Scripted offline archival-storage fixture response, revision ${this.revision}.`,
      intention: { capability: "artifact.write", body },
    };
  }
}
