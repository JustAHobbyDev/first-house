import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { canonicalJson } from "../domain/json.js";
import { choice, integer } from "../domain/validation.js";
import { CommissionWorkflow } from "../commissions/workflow.js";
import { fixtureActor, fixtureNeighbor, openRuntime } from "./scenario.js";

const usage = `Usage: cli commission <init|inspect|accept-terms|advance|resume|report|review|dispute|resolve> DIRECTORY ... [--json]
  report DIRECTORY [REVISION]
  review DIRECTORY REVISION <accept|revise> --feedback-file PATH
  dispute DIRECTORY REVISION --by <steward|neighbor> --reason-file PATH
  resolve DIRECTORY REVISION <return-to-review|revise> --reason-file PATH`;

export async function commissionCommand(
  args: string[],
  json: boolean,
): Promise<void> {
  const [action, directory, ...tail] = args;
  if (!action || !directory) throw new Error(usage);
  choice(action, [
    "init",
    "inspect",
    "accept-terms",
    "advance",
    "resume",
    "report",
    "review",
    "dispute",
    "resolve",
  ]);
  const revision = (value: string | undefined) => {
    if (!value || !/^[1-9][0-9]*$/.test(value))
      throw new Error("Specify the exact positive delivery revision");
    return integer(Number(value), 1);
  };
  // Validate the complete command before opening a database or reading a feedback file.
  if (
    ["init", "inspect", "accept-terms", "advance", "resume"].includes(action) &&
    tail.length !== 0
  )
    throw new Error(usage);
  if (action === "report" && tail.length > 1) throw new Error(usage);
  if (action === "report" && tail[0]) revision(tail[0]);
  if (action === "review") {
    if (tail.length !== 4 || tail[2] !== "--feedback-file")
      throw new Error(usage);
    revision(tail[0]);
    choice(tail[1], ["accept", "revise"]);
  }
  if (action === "dispute") {
    if (tail.length !== 5 || tail[1] !== "--by" || tail[3] !== "--reason-file")
      throw new Error(usage);
    revision(tail[0]);
    choice(tail[2], ["steward", "neighbor"]);
  }
  if (action === "resolve") {
    if (tail.length !== 4 || tail[2] !== "--reason-file")
      throw new Error(usage);
    revision(tail[0]);
    choice(tail[1], ["return-to-review", "revise"]);
  }
  const path = resolve(directory);
  if (action !== "init" && !existsSync(join(path, "record.db")))
    throw new Error("Commission development database does not exist");
  const runtime = openRuntime(path);
  try {
    const verification = runtime.store.verify();
    if (!verification.valid) throw new Error(verification.errors.join("\n"));
    const workflow = new CommissionWorkflow(runtime.service);
    let result: unknown;
    switch (action) {
      case "init":
        result = workflow.initialize();
        break;
      case "inspect":
        result = workflow.inspect();
        break;
      case "accept-terms":
        result = workflow.acceptTerms();
        break;
      case "advance":
      case "resume":
        result = await workflow.advance();
        break;
      case "report":
        result = workflow.report(tail[0] ? revision(tail[0]) : undefined);
        break;
      case "review":
        result = await workflow.review(
          revision(tail[0]),
          choice(tail[1], ["accept", "revise"]),
          readFileSync(tail[3]!, "utf8"),
        );
        break;
      case "dispute":
        result = workflow.dispute(
          revision(tail[0]),
          readFileSync(tail[4]!, "utf8"),
          tail[2] === "steward" ? fixtureActor : fixtureNeighbor,
        );
        break;
      case "resolve":
        result = workflow.resolve(
          revision(tail[0]),
          choice(tail[1], ["return-to-review", "revise"]),
          readFileSync(tail[3]!, "utf8"),
        );
        break;
    }
    if (json) process.stdout.write(canonicalJson(result) + "\n");
    else if (action === "report")
      process.stdout.write(
        (result as ReturnType<CommissionWorkflow["report"]>).report + "\n",
      );
    else {
      const summary = result as ReturnType<CommissionWorkflow["inspect"]>;
      process.stdout.write(
        `Archival storage commission — disposable development fixture\nStatus: ${summary.commission.status}\nObligation: ${summary.commitment.status}\nSteward: ${summary.actorLifecycle}\nDelivered revisions: ${summary.commission.deliveries.length}\nNext: ${summary.nextAction}\n`,
      );
      if (summary.latestArtifactPath)
        process.stdout.write(`Latest report: ${summary.latestArtifactPath}\n`);
    }
  } finally {
    runtime.db.close();
  }
}
