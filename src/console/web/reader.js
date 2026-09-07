/* A small display renderer. Source bytes remain available separately.
   Never interpret source HTML, fetch images, or execute source content. */
export function renderMarkdown(text, target, followLink) {
  const inline = (parent, value) => {
    const tokens =
      /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\([^\s)]+\))/g;
    let cursor = 0;
    for (const match of value.matchAll(tokens)) {
      parent.append(document.createTextNode(value.slice(cursor, match.index)));
      const token = match[0];
      let node;
      if (token.startsWith("`")) {
        node = document.createElement("code");
        node.textContent = token.slice(1, -1);
      } else if (token.startsWith("**")) {
        node = document.createElement("strong");
        node.textContent = token.slice(2, -2);
      } else if (token.startsWith("*")) {
        node = document.createElement("em");
        node.textContent = token.slice(1, -1);
      } else {
        const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
        node = document.createElement("button");
        node.className = "source-link";
        node.textContent = link[1];
        node.title = link[2];
        node.onclick = () => followLink(link[2]);
      }
      parent.append(node);
      cursor = match.index + token.length;
    }
    parent.append(document.createTextNode(value.slice(cursor)));
  };
  const fragment = document.createDocumentFragment();
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const special = (line) =>
    /^(#{1,6}\s|\s*```|\s*~~~|\s*>|\s*[-*+]\s|\s*\d+\.\s|\s*(?:-{3,}|\*{3,}|_{3,})\s*$)/.test(
      line,
    );
  const cells = (line) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = /^\s*(`{3,}|~{3,})/.exec(line);
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (fence) {
      const body = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith(fence[1]))
        body.push(lines[i++]);
      if (i < lines.length) i++;
      const pre = document.createElement("pre");
      pre.textContent = body.join("\n");
      fragment.append(pre);
    } else if (heading) {
      const element = document.createElement(
        `h${Math.min(6, heading[1].length + 1)}`,
      );
      inline(element, heading[2]);
      fragment.append(element);
      i++;
    } else if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      fragment.append(document.createElement("hr"));
      i++;
    } else if (/^\s*>/.test(line)) {
      const body = [];
      while (i < lines.length && /^\s*>/.test(lines[i]))
        body.push(lines[i++].replace(/^\s*>\s?/, ""));
      const quote = document.createElement("blockquote");
      inline(quote, body.join("\n"));
      fragment.append(quote);
    } else if (/^\s*(?:[-*+]|\d+\.)\s/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const list = document.createElement(ordered ? "ol" : "ul");
      if (ordered) list.start = Number(/^\s*(\d+)/.exec(line)[1]);
      const marker = ordered ? /^\s*\d+\.\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/;
      while (i < lines.length) {
        const item = marker.exec(lines[i]);
        if (!item) break;
        const body = [item[1]];
        i++;
        while (
          i < lines.length &&
          lines[i].trim() &&
          /^\s+/.test(lines[i]) &&
          !special(lines[i])
        )
          body.push(lines[i++].trim());
        const li = document.createElement("li");
        inline(li, body.join(" "));
        list.append(li);
      }
      fragment.append(list);
    } else if (
      line.includes("|") &&
      i + 1 < lines.length &&
      cells(lines[i + 1]).every((cell) => /^:?-{3,}:?$/.test(cell))
    ) {
      const table = document.createElement("table");
      const header = document.createElement("tr");
      for (const value of cells(line)) {
        const th = document.createElement("th");
        inline(th, value);
        header.append(th);
      }
      const head = document.createElement("thead");
      head.append(header);
      table.append(head);
      const body = document.createElement("tbody");
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        const row = document.createElement("tr");
        for (const value of cells(lines[i++])) {
          const td = document.createElement("td");
          inline(td, value);
          row.append(td);
        }
        body.append(row);
      }
      table.append(body);
      fragment.append(table);
    } else {
      const body = [line];
      i++;
      while (i < lines.length && lines[i].trim() && !special(lines[i])) {
        if (
          lines[i].includes("|") &&
          i + 1 < lines.length &&
          cells(lines[i + 1]).every((cell) => /^:?-{3,}:?$/.test(cell))
        )
          break;
        body.push(lines[i++]);
      }
      const paragraph = document.createElement("p");
      inline(paragraph, body.join("\n"));
      fragment.append(paragraph);
    }
  }
  target.replaceChildren(fragment);
}
