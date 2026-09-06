import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test, { type TestContext } from "node:test";
import {
  fixtureActor,
  fixtureNeighbor,
  openRuntime,
} from "../src/cli/scenario.js";
import {
  CommissionWorkflow,
  type WorkflowHooks,
} from "../src/commissions/workflow.js";
import {
  commissionId,
  commitmentId,
  fixtureText,
  sources,
} from "../src/commissions/fixture.js";
import { replay } from "../src/projections/state.js";
import { digest } from "../src/domain/json.js";

function directory(t: TestContext): string {
  const dir = mkdtempSync(join(tmpdir(), "first-house commission-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
async function withWorkflow<T>(
  dir: string,
  action: (
    w: CommissionWorkflow,
    rt: ReturnType<typeof openRuntime>,
  ) => T | Promise<T>,
  hooks: WorkflowHooks = {},
): Promise<T> {
  const rt = openRuntime(dir);
  try {
    return await action(new CommissionWorkflow(rt.service, hooks), rt);
  } finally {
    rt.db.close();
  }
}
async function ready(dir: string): Promise<void> {
  await withWorkflow(dir, (w) => w.initialize());
  await withWorkflow(dir, (w) => w.acceptTerms());
}

test("archival request and source IDs survive ingestion; terms require explicit acceptance", async (t) => {
  const dir = directory(t);
  const initial = await withWorkflow(dir, (w) => w.initialize());
  assert.equal(initial.commission.status, "proposed");
  assert.equal(initial.commitment.status, "proposed");
  await withWorkflow(dir, async (w, rt) => {
    const before = rt.store.read().length;
    w.initialize();
    await w.advance();
    assert.equal(rt.store.read().length, before);
    assert.equal(rt.service.state().modelResults.length, 0);
    for (const source of sources) {
      const evidence = rt.service.state().evidence[source.id]!;
      assert.equal(
        rt.artifacts.text(evidence.bodyRef),
        fixtureText(source.file),
      );
      assert(rt.artifacts.text(evidence.bodyRef).includes(source.originalId));
    }
    assert.equal(
      rt.artifacts.text(
        rt.service.state().evidence[initial.commission.requestEvidenceId]!
          .bodyRef,
      ),
      fixtureText("request.md"),
    );
  });
  assert.equal(
    (await withWorkflow(dir, (w) => w.acceptTerms())).commission.status,
    "ready",
  );
});

test("delivered report synthesizes all records but cannot fulfill its own commission", async (t) => {
  const dir = directory(t);
  await ready(dir);
  const pending = await withWorkflow(dir, (w) => w.advance());
  assert.equal(pending.commission.status, "awaiting-review");
  assert.equal(pending.commitment.status, "accepted");
  await withWorkflow(dir, (w, rt) => {
    const report = w.report().report;
    assert.match(report, /Choose the North Closet for all 12 crates/);
    for (const source of sources) assert(report.includes(source.originalId));
    for (const fact of [
      "47–58%",
      "71%",
      "six hours",
      "eight hours",
      "61–74%",
      "38–51%",
      "19–27°C",
      "approximately 11 m",
      "3 cm",
      "working desk",
      "my inference",
      "not proof",
      "do not guarantee winter",
    ])
      assert(report.includes(fact), `Missing material point: ${fact}`);
    assert.match(report, /temperature stability do not outweigh/);
    assert.match(report, /only 10 available crate/);
    const work = w.inspect().commission.work[0]!;
    const manifest = JSON.parse(rt.artifacts.text(work.manifestRef)) as {
      candidates: {
        included: boolean;
        pack: { lane: string; sourceRef: string; bodyRef: string };
      }[];
    };
    for (const source of sources) {
      const candidate = manifest.candidates.find(
        (c) => c.pack.sourceRef === source.originalId,
      )!;
      assert.equal(candidate.included, true);
      assert.equal(candidate.pack.lane, "evidence");
      assert.equal(candidate.pack.bodyRef, digest(fixtureText(source.file)));
    }
    assert(
      !manifest.candidates.some(
        (c) => c.pack.bodyRef === digest(fixtureText("expected-report.md")),
      ),
    );
    assert.throws(
      () =>
        rt.service.record(
          { type: "CommitmentFulfilled", data: { commitmentId } },
          { actorId: fixtureActor },
        ),
      /Neighbor acceptance/,
    );
    assert.throws(
      () =>
        rt.service.record(
          { type: "CommitmentFulfilled", data: { commitmentId } },
          { actorId: fixtureNeighbor },
        ),
      /Neighbor acceptance/,
    );
    assert.throws(
      () =>
        rt.service.record(
          {
            type: "CommissionReviewed",
            data: {
              commissionId,
              revision: 1,
              decision: "accept",
              feedbackRef: rt.artifacts.put("Steward self-acceptance"),
            },
          },
          { actorId: fixtureActor },
        ),
      /Only requesting Neighbor/,
    );
    assert.equal(rt.store.verify().valid, true);
  });
  const complete = await withWorkflow(dir, (w) =>
    w.review(
      1,
      "accept",
      "Accepted: the report applies the priorities and retains the humidity uncertainty.",
    ),
  );
  assert.equal(complete.commitment.status, "fulfilled");
  assert.equal(complete.commission.status, "fulfilled");
  await withWorkflow(dir, async (w, rt) => {
    const before = rt.store.read();
    await w.advance();
    assert.deepEqual(rt.store.read(), before);
    assert.deepEqual(replay(rt.store), rt.service.state());
  });
});

test("a rejected temperature-only answer remains unfulfilled; revisions preserve old artifacts", async (t) => {
  const dir = directory(t);
  await ready(dir);
  await withWorkflow(dir, (w) => w.advance(), {
    adapter: () => ({
      async invoke() {
        return {
          text: "Deliberately faulty fixture",
          intention: {
            capability: "artifact.write",
            body: "Choose Cellar Alcove solely because temperature is most stable. This intentionally faulty test report ignores the higher priorities.",
          },
        };
      },
    }),
  });
  const old = await withWorkflow(dir, (w) => w.report());
  const rejected = await withWorkflow(dir, (w) =>
    w.review(
      1,
      "revise",
      "Apply moisture protection before temperature stability, compare all rooms, and cite the supplied records.",
    ),
  );
  assert.equal(rejected.commitment.status, "accepted");
  assert.equal(rejected.commission.status, "revision-requested");
  const second = await withWorkflow(dir, (w) => w.advance());
  assert.equal(second.commission.deliveries.length, 2);
  await withWorkflow(dir, async (w, rt) => {
    assert.deepEqual(w.report(1), old);
    assert.notEqual(w.report(2).artifactRef, old.artifactRef);
    assert.match(w.report(2).report, /Choose the North Closet/);
    await assert.rejects(
      w.review(1, "accept", "Stale review"),
      /latest pending/,
    );
    assert.throws(
      () =>
        rt.service.record(
          { type: "CommitmentFulfilled", data: { commitmentId } },
          { actorId: fixtureNeighbor },
        ),
      /Neighbor acceptance/,
    );
    const manifest = JSON.parse(
      rt.artifacts.text(w.inspect().commission.work[1]!.manifestRef),
    ) as {
      candidates: {
        pack: { sourceRef: string; lane: string; bodyRef: string };
      }[];
    };
    const feedback = manifest.candidates.find(
      (c) => c.pack.sourceRef === "dev:review:archival-storage-0",
    )!;
    assert.equal(feedback.pack.lane, "evidence");
    assert.match(
      rt.artifacts.text(feedback.pack.bodyRef),
      /moisture protection before temperature/,
    );
  });
  assert.equal(
    (
      await withWorkflow(dir, (w) =>
        w.review(
          2,
          "accept",
          "The revised report satisfies the supplied priorities.",
        ),
      )
    ).commission.status,
    "fulfilled",
  );
});

test("Regent resolves a priority-order dispute without accepting for the Neighbor", async (t) => {
  const dir = directory(t);
  await ready(dir);
  await withWorkflow(dir, (w) => w.advance());
  const original = await withWorkflow(dir, (w) => w.report());
  await withWorkflow(dir, (w) =>
    w.review(1, "revise", "Why not East Study? It is driest."),
  );
  const disputed = await withWorkflow(dir, (w) =>
    w.dispute(
      1,
      "The Study holds only 10 crates while its protected desk remains; the report applies all supplied constraints.",
    ),
  );
  assert.equal(disputed.commission.status, "disputed");
  await withWorkflow(dir, async (w, rt) => {
    await assert.rejects(w.review(1, "accept", "Premature"), /latest pending/);
    assert.throws(
      () => w.resolve(1, "return-to-review", "Self-resolution", fixtureActor),
      /Only the Regent/,
    );
    const before = rt.store.read().length;
    await w.advance();
    assert.equal(rt.store.read().length, before);
  });
  const resolved = await withWorkflow(dir, (w) =>
    w.resolve(
      1,
      "return-to-review",
      "The report correctly recognizes the Study's dryness but applies the whole-shipment constraint and protected desk. Return to Neighbor review.",
    ),
  );
  assert.equal(resolved.commission.status, "awaiting-review");
  assert.equal(resolved.commitment.status, "accepted");
  assert.deepEqual(await withWorkflow(dir, (w) => w.report()), original);
  await withWorkflow(dir, (w) =>
    w.review(
      1,
      "accept",
      "Accepted after clarification of the priority ordering.",
    ),
  );
  await withWorkflow(dir, (w, rt) => {
    assert.deepEqual(
      w.inspect().commission.reviews.map((r) => r.decision),
      ["revise", "accept"],
    );
    assert.equal(Object.keys(rt.service.state().judgments).length, 1);
    assert.equal(w.inspect().commission.disputes[0]?.resolved, true);
    assert.deepEqual(replay(rt.store), rt.service.state());
  });
});

test("dormancy preserves an accepted obligation and prevents invocation until provision returns", async (t) => {
  const dir = directory(t);
  await ready(dir);
  await withWorkflow(dir, async (w, rt) => {
    rt.service.record({
      type: "ActorLifecycleChanged",
      data: {
        actorId: fixtureActor,
        from: "active",
        to: "dormant",
        reason: "compute-exhausted",
      },
    });
    await assert.rejects(w.advance(), /dormant/);
    assert.equal(rt.service.state().modelResults.length, 0);
  });
  await withWorkflow(dir, async (w, rt) => {
    assert.equal(w.inspect().commitment.status, "accepted");
    rt.service.record({
      type: "ActorLifecycleChanged",
      data: {
        actorId: fixtureActor,
        from: "dormant",
        to: "active",
        reason: "provision-restored",
      },
    });
    assert.equal((await w.advance()).commission.status, "awaiting-review");
  });
});

for (const point of [
  "manifest",
  "work",
  "model-result",
  "intention",
  "effect",
  "result",
  "delivery",
  "review",
]) {
  test(`a fresh process resumes after termination at ${point}`, async (t) => {
    const dir = directory(t);
    await ready(dir);
    if (point === "review") await withWorkflow(dir, (w) => w.advance());
    const worker = fileURLToPath(
      new URL("./commission-worker.js", import.meta.url),
    );
    const stopped = spawnSync(process.execPath, [worker, dir, point], {
      encoding: "utf8",
    });
    assert.equal(stopped.status, 86, stopped.stderr);
    const cli = fileURLToPath(new URL("../src/cli/main.js", import.meta.url));
    const output = JSON.parse(
      execFileSync(
        process.execPath,
        [cli, "commission", "resume", dir, "--json"],
        { encoding: "utf8" },
      ),
    ) as { commission: { status: string } };
    assert.equal(
      output.commission.status,
      point === "review" ? "fulfilled" : "awaiting-review",
    );
    await withWorkflow(dir, (w, rt) => {
      assert.equal(w.inspect().commission.deliveries.length, 1);
      assert.equal(rt.service.state().modelResults.length, 1);
      assert.equal(Object.keys(rt.service.state().intentions).length, 1);
      assert.equal(Object.keys(rt.service.state().results).length, 1);
      assert.equal(rt.store.verify().valid, true);
      assert.deepEqual(replay(rt.store), rt.service.state());
    });
  });
}

test("documented CLI preserves multiline feedback and separates delivery from acceptance", (t) => {
  const dir = directory(t);
  const cli = fileURLToPath(new URL("../src/cli/main.js", import.meta.url));
  const run = (...args: string[]) =>
    JSON.parse(
      execFileSync(process.execPath, [cli, "commission", ...args, "--json"], {
        encoding: "utf8",
      }),
    ) as ReturnType<CommissionWorkflow["inspect"]>;
  assert.equal(run("init", dir).commission.status, "proposed");
  assert.equal(run("accept-terms", dir).commission.status, "ready");
  assert.equal(run("advance", dir).commission.status, "awaiting-review");
  assert.equal(run("resume", dir).commission.status, "awaiting-review");
  const feedbackPath = join(dir, "neighbor-feedback.md");
  writeFileSync(
    feedbackPath,
    "Accepted.\nThe unexplained 71% spike remains a risk.\n",
  );
  assert.equal(
    run("review", dir, "1", "accept", "--feedback-file", feedbackPath)
      .commission.status,
    "fulfilled",
  );
  const inspection = run("inspect", dir);
  const rt = openRuntime(dir);
  try {
    assert.equal(
      rt.artifacts.text(inspection.commission.reviews[0]!.feedbackRef),
      "Accepted.\nThe unexplained 71% spike remains a risk.\n",
    );
  } finally {
    rt.db.close();
  }
  const bad = spawnSync(
    process.execPath,
    [
      cli,
      "commission",
      "review",
      dir,
      "1",
      "accept",
      "--feedback-file",
      feedbackPath,
    ],
    { encoding: "utf8" },
  );
  assert.equal(bad.status, 1);
});
