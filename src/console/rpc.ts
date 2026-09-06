import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";

export type ObjectValue = Record<string, unknown>;
export function object(value: unknown): ObjectValue {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected an object");
  return value as ObjectValue;
}
export function string(value: unknown): string {
  if (typeof value !== "string") throw new Error("Expected text");
  return value;
}
export interface Rpc {
  request(method: string, params: ObjectValue): Promise<ObjectValue>;
  onNotification: (method: string, params: ObjectValue) => void;
  onRequest: (method: string, params: ObjectValue) => Promise<ObjectValue>;
  onClose: () => void;
  close(): void;
}

/** The small protocol surface here was checked against codex-cli 0.153.2 generate-ts. */
export class AppServer implements Rpc {
  onNotification: Rpc["onNotification"] = () => {};
  onRequest: Rpc["onRequest"] = async () => {
    throw new Error("Unsupported request");
  };
  onClose = () => {};
  private serial = 0;
  private stopped = false;
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<
    number,
    {
      resolve: (value: ObjectValue) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  constructor(cwd: string) {
    const disabled = [
      "apps",
      "plugins",
      "hooks",
      "shell_tool",
      "unified_exec",
      "multi_agent",
      "multi_agent_v2",
      "code_mode",
      "browser_use",
      "computer_use",
      "image_generation",
    ];
    this.child = spawn(
      "codex",
      [
        "app-server",
        "--listen",
        "stdio://",
        "-c",
        "mcp_servers={}",
        ...disabled.flatMap((name) => ["--disable", name]),
      ],
      { cwd, stdio: "pipe" },
    );
    // Do not forward raw process diagnostics (which may contain account/config data).
    this.child.stderr.resume();
    this.child.stdin.on("error", () => this.close());
    this.child.on("error", () => this.close());
    this.child.on("exit", () => this.close());
    createInterface({ input: this.child.stdout }).on("line", (line) => {
      void this.receive(line).catch(() => this.close());
    });
  }

  async initialize() {
    await this.request("initialize", {
      clientInfo: { name: "first_house_regent", version: "0.1.0" },
      capabilities: { experimentalApi: true },
    });
    this.send({ method: "initialized" });
  }

  private send(message: ObjectValue) {
    if (this.stopped) throw new Error("Codex disconnected");
    this.child.stdin.write(JSON.stringify(message) + "\n");
  }

  request(method: string, params: ObjectValue): Promise<ObjectValue> {
    if (this.stopped) return Promise.reject(new Error("Codex disconnected"));
    const id = ++this.serial;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            `Codex ${method} timed out; reconnect to inspect the stored thread before retrying.`,
          ),
        );
        this.close();
      }, 30_000);
      this.pending.set(id, { resolve, reject, timer });
      this.send({ id, method, params });
    });
  }

  private async receive(line: string) {
    const message = object(JSON.parse(line));
    if (typeof message.method === "string") {
      const params = object(message.params ?? {});
      if (message.id !== undefined) {
        try {
          this.send({
            id: message.id,
            result: await this.onRequest(message.method, params),
          });
        } catch {
          this.send({
            id: message.id,
            error: {
              code: -32601,
              message: "Not supported by the Regent reading console",
            },
          });
        }
      } else this.onNotification(message.method, params);
    } else if (typeof message.id === "number") {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error)
        pending.reject(new Error(string(object(message.error).message)));
      else pending.resolve(object(message.result));
    }
  }

  close() {
    if (this.stopped) return;
    this.stopped = true;
    this.child.kill();
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(
        new Error(
          "Codex disconnected; reconnect to inspect the stored thread.",
        ),
      );
    }
    this.pending.clear();
    this.onClose();
  }
}
