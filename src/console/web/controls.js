export function setupControls(step) {
  const $ = (id) => document.getElementById(id);
  const shortcuts = $("shortcuts");
  $("close-shortcuts").onclick = () => shortcuts.close();
  shortcuts.addEventListener("click", (event) => {
    const bounds = shortcuts.getBoundingClientRect();
    if (
      event.target === shortcuts &&
      (event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom)
    )
      shortcuts.close();
  });
  const mobile = matchMedia("(max-width: 699px)");
  let left = !mobile.matches,
    right = !mobile.matches,
    pinned = false,
    dockVisible = true,
    dismissed = false,
    lastY = 0;
  let returnFocus = null;
  const sizes = ["compact", "normal", "large"];
  let size = localStorage.getItem("regent-size") || "normal";
  if (!sizes.includes(size)) size = size === "larger" ? "large" : "normal";
  function paintSize() {
    document.body.dataset.size = size;
    $("size-label").textContent = size[0].toUpperCase() + size.slice(1);
    $("size").setAttribute(
      "aria-label",
      `Text size: ${$("size-label").textContent}`,
    );
    localStorage.setItem("regent-size", size);
  }
  function paintPanels() {
    $("shell").classList.toggle("left-collapsed", !left);
    $("shell").classList.toggle("right-collapsed", !right);
    $("toggle-left").textContent = left ? "«" : "»";
    $("toggle-right").textContent = right ? "»" : "«";
    for (const [id, open, label] of [
      ["toggle-left", left, "records"],
      ["toggle-right", right, "chat"],
    ]) {
      $(id).setAttribute("aria-expanded", String(open));
      $(id).setAttribute(
        "aria-label",
        `${open ? "Collapse" : "Expand"} ${label}`,
      );
      $(id).title =
        `${open ? "Collapse" : "Expand"} ${label} — ${label === "records" ? "F" : "C"}`;
    }
    $("dock-chat").setAttribute("aria-expanded", String(right));
    const drawer = mobile.matches && (left || right);
    $("scrim").hidden = !drawer;
    document.querySelector(".reader").inert = drawer;
    document.querySelector(".statusbar").inert = drawer;
  }
  function closeDrawers() {
    if (!mobile.matches) return;
    left = false;
    right = false;
    paintPanels();
    returnFocus?.focus();
    returnFocus = null;
  }
  function toggle(panel) {
    const willOpen = panel === "left" ? !left : !right;
    if (mobile.matches && willOpen) returnFocus = document.activeElement;
    if (panel === "left") {
      left = willOpen;
      if (mobile.matches && left) right = false;
    } else {
      right = willOpen;
      if (mobile.matches && right) left = false;
    }
    paintPanels();
    if (mobile.matches) {
      if (willOpen)
        $(panel === "left" ? "toggle-left" : "toggle-right").focus();
      else {
        returnFocus?.focus();
        returnFocus = null;
      }
    }
  }
  function paintDock() {
    $("shell").classList.toggle("dock-hidden", !dockVisible);
    $("dock").inert = !dockVisible;
    $("show-dock").hidden = dockVisible;
    $("pin-dock").setAttribute("aria-pressed", String(pinned));
    $("pin-dock").title = pinned ? "Unpin controls" : "Pin controls open";
  }
  function showDock() {
    dockVisible = true;
    dismissed = false;
    paintDock();
  }
  function hideDock() {
    dockVisible = false;
    pinned = false;
    dismissed = true;
    paintDock();
    $("show-dock").focus();
  }
  function cycleSize() {
    size = sizes[(sizes.indexOf(size) + 1) % sizes.length];
    paintSize();
    showDock();
  }
  $("toggle-left").onclick = () => toggle("left");
  $("toggle-right").onclick = () => toggle("right");
  $("open-records").onclick = () => toggle("left");
  $("dock-chat").onclick = () => toggle("right");
  $("scrim").onclick = closeDrawers;
  $("size").onclick = cycleSize;
  $("hide-dock").onclick = hideDock;
  $("show-dock").onclick = () => {
    showDock();
    $("previous").focus();
  };
  $("pin-dock").onclick = () => {
    pinned = !pinned;
    showDock();
  };
  $("toggle-filters").onclick = () => {
    $("filters").hidden = !$("filters").hidden;
    $("toggle-filters").setAttribute(
      "aria-expanded",
      String(!$("filters").hidden),
    );
    if (!$("filters").hidden) $("search").focus();
  };
  $("raw-toggle").onclick = () => {
    const raw = $("original").hidden;
    $("original").hidden = !raw;
    $("reading-text").hidden = raw;
    $("raw-toggle").textContent = raw
      ? "Show reading view"
      : "Show source text";
    $("raw-toggle").setAttribute("aria-pressed", String(raw));
  };
  $("reader-scroll").addEventListener(
    "scroll",
    () => {
      const y = $("reader-scroll").scrollTop,
        delta = y - lastY;
      if (Math.abs(delta) < 6) return;
      lastY = y;
      if (pinned || dismissed || $("dock").contains(document.activeElement))
        return;
      if (delta > 0 && y > 90) dockVisible = false;
      else if (delta < 0) dockVisible = true;
      paintDock();
    },
    { passive: true },
  );
  document.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    if (shortcuts.open) {
      if (
        event.key === "?" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        if (!event.repeat) shortcuts.close();
      }
      // The native dialog handles Escape, focus containment, and restoration.
      return;
    }
    if (event.key === "Escape" && mobile.matches) {
      closeDrawers();
      return;
    }
    if (event.key === "Tab" && mobile.matches && (left || right)) {
      const panel = $(left ? "records-panel" : "conversation");
      const focusable = [
        ...panel.querySelectorAll(
          "button:not(:disabled), input, select, textarea, summary",
        ),
      ].filter((node) => node.getClientRects().length);
      const first = focusable[0],
        last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key === "Enter" &&
      event.target === $("message")
    ) {
      event.preventDefault();
      $("composer").requestSubmit();
      return;
    }
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.target.closest("input, textarea, select, [contenteditable=true]")
    )
      return;
    const key = event.key.toLowerCase();
    if (["arrowleft", "arrowright", "t", "f", "c", ".", "?"].includes(key))
      event.preventDefault();
    if (key === "arrowleft" || key === "arrowright") {
      step(key === "arrowleft" ? -1 : 1);
      showDock();
    } else if (key === "t") cycleSize();
    else if (key === "f") toggle("left");
    else if (key === "c") toggle("right");
    else if (key === ".") {
      if (dockVisible) hideDock();
      else showDock();
    } else if (key === "?" && !event.repeat) shortcuts.showModal();
  });
  mobile.addEventListener("change", () => {
    left = !mobile.matches;
    right = !mobile.matches;
    paintPanels();
  });
  paintPanels();
  paintSize();
  paintDock();
  return {
    selected() {
      $("reader-scroll").scrollTop = 0;
      lastY = 0;
      if (!dismissed) {
        dockVisible = true;
        paintDock();
      }
    },
    closeDrawers,
  };
}
