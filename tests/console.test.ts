import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { loadHistory, digest } from "../src/console/history.js";
import { ConsoleSession } from "../src/console/session.js";
import { startConsole, tailnetAccess } from "../src/console/server.js";
import { consoleRecords, FixtureRpc } from "./console-fixture.js";

function setup() {
  const directory = mkdtempSync(join(tmpdir(), "regent-test-"));
  const rpc = new FixtureRpc();
  const session = new ConsoleSession(
    consoleRecords,
    process.cwd(),
    directory,
    () => rpc,
  );
  return {
    directory,
    rpc,
    session,
    cleanup: () => {
      session.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

test("tailnet access trusts only the configured identity and origin through the loopback proxy", async () => {
  const f = setup();
  const origin = "http://console.example.ts.net:4311";
  const app = await startConsole(f.session, {
    port: 0,
    token: "test-token",
    tailnet: { origin, login: "regent@example.com" },
  });
  const { request } = await import("node:http");
  const call = (headers: Record<string, string>) =>
    new Promise<number>((resolve, reject) => {
      const req = request(
        app.origin + "/api/history",
        { headers },
        (response) => {
          response.resume();
          resolve(response.statusCode!);
        },
      );
      req.on("error", reject);
      req.end();
    });
  const identity = {
    Host: new URL(origin).host,
    "Tailscale-User-Login": "regent@example.com",
  };
  try {
    assert.equal(await call(identity), 200);
    assert.equal(await call({ ...identity, Origin: origin }), 200);
    assert.equal(await call({ Host: identity.Host }), 403);
    assert.equal(
      await call({
        ...identity,
        "Tailscale-User-Login": "someone-else@example.com",
      }),
      403,
    );
    assert.equal(
      await call({ ...identity, Origin: "https://attacker.invalid" }),
      403,
    );
    assert.equal(
      await call({ ...identity, "Sec-Fetch-Site": "cross-site" }),
      403,
    );
    assert.equal(
      await call({ "Tailscale-User-Login": identity["Tailscale-User-Login"] }),
      401,
    );
    assert.equal(await call({ Authorization: "Bearer test-token" }), 200);
    assert.throws(
      () => tailnetAccess({ origin: "http://0.0.0.0:4311", login: "regent" }),
      /origin/,
    );
    assert.throws(() => tailnetAccess({ origin, login: "" }), /login/);
    assert.equal(f.rpc.calls.length, 0);
  } finally {
    await app.close();
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("history imports pinned originals, preserves bytes, and rejects corruption and symlink escape", () => {
  const root = mkdtempSync(join(tmpdir(), "regent-import-"));
  try {
    mkdirSync(join(root, "archive"));
    const source = Buffer.from("# Original\r\n\nπ <script>bad()</script>\n");
    writeFileSync(join(root, "archive", "original.md"), source);
    writeFileSync(
      join(root, "archive", "archive-manifest.json"),
      JSON.stringify({
        artifacts: [{ path: "original.md", sha256: digest(source) }],
      }),
    );
    writeFileSync(
      join(root, "reader.json"),
      JSON.stringify({ participants: [], scenes: [] }),
    );
    const specs = [
      { id: "dev:fixture", directory: "archive", reader: "reader.json" },
    ];
    assert.equal(loadHistory(root, specs)[0]?.text, source.toString());
    assert.deepEqual(
      readFileSync(join(root, "archive", "original.md")),
      source,
    );
    writeFileSync(join(root, "archive", "original.md"), "changed");
    assert.throws(() => loadHistory(root, specs), /hash mismatch/);
    rmSync(join(root, "archive", "original.md"));
    writeFileSync(join(root, "outside.md"), source);
    symlinkSync(join(root, "outside.md"), join(root, "archive", "original.md"));
    assert.throws(() => loadHistory(root, specs), /escapes root/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("navigation has no model effect; submissions pin original input before invocation; tools stay bounded", async () => {
  const f = setup();
  try {
    const first = consoleRecords[0]!,
      second = consoleRecords[1]!;
    f.session.select(second.id);
    assert.equal(f.rpc.calls.length, 0);
    await f.session.connect();
    const config = f.rpc.calls.find(
      (call) => call.method === "thread/start",
    )!.params;
    assert.equal(config.sandbox, "read-only");
    assert.deepEqual(config.config, {
      web_search: "disabled",
      mcp_servers: { "inherited-tool": { enabled: false } },
    });
    await f.session.submit("  My exact words.\n", first.id);
    f.session.select(second.id);
    const db = new DatabaseSync(join(f.directory, "operator.sqlite"), {
      readOnly: true,
    });
    const recorded = JSON.parse(
      String(db.prepare("SELECT body FROM submissions").get()!.body),
    );
    db.close();
    assert.deepEqual(recorded.input, f.rpc.sentInput().input);
    assert.equal(recorded.input[0].text, "  My exact words.\n");
    assert.ok(recorded.input[1].text.includes(first.sha256));
    await assert.rejects(
      f.session.submit("duplicate", first.id),
      /already running/,
    );
    assert.equal(
      f.rpc.calls.filter((call) => call.method === "turn/start").length,
      1,
    );
    const result = await f.rpc.navigate(first.id);
    assert.equal(result.success, true);
    assert.equal(f.session.state.selection, first.id);
    assert.equal((await f.rpc.navigate("../../secret")).success, false);
    await assert.rejects(
      f.rpc.onRequest("item/commandExecution/requestApproval", {
        threadId: "console-test-thread",
      }),
      /Unsupported/,
    );
    await assert.rejects(
      f.rpc.onRequest("item/tool/call", {
        threadId: "foreign",
        tool: "house_history",
      }),
      /Unexpected thread/,
    );
    f.rpc.delta("Hello ");
    f.rpc.delta("Regent");
    assert.equal(
      f.session.state.messages.find((message) => message.role === "Codex")
        ?.text,
      "Hello Regent",
    );
    await f.session.interrupt();
    assert.equal(f.session.state.busy, false);
    assert.match(f.session.state.status, /interrupted/);
  } finally {
    f.cleanup();
  }
});

test("a single console owns its store; restart resumes only its own thread and reconciles responses", async () => {
  const f = setup();
  try {
    assert.throws(
      () => new ConsoleSession(consoleRecords, process.cwd(), f.directory),
      /Another console/,
    );
    await f.session.connect();
    await f.session.submit("Hello", consoleRecords[0]!.id);
    f.rpc.delta("Partial");
    f.session.close();
    f.rpc.turns = [
      {
        id: "turn-1",
        status: "completed",
        items: [
          {
            id: "assistant-1",
            type: "agentMessage",
            text: "Complete stored answer",
          },
        ],
      },
    ];
    const resumed = new ConsoleSession(
      consoleRecords,
      process.cwd(),
      f.directory,
      () => f.rpc,
    );
    try {
      assert.equal(resumed.state.connected, false);
      assert.equal(resumed.state.messages[0]?.text, "Hello");
      await resumed.connect();
      assert.equal(f.rpc.calls.at(-1)?.method, "thread/resume");
      assert.equal(
        resumed.state.messages.filter((message) => message.role === "Codex")
          .length,
        1,
      );
      assert.equal(
        resumed.state.messages.at(-1)?.text,
        "Complete stored answer",
      );
      assert.equal(resumed.state.busy, false);
      assert.equal(
        f.rpc.calls.filter((call) => call.method === "turn/start").length,
        1,
      );
    } finally {
      resumed.close();
    }
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("uncertain sends are retained and disconnected without automatic retry", async () => {
  const f = setup();
  try {
    await f.session.connect();
    f.rpc.failSend = true;
    await assert.rejects(
      f.session.submit("Do not lose me", consoleRecords[0]!.id),
      /Lost response/,
    );
    assert.equal(f.session.state.connected, false);
    assert.equal(f.session.state.messages[0]?.text, "Do not lose me");
    assert.match(f.session.state.status, /uncertain/);
    assert.equal(
      f.rpc.calls.filter((call) => call.method === "turn/start").length,
      1,
    );
  } finally {
    f.cleanup();
  }
});

test("HTTP access rejects missing auth, cross-origin access, rebinding, arbitrary actions, and oversized input", async () => {
  const f = setup();
  const app = await startConsole(f.session, { port: 0, token: "test-token" });
  const headers = {
    Authorization: "Bearer test-token",
    "Content-Type": "application/json",
  };
  try {
    assert.equal((await fetch(app.origin + "/api/history")).status, 401);
    assert.equal(
      (
        await fetch(app.origin + "/api/history", {
          headers: { ...headers, Origin: "https://attacker.invalid" },
        })
      ).status,
      403,
    );
    // Undici strips an overridden Host; a raw HTTP request exercises rebinding below.
    const { request } = await import("node:http");
    const rebound = await new Promise<number>((resolve) => {
      request(
        app.origin + "/api/history",
        { headers: { ...headers, Host: "attacker.invalid" } },
        (response) => {
          response.resume();
          resolve(response.statusCode!);
        },
      ).end();
    });
    assert.equal(rebound, 403);
    assert.equal(
      (await fetch(app.origin + "/api/history", { headers })).status,
      200,
    );
    assert.equal(
      (
        await fetch(app.origin + "/api/command", {
          method: "POST",
          headers,
          body: "{}",
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await fetch(app.origin + "/api/select", {
          method: "POST",
          headers,
          body: JSON.stringify({ recordId: "../../secret" }),
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await fetch(app.origin + "/api/message", {
          method: "POST",
          headers,
          body: JSON.stringify({ text: "a".repeat(150_000) }),
        })
      ).status,
      400,
    );
    const abort = new AbortController();
    const events = await fetch(app.origin + "/api/events", {
      headers,
      signal: abort.signal,
    });
    const reader = events.body!.getReader();
    assert.match(
      new TextDecoder().decode((await reader.read()).value),
      /data:/,
    );
    f.session.select(consoleRecords[1]!.id);
    assert.match(
      new TextDecoder().decode((await reader.read()).value),
      /second.md/,
    );
    f.session.state.messages.push({
      id: "large",
      role: "Codex",
      text: "x".repeat(200_000),
    });
    f.session.select(consoleRecords[0]!.id);
    let largeFrame = "";
    while (!largeFrame.includes("\n\n"))
      largeFrame += new TextDecoder().decode((await reader.read()).value);
    assert.equal(
      JSON.parse(largeFrame.slice(6)).messages[0].text.length,
      200_000,
    );
    f.session.select(consoleRecords[1]!.id);
    let nextFrame = "";
    while (!nextFrame.includes("\n\n"))
      nextFrame += new TextDecoder().decode((await reader.read()).value);
    assert.equal(
      JSON.parse(nextFrame.slice(6)).selection,
      consoleRecords[1]!.id,
    );
    abort.abort();
    assert.equal(f.rpc.calls.length, 0);
  } finally {
    await app.close();
    rmSync(f.directory, { recursive: true, force: true });
  }
});
