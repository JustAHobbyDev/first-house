import { digest, type HistoryRecord } from "../src/console/history.js";
import { object, type ObjectValue, type Rpc } from "../src/console/rpc.js";

export const consoleRecords: HistoryRecord[] = ["first", "second"].map(
  (name) => {
    const text = `# ${name}\n\nOriginal <script>window.sourceExecuted = true</script>\n`;
    return {
      id: `dev:console-test/${name}.md`,
      archive: "dev:console-test",
      path: `${name}.md`,
      sha256: digest(Buffer.from(text)),
      text,
      participants: ["Steward"],
      manifests: [],
    };
  },
);

/** Explicit protocol fixture, never used by the runnable console. */
export class FixtureRpc implements Rpc {
  onNotification: Rpc["onNotification"] = () => {};
  onRequest: Rpc["onRequest"] = async () => ({});
  onClose = () => {};
  calls: { method: string; params: ObjectValue }[] = [];
  turns: ObjectValue[] = [];
  failSend = false;
  async request(method: string, params: ObjectValue): Promise<ObjectValue> {
    this.calls.push({ method, params });
    if (method === "account/read") return { account: { type: "chatgpt" } };
    if (method === "mcpServerStatus/list")
      return { data: [{ name: "inherited-tool" }], nextCursor: null };
    if (method === "thread/start" || method === "thread/resume")
      return { thread: { id: "console-test-thread", turns: this.turns } };
    if (method === "turn/start") {
      if (this.failSend) throw new Error("Lost response");
      this.onNotification("turn/started", {
        threadId: "console-test-thread",
        turn: { id: "turn-1" },
      });
      return { turn: { id: "turn-1" } };
    }
    if (method === "turn/interrupt") {
      this.finish("interrupted");
      return {};
    }
    throw new Error(`Unexpected RPC: ${method}`);
  }
  delta(text: string) {
    this.onNotification("item/agentMessage/delta", {
      threadId: "console-test-thread",
      itemId: "assistant-1",
      delta: text,
    });
  }
  finish(status = "completed") {
    this.onNotification("turn/completed", {
      threadId: "console-test-thread",
      turn: { id: "turn-1", status },
    });
  }
  async navigate(recordId: string) {
    return this.onRequest("item/tool/call", {
      threadId: "console-test-thread",
      turnId: "turn-1",
      callId: "call-1",
      namespace: null,
      tool: "house_history",
      arguments: { action: "select", recordId },
    });
  }
  sentInput() {
    return object(
      this.calls.find((call) => call.method === "turn/start")?.params,
    );
  }
  close() {
    this.onClose();
  }
}
