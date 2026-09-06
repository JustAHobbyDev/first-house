import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";
import {
  deterministicDependencies,
  openRuntime,
  seedFixtures,
} from "../src/cli/scenario.js";

export function runtime(t: TestContext, seeded = true) {
  const directory = mkdtempSync(join(tmpdir(), "first-house-test-"));
  const deps = deterministicDependencies();
  const rt = openRuntime(directory, deps);
  t.after(() => {
    rt.db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  if (seeded) seedFixtures(rt.service);
  return { ...rt, directory, deps };
}
