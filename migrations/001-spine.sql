CREATE TABLE IF NOT EXISTS store_metadata (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  mode TEXT NOT NULL CHECK (mode = 'development-unborn'),
  schema_version INTEGER NOT NULL CHECK (schema_version = 1)
);
INSERT OR IGNORE INTO store_metadata VALUES (1, 'development-unborn', 1);
CREATE TABLE IF NOT EXISTS events (
  sequence INTEGER PRIMARY KEY CHECK (sequence > 0),
  id TEXT NOT NULL UNIQUE CHECK (id LIKE 'dev:%'),
  correlation_id TEXT NOT NULL,
  json TEXT NOT NULL CHECK (json_valid(json)),
  hash TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS events_correlation ON events(correlation_id, sequence);
CREATE TRIGGER IF NOT EXISTS events_no_update BEFORE UPDATE ON events
BEGIN SELECT RAISE(ABORT, 'Regent Record is append-only'); END;
CREATE TRIGGER IF NOT EXISTS events_no_delete BEFORE DELETE ON events
BEGIN SELECT RAISE(ABORT, 'Regent Record is append-only'); END;
CREATE TRIGGER IF NOT EXISTS events_sequence BEFORE INSERT ON events
WHEN NEW.sequence != COALESCE((SELECT MAX(sequence) FROM events), 0) + 1
BEGIN SELECT RAISE(ABORT, 'Event sequence must be contiguous'); END;
CREATE TABLE IF NOT EXISTS projections (
  name TEXT PRIMARY KEY,
  cursor INTEGER NOT NULL,
  json TEXT NOT NULL CHECK (json_valid(json))
);
