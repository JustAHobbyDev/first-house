import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export function openDatabase(path: string): DatabaseSync {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  try {
    // Refuse unrelated/pre-existing databases before introducing our schema.
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      )
      .all();
    if (tables.length > 0) {
      if (!tables.some((t) => t.name === "store_metadata"))
        throw new Error("Refusing a database without development metadata");
      const row = db
        .prepare(
          "SELECT mode, schema_version FROM store_metadata WHERE singleton=1",
        )
        .get();
      if (row?.mode !== "development-unborn" || row.schema_version !== 1)
        throw new Error("Not a supported disposable development store");
    }
    db.exec(
      "PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON;",
    );
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(
        readFileSync(
          new URL("../../../migrations/001-spine.sql", import.meta.url),
          "utf8",
        ),
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
