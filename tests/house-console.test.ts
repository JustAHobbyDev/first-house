import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { HouseExperiment, type MemberFactory } from "../src/console/house.js";
import { FixtureMember } from "./house-fixture.js";

const settled = () => new Promise<void>((resolve) => setImmediate(resolve));

test("House members have separate processes and exact context; Regent controls turns; completed sessions resume", async () => {
  const directory = mkdtempSync(join(tmpdir(), "regent-house-test-"));
  const members: FixtureMember[] = [];
  const launches: {
    cwd: string;
    system: string;
    sessionId: string | undefined;
  }[] = [];
  const factory: MemberFactory = (cwd, system, sessionId) => {
    launches.push({ cwd, system, sessionId });
    const member = new FixtureMember();
    members.push(member);
    return member;
  };
  let house = new HouseExperiment(process.cwd(), directory, factory);
  try {
    house.start();
    assert.equal(new Set(launches.map((launch) => launch.cwd)).size, 3);
    assert.ok(
      launches.every((launch) =>
        launch.system.includes("human participant is Regent"),
      ),
    );
    assert.ok(members.every((member) => member.inputs.length === 0));
    assert.throws(() => house.submit("hello", ["Regent"]), /known House/);
    assert.equal(house.state.messages.length, 0);
    const text = "My exact words.\nWhat do you observe?";
    house.submit(text, ["Steward", "Witness", "Dreamer"]);
    assert.throws(() => house.submit("duplicate", ["Steward"]), /busy/);
    const db = new DatabaseSync(join(directory, "experiment.sqlite"), {
      readOnly: true,
    });
    const recorded = db
      .prepare("SELECT body FROM events ORDER BY sequence")
      .all()
      .map((row) => JSON.parse(String(row.body)));
    db.close();
    const inputs = recorded.filter((event) => event.kind === "input");
    assert.equal(inputs.length, 3);
    members.forEach((member, index) => {
      assert.equal(inputs[index].input, member.inputs[0]);
      const input = JSON.parse(member.inputs[0]!);
      assert.deepEqual(input.sources, [house.context]);
      assert.equal(input.correspondence.length, 1);
      assert.equal(input.correspondence[0].text, text);
      member.finish(`Reply ${index}`, `session-${index}`);
    });
    await settled();
    assert.equal(house.state.busy, false);
    assert.equal(house.state.messages.length, 4);
    assert.ok(
      members.every((member) => member.inputs.length === 1),
      "no autonomous follow-up",
    );
    house.submit("Steward, respond again", ["Steward"]);
    const followup = JSON.parse(members[0]!.inputs[1]!);
    assert.equal(followup.sources, undefined);
    assert.deepEqual(
      followup.correspondence.map((entry: { text: string }) => entry.text),
      ["Reply 0", "Reply 1", "Reply 2", "Steward, respond again"],
    );
    assert.equal(members[1]!.inputs.length, 1);
    members[0]!.finish("Second reply", "session-0");
    await settled();
    const expected = structuredClone(house.state.messages);
    house.close();
    house = new HouseExperiment(process.cwd(), directory, factory);
    assert.deepEqual(house.state.messages, expected);
    house.start();
    assert.deepEqual(
      launches.slice(3).map((launch) => launch.sessionId),
      ["session-0", "session-1", "session-2"],
    );
    assert.ok(
      members.slice(3).every((member) => member.inputs.length === 0),
      "resume does not resend inputs",
    );
  } finally {
    house.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("stopping an in-flight House response retains input and blocks uncertain replay", async () => {
  const directory = mkdtempSync(join(tmpdir(), "regent-house-stop-"));
  let house = new HouseExperiment(
    process.cwd(),
    directory,
    () => new FixtureMember(),
  );
  try {
    house.start();
    house.submit("Do not silently resend me", ["Witness"]);
    house.stop();
    await settled();
    assert.equal(house.state.busy, false);
    assert.throws(() => house.start(), /uncertain/);
    house.close();
    house = new HouseExperiment(
      process.cwd(),
      directory,
      () => new FixtureMember(),
    );
    assert.equal(house.state.messages[0]!.text, "Do not silently resend me");
    assert.throws(() => house.start(), /uncertain/);
  } finally {
    house.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
