import { renderMarkdown } from "./reader.js";
import { setupControls } from "./controls.js";
import { setupHouse } from "./house.js";
/* Source and model HTML is never executed. */
const $ = (id) => document.getElementById(id);
let token =
  location.hash.slice(1) || sessionStorage.getItem("regent-token") || "";
history.replaceState(null, "", location.pathname);
if (token) sessionStorage.setItem("regent-token", token);
let records = [],
  state,
  selected,
  visible = [],
  displayed = null,
  recordRequest = 0;
let networkNotice = false;
const showError = (error, network = false) => {
  networkNotice = network;
  $("error").textContent = error.message;
  $("error-toggle").hidden = false;
  $("error-toggle").title = error.message;
  $("error-panel").hidden = false;
  $("error-toggle").setAttribute("aria-expanded", "true");
};
function clearError() {
  $("error-panel").hidden = true;
  $("error-toggle").hidden = true;
  $("error-toggle").setAttribute("aria-expanded", "false");
  networkNotice = false;
}
$("dismiss-error").onclick = clearError;
$("error-toggle").onclick = () => {
  $("error-panel").hidden = !$("error-panel").hidden;
  $("error-toggle").setAttribute(
    "aria-expanded",
    String(!$("error-panel").hidden),
  );
};
async function api(path, data) {
  const response = await fetch(path, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    ...(data ? { method: "POST", body: JSON.stringify(data) } : {}),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || "Request failed");
  return value;
}
function action(fn) {
  return () => {
    clearError();
    void fn().catch(showError);
  };
}
const renderHouse = setupHouse(api, showError);
async function select(id) {
  await api("/api/select", { recordId: id });
  controls.closeDrawers();
}
async function step(direction) {
  const index = visible.findIndex((record) => record.id === state?.selection);
  if (index >= 0 && visible[index + direction])
    await select(visible[index + direction].id);
}
const controls = setupControls(
  (direction) => void step(direction).catch(showError),
);
function linkRecord(id, label) {
  const button = document.createElement("button");
  button.textContent = label;
  button.onclick = action(() => select(id));
  return button;
}
let lastList = "";
function list() {
  const query = $("search").value.toLowerCase(),
    participant = $("participant").value;
  const key = JSON.stringify([
    query,
    participant,
    state?.selection,
    records.length,
  ]);
  if (key === lastList) return;
  lastList = key;
  const focusedId = $("history").contains(document.activeElement)
    ? document.activeElement.dataset.recordId
    : null;
  visible = records.filter(
    (record) =>
      (!participant || record.participants.includes(participant)) &&
      `${record.path} ${record.archive} ${record.participants.join(" ")}`
        .toLowerCase()
        .includes(query),
  );
  $("history").replaceChildren(
    ...visible.map((record) => {
      const button = linkRecord(record.id, record.path);
      button.className = "record";
      button.dataset.recordId = record.id;
      button.title = record.path;
      button.setAttribute("aria-label", record.path);
      button.replaceChildren();
      button.setAttribute(
        "aria-current",
        String(record.id === state?.selection),
      );
      const small = document.createElement("small");
      small.textContent = record.archive.endsWith("first-council")
        ? "First Council"
        : "The Promise and the Door";
      const marker = document.createElement("span");
      marker.className = "record-marker";
      marker.setAttribute("aria-hidden", "true");
      const copy = document.createElement("span");
      copy.className = "record-copy";
      const name = document.createElement("span");
      name.className = "record-name";
      name.textContent = record.path;
      copy.append(name, small);
      button.append(marker, copy);
      return button;
    }),
  );
  const index = visible.findIndex((record) => record.id === state?.selection);
  $("previous").disabled = index <= 0;
  $("next").disabled = index < 0 || index >= visible.length - 1;
  $("record-count").textContent = `Reading order · ${visible.length} records`;
  if (focusedId)
    [...$("history").children]
      .find((button) => button.dataset.recordId === focusedId)
      ?.focus({ preventScroll: true });
}
async function render(next) {
  if (state && next.revision < state.revision) return;
  state = next;
  renderHouse(next.house);
  $("status").title = state.status;
  $("status").textContent = state.busy
    ? "Codex responding"
    : /Turn (interrupted|failed)/.test(state.status)
      ? state.status.split(":")[0]
      : state.connected
        ? "Codex connected"
        : /Connecting/.test(state.status)
          ? "Connecting Codex"
          : "Codex offline";
  $("thread").textContent = state.threadId
    ? `thread ${state.threadId.slice(0, 8)}`
    : "";
  $("thread").title = state.threadId || "No operator thread created yet";
  $("connect").disabled = state.connected;
  $("connect").hidden = state.connected;
  $("chat-intro").hidden = state.messages.length > 0;
  $("send").disabled =
    !state.connected ||
    state.busy ||
    !state.selection ||
    displayed !== state.selection;
  $("interrupt").disabled = !state.connected || !state.turnId;
  $("attachment").textContent =
    state.selection?.split("/").at(-1) || "No record selected";
  $("attachment").title =
    `Sending includes the full original and hash for: ${state.selection || "none"}`;
  const bottom =
    $("messages").scrollHeight -
      $("messages").scrollTop -
      $("messages").clientHeight <
    60;
  $("messages").replaceChildren(
    ...state.messages.map((message) => {
      const entry = document.createElement("div");
      entry.className =
        message.role === "Activity" ? "message activity" : "message";
      const name = document.createElement("strong");
      name.textContent = message.role;
      const text = document.createElement("p");
      text.textContent = message.text;
      entry.append(name, text);
      if (message.recordId)
        entry.append(linkRecord(message.recordId, "Read attached record"));
      return entry;
    }),
  );
  if (bottom) $("messages").scrollTop = $("messages").scrollHeight;
  list();
  if (displayed === state.selection) return;
  $("download").disabled = true;
  const id = state.selection,
    request = ++recordRequest;
  const record = await api(`/api/record?id=${encodeURIComponent(id)}`);
  if (request !== recordRequest || state.selection !== id) return;
  selected = record;
  displayed = record.id;
  $("title").textContent = record.path;
  $("title").title = record.path;
  $("archive-label").textContent = `${record.archive} · host original`;
  $("metadata").textContent =
    `${record.archive} · Host rehearsal original · History links: ${record.participants.join(", ") || "shared source / archive record"}`;
  $("reference").textContent = `${record.id}\nSHA-256 ${record.sha256}`;
  $("original").textContent = record.text;
  if (record.path.endsWith(".md"))
    renderMarkdown(record.text, $("reading-text"), followSourceLink);
  else {
    const pre = document.createElement("pre");
    pre.textContent = record.text;
    $("reading-text").replaceChildren(pre);
  }
  controls.selected();
  $("download").disabled = false;
  $("send").disabled = !state.connected || state.busy;
  $("manifests").replaceChildren(
    ...record.manifests.map((id) =>
      linkRecord(id, records.find((record) => record.id === id)?.path || id),
    ),
  );
}
$("search").oninput = list;
$("participant").onchange = list;
$("previous").onclick = action(async () => {
  await step(-1);
});
$("next").onclick = action(async () => {
  await step(1);
});
$("connect").onclick = action(async () => {
  $("connect").disabled = true;
  try {
    await render(await api("/api/connect", {}));
  } finally {
    $("connect").disabled = !!state?.connected;
  }
});
$("interrupt").onclick = action(() => api("/api/interrupt", {}));
function followSourceLink(path) {
  try {
    const url = new URL(path, `https://archive.invalid/${selected.path}`);
    if (url.origin === "https://archive.invalid") {
      const record = records.find(
        (record) =>
          record.archive === selected.archive &&
          record.path === decodeURIComponent(url.pathname.slice(1)),
      );
      if (record) {
        void select(record.id).catch(showError);
        return;
      }
    }
    if (/^https?:\/\//.test(path)) {
      window.open(path, "_blank", "noopener,noreferrer");
      return;
    }
  } catch {
    /* Unresolved references remain visible in the original source. */
  }
  showError(new Error(`This reference is not in the loaded archive: ${path}`));
}
$("download").onclick = () => {
  if (!selected) return;
  const url = URL.createObjectURL(
    new Blob([selected.text], { type: "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = selected.path.split("/").at(-1);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("composer").onsubmit = (event) => {
  event.preventDefault();
  const text = $("message").value,
    recordId = displayed;
  if (
    !text.trim() ||
    displayed !== state.selection ||
    state.busy ||
    !state.connected
  )
    return;
  $("send").disabled = true;
  void api("/api/message", { text, recordId })
    .then(async (next) => {
      if ($("message").value === text) $("message").value = "";
      await render(next);
    })
    .catch(async (error) => {
      showError(error);
      try {
        await render(await api("/api/state"));
      } catch {
        /* Reconnect stream will restore state. */
      }
    });
};
async function events() {
  while (true) {
    try {
      const response = await fetch("/api/events", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok)
        throw new Error(
          "Console connection lost. Reopen the private launch file if the server restarted.",
        );
      if (networkNotice) clearError();
      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let end;
        while ((end = buffer.indexOf("\n\n")) >= 0) {
          const line = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          if (line.startsWith("data: "))
            await render(JSON.parse(line.slice(6)));
        }
      }
      throw new Error("Console connection lost; reconnecting…");
    } catch (error) {
      showError(error, true);
      $("send").disabled = true;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
}
void (async () => {
  records = await api("/api/history");
  for (const name of [
    ...new Set(records.flatMap((record) => record.participants)),
  ].sort()) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    $("participant").append(option);
  }
  await render(await api("/api/state"));
  await events();
})().catch(showError);
