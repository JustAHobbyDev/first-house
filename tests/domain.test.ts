import assert from "node:assert/strict";
import test from "node:test";
import { fixtureActor, fixtureNeighbor } from "../src/cli/scenario.js";
import { financialKinds } from "../src/domain/types.js";
import { parseCommand } from "../src/domain/commands.js";
import { replay } from "../src/projections/state.js";
import { runtime } from "./helpers.js";

test("a commission can have only a request, without an attached research corpus", (t) => {
  const rt = runtime(t);
  const bodyRef = rt.artifacts.put("Please write a brief welcome verse.");
  rt.service.record(
    {
      type: "EvidenceReceived",
      data: {
        id: "dev:evidence:verse-request",
        fromActorId: fixtureNeighbor,
        bodyRef,
        trust: "untrusted",
      },
    },
    { actorId: fixtureNeighbor },
  );
  rt.service.record({
    type: "CommitmentProposed",
    data: {
      id: "dev:commitment:verse",
      fromActorId: fixtureActor,
      toActorId: fixtureNeighbor,
      approach: "commission",
      description: "Write a brief welcome verse for the requester to review.",
    },
  });
  const data = {
    id: "dev:commission:verse",
    commitmentId: "dev:commitment:verse",
    requestEvidenceId: "dev:evidence:verse-request",
    evidenceIds: [] as string[],
    termsRef: rt.artifacts.put(
      "Deliver an ordinary text artifact for Neighbor review.",
    ),
  };
  assert.throws(
    () =>
      rt.service.record(
        {
          type: "CommissionOpened",
          data: { ...data, evidenceIds: ["dev:evidence:missing"] },
        },
        { actorId: fixtureActor },
      ),
    /missing or duplicated/,
  );
  assert.throws(
    () =>
      rt.service.record(
        {
          type: "CommissionOpened",
          data: {
            ...data,
            evidenceIds: [data.requestEvidenceId, data.requestEvidenceId],
          },
        },
        { actorId: fixtureActor },
      ),
    /missing or duplicated/,
  );
  rt.service.record(
    { type: "CommissionOpened", data },
    { actorId: fixtureActor },
  );
  rt.service.record(
    { type: "CommitmentAccepted", data: { commitmentId: data.commitmentId } },
    { actorId: fixtureActor },
  );
  const commission = replay(rt.store).commissions[data.id]!;
  assert.equal(commission.status, "ready");
  assert.deepEqual(commission.evidenceIds, []);
  assert.equal(commission.requestEvidenceId, data.requestEvidenceId);
});

test("actor kinds exclude Neighbor and offices; all fixture identities require dev:", (t) => {
  const rt = runtime(t);
  for (const kind of ["neighbor", "Steward", "Dreamer", "Witness"])
    assert.throws(() =>
      parseCommand({
        type: "ActorRegistered",
        data: {
          id: "dev:actor:invalid",
          kind,
          name: "Invalid",
          lifecycle: "active",
        },
      }),
    );
  for (const id of ["actor:canonical", "first-house", "dev:", "__proto__"])
    assert.throws(
      () =>
        parseCommand({
          type: "ActorRegistered",
          data: {
            id,
            kind: "artificial",
            name: "Invalid",
            lifecycle: "active",
          },
        }),
      /namespace/,
    );
  assert.equal(rt.service.state().neighbors[0]?.actorId, fixtureNeighbor);
  assert.equal(rt.service.state().actors[fixtureNeighbor]?.kind, "human");
  assert.throws(
    () =>
      rt.service.record({
        type: "OfficeAssigned",
        data: {
          actorId: fixtureActor,
          officeId: "office:canonical",
          startsAt: "2026-01-01T00:00:00.000Z",
          endsAt: "2027-01-01T00:00:00.000Z",
        },
      }),
    /namespace/,
  );
  assert.throws(
    () =>
      rt.service.record({
        type: "ActorRegistered",
        data: {
          id: "dev:actor:extra",
          kind: "human",
          name: "Invalid",
          lifecycle: "active",
          morality_score: 1,
        },
      }),
    /exactly/,
  );
});
test("compute exhaustion only permits active to dormant; death is not a state", (t) => {
  const rt = runtime(t);
  assert.throws(() =>
    rt.service.record({
      type: "ActorLifecycleChanged",
      data: {
        actorId: fixtureActor,
        from: "active",
        to: "dead",
        reason: "compute-exhausted",
      },
    }),
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
  assert.equal(rt.service.state().actors[fixtureActor]?.lifecycle, "dormant");
  assert.throws(
    () =>
      rt.service.record({
        type: "ActorLifecycleChanged",
        data: {
          actorId: fixtureActor,
          from: "dormant",
          to: "unborn",
          reason: "development",
        },
      }),
    /transition/,
  );
  rt.service.record({
    type: "ActorLifecycleChanged",
    data: {
      actorId: fixtureActor,
      from: "dormant",
      to: "active",
      reason: "provision-restored",
    },
  });
  assert.equal(replay(rt.store).actors[fixtureActor]?.lifecycle, "active");
});
test("financial purposes remain distinct and cannot be exchanged into compute", (t) => {
  const rt = runtime(t);
  for (const kind of financialKinds)
    rt.service.record({
      type: "TransferRecorded",
      data: {
        id: `dev:transfer:${kind}`,
        fromActorId: fixtureNeighbor,
        toActorId: fixtureActor,
        ledger: "financial",
        kind,
        amountMinor: 100,
        currency: "USD",
        restriction:
          kind === "restricted-offering"
            ? "Fixture research supplies only"
            : null,
      },
    });
  rt.service.record({
    type: "TransferRecorded",
    data: {
      id: "dev:transfer:compute",
      fromActorId: "dev:actor:regent",
      toActorId: fixtureActor,
      ledger: "compute",
      kind: "compute-provision",
      units: 2000,
      unit: "tokens",
    },
  });
  const state = replay(rt.store);
  assert.deepEqual(
    Object.values(state.financialTransfers).map((x) => x.kind),
    [...financialKinds],
  );
  assert.equal(Object.keys(state.computeProvisions).length, 1);
  assert.equal(Object.keys(state.commitments).length, 0);
  assert.throws(
    () =>
      rt.service.record({
        type: "TransferRecorded",
        data: {
          id: "dev:transfer:bad",
          fromActorId: fixtureNeighbor,
          toActorId: fixtureActor,
          ledger: "compute",
          kind: "compute-provision",
          amountMinor: 1,
          currency: "USD",
          units: 10,
          unit: "tokens",
        },
      }),
    /exactly/,
  );
  assert.throws(
    () =>
      rt.service.record({
        type: "TransferRecorded",
        data: {
          id: "dev:transfer:restricted",
          fromActorId: fixtureNeighbor,
          toActorId: fixtureActor,
          ledger: "financial",
          kind: "restricted-offering",
          amountMinor: 1,
          currency: "USD",
          restriction: null,
        },
      }),
    /restriction/,
  );
});
test("petitions and commissions require explicit acceptance by the obligated actor", (t) => {
  const rt = runtime(t);
  for (const [index, terminal] of [
    "CommitmentFulfilled",
    "CommitmentBreached",
    "CommitmentReleased",
  ].entries()) {
    const id = `dev:commitment:${index}`;
    rt.service.record({
      type: "CommitmentProposed",
      data: {
        id,
        fromActorId: fixtureActor,
        toActorId: fixtureNeighbor,
        description: "Disposable work",
        approach: index === 0 ? "petition" : "commission",
      },
    });
    assert.throws(
      () => rt.service.record({ type: terminal, data: { commitmentId: id } }),
      /transition/,
    );
    assert.throws(
      () =>
        rt.service.record(
          { type: "CommitmentAccepted", data: { commitmentId: id } },
          { actorId: fixtureNeighbor },
        ),
      /obligated actor/,
    );
    rt.service.record(
      { type: "CommitmentAccepted", data: { commitmentId: id } },
      { actorId: fixtureActor },
    );
    rt.service.record({ type: terminal, data: { commitmentId: id } });
    assert.throws(
      () =>
        rt.service.record(
          { type: "CommitmentAccepted", data: { commitmentId: id } },
          { actorId: fixtureActor },
        ),
      /transition/,
    );
  }
  assert.deepEqual(
    Object.values(replay(rt.store).commitments).map((c) => c.status),
    ["fulfilled", "breached", "released"],
  );
});
test("testimony and authorized fixture judgments preserve original observed records", (t) => {
  const rt = runtime(t);
  const original = rt.store.head()!;
  const bodyRef = rt.artifacts.put(
    "Disposable interpretation, not a replacement for the record.",
  );
  rt.service.record(
    {
      type: "TestimonySubmitted",
      data: {
        id: "dev:testimony:one",
        authorId: fixtureActor,
        eventId: original.id,
        bodyRef,
        source: "chronicle",
      },
    },
    { actorId: fixtureActor },
  );
  const judgment = {
    type: "JudgmentRecorded",
    data: {
      id: "dev:judgment:one",
      judgeActorId: "dev:actor:regent",
      officeId: "dev:office:reviewer",
      eventId: original.id,
      bodyRef,
    },
  };
  assert.throws(
    () =>
      rt.service.record(judgment, {
        actorId: "dev:actor:regent",
        recordedBy: "seat",
      }),
    /authority/,
  );
  rt.service.record({
    type: "OfficeDefined",
    data: {
      id: "dev:office:reviewer",
      name: "Disposable review office",
      capabilities: ["judgment.record"],
    },
  });
  rt.service.record({
    type: "OfficeAssigned",
    data: {
      actorId: "dev:actor:regent",
      officeId: "dev:office:reviewer",
      startsAt: "2025-01-01T00:00:00.000Z",
      endsAt: "2027-01-01T00:00:00.000Z",
    },
  });
  rt.service.record(judgment, {
    actorId: "dev:actor:regent",
    recordedBy: "regent",
  });
  assert.deepEqual(
    rt.store.read(original.sequence, original.sequence)[0],
    original,
  );
  const state = replay(rt.store);
  assert.equal(Object.keys(state.testimony).length, 1);
  assert.equal(Object.keys(state.judgments).length, 1);
});
