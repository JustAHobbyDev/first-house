import assert from "node:assert/strict";
import { chmodSync, readdirSync, writeFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { openDatabase } from "../src/storage/database.js";
import { canonicalJson } from "../src/domain/json.js";
import { project, replay, saveProjection } from "../src/projections/state.js";
import { runtime } from "./helpers.js";

test("unrelated databases are rejected before migration or journal changes", (t) => {
  const rt = runtime(t, false);
  const path = join(rt.directory, "unrelated.db");
  const original = new DatabaseSync(path);
  original.exec(
    "CREATE TABLE unrelated(value TEXT); INSERT INTO unrelated VALUES ('preserve')",
  );
  original.close();
  assert.throws(() => openDatabase(path), /development metadata/);
  const check = new DatabaseSync(path);
  try {
    assert.equal(
      check.prepare("SELECT value FROM unrelated").get()?.value,
      "preserve",
    );
    assert.equal(
      check.prepare("PRAGMA journal_mode").get()?.journal_mode,
      "delete",
    );
    assert.equal(
      check
        .prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table'")
        .get()?.n,
      1,
    );
  } finally {
    check.close();
  }
});

test("canonical JSON sorts nested keys and rejects lossy data", () => {
  assert.equal(
    canonicalJson({ b: [2, { z: 1, a: 0 }], a: "x" }),
    canonicalJson({ a: "x", b: [2, { a: 0, z: 1 }] }),
  );
  for (const value of [
    undefined,
    NaN,
    Infinity,
    new Date(),
    { x: undefined },
    [undefined],
    Array(1),
  ])
    assert.throws(() => canonicalJson(value));
});
test("injected IDs and clocks produce identical complete event hashes", (t) => {
  const a = runtime(t);
  const b = runtime(t);
  assert.deepEqual(a.store.read(), b.store.read());
  assert.equal(a.store.verify().valid, true);
  assert.equal(a.db.prepare("PRAGMA journal_mode").get()?.journal_mode, "wal");
  assert.deepEqual(
    a.store.read(3, 5).map((e) => e.sequence),
    [3, 4, 5],
  );
  assert.equal(
    a.store.correlation("dev:correlation:bootstrap").length,
    a.store.read().length,
  );
  assert.equal(a.store.correlation("dev:correlation:absent").length, 0);
});
test("database rejects updates, deletes and noncontiguous inserts", (t) => {
  const rt = runtime(t);
  assert.throws(
    () => rt.db.exec("UPDATE events SET hash='changed' WHERE sequence=1"),
    /append-only/,
  );
  assert.throws(
    () => rt.db.exec("DELETE FROM events WHERE sequence=1"),
    /append-only/,
  );
  assert.throws(
    () =>
      rt.db
        .prepare(
          "INSERT INTO events VALUES (99,'dev:event:bad','dev:correlation:x','{}','x')",
        )
        .run(),
    /contiguous/,
  );
  assert.equal(rt.store.verify().valid, true);
});
test("tampering is detected and blocks further appends and replay", (t) => {
  const rt = runtime(t);
  rt.db.exec("DROP TRIGGER events_no_update");
  const modified = rt.store.read(2, 2)[0]!;
  modified.occurredAt = "2026-02-01T00:00:00.000Z";
  rt.db
    .prepare("UPDATE events SET json=? WHERE sequence=2")
    .run(canonicalJson(modified));
  assert.equal(rt.store.verify().valid, false);
  assert.throws(() => replay(rt.store), /Hash-chain/);
  assert.throws(
    () =>
      rt.service.record({
        type: "ActorRegistered",
        data: {
          id: "dev:actor:new",
          kind: "human",
          name: "Fixture",
          lifecycle: "unborn",
        },
      }),
    /invalid record/,
  );
});
test("retained checkpoint detects otherwise internally valid suffix deletion", (t) => {
  const rt = runtime(t);
  const head = rt.store.head()!;
  rt.db.exec("DROP TRIGGER events_no_delete");
  rt.db.prepare("DELETE FROM events WHERE sequence=?").run(head.sequence);
  assert.equal(rt.store.verify().valid, true);
  assert.equal(
    rt.store.verify({ sequence: head.sequence, hash: head.hash }).valid,
    false,
  );
});
test("failed transactional append leaves stream unchanged", (t) => {
  const rt = runtime(t);
  const head = rt.store.head()!;
  assert.throws(
    () =>
      rt.store.append(
        {
          type: "ActorRegistered",
          data: {
            id: "dev:actor:new",
            kind: "human",
            name: "New",
            lifecycle: "unborn",
          },
        },
        {
          id: head.id,
          occurredAt: head.occurredAt,
          actorId: null,
          subjectId: null,
          causedBy: null,
          correlationId: head.correlationId,
          canonVersion: head.canonVersion,
          recordedBy: "runtime",
        },
      ),
    /UNIQUE/,
  );
  assert.deepEqual(rt.store.head(), head);
  const next = rt.service.record({
    type: "ActorRegistered",
    data: {
      id: "dev:actor:next",
      kind: "human",
      name: "Next",
      lifecycle: "unborn",
    },
  });
  assert.equal(next.sequence, head.sequence + 1);
});
test("artifact bodies deduplicate and reads reject corruption without overwriting", (t) => {
  const { artifacts } = runtime(t, false);
  const ref = artifacts.put("same bytes");
  assert.equal(artifacts.put(Buffer.from("same bytes")), ref);
  assert.equal(readdirSync(artifacts.root).length, 1);
  assert.equal(artifacts.text(ref), "same bytes");
  chmodSync(artifacts.path(ref), 0o644);
  writeFileSync(artifacts.path(ref), "corrupted bytes");
  assert.equal(artifacts.verify(ref), false);
  assert.throws(() => artifacts.get(ref), /integrity/);
  assert.throws(() => artifacts.put("same bytes"), /integrity/);
  assert.throws(() => artifacts.get("../../etc/passwd"), /reference/);
});
test("events cannot commit missing artifact references", (t) => {
  const rt = runtime(t);
  const count = rt.store.read().length;
  assert.throws(() =>
    rt.service.record({
      type: "EvidenceReceived",
      data: {
        id: "dev:evidence:missing",
        fromActorId: "dev:actor:neighbor",
        bodyRef: "sha256:" + "0".repeat(64),
        trust: "untrusted",
      },
    }),
  );
  assert.equal(rt.store.read().length, count);
});
test("destroying projections and replaying reconstructs identical state", (t) => {
  const rt = runtime(t);
  const expected = project(rt.store.read());
  saveProjection(rt.db, expected);
  rt.db.exec("DELETE FROM projections");
  assert.deepEqual(replay(rt.store), expected);
  assert.equal(
    rt.db.prepare("SELECT json FROM projections WHERE name='state'").get()
      ?.json,
    canonicalJson(expected),
  );
  assert.equal(rt.store.read().length, expected.cursor);
});
