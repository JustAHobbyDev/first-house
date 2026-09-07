import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { ClaudeProcess, type MemberProcess } from "./claude.js";
import { object, string } from "./rpc.js";

const names = ["Steward", "Witness", "Dreamer"] as const;
type Name = (typeof names)[number];
interface Entry {
  id: string;
  author: string;
  text: string;
  at: string;
}
interface Member {
  name: Name;
  id: string;
  sessionId?: string;
  seen: number;
  status: string;
}
export interface HouseState {
  revision: number;
  id: string;
  running: boolean;
  busy: boolean;
  status: string;
  members: Member[];
  messages: Entry[];
}
export type MemberFactory = (
  cwd: string,
  system: string,
  sessionId?: string,
) => MemberProcess;

/** Disposable, Regent-directed experiment; separate from the House runtime. */
export class HouseExperiment {
  readonly state: HouseState;
  readonly context: { source: string; sha256: string; text: string };
  onChange = () => {};
  private readonly db: DatabaseSync;
  private readonly processes = new Map<Name, MemberProcess>();
  private closed = false;
  private uncertain = false;
  private stopping = false;
  constructor(
    root: string,
    private readonly directory: string,
    private readonly factory: MemberFactory = (cwd, system, sessionId) =>
      new ClaudeProcess(cwd, system, sessionId),
  ) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(join(directory, "experiment.sqlite"));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS events (sequence INTEGER PRIMARY KEY, body TEXT NOT NULL);
      CREATE TRIGGER IF NOT EXISTS no_event_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT, 'append only'); END;
      CREATE TRIGGER IF NOT EXISTS no_event_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT, 'append only'); END;`);
    const events = this.db
      .prepare("SELECT body FROM events ORDER BY sequence")
      .all()
      .map((row) => object(JSON.parse(string(row.body))));
    const initial = events[0];
    const source = "canon/drafts/creation-myth.md";
    const text = initial
      ? string(object(initial.context).text)
      : readFileSync(join(root, source), "utf8");
    this.context = {
      source,
      text,
      sha256: createHash("sha256").update(text).digest("hex"),
    };
    this.state = {
      revision: events.length,
      id: initial
        ? string(initial.id)
        : `dev:interactive-house:${randomUUID()}`,
      running: false,
      busy: false,
      status: "Ready to start",
      messages: [],
      members: names.map((name) => ({
        name,
        id: `dev:interactive:${name.toLowerCase()}`,
        seen: 0,
        status: "Stopped",
      })),
    };
    const pending = new Set<string>();
    for (const event of events) {
      if (event.kind === "message")
        this.state.messages.push(object(event.entry) as unknown as Entry);
      if (event.kind === "input") pending.add(string(event.id));
      if (event.kind === "result") {
        pending.delete(string(event.id));
        const member = this.state.members.find(
          (member) => member.name === event.member,
        )!;
        const result = object(event.result);
        if (typeof result.session_id === "string")
          member.sessionId = result.session_id;
        if (result.is_error !== true) member.seen = Number(event.seen);
        else this.uncertain = true;
        if (event.entry)
          this.state.messages.push(object(event.entry) as unknown as Entry);
      }
      if (event.kind === "failure") this.uncertain = true;
    }
    this.uncertain ||= pending.size > 0;
    if (!initial)
      this.record({
        kind: "created",
        id: this.state.id,
        context: this.context,
        prompts: this.state.members.map((member) => ({
          member: member.name,
          text: this.system(member),
        })),
      });
    if (this.uncertain)
      this.state.status =
        "A prior response has an uncertain outcome. Transcript retained; automatic resume is blocked.";
  }
  private system(member: Member) {
    return `You are ${member.name} (${member.id}) in a fictional, noncanonical House development test. The human participant is Regent. You speak only as ${member.name}; do not write other participants' speech. Input arrives as JSON containing original source material and shared correspondence. Your reply is your own contribution to that shared conversation. No real-world actions or tools are available. No canonical House, member, or Seat is constituted by this test.`;
  }
  private record(event: Record<string, unknown>) {
    this.db
      .prepare("INSERT INTO events(body) VALUES(?)")
      .run(JSON.stringify({ ...event, recordedAt: new Date().toISOString() }));
    this.state.revision++;
  }
  private changed() {
    if (!this.closed) this.onChange();
  }
  start() {
    if (this.stopping)
      throw new Error("Claude processes are still stopping; try again shortly");
    if (this.closed || this.uncertain)
      throw new Error(
        "This experiment cannot resume automatically after an uncertain outcome",
      );
    if (this.state.running)
      throw new Error("House members are already running");
    this.record({
      kind: "start",
      members: this.state.members.map((member) => ({
        name: member.name,
        sessionId: member.sessionId ?? null,
        systemPrompt: this.system(member),
      })),
    });
    try {
      for (const member of this.state.members) {
        const cwd = join(this.directory, member.name.toLowerCase());
        mkdirSync(cwd, { recursive: true, mode: 0o700 });
        this.processes.set(
          member.name,
          this.factory(cwd, this.system(member), member.sessionId),
        );
        member.status = "Waiting for Regent";
      }
      this.state.running = true;
      this.state.status = "Waiting for Regent";
      this.changed();
    } catch (error) {
      this.stop();
      throw error;
    }
  }
  private message(author: string, text: string) {
    const entry = {
      id: randomUUID(),
      author,
      text,
      at: new Date().toISOString(),
    };
    this.record({ kind: "message", entry });
    this.state.messages.push(entry);
  }
  submit(text: unknown, recipients: unknown) {
    const body = string(text);
    if (!body.trim() || body.length > 32_000)
      throw new Error("Enter 1–32,000 characters");
    if (
      !Array.isArray(recipients) ||
      !recipients.length ||
      new Set(recipients).size !== recipients.length ||
      !recipients.every((name) => names.includes(name as Name))
    )
      throw new Error("Choose known House members");
    if (!this.state.running || this.state.busy || this.uncertain)
      throw new Error(
        "House members are stopped, busy, or need outcome review",
      );
    this.message("Regent", body);
    const seen = this.state.messages.length;
    this.state.busy = true;
    this.state.status = "Members responding";
    // Freeze the same public boundary for this round. Replies from this round
    // become available on a member's next turn, never injected mid-response.
    const work = this.state.members
      .filter((member) => recipients.includes(member.name))
      .map((member) => {
        const id = randomUUID();
        const input = JSON.stringify({
          ...(member.sessionId ? {} : { sources: [this.context] }),
          correspondence: this.state.messages.slice(member.seen, seen),
        });
        this.record({ kind: "input", id, member: member.name, input, seen });
        member.status = "Responding";
        return { id, input, member };
      });
    this.changed();
    void Promise.all(
      work.map(async ({ id, input, member }) => {
        try {
          const result = await this.processes.get(member.name)!.send(input);
          if (this.closed) return;
          if (result.is_error === true) {
            this.record({
              kind: "result",
              id,
              member: member.name,
              seen,
              result,
            });
            throw new Error(
              "Claude reported a failed turn; its outcome needs review",
            );
          }
          const entry = {
            id: randomUUID(),
            author: member.name,
            text: string(result.result),
            at: new Date().toISOString(),
          };
          this.record({
            kind: "result",
            id,
            member: member.name,
            seen,
            result,
            entry,
          });
          member.sessionId = string(result.session_id);
          member.seen = seen;
          this.state.messages.push(entry);
          member.status = "Waiting for Regent";
        } catch (error) {
          if (this.closed) return;
          this.uncertain = true;
          member.status =
            error instanceof Error ? error.message : "Response failed";
          this.record({
            kind: "failure",
            id,
            member: member.name,
            error: member.status,
          });
        }
        this.changed();
      }),
    ).then(() => {
      if (this.closed) return;
      this.state.busy = false;
      this.state.status = this.uncertain
        ? "Response outcome needs review; messages will not be resent"
        : this.state.running
          ? "Waiting for Regent"
          : "Stopped";
      this.state.revision++;
      this.changed();
    });
  }
  stop() {
    const exiting = [...this.processes.values()].map(
      (process) => process.exited,
    );
    this.stopping = exiting.length > 0;
    for (const process of this.processes.values()) process.close();
    this.processes.clear();
    this.state.running = false;
    for (const member of this.state.members)
      if (member.status !== "Responding") member.status = "Stopped";
    this.record({ kind: "stop" });
    this.state.status = "Stopped";
    this.changed();
    void Promise.all(exiting).then(() => {
      this.stopping = false;
    });
  }
  close() {
    if (this.closed) return;
    this.stop();
    this.closed = true;
    this.db.close();
  }
}
