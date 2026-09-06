import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { canonicalJson } from "../domain/json.js";
import { replay } from "../projections/state.js";
import { openRuntime, runDemo } from "./scenario.js";
import { commissionCommand } from "./commission.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const positional = args.filter((a) => a !== "--json");
  if (positional[0] === "commission") {
    await commissionCommand(positional.slice(1), json);
    return;
  }
  const [command, directory] = positional;
  if (
    !command ||
    !["demo", "migrate", "verify", "replay"].includes(command) ||
    positional.length > 2
  )
    throw new Error(
      "Usage: cli <demo|migrate|verify|replay> [development-directory] [--json]",
    );
  let result: unknown;
  if (command === "demo")
    result = await runDemo(directory ? resolve(directory) : undefined);
  else {
    if (!directory)
      throw new Error("Specify the disposable development directory");
    const path = resolve(directory);
    if (command !== "migrate" && !existsSync(join(path, "record.db")))
      throw new Error("Development record.db does not exist");
    const runtime = openRuntime(path);
    try {
      if (command === "verify") {
        result = runtime.store.verify();
        if (!(result as { valid: boolean }).valid) process.exitCode = 1;
      } else if (command === "replay") {
        const state = replay(runtime.store);
        result = {
          mode: "development-unborn",
          replayed: state.cursor,
          projection: "rebuilt",
        };
      } else
        result = {
          mode: "development-unborn",
          directory: path,
          schemaVersion: 1,
        };
    } finally {
      runtime.db.close();
    }
  }
  if (json) process.stdout.write(canonicalJson(result) + "\n");
  else {
    process.stdout.write(
      "First House pre-birth development fixture — no canonical House has been born.\n",
    );
    for (const [key, value] of Object.entries(
      result as Record<string, unknown>,
    ))
      process.stdout.write(
        `${key}: ${typeof value === "object" ? canonicalJson(value) : String(value)}\n`,
      );
  }
}
main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
