import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import test from "node:test";
import { compileInput, fixtureActor, runDemo } from "../src/cli/scenario.js";
import { compileContext } from "../src/context/compiler.js";
import { recordManifest } from "../src/actors/model.js";
import { DevelopmentBroker } from "../src/capabilities/broker.js";
import { digest } from "../src/domain/json.js";
import { replay } from "../src/projections/state.js";
import { runtime } from "./helpers.js";

function propose(rt: ReturnType<typeof runtime>) {
  const context = compileContext(compileInput(rt.service));
  recordManifest(rt.service, context);
  const body = "Disposable generated artifact for recovery test.";
  const intention = {
    id: "dev:intention:test",
    actorId: fixtureActor,
    capability: "artifact.write",
    body,
    expectedRef: digest(body),
    contextManifestRef: context.manifestRef,
  };
  rt.service.record(
    { type: "IntentionProposed", data: intention },
    { actorId: fixtureActor, recordedBy: "runtime" },
  );
  return intention;
}
test("unrecorded intentions cannot execute; recorded policy precedes effect", (t) => {
  const rt = runtime(t);
  const broker = new DevelopmentBroker(rt.service);
  assert.throws(
    () => broker.execute("dev:intention:unknown"),
    /recorded intention/,
  );
  const intention = propose(rt);
  const original = rt.artifacts.put.bind(rt.artifacts);
  rt.artifacts.put = (bytes) => {
    assert.equal(rt.store.head()?.type, "CapabilityPolicyEvaluated");
    assert(rt.service.state().intentions[intention.id]);
    return original(bytes);
  };
  assert.equal(broker.execute(intention.id).outcome, "succeeded");
  const count = rt.store.read().length;
  assert.equal(broker.execute(intention.id).outcome, "succeeded");
  assert.equal(rt.store.read().length, count);
});
test("interrupted artifact effect is recoverable and replay does not repeat it", (t) => {
  const rt = runtime(t);
  const intention = propose(rt);
  const broker = new DevelopmentBroker(rt.service, () => {
    throw new Error("simulated process interruption");
  });
  assert.throws(() => broker.execute(intention.id), /interruption/);
  assert.equal(rt.artifacts.verify(intention.expectedRef), true);
  assert.equal(rt.service.state().results[intention.id], undefined);
  const filesBefore = readdirSync(rt.artifacts.root);
  replay(rt.store);
  assert.deepEqual(readdirSync(rt.artifacts.root), filesBefore);
  const recovery = new DevelopmentBroker(rt.service).execute(intention.id);
  assert.equal(recovery.outcome, "succeeded");
  assert.match(recovery.detail, /Reconciled/);
  assert.equal(rt.store.verify().valid, true);
});
test("current lifecycle and expired tenure override historical context permission", (t) => {
  const rt = runtime(t);
  const intention = propose(rt);
  rt.service.record({
    type: "ActorLifecycleChanged",
    data: {
      actorId: fixtureActor,
      from: "active",
      to: "dormant",
      reason: "compute-exhausted",
    },
  });
  assert.equal(
    new DevelopmentBroker(rt.service).execute(intention.id).outcome,
    "denied",
  );
  assert.equal(rt.artifacts.has(intention.expectedRef), false);
  const expired = runtime(t);
  const second = propose(expired);
  expired.deps.clock = () => "2028-01-01T00:00:00.000Z";
  assert.equal(
    new DevelopmentBroker(expired.service).execute(second.id).outcome,
    "denied",
  );
  assert.equal(expired.artifacts.has(second.expectedRef), false);
});
test("effect write failure is recorded with no claimed output", (t) => {
  const rt = runtime(t);
  const intention = propose(rt);
  rt.artifacts.put = () => {
    throw new Error("simulated disk full");
  };
  const result = new DevelopmentBroker(rt.service).execute(intention.id);
  assert.equal(result.outcome, "failed");
  assert.equal(result.artifactRef, null);
  assert.match(result.detail, /disk full/);
});
test("offline demonstration verifies and replays a fresh disposable scenario", async (t) => {
  const rt = runtime(t, false);
  const result = await runDemo(rt.directory);
  assert.equal(result.mode, "development-unborn");
  assert.equal(result.chainValid, true);
  assert.equal(result.replayIdentical, true);
  assert.equal(result.fakeInvocations, 1);
  assert.equal(result.capabilityOutcome, "succeeded");
});
