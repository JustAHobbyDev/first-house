// A real process exits after a committed checkpoint to exercise restart recovery.
import { openRuntime } from "../src/cli/scenario.js";
import { CommissionWorkflow } from "../src/commissions/workflow.js";

const [directory, point] = process.argv.slice(2);
if (!directory || !point)
  throw new Error("Expected directory and crash checkpoint");
const runtime = openRuntime(directory);
try {
  const workflow = new CommissionWorkflow(runtime.service, {
    checkpoint: (current) => {
      if (current === point) process.exit(86);
    },
  });
  if (point === "review")
    await workflow.review(
      1,
      "accept",
      "Fixture Neighbor accepts the cited comparison and residual risk.",
    );
  else await workflow.advance();
  throw new Error("Requested checkpoint was not reached");
} finally {
  runtime.db.close();
}
