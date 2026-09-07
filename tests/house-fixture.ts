import type { MemberProcess } from "../src/console/claude.js";
import type { ObjectValue } from "../src/console/rpc.js";

/** Explicit protocol fixture; never used by the runnable console. */
export class FixtureMember implements MemberProcess {
  inputs: string[] = [];
  pending:
    | { resolve: (result: ObjectValue) => void; reject: (error: Error) => void }
    | undefined;
  send(input: string): Promise<ObjectValue> {
    this.inputs.push(input);
    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject };
    });
  }
  finish(text: string, sessionId = "fixture-session") {
    this.pending!.resolve({
      type: "result",
      is_error: false,
      result: text,
      session_id: sessionId,
    });
    this.pending = undefined;
  }
  close() {
    this.pending?.reject(new Error("Fixture process stopped"));
    this.pending = undefined;
  }
}
