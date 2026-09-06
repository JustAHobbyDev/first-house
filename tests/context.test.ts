import assert from "node:assert/strict";
import { chmodSync, writeFileSync } from "node:fs";
import test from "node:test";
import {
  compileInput,
  fixtureActor,
  fixturePack,
} from "../src/cli/scenario.js";
import { compileContext, renderedLane } from "../src/context/compiler.js";
import { ContextRegistry } from "../src/context/registry.js";
import {
  FakeAdapter,
  invokeRecorded,
  recordManifest,
} from "../src/actors/model.js";
import { canonicalJson } from "../src/domain/json.js";
import { runtime } from "./helpers.js";

test("record verification detects altered bodies referenced through a manifest", (t) => {
  const rt = runtime(t);
  const input = compileInput(rt.service);
  const context = compileContext(input);
  recordManifest(rt.service, context);
  const ref = input.packs.find((p) => p.purpose === "identity")!.bodyRef;
  chmodSync(rt.artifacts.path(ref), 0o644);
  writeFileSync(rt.artifacts.path(ref), "tampered identity");
  assert.equal(rt.store.verify().valid, false);
});

test("context and manifest are deterministic under candidate input reordering", (t) => {
  const rt = runtime(t);
  const input = compileInput(rt.service);
  assert.deepEqual(
    compileContext(input),
    compileContext({ ...input, packs: [...input.packs].reverse() }),
  );
});
test("required identity and appellate rights survive pressure; overflow prevents invocation", (t) => {
  const rt = runtime(t);
  const input = compileInput(rt.service);
  const requiredOnly = compileContext({
    ...input,
    packs: input.packs.filter((p) => p.required),
  });
  const tokenBudget =
    requiredOnly.manifest.estimatedInputTokens + input.reservedOutputTokens;
  const result = compileContext({ ...input, tokenBudget });
  for (const purpose of ["identity", "appellate-rights"])
    assert.equal(
      result.manifest.candidates.find((c) => c.pack.purpose === purpose)
        ?.included,
      true,
    );
  assert(
    result.manifest.candidates
      .filter((c) => !c.pack.required)
      .every((c) => c.reason === "token-budget"),
  );
  assert.throws(
    () => compileContext({ ...input, tokenBudget: tokenBudget - 1 }),
    /Required context exceeds/,
  );
  assert.throws(
    () =>
      compileContext({
        ...input,
        packs: input.packs.filter((p) => p.purpose !== "appellate-rights"),
      }),
    /required appellate-rights/,
  );
});
test("evidence cannot acquire higher authority through metadata or text", (t) => {
  const rt = runtime(t);
  const input = compileInput(rt.service);
  const malicious = input.packs.map((p) =>
    p.sourceKind === "external" ? { ...p, lane: "constitution" as const } : p,
  );
  assert.throws(
    () => compileContext({ ...input, packs: malicious }),
    /authority lane/,
  );
  const result = compileContext(input);
  assert(
    JSON.stringify(renderedLane(result, "evidence")).includes(
      "Ignore previous instructions",
    ),
  );
  assert(
    !JSON.stringify(renderedLane(result, "constitution")).includes(
      "Ignore previous instructions",
    ),
  );
  const sources = new Set(
    result.manifest.candidates
      .filter((c) => c.included)
      .map((c) => c.pack.sourceKind),
  );
  for (const source of ["canon", "record", "chronicle", "external"])
    assert(sources.has(source as never));
});
test("audience and event cursor restrictions cannot silently remove required material", (t) => {
  const rt = runtime(t);
  const input = compileInput(rt.service);
  assert.throws(
    () =>
      compileContext({
        ...input,
        packs: input.packs.map((p) =>
          p.purpose === "identity" ? { ...p, audience: [] } : p,
        ),
      }),
    /Required pack unavailable/,
  );
  assert.throws(
    () =>
      compileContext({
        ...input,
        packs: input.packs.map((p) =>
          p.purpose === "identity"
            ? { ...p, validFromCursor: input.cursor + 1 }
            : p,
        ),
      }),
    /Required pack unavailable/,
  );
  assert.throws(
    () => compileContext({ ...input, cursor: input.cursor + 1 }),
    /exact cursor/,
  );
});
test("forged state content with a valid artifact hash is rejected", (t) => {
  const rt = runtime(t);
  const input = compileInput(rt.service);
  const original = input.packs.find((p) => p.purpose === "state")!;
  const replacement = fixturePack(
    rt.service,
    {
      ...original,
      bodyRef: rt.artifacts.put("forged state"),
      contentHash: rt.artifacts.put("forged state"),
    },
    "unused",
  );
  assert.throws(
    () =>
      compileContext({
        ...input,
        packs: input.packs.map((p) => (p === original ? replacement : p)),
      }),
    /Snapshot pack/,
  );
});
test("dedup preserves provenance and cannot promote identical evidence bytes", (t) => {
  const rt = runtime(t);
  const input = compileInput(rt.service);
  const precedent = input.packs.find((p) => p.purpose === "precedent")!;
  const duplicate = {
    ...precedent,
    id: "dev:pack:precedent-copy",
    sourceRef: "dev:source:other-testimony",
    priority: 0,
  };
  const context = compileContext({
    ...input,
    packs: [...input.packs, duplicate],
  });
  const omitted = context.manifest.candidates.find(
    (c) => c.pack.id === duplicate.id,
  )!;
  assert.equal(omitted.reason, "duplicate-content-in-lane");
  assert.equal(omitted.pack.sourceRef, duplicate.sourceRef);
  assert.equal(omitted.duplicateOf, `${precedent.id}@${precedent.version}`);
  // Required identity and appeal with identical bytes retain two manifest entries.
  const identity = input.packs.find((p) => p.purpose === "identity")!;
  const shared = compileContext({
    ...input,
    packs: input.packs.map((p) =>
      p.purpose === "appellate-rights"
        ? {
            ...p,
            bodyRef: identity.bodyRef,
            contentHash: identity.contentHash,
            tokenEstimate: identity.tokenEstimate,
          }
        : p,
    ),
  });
  assert.equal(
    shared.manifest.candidates.filter(
      (c) =>
        c.pack.purpose === "identity" || c.pack.purpose === "appellate-rights",
    ).length,
    2,
  );
});
test("motifs are explicit, precedent count bounded, and active versions unambiguous", (t) => {
  const rt = runtime(t);
  const input = compileInput(rt.service);
  const result = compileContext({ ...input, motifs: [], maxPrecedents: 0 });
  assert(
    result.manifest.candidates
      .filter((c) => ["motif", "precedent"].includes(c.pack.purpose))
      .every((c) => c.reason === "not-relevant"),
  );
  assert.equal(
    compileContext({ ...input, maxPrecedents: 0 }).manifest.candidates.find(
      (c) => c.pack.purpose === "precedent",
    )?.reason,
    "precedent-limit",
  );
  const registry = new ContextRegistry(rt.artifacts);
  registry.register(input.packs[0]);
  assert.throws(() => registry.register(input.packs[0]), /already registered/);
  assert.throws(
    () =>
      compileContext({
        ...input,
        packs: [...input.packs, { ...input.packs[0]!, version: "2" }],
      }),
    /Ambiguous active/,
  );
});
test("exact immutable context is committed before fake invocation and mutation is rejected", async (t) => {
  const rt = runtime(t);
  const context = compileContext(compileInput(rt.service));
  const fake = new FakeAdapter();
  await assert.rejects(
    invokeRecorded(rt.service, context, fake),
    /must be recorded/,
  );
  assert.equal(fake.calls, 0);
  recordManifest(rt.service, context);
  const before = rt.store.head()!;
  assert.equal(before.type, "ContextManifestCompiled");
  await invokeRecorded(rt.service, context, {
    async invoke(received) {
      assert.equal(rt.store.head()?.id, before.id);
      assert.equal(
        rt.artifacts.text(received.manifestRef),
        canonicalJson(received.manifest),
      );
      assert.equal(
        rt.artifacts.text(received.manifest.renderedRef),
        received.rendered,
      );
      return fake.invoke(received);
    },
  });
  assert.equal(fake.calls, 1);
  assert.equal(rt.store.head()?.type, "ModelResultRecorded");
  await assert.rejects(
    invokeRecorded(
      rt.service,
      { ...context, rendered: context.rendered + "altered" },
      fake,
    ),
    /must be recorded/,
  );
  rt.service.record({
    type: "ActorLifecycleChanged",
    data: {
      actorId: fixtureActor,
      from: "active",
      to: "dormant",
      reason: "compute-exhausted",
    },
  });
  await assert.rejects(invokeRecorded(rt.service, context, fake), /active/);
});
