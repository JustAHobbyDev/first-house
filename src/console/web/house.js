export function setupHouse(api, showError) {
  const $ = (id) => document.getElementById(id);
  let state;
  let pending = false;
  let mode = sessionStorage.getItem("regent-conversation") || "private";
  function paintMode() {
    const house = mode === "house";
    $("house-panel").hidden = !house;
    $("private-body").hidden = house;
    $("composer").hidden = house;
    document.querySelector(".private-note").hidden = house;
    $("private-tab").setAttribute("aria-pressed", String(!house));
    $("house-tab").setAttribute("aria-pressed", String(house));
    $("conversation").setAttribute(
      "aria-label",
      house ? "Interactive House test" : "Private operator conversation",
    );
    sessionStorage.setItem("regent-conversation", mode);
  }
  for (const choice of ["private", "house"])
    $(choice + "-tab").onclick = () => {
      mode = choice;
      paintMode();
    };
  function update(next) {
    if (!next) return;
    if (state && next.revision < state.revision) return;
    state = next;
    $("conversation-tabs").hidden = false;
    paintMode();
    $("house-status").textContent = state.status;
    $("house-start").hidden = state.running;
    $("house-start").disabled = state.busy;
    $("house-stop").disabled = !state.running;
    $("house-send").disabled = pending || !state.running || state.busy;
    $("house-recipient").disabled = pending || state.busy;
    $("house-members").replaceChildren(
      ...state.members.map((member) => {
        const item = document.createElement("li");
        item.textContent = `${member.name} · ${member.status}`;
        return item;
      }),
    );
    const box = $("house-messages");
    const bottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    box.replaceChildren(
      ...state.messages.map((message) => {
        const entry = document.createElement("div");
        entry.className = "message";
        const author = document.createElement("strong");
        author.textContent = message.author;
        const text = document.createElement("p");
        text.textContent = message.text;
        entry.append(author, text);
        return entry;
      }),
    );
    if (bottom) box.scrollTop = box.scrollHeight;
    const signal = document.querySelector(".house-status");
    signal.title = `Noncanonical interactive test · ${state.id}`;
    signal.lastElementChild.textContent = state.running
      ? "Regent · House test live"
      : "Regent · House test stopped";
  }
  async function action(path, body = {}) {
    try {
      const result = await api(path, body);
      update(result.house);
    } catch (error) {
      showError(error);
    }
  }
  $("house-start").onclick = () => action("/api/house/start");
  $("house-stop").onclick = () => action("/api/house/stop");
  $("house-composer").onsubmit = async (event) => {
    event.preventDefault();
    const text = $("house-message").value;
    if (pending || !state?.running || state.busy || !text.trim()) return;
    pending = true;
    update(state);
    const choice = $("house-recipient").value;
    try {
      const result = await api("/api/house/message", {
        text,
        recipients:
          choice === "all"
            ? state.members.map((member) => member.name)
            : [choice],
      });
      if ($("house-message").value === text) $("house-message").value = "";
      update(result.house);
    } catch (error) {
      showError(error);
    } finally {
      pending = false;
      update(state);
    }
  };
  $("house-message").onkeydown = (event) => {
    if (
      !event.isComposing &&
      (event.ctrlKey || event.metaKey) &&
      event.key === "Enter"
    ) {
      event.preventDefault();
      $("house-composer").requestSubmit();
    }
  };
  $("house-context").onclick = async () => {
    try {
      const context = await api("/api/house/context");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(context, null, 2)], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "house-test-context.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      showError(error);
    }
  };
  return update;
}
