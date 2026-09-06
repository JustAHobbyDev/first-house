/* All source and model text is rendered as text, never executable markup. */
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
const showError = (error) => {
  $("error").textContent = error.message;
  $("error").hidden = false;
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
    $("error").hidden = true;
    void fn().catch(showError);
  };
}
async function select(id) {
  await api("/api/select", { recordId: id });
}
function linkRecord(id, label) {
  const button = document.createElement("button");
  button.textContent = label;
  button.onclick = action(() => select(id));
  return button;
}
function list() {
  const query = $("search").value.toLowerCase(),
    participant = $("participant").value;
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
      button.setAttribute(
        "aria-current",
        String(record.id === state?.selection),
      );
      const small = document.createElement("small");
      small.textContent = record.archive.endsWith("first-council")
        ? "First Council"
        : "The Promise and the Door";
      button.append(small);
      return button;
    }),
  );
  const index = visible.findIndex((record) => record.id === state?.selection);
  $("previous").disabled = index <= 0;
  $("next").disabled = index < 0 || index >= visible.length - 1;
}
async function render(next) {
  if (state && next.revision < state.revision) return;
  state = next;
  $("status").textContent = state.status;
  $("thread").textContent = state.threadId
    ? `Console thread: ${state.threadId}`
    : "No operator thread created yet.";
  $("connect").disabled = state.connected;
  $("send").disabled =
    !state.connected ||
    state.busy ||
    !state.selection ||
    displayed !== state.selection;
  $("interrupt").disabled = !state.connected || !state.turnId;
  $("attachment").textContent =
    `Sending includes the full original and hash for: ${state.selection || "none"}`;
  const bottom =
    $("messages").scrollHeight -
      $("messages").scrollTop -
      $("messages").clientHeight <
    60;
  $("messages").replaceChildren(
    ...state.messages.map((message) => {
      const entry = document.createElement("div");
      entry.className = "message";
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
  $("metadata").textContent =
    `${record.archive} · Host rehearsal original · History links: ${record.participants.join(", ") || "shared source / archive record"}`;
  $("reference").textContent = `${record.id}\nSHA-256 ${record.sha256}`;
  $("original").textContent = record.text;
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
  const index = visible.findIndex((record) => record.id === state.selection);
  if (index > 0) await select(visible[index - 1].id);
});
$("next").onclick = action(async () => {
  const index = visible.findIndex((record) => record.id === state.selection);
  if (index >= 0 && index + 1 < visible.length)
    await select(visible[index + 1].id);
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
$("size").value = localStorage.getItem("regent-size") || "normal";
function size() {
  document.body.className = $("size").value;
  localStorage.setItem("regent-size", $("size").value);
}
$("size").onchange = size;
size();
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
      showError(error);
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
