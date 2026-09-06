import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  existsSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ConsoleSession } from "../dist/src/console/session.js";
import { startConsole } from "../dist/src/console/server.js";
import { consoleRecords, FixtureRpc } from "../dist/tests/console-fixture.js";

const chrome =
  process.env.REGENT_TEST_CHROME ||
  "/var/home/d/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell";
if (!existsSync(chrome))
  throw new Error(
    "Set REGENT_TEST_CHROME to an installed Chromium executable.",
  );
const directory = mkdtempSync(join(tmpdir(), "regent-browser-"));
const rpc = new FixtureRpc();
const session = new ConsoleSession(
  consoleRecords,
  process.cwd(),
  join(directory, "state"),
  () => rpc,
);
const app = await startConsole(session, {
  port: 0,
  token: "browser-fixture-token",
});
const proc = spawn(
  chrome,
  [
    "--headless",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--remote-debugging-port=0",
    `--user-data-dir=${join(directory, "profile")}`,
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);
let ws;
try {
  const endpoint = await new Promise((resolve, reject) => {
    let log = "";
    const timer = setTimeout(
      () => reject(new Error("Chromium launch timeout")),
      15000,
    );
    proc.stderr.on("data", (chunk) => {
      log += chunk;
      const match = /DevTools listening on (ws:\/\/\S+)/.exec(log);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    proc.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    proc.on("exit", () => {
      clearTimeout(timer);
      reject(new Error("Chromium exited before connection"));
    });
  });
  ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  let serial = 0,
    browserSession;
  const pending = new Map(),
    failures = [],
    external = [];
  ws.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const request = pending.get(message.id);
      if (request) {
        pending.delete(message.id);
        clearTimeout(request.timer);
        message.error
          ? request.reject(new Error(JSON.stringify(message.error)))
          : request.resolve(message.result);
      }
    } else if (message.method === "Runtime.exceptionThrown")
      failures.push(message.params.exceptionDetails);
    else if (
      message.method === "Network.requestWillBeSent" &&
      !message.params.request.url.startsWith(app.origin) &&
      !message.params.request.url.startsWith("blob:")
    )
      external.push(message.params.request.url);
  });
  const send = (method, params = {}, scoped = true) =>
    new Promise((resolve, reject) => {
      const id = ++serial,
        timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`CDP timeout ${method}`));
        }, 10000);
      pending.set(id, { resolve, reject, timer });
      ws.send(
        JSON.stringify({
          id,
          method,
          params,
          ...(scoped && browserSession ? { sessionId: browserSession } : {}),
        }),
      );
    });
  const page = await send("Target.createTarget", { url: "about:blank" }, false);
  browserSession = (
    await send(
      "Target.attachToTarget",
      { targetId: page.targetId, flatten: true },
      false,
    )
  ).sessionId;
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Network.enable");
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails)
      throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const until = async (expression) => {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      if (await evaluate(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Browser condition timed out: ${expression}`);
  };
  const launch = join(directory, "launch.html");
  writeFileSync(
    launch,
    `<a href="${app.origin}/#browser-fixture-token">Open console</a>`,
  );
  await send("Page.navigate", { url: pathToFileURL(launch).href });
  await until("Boolean(document.querySelector('a'))");
  await evaluate("document.querySelector('a').click()");
  await until(
    "document.querySelector('#original')?.textContent.includes('# first')",
  );
  assert.equal(await evaluate("location.hash"), "");
  assert.equal(await evaluate("Boolean(window.sourceExecuted)"), false);
  assert.equal(rpc.calls.length, 0);
  await evaluate("document.querySelector('#next').click()");
  await until("document.querySelector('#title').textContent === 'second.md'");
  await evaluate("document.querySelector('#previous').click()");
  await until("document.querySelector('#title').textContent === 'first.md'");
  await evaluate(
    "document.querySelector('#search').value='second'; document.querySelector('#search').dispatchEvent(new Event('input'))",
  );
  assert.equal(
    await evaluate("document.querySelectorAll('#history button').length"),
    1,
  );
  await evaluate(
    "document.querySelector('#search').value=''; document.querySelector('#search').dispatchEvent(new Event('input')); document.querySelector('#size').value='larger'; document.querySelector('#size').dispatchEvent(new Event('change'))",
  );
  assert.equal(
    await evaluate(
      "getComputedStyle(document.querySelector('#original')).fontSize",
    ),
    "22.4px",
  );
  await send(
    "Browser.setDownloadBehavior",
    { behavior: "allow", downloadPath: directory },
    false,
  );
  await evaluate("document.querySelector('#download').click()");
  for (let i = 0; i < 100 && !existsSync(join(directory, "first.md")); i++)
    await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(
    readFileSync(join(directory, "first.md"), "utf8"),
    consoleRecords[0].text,
  );
  await evaluate("document.querySelector('#connect').click()");
  await until("!document.querySelector('#send').disabled");
  await evaluate(
    "document.querySelector('#message').value='Discuss this original'; document.querySelector('#composer').requestSubmit()",
  );
  await until(
    "document.querySelector('#messages').textContent.includes('Discuss this original')",
  );
  rpc.delta("A fixture response ");
  rpc.delta("<img src=x onerror=alert(1)>");
  await until(
    "document.querySelector('#messages').textContent.includes('A fixture response')",
  );
  assert.equal(
    await evaluate("document.querySelectorAll('#messages img').length"),
    0,
  );
  await rpc.navigate(consoleRecords[1].id);
  await until("document.querySelector('#title').textContent === 'second.md'");
  assert.ok(rpc.sentInput().input[1].text.includes(consoleRecords[0].sha256));
  await evaluate("document.querySelector('#interrupt').click()");
  await until(
    "document.querySelector('#status').textContent.includes('interrupted')",
  );
  await send("Page.reload");
  await until(
    "document.querySelector('#messages')?.textContent.includes('Discuss this original') && document.querySelector('#title')?.textContent === 'second.md'",
  );
  assert.equal(await evaluate("document.body.className"), "larger");
  for (const width of [1440, 900, 390]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });
    assert.equal(
      await evaluate(
        "document.documentElement.scrollWidth <= window.innerWidth",
      ),
      true,
      `overflow at ${width}`,
    );
  }
  assert.deepEqual(failures, []);
  assert.deepEqual(
    external.filter((url) => url !== pathToFileURL(launch).href),
    [],
  );
  console.log(
    "Chromium passed: originals, navigation, filters, size, downloads, source/model markup safety, fixture chat streaming, shared selection, interruption, reload, and desktop/mobile layout. Chat responses in this test are protocol fixtures.",
  );
} finally {
  ws?.close();
  const exited = new Promise((resolve) => proc.once("exit", resolve));
  proc.kill();
  await exited;
  await app.close();
  rmSync(directory, { recursive: true, force: true });
}
