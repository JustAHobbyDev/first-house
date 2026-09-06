import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadHistory } from "./history.js";
import { ConsoleSession } from "./session.js";
import { object } from "./rpc.js";

interface TailnetAccess {
  origin: string;
  login: string;
}

export function tailnetAccess(value: unknown): TailnetAccess {
  const config = object(value);
  if (
    typeof config.origin !== "string" ||
    typeof config.login !== "string" ||
    !config.login.trim()
  )
    throw new Error(
      "Tailnet access requires an origin and an exact Tailscale login",
    );
  const url = new URL(config.origin);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !url.hostname.endsWith(".ts.net") ||
    url.origin !== config.origin
  )
    throw new Error(
      "Tailnet origin must be an HTTP(S) .ts.net origin without a path",
    );
  return { origin: url.origin, login: config.login };
}

async function body(request: IncomingMessage) {
  if (request.headers["content-type"] !== "application/json")
    throw new Error("Expected application/json");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.from(chunk as Uint8Array);
    size += bytes.length;
    if (size > 140_000) throw new Error("Request too large");
    chunks.push(bytes);
  }
  return object(JSON.parse(Buffer.concat(chunks).toString("utf8")));
}

export async function startConsole(
  session: ConsoleSession,
  options: {
    port?: number;
    token?: string;
    assets?: string;
    tailnet?: TailnetAccess;
  } = {},
) {
  const tailnet = options.tailnet ? tailnetAccess(options.tailnet) : undefined;
  const token = options.token ?? randomBytes(32).toString("hex");
  const expected = Buffer.from(`Bearer ${token}`);
  const assets =
    options.assets ??
    fileURLToPath(new URL("../../../src/console/web/", import.meta.url));
  const streams = new Set<ServerResponse>();
  const blocked = new Set<ServerResponse>();
  const dirty = new Set<ServerResponse>();
  let origin = "";
  const snapshot = () => JSON.stringify(session.state);
  const push = (stream: ServerResponse) => {
    if (blocked.has(stream)) {
      dirty.add(stream);
      return;
    }
    if (!stream.write(`data: ${snapshot()}\n\n`)) {
      blocked.add(stream);
      stream.once("drain", () => {
        blocked.delete(stream);
        if (dirty.delete(stream) && streams.has(stream)) push(stream);
      });
    }
  };
  session.onChange = () => {
    for (const stream of streams) push(stream);
  };
  const server = createServer((request, response) => {
    void (async () => {
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("Referrer-Policy", "no-referrer");
      response.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      );
      const json = (status: number, value: unknown) => {
        response.writeHead(status, { "Content-Type": "application/json" });
        response.end(JSON.stringify(value));
      };
      const viaTailnet =
        !!tailnet && request.headers.host === new URL(tailnet.origin).host;
      const requestOrigin = viaTailnet ? tailnet!.origin : origin;
      if (
        request.headers.host !== new URL(requestOrigin).host ||
        (request.headers.origin && request.headers.origin !== requestOrigin)
      ) {
        json(403, { error: "Local same-origin access required" });
        return;
      }
      // Only the loopback listener trusts Serve's identity header. Tailscale
      // strips client-supplied copies before adding the authenticated identity.
      const tailnetAuthenticated =
        viaTailnet &&
        request.socket.remoteAddress === "127.0.0.1" &&
        request.headers["tailscale-user-login"] === tailnet!.login;
      if (viaTailnet && !tailnetAuthenticated) {
        json(403, {
          error:
            "This console is restricted to the Regent's Tailscale identity.",
        });
        return;
      }
      const url = new URL(request.url ?? "/", requestOrigin);
      const staticFiles: Record<string, [string, string]> = {
        "/": ["index.html", "text/html"],
        "/app.js": ["app.js", "text/javascript"],
        "/style.css": ["style.css", "text/css"],
      };
      const asset = staticFiles[url.pathname];
      if (request.method === "GET" && asset) {
        response.writeHead(200, {
          "Content-Type": asset[1] + "; charset=utf-8",
        });
        response.end(readFileSync(join(assets, asset[0])));
        return;
      }
      const supplied = Buffer.from(request.headers.authorization ?? "");
      if (request.headers["sec-fetch-site"] === "cross-site") {
        json(403, { error: "Local same-origin access required" });
        return;
      }
      if (
        !tailnetAuthenticated &&
        (supplied.length !== expected.length ||
          !timingSafeEqual(supplied, expected))
      ) {
        json(401, {
          error: "Open the private launch file printed by the console command.",
        });
        return;
      }
      try {
        if (request.method === "GET" && url.pathname === "/api/state") {
          json(200, session.state);
          return;
        }
        if (request.method === "GET" && url.pathname === "/api/history") {
          json(
            200,
            session.records.map(({ text: _text, ...record }) => record),
          );
          return;
        }
        if (request.method === "GET" && url.pathname === "/api/record") {
          json(200, session.record(url.searchParams.get("id")));
          return;
        }
        if (request.method === "GET" && url.pathname === "/api/events") {
          response.writeHead(200, {
            "Content-Type": "text/event-stream",
            Connection: "keep-alive",
          });
          streams.add(response);
          push(response);
          response.on("close", () => {
            streams.delete(response);
            blocked.delete(response);
            dirty.delete(response);
          });
          return;
        }
        if (request.method === "POST") {
          const value = await body(request);
          if (url.pathname === "/api/select") session.select(value.recordId);
          else if (url.pathname === "/api/connect") await session.connect();
          else if (url.pathname === "/api/message")
            await session.submit(value.text, value.recordId);
          else if (url.pathname === "/api/interrupt") await session.interrupt();
          else {
            json(404, { error: "Unknown action" });
            return;
          }
          json(200, session.state);
          return;
        }
        json(404, { error: "Not found" });
      } catch (error) {
        json(400, {
          error: error instanceof Error ? error.message : "Request failed",
        });
      }
    })().catch(() => {
      if (!response.headersSent) response.writeHead(500);
      response.end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 4310, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No listener address");
  origin = `http://127.0.0.1:${address.port}`;
  return {
    origin,
    token,
    close: async () => {
      for (const stream of streams) stream.destroy();
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      session.close();
    },
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = process.cwd();
  const directory = resolve(root, "var/dev-regent-console");
  let session: ConsoleSession | undefined;
  try {
    const accessFile = join(directory, "tailnet.json");
    const tailnet = existsSync(accessFile)
      ? tailnetAccess(JSON.parse(readFileSync(accessFile, "utf8")))
      : undefined;
    session = new ConsoleSession(loadHistory(root), root, directory);
    const app = await startConsole(session, tailnet ? { tailnet } : {});
    const launch = join(directory, "open-console.html");
    writeFileSync(
      launch,
      `<!doctype html><meta charset="utf-8"><title>Open Regent console</title><a href="${app.origin}/#${app.token}">Open the Regent console</a>`,
      { mode: 0o600 },
    );
    console.log(
      `Regent console: ${app.origin}\nOpen this private file in your browser, then follow its link:\n${launch}\nReader only until you connect Codex and send a message. Ctrl-C stops the console.`,
    );
    if (tailnet)
      console.log(
        `Tailnet console: ${tailnet.origin} (requires Tailscale Serve and the configured Regent identity)`,
      );
    let stopping = false;
    const stop = () => {
      if (!stopping) {
        stopping = true;
        void app.close();
      }
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  } catch (error) {
    session?.close();
    console.error(error instanceof Error ? error.message : "Console failed");
    process.exitCode = 1;
  }
}
