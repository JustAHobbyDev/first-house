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
import {
  consoleRecords as fixtureRecords,
  FixtureRpc,
} from "../dist/tests/console-fixture.js";
import { digest } from "../dist/src/console/history.js";
import { HouseExperiment } from "../dist/src/console/house.js";
import { FixtureMember } from "../dist/tests/house-fixture.js";

const consoleRecords = structuredClone(fixtureRecords);
consoleRecords[0].text +=
  "\n**Original emphasis** and `literal code`.\n\n" +
  Array.from(
    { length: 30 },
    (_, i) =>
      `## Paragraph ${i + 1}\n\nA preserved paragraph for scrolling and reading controls.\n`,
  ).join("\n");
consoleRecords[0].sha256 = digest(Buffer.from(consoleRecords[0].text));

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
const houseMembers = [];
const house = new HouseExperiment(
  process.cwd(),
  join(directory, "house"),
  () => {
    const member = new FixtureMember();
    houseMembers.push(member);
    return member;
  },
);
const app = await startConsole(session, {
  port: 0,
  token: "browser-fixture-token",
  house,
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
  assert.equal(
    await evaluate("document.querySelectorAll('#reading-text script').length"),
    0,
  );
  assert.equal(
    await evaluate("document.querySelector('#reading-text h2').textContent"),
    "first",
  );
  assert.equal(
    await evaluate(
      "document.querySelector('#reading-text strong').textContent",
    ),
    "Original emphasis",
  );
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
    "document.querySelector('#search').value=''; document.querySelector('#search').dispatchEvent(new Event('input')); document.querySelector('#size').click()",
  );
  assert.equal(
    await evaluate(
      "getComputedStyle(document.querySelector('#reading-text')).fontSize",
    ),
    "21px",
  );
  await evaluate(
    "document.querySelector('#toggle-left').click(); document.querySelector('#toggle-right').click()",
  );
  assert.equal(
    await evaluate(
      "document.querySelector('#shell').classList.contains('left-collapsed') && document.querySelector('#shell').classList.contains('right-collapsed')",
    ),
    true,
  );
  await evaluate(
    "document.querySelector('#toggle-left').click(); document.querySelector('#toggle-right').click()",
  );
  await evaluate(
    "document.activeElement.blur(); document.querySelector('#reader-scroll').scrollTop = 500",
  );
  await until(
    "document.querySelector('#shell').classList.contains('dock-hidden')",
  );
  await evaluate("document.querySelector('#reader-scroll').scrollTop = 100");
  await until(
    "!document.querySelector('#shell').classList.contains('dock-hidden')",
  );
  await evaluate(
    "document.querySelector('#pin-dock').click(); document.activeElement.blur(); document.querySelector('#reader-scroll').scrollTop = 700",
  );
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(
    await evaluate(
      "document.querySelector('#shell').classList.contains('dock-hidden')",
    ),
    false,
  );
  await evaluate("document.querySelector('#hide-dock').click()");
  assert.equal(await evaluate("document.querySelector('#dock').inert"), true);
  await evaluate(
    "document.querySelector('#show-dock').click(); document.querySelector('#provenance').open=true; document.querySelector('#raw-toggle').click()",
  );
  assert.equal(
    await evaluate("document.querySelector('#original').hidden"),
    false,
  );
  assert.equal(
    await evaluate("document.querySelector('#original').textContent"),
    consoleRecords[0].text,
  );
  await evaluate(
    "document.querySelector('#raw-toggle').click(); document.querySelector('#provenance').open=false",
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
    "document.querySelector('#message').focus(); document.querySelector('#message').value='Discuss this original'",
  );
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Enter",
    code: "Enter",
    text: "\r",
    windowsVirtualKeyCode: 13,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Enter",
    code: "Enter",
  });
  assert.equal(
    await evaluate("document.querySelector('#message').value"),
    "Discuss this original\n",
  );
  assert.equal(
    rpc.calls.filter((call) => call.method === "turn/start").length,
    0,
  );
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Enter",
    code: "Enter",
    modifiers: 2,
    windowsVirtualKeyCode: 13,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Enter",
    code: "Enter",
  });
  await until(
    "document.querySelector('#messages').textContent.includes('Discuss this original')",
  );
  assert.equal(
    rpc.calls.filter((call) => call.method === "turn/start").length,
    1,
  );
  assert.equal(rpc.sentInput().input[0].text, "Discuss this original\n");
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
  assert.equal(await evaluate("document.body.dataset.size"), "large");
  for (const width of [1440, 900, 390, 320]) {
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
    assert.equal(
      await evaluate(
        "document.querySelector('.dock-controls').getBoundingClientRect().left >= document.querySelector('.reader').getBoundingClientRect().left && document.querySelector('.dock-controls').getBoundingClientRect().right <= document.querySelector('.reader').getBoundingClientRect().right",
      ),
      true,
      `dock clipping at ${width}`,
    );
  }
  await evaluate("document.querySelector('#open-records').click()");
  assert.equal(
    await evaluate("document.querySelector('#scrim').hidden"),
    false,
  );
  assert.equal(await evaluate("document.querySelector('.reader').inert"), true);
  await evaluate(
    "document.querySelector('#scrim').click(); document.querySelector('#dock-chat').click()",
  );
  assert.equal(
    await evaluate(
      "getComputedStyle(document.querySelector('#conversation')).display",
    ),
    "flex",
  );
  await evaluate(
    "document.querySelector('#message').focus(); document.querySelector('#message').value='f c t .'",
  );
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "f",
    code: "KeyF",
  });
  assert.equal(
    await evaluate(
      "document.querySelector('#shell').classList.contains('right-collapsed')",
    ),
    false,
  );
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
  });
  assert.equal(await evaluate("document.querySelector('#scrim').hidden"), true);
  assert.equal(
    await evaluate("document.querySelector('.reader').inert"),
    false,
  );
  if (process.env.REGENT_TEST_SCREENSHOT) {
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await rpc.navigate(consoleRecords[0].id);
    await until("document.querySelector('#title').textContent === 'first.md'");
    await evaluate("document.fonts.ready");
    const screenshot = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(
      process.env.REGENT_TEST_SCREENSHOT,
      Buffer.from(screenshot.data, "base64"),
    );
  }
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await until(
    "!document.querySelector('#shell').classList.contains('right-collapsed')",
  );
  await evaluate(
    "document.querySelector('#house-tab').click(); document.querySelector('#house-start').click()",
  );
  await until("!document.querySelector('#house-send').disabled");
  assert.equal(houseMembers.length, 3);
  assert.ok(houseMembers.every((member) => member.inputs.length === 0));
  await evaluate(
    "document.querySelector('#house-message').focus(); document.querySelector('#house-message').value='Regent fixture opening';",
  );
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Enter",
    code: "Enter",
    modifiers: 2,
    windowsVirtualKeyCode: 13,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Enter",
    code: "Enter",
  });
  await until(
    "document.querySelector('#house-messages').textContent.includes('Regent fixture opening')",
  );
  assert.equal(house.state.messages.length, 1);
  assert.equal(
    session.state.messages.filter(
      (message) => message.text === "Regent fixture opening",
    ).length,
    0,
  );
  houseMembers.forEach((member, index) =>
    member.finish(
      `Member fixture ${index} <img src=x onerror=alert(1)>`,
      `house-session-${index}`,
    ),
  );
  await until(
    "document.querySelector('#house-messages').textContent.includes('Member fixture 2') && !document.querySelector('#house-send').disabled",
  );
  assert.equal(
    await evaluate("document.querySelectorAll('#house-messages img').length"),
    0,
  );
  await evaluate(
    "document.querySelector('#house-recipient').value='Witness'; document.querySelector('#house-message').value='Witness follow-up'; document.querySelector('#house-composer').requestSubmit()",
  );
  await until(
    "document.querySelector('#house-messages').textContent.includes('Witness follow-up')",
  );
  assert.deepEqual(
    houseMembers.map((member) => member.inputs.length),
    [1, 2, 1],
  );
  houseMembers[1].finish("Witness fixture reply", "house-session-1");
  await until(
    "document.querySelector('#house-messages').textContent.includes('Witness fixture reply')",
  );
  await send("Page.reload");
  await until(
    "document.querySelector('#house-panel')?.hidden === false && document.querySelector('#house-messages').textContent.includes('Witness fixture reply')",
  );
  await evaluate("document.querySelector('#private-tab').click()");
  assert.equal(
    await evaluate(
      "document.querySelector('#messages').textContent.includes('Discuss this original')",
    ),
    true,
  );
  await evaluate("document.querySelector('#house-tab').click()");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 320,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await until(
    "document.querySelector('#shell').classList.contains('right-collapsed')",
  );
  await evaluate("document.querySelector('#dock-chat').click()");
  assert.equal(
    await evaluate(
      "document.querySelector('#house-panel').scrollWidth <= document.querySelector('#house-panel').clientWidth",
    ),
    true,
  );
  await evaluate("document.querySelector('#house-stop').click()");
  await until(
    "document.querySelector('#house-status').textContent === 'Stopped'",
  );
  console.log(
    "House console passed: independent processes, exact Regent input, responder selection, private chat separation, safe replies, reload, mobile layout, and stop.",
  );
  assert.deepEqual(failures, []);
  assert.deepEqual(
    external.filter((url) => url !== pathToFileURL(launch).href),
    [],
  );
  console.log(
    "Chromium passed: formatted originals and raw source, navigation, filters, collapsible panels, dock hide/pin/reveal, text size, downloads, markup safety, fixture chat streaming, shared selection, interruption, reload, mobile drawers, keyboard input, and desktop/mobile layout. Chat responses are protocol fixtures.",
  );
} finally {
  ws?.close();
  const exited = new Promise((resolve) => proc.once("exit", resolve));
  proc.kill();
  await exited;
  await app.close();
  rmSync(directory, { recursive: true, force: true });
}
