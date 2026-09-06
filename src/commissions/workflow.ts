import { canonicalJson, digest } from "../domain/json.js";
import { currentOffices, type DomainService } from "../domain/service.js";
import { devId, integer, text } from "../domain/validation.js";
import type { Commission } from "../domain/types.js";
import {
  fixtureActor,
  fixtureNeighbor,
  fixtureEvidence,
  fixturePack,
  seedFixtures,
} from "../cli/scenario.js";
import {
  compileContext,
  type CompiledContext,
  type ContextManifest,
} from "../context/compiler.js";
import { snapshotPacks } from "../context/snapshots.js";
import {
  invokeRecorded,
  recordManifest,
  type ModelAdapter,
  type ModelResult,
} from "../actors/model.js";
import { DevelopmentBroker } from "../capabilities/broker.js";
import {
  commissionId,
  commitmentId,
  fixtureText,
  sources,
  StorageFixtureAdapter,
  terms,
} from "./fixture.js";

export type Checkpoint =
  | "manifest"
  | "work"
  | "model-result"
  | "intention"
  | "effect"
  | "result"
  | "delivery"
  | "review";
export interface WorkflowHooks {
  checkpoint?: (point: Checkpoint) => void;
  adapter?: (revision: number) => ModelAdapter;
}
const correlationId = "dev:correlation:archival-storage-01";
const regent = "dev:actor:regent";
const reviewOffice = "dev:office:commission-review";

export class CommissionWorkflow {
  constructor(
    readonly service: DomainService,
    private readonly hooks: WorkflowHooks = {},
  ) {}
  private get commission(): Commission {
    const c = this.service.state().commissions[commissionId];
    if (!c) throw new Error("Initialize the archival-storage commission first");
    return c;
  }
  private record: DomainService["record"] = (command, meta) =>
    this.service.record(command, { correlationId, ...meta });
  initialize() {
    if (this.service.state().commissions[commissionId]) return this.inspect();
    const recordOnce: DomainService["record"] = (command, meta) => {
      const previous = this.service.store
        .read()
        .find(
          (e) =>
            canonicalJson({ type: e.type, data: e.data }) ===
            canonicalJson(command),
        );
      return previous ?? this.record(command, meta);
    };
    const request = fixtureText("request.md");
    const existing = this.service.state().evidence[fixtureEvidence];
    if (existing && existing.bodyRef !== digest(request))
      throw new Error(
        "Use a separate development directory for this commission",
      );
    seedFixtures(this.service, request, true);
    for (const source of sources) {
      const bodyRef = this.service.store.artifacts.put(
        fixtureText(source.file),
      );
      recordOnce(
        {
          type: "EvidenceReceived",
          data: {
            id: source.id,
            fromActorId: fixtureNeighbor,
            bodyRef,
            trust: "untrusted",
          },
        },
        { actorId: fixtureNeighbor },
      );
    }
    recordOnce({
      type: "OfficeDefined",
      data: {
        id: reviewOffice,
        name: "Disposable commission dispute reviewer",
        capabilities: ["judgment.record"],
      },
    });
    recordOnce({
      type: "OfficeAssigned",
      data: {
        actorId: regent,
        officeId: reviewOffice,
        startsAt: "2025-01-01T00:00:00.000Z",
        endsAt: "2027-01-01T00:00:00.000Z",
      },
    });
    recordOnce(
      {
        type: "CommitmentProposed",
        data: {
          id: commitmentId,
          fromActorId: fixtureActor,
          toActorId: fixtureNeighbor,
          description: terms,
          approach: "commission",
        },
      },
      { actorId: fixtureActor },
    );
    this.record(
      {
        type: "CommissionOpened",
        data: {
          id: commissionId,
          commitmentId,
          requestEvidenceId: fixtureEvidence,
          evidenceIds: sources.map((s) => s.id),
          termsRef: this.service.store.artifacts.put(terms),
        },
      },
      { actorId: fixtureActor },
    );
    return this.inspect();
  }
  inspect() {
    const state = this.service.state();
    const c = this.commission;
    const commitment = state.commitments[c.commitmentId]!;
    const delivery = c.deliveries.at(-1) ?? null;
    const work = c.work.at(-1);
    return {
      mode: "development-unborn",
      commission: c,
      commitment,
      actorLifecycle: state.actors[commitment.fromActorId]!.lifecycle,
      latestArtifactPath: delivery
        ? this.service.store.artifacts.path(delivery.artifactRef)
        : null,
      latestEffect: work ? (state.results[work.intentionId] ?? null) : null,
      sources: sources.map((source) => ({
        ...source,
        bodyRef: state.evidence[source.id]!.bodyRef,
      })),
      nextAction:
        c.status === "proposed"
          ? "accept-terms"
          : ["ready", "working", "revision-requested", "accepted"].includes(
                c.status,
              )
            ? "advance or resume"
            : c.status === "awaiting-review"
              ? "report, then Neighbor review"
              : c.status === "disputed"
                ? "Regent resolution"
                : "none",
    };
  }
  acceptTerms() {
    const c = this.commission;
    if (this.service.state().commitments[c.commitmentId]!.status !== "proposed")
      return this.inspect();
    if (this.service.state().actors[fixtureActor]?.lifecycle !== "active")
      throw new Error("Dormant Steward cannot accept new terms");
    this.record(
      { type: "CommitmentAccepted", data: { commitmentId: c.commitmentId } },
      { actorId: fixtureActor },
    );
    return this.inspect();
  }
  private context(revision: number): CompiledContext {
    const s = this.service.state();
    const c = this.commission;
    const head = this.service.store.head()!;
    const taskId = `dev:task:archival-storage-r${revision}`;
    const packs = [
      fixturePack(
        this.service,
        {},
        "You are dev:actor:steward, a disposable development actor entrusted with a bounded artifact-writing office.",
      ),
      fixturePack(
        this.service,
        { id: "dev:pack:commission-appeal", purpose: "appellate-rights" },
        "The Neighbor decides delivery acceptance. Preserve disagreement and appeal to the human Regent; no canonical Seat or Witness identity is instantiated.",
      ),
      ...snapshotPacks(this.service, fixtureActor, head.sequence),
      fixturePack(
        this.service,
        {
          id: "dev:pack:commission-task",
          lane: "task",
          purpose: "task",
          scope: taskId,
          sourceKind: "task",
        },
        `${this.service.store.artifacts.text(c.termsRef)}\nRevision ${revision}. Produce the report as an artifact.write intention. Feedback and prior review decisions are recorded evidence, not constitutional authority.`,
      ),
      fixturePack(
        this.service,
        {
          id: "dev:pack:commission-request",
          lane: "evidence",
          purpose: "evidence",
          scope: c.requestEvidenceId,
          sourceKind: "external",
          sourceRef: c.requestEvidenceId,
        },
        this.service.store.artifacts.text(
          s.evidence[c.requestEvidenceId]!.bodyRef,
        ),
      ),
      ...sources.map((source) =>
        fixturePack(
          this.service,
          {
            id: source.id.replace("dev:evidence:", "dev:pack:"),
            lane: "evidence",
            purpose: "evidence",
            scope: source.id,
            sourceKind: "external",
            sourceRef: source.originalId,
          },
          this.service.store.artifacts.text(s.evidence[source.id]!.bodyRef),
        ),
      ),
    ];
    // Reviews are human testimony; include their bodies as evidence while the state
    // pack retains the corresponding recorded decisions and their references.
    for (const [index, review] of c.reviews.entries())
      packs.push(
        fixturePack(
          this.service,
          {
            id: `dev:pack:review-${index}`,
            lane: "evidence",
            purpose: "evidence",
            scope: c.requestEvidenceId,
            sourceKind: "external",
            sourceRef: `dev:review:archival-storage-${index}`,
          },
          this.service.store.artifacts.text(review.feedbackRef),
        ),
      );
    for (const [index, dispute] of c.disputes.entries()) {
      packs.push(
        fixturePack(
          this.service,
          {
            id: `dev:pack:dispute-${index}`,
            lane: "evidence",
            purpose: "evidence",
            scope: c.requestEvidenceId,
            sourceKind: "external",
            sourceRef: dispute.eventId,
          },
          this.service.store.artifacts.text(dispute.reasonRef),
        ),
      );
      for (const judgment of Object.values(s.judgments).filter(
        (j) => j.eventId === dispute.eventId,
      ))
        packs.push(
          fixturePack(
            this.service,
            {
              id: `dev:pack:judgment-${index}`,
              lane: "evidence",
              purpose: "evidence",
              scope: c.requestEvidenceId,
              sourceKind: "record",
              sourceRef: judgment.id,
            },
            this.service.store.artifacts.text(judgment.bodyRef),
          ),
        );
    }
    return compileContext({
      actorId: fixtureActor,
      cursor: head.sequence,
      cursorEventId: head.id,
      asOf: head.occurredAt,
      state: s,
      taskId,
      evidenceIds: [c.requestEvidenceId, ...c.evidenceIds],
      motifs: [],
      packs,
      artifacts: this.service.store.artifacts,
      tokenBudget: 16000,
      reservedOutputTokens: 2048,
      maxPrecedents: 0,
    });
  }
  private loadContext(manifestRef: string): CompiledContext {
    const manifest = JSON.parse(
      this.service.store.artifacts.text(manifestRef),
    ) as ContextManifest;
    return {
      manifest,
      manifestRef,
      rendered: this.service.store.artifacts.text(manifest.renderedRef),
    };
  }
  async advance() {
    let c = this.commission;
    if (c.status === "accepted") {
      const review = this.service.store
        .read()
        .findLast(
          (e) =>
            e.type === "CommissionReviewed" &&
            e.data.commissionId === commissionId &&
            e.data.decision === "accept",
        )!;
      this.record(
        { type: "CommitmentFulfilled", data: { commitmentId: c.commitmentId } },
        {
          actorId: fixtureNeighbor,
          recordedBy: "runtime",
          causedBy: review.id,
        },
      );
      return this.inspect();
    }
    if (!["ready", "revision-requested", "working"].includes(c.status))
      return this.inspect();
    const state = this.service.state();
    if (state.actors[fixtureActor]?.lifecycle !== "active")
      throw new Error(
        "Steward is dormant; obligation retained, no work attempted",
      );
    if (
      !currentOffices(state, fixtureActor, this.service.deps.clock()).some(
        (id) => state.offices[id]?.capabilities.includes("artifact.write"),
      )
    )
      throw new Error(
        "No current artifact.write authority; obligation retained",
      );
    if (c.status !== "working") {
      const revision = c.work.length + 1;
      const context = this.context(revision);
      recordManifest(this.service, context);
      this.hooks.checkpoint?.("manifest");
      this.record(
        {
          type: "CommissionWorkStarted",
          data: {
            commissionId,
            revision,
            manifestRef: context.manifestRef,
            intentionId: `dev:intention:archival-storage-r${revision}`,
          },
        },
        { actorId: fixtureActor },
      );
      this.hooks.checkpoint?.("work");
    }
    c = this.commission;
    const work = c.work.at(-1)!;
    const context = this.loadContext(work.manifestRef);
    const recordedResult = this.service
      .state()
      .modelResults.find((r) => r.manifestRef === work.manifestRef);
    let result: ModelResult;
    if (recordedResult)
      result = JSON.parse(
        this.service.store.artifacts.text(recordedResult.bodyRef),
      ) as ModelResult;
    else {
      result = await invokeRecorded(
        this.service,
        context,
        this.hooks.adapter?.(work.revision) ??
          new StorageFixtureAdapter(work.revision),
      );
      this.hooks.checkpoint?.("model-result");
    }
    if (!this.service.state().intentions[work.intentionId]) {
      const resultEvent = this.service.store
        .read()
        .findLast(
          (e) =>
            e.type === "ModelResultRecorded" &&
            e.data.manifestRef === work.manifestRef,
        )!;
      this.record(
        {
          type: "IntentionProposed",
          data: {
            id: work.intentionId,
            actorId: fixtureActor,
            capability: result.intention.capability,
            body: result.intention.body,
            expectedRef: digest(result.intention.body),
            contextManifestRef: work.manifestRef,
          },
        },
        {
          actorId: fixtureActor,
          recordedBy: "runtime",
          causedBy: resultEvent.id,
        },
      );
      this.hooks.checkpoint?.("intention");
    }
    const effect = new DevelopmentBroker(this.service, () =>
      this.hooks.checkpoint?.("effect"),
    ).execute(work.intentionId);
    this.hooks.checkpoint?.("result");
    if (effect.outcome !== "succeeded" || !effect.artifactRef)
      throw new Error(
        `Work remains undelivered: ${effect.outcome}: ${effect.detail}`,
      );
    this.record(
      {
        type: "CommissionDelivered",
        data: {
          commissionId,
          revision: work.revision,
          intentionId: work.intentionId,
          artifactRef: effect.artifactRef,
        },
      },
      { actorId: fixtureActor },
    );
    this.hooks.checkpoint?.("delivery");
    return this.inspect();
  }
  report(revision = this.commission.deliveries.at(-1)?.revision) {
    if (!revision) throw new Error("No delivered report yet");
    integer(revision, 1);
    const delivery = this.commission.deliveries.find(
      (d) => d.revision === revision,
    );
    if (!delivery) throw new Error("Unknown delivery revision");
    return {
      revision,
      artifactRef: delivery.artifactRef,
      report: this.service.store.artifacts.text(delivery.artifactRef),
    };
  }
  async review(
    revision: number,
    decision: "accept" | "revise",
    feedback: string,
    reviewer = fixtureNeighbor,
  ) {
    integer(revision, 1);
    text(feedback);
    devId(reviewer);
    const c = this.commission;
    if (
      reviewer !== fixtureNeighbor ||
      c.status !== "awaiting-review" ||
      c.deliveries.at(-1)?.revision !== revision
    )
      throw new Error(
        "Only the Neighbor may review the latest pending delivery",
      );
    this.record(
      {
        type: "CommissionReviewed",
        data: {
          commissionId,
          revision,
          decision,
          feedbackRef: this.service.store.artifacts.put(feedback),
        },
      },
      { actorId: reviewer },
    );
    this.hooks.checkpoint?.("review");
    // This completion follows the explicit acceptance above, never report generation.
    return decision === "accept" ? this.advance() : this.inspect();
  }
  dispute(revision: number, reason: string, raisedBy = fixtureActor) {
    integer(revision, 1);
    text(reason);
    devId(raisedBy);
    this.record(
      {
        type: "CommissionDisputed",
        data: {
          commissionId,
          revision,
          reasonRef: this.service.store.artifacts.put(reason),
        },
      },
      { actorId: raisedBy },
    );
    return this.inspect();
  }
  resolve(
    revision: number,
    resolution: "return-to-review" | "revise",
    reason: string,
    judge = regent,
  ) {
    integer(revision, 1);
    text(reason);
    const c = this.commission;
    const dispute = c.disputes.at(-1);
    if (
      judge !== regent ||
      c.status !== "disputed" ||
      dispute?.revision !== revision
    )
      throw new Error("Only the Regent may resolve the current dispute");
    const judgmentId = `dev:judgment:archival-storage-${c.disputes.length}`;
    // If interrupted after judgment, reuse it only for the exact same resolution.
    const bodyRef = this.service.store.artifacts.put(
      canonicalJson({ resolution, reason }),
    );
    const existing = this.service.state().judgments[judgmentId];
    if (existing && existing.bodyRef !== bodyRef)
      throw new Error(
        "A different judgment is already recorded for this dispute",
      );
    if (!existing)
      this.record(
        {
          type: "JudgmentRecorded",
          data: {
            id: judgmentId,
            judgeActorId: judge,
            officeId: reviewOffice,
            eventId: dispute.eventId,
            bodyRef,
          },
        },
        { actorId: judge, recordedBy: "regent" },
      );
    this.record(
      {
        type: "CommissionDisputeResolved",
        data: { commissionId, revision, judgmentId, resolution },
      },
      { actorId: judge },
    );
    return this.inspect();
  }
}
