import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { object, string, type ObjectValue } from "./rpc.js";

export interface MemberProcess {
  readonly exited?: Promise<void>;
  send(input: string): Promise<ObjectValue>;
  close(): void;
}

/** One independent conversation over Claude's newline-delimited JSON protocol. */
export class ClaudeProcess implements MemberProcess {
  readonly exited: Promise<void>;
  private readonly child: ChildProcessWithoutNullStreams;
  private pending:
    | { resolve: (value: ObjectValue) => void; reject: (error: Error) => void }
    | undefined;
  private ended = false;
  constructor(cwd: string, systemPrompt: string, sessionId?: string) {
    this.child = spawn(
      "claude",
      [
        "-p",
        "--safe-mode",
        "--tools",
        "",
        "--disable-slash-commands",
        "--input-format",
        "stream-json",
        "--output-format",
        "stream-json",
        "--verbose",
        "--system-prompt",
        systemPrompt,
        ...(sessionId ? ["--resume", sessionId] : []),
      ],
      { cwd, stdio: "pipe" },
    );
    this.child.stderr.resume();
    this.exited = new Promise((resolve) =>
      this.child.once("close", () => resolve()),
    );
    const fail = () => {
      this.ended = true;
      this.pending?.reject(
        new Error(
          "Claude process ended; the outcome may be uncertain. The message will not be resent.",
        ),
      );
      this.pending = undefined;
    };
    this.child.on("error", fail);
    this.child.on("close", fail);
    this.child.stdin.on("error", fail);
    const lines = createInterface({ input: this.child.stdout });
    lines.on("line", (line) => {
      try {
        const event = object(JSON.parse(line));
        if (event.type !== "result" || !this.pending) return;
        const pending = this.pending;
        this.pending = undefined;
        pending.resolve(event);
      } catch {
        this.close();
      }
    });
  }
  send(input: string): Promise<ObjectValue> {
    if (this.ended || this.pending)
      return Promise.reject(
        new Error("Claude is unavailable or already responding"),
      );
    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject };
      this.child.stdin.write(
        JSON.stringify({
          type: "user",
          session_id: "",
          parent_tool_use_id: null,
          message: { role: "user", content: string(input) },
        }) + "\n",
      );
    });
  }
  close() {
    if (this.ended) return;
    this.ended = true;
    const responding = !!this.pending;
    this.pending?.reject(
      new Error(
        "Response stopped; the outcome may be uncertain. The message will not be resent.",
      ),
    );
    this.pending = undefined;
    if (responding) this.child.kill("SIGTERM");
    else {
      // Let completed turns flush to Claude's own session store before exit.
      this.child.stdin.end();
      const timer = setTimeout(() => this.child.kill("SIGTERM"), 3000);
      timer.unref();
      void this.exited.then(() => clearTimeout(timer));
    }
  }
}
