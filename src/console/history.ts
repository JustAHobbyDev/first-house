import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { resolve, sep } from "node:path";

export interface HistoryRecord {
  id: string;
  archive: string;
  path: string;
  sha256: string;
  text: string;
  participants: string[];
  manifests: string[];
}

export const archiveSpecs = [
  {
    id: "dev:rehearsal:first-council",
    directory: "var/dev-ritual-rehearsal-R0ghIU",
    reader: "var/dev-screenplay-build-BY76hW/screenplay.json",
  },
  {
    id: "dev:rehearsal:promise-and-door",
    directory: "var/dev-scriptural-tension-Wis8NP",
    reader: "var/dev-tension-screenplay-Wis8NP/screenplay.json",
  },
];

export function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Import only manifest-listed originals. Never serve arbitrary filesystem paths. */
export function loadHistory(
  root: string,
  specs = archiveSpecs,
): HistoryRecord[] {
  const records: HistoryRecord[] = [];
  for (const spec of specs) {
    const directory = realpathSync(resolve(root, spec.directory));
    const read = (path: string) => {
      if (path.split("/").some((part) => part === "..") || path.startsWith("/"))
        throw new Error("Invalid archive path");
      const full = realpathSync(resolve(directory, path));
      if (!full.startsWith(directory + sep))
        throw new Error("Archive path escapes root");
      return readFileSync(full);
    };
    const manifestBytes = read("archive-manifest.json");
    const manifest = JSON.parse(manifestBytes.toString()) as {
      artifacts: { path: string; sha256: string }[];
    };
    const entries = [
      ...manifest.artifacts,
      { path: "archive-manifest.json", sha256: digest(manifestBytes) },
    ];
    const local = new Map<string, HistoryRecord>();
    for (const entry of entries) {
      if (local.has(entry.path)) throw new Error("Duplicate archive path");
      const bytes = read(entry.path);
      if (digest(bytes) !== entry.sha256)
        throw new Error(
          `Archive hash mismatch: ${spec.directory}/${entry.path}`,
        );
      local.set(entry.path, {
        id: `${spec.id}/${entry.path}`,
        archive: spec.id,
        path: entry.path,
        sha256: entry.sha256,
        text: bytes.toString("utf8"),
        participants: [],
        manifests: [],
      });
    }
    // These are documentary links, not complete invocation-context claims.
    for (const record of local.values()) {
      if (
        !record.path.endsWith(".json") ||
        record.path === "archive-manifest.json"
      )
        continue;
      const value = JSON.parse(record.text) as {
        artifacts?: { path: string }[];
      };
      if (Array.isArray(value.artifacts))
        for (const item of value.artifacts) {
          local.get(item.path)?.manifests.push(record.id);
        }
    }
    const reader = JSON.parse(
      readFileSync(resolve(root, spec.reader), "utf8"),
    ) as {
      participants: { name: string; files: string[] }[];
      scenes: { sources?: string[]; cards: { sources?: string[] }[] }[];
    };
    const sourcePath = (path: string) =>
      spec.id.endsWith("promise-and-door")
        ? path.startsWith("tension/")
          ? path.slice(8)
          : null
        : path;
    for (const participant of reader.participants)
      for (const file of participant.files) {
        const path = sourcePath(file);
        if (path) local.get(path)?.participants.push(participant.name);
      }
    const ordered = new Set<string>();
    for (const scene of reader.scenes) {
      for (const file of [
        ...(scene.sources ?? []),
        ...scene.cards.flatMap((card) => card.sources ?? []),
      ]) {
        const path = sourcePath(file);
        if (path && local.has(path)) ordered.add(path);
      }
    }
    for (const path of local.keys()) ordered.add(path);
    records.push(...[...ordered].map((path) => local.get(path)!));
  }
  return records;
}

export function reference(record: HistoryRecord) {
  return {
    id: record.id,
    archive: record.archive,
    path: record.path,
    sha256: record.sha256,
  };
}
