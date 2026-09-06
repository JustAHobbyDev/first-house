# Regent web console

The console is a local development surface for the human Regent to read preserved
history and converse privately with a Codex assistant. No canonical House has been
born. The House runtime still uses its fake adapter. This separate operator
integration does not invoke inhabitants or enter correspondence into their context.

## Run locally

```sh
pnpm console
```

The server binds only to `http://127.0.0.1:4310`. Open the printed private
`var/dev-regent-console/open-console.html` file in your browser and follow its
link. The file contains a fresh local access token; keep it private. The browser
removes the token from its address bar and retains it in session storage. Reopen
the launch file after restarting the server. Stop the process with Ctrl-C.

The reader works without Codex. **Connect Codex** starts a private stdio App Server
process and creates or resumes only this console's stored operator thread. A model
turn starts when you send a message. The installation must already have a working
Codex login; if needed, use `codex login` in your terminal. The console never reads
credential files or sends provider credentials to the browser.

This is a **separate conversation** from the host Codex session. There is no import
or transfer of that active session, its unrecorded context, or its tool permissions.
The installed Codex model configuration supplies the model. Live operator turns
use the existing account's provision. No persistent backend service or public
exposure has been configured.

## Access over the tailnet

The Regent authorized private remote access on 6 September 2026. The console is
available at **http://anvil.tail9f1965.ts.net:4311/** from the Regent's personal
Tailscale devices. There is no launch file or token to copy for this route.
The HTTP connection travels within Tailscale's encrypted network.

Tailscale Serve proxies to the loopback backend and supplies the requester's
verified identity. The console accepts only the configured Regent login, checks
the exact origin, and rejects missing or other identities. Tagged devices have no
personal identity header and cannot use this route. See
[Tailscale Serve identity headers](https://tailscale.com/docs/features/tailscale-serve#identity-headers).

The ignored `var/dev-regent-console/tailnet.json` configures `origin` and `login`;
it contains no credential. `pnpm console` reads it at startup. The route was
configured with:

```sh
tailscale serve --bg --http=4311 http://127.0.0.1:4310
```

This Serve route survives CLI exit. The backend must also be running; it is still
a foreground development process. Stop just this route with
`tailscale serve --http=4311 off`. Do not use Funnel or broaden the backend bind
address: identity headers are trusted only from the loopback proxy. Direct local
access continues to require the private launch token.

## Reading together

The history pane reuses source and participant mappings from the two existing
documentary readers. It loads all 66 originals from the archived First Council and
The Promise and the Door rehearsals. Source paths and content are preserved;
manifest hashes are checked before serving. Startup fails if an archive is missing
or a listed file no longer matches. These ignored archives must be available on
the local machine; a fresh source checkout does not contain them.

Previous/next move through the filtered documentary reading order. That order is
not a claim about speech order within parallel rounds. Participant history links
do not independently establish authorship or recipients. Original text and linked
stage/source manifests expose the recorded provenance, including original capture
timestamps. The archive manifests' own hashes are computed locally; none of these
checks establishes independent custody or complete model context.

The reading position is shared across authenticated browser tabs and Codex's
`house_history` tool. That tool can list, read, and select known records. Moving the
selection does not start a model turn, change House history, or execute effects.
The live boundary is displayed separately: no House execution is attached, and
both imported rehearsals are complete. There is no House pause/continue control,
regeneration, branching, or token-level debugger in this slice.

Sending explicitly includes the user's exact message and the selected original's
full text, source ID, path, and SHA-256. The console records those exact inputs
before `turn/start`. Subsequent navigation does not change that submitted input.
Messages contain a link back to the original selected at submission. Codex's
interpretations remain in the private conversation, separate from the originals.

## Persistence and recovery

`var/dev-regent-console/operator.sqlite` holds the operator transcript, selection,
console-owned thread ID, and exact submissions. It is separate from every House
event store and is not a Chronicle or a canonical record. UI state is mutable;
this database does not claim the House event store's append-only guarantees.
Submission and transcript persistence share a transaction before invocation.

Codex also persists its own thread history. Reconnecting resumes the stored thread
and reconciles assistant messages by item ID, including a final response missed
while disconnected. A running stored turn blocks a second submission. Stop response
uses `turn/interrupt`; stopping a response does not undo prior activity.

A failed or timed-out send can have an uncertain outcome. The console retains the
submission and disconnects without automatically resending it. Reconnect to inspect
the stored thread before deciding what to send next. A SQLite writer lease prevents
two consoles from owning the same state directory. Its operating-system lock is
released on exit, including process failure.

## Integration and access boundary

The implementation follows the [official Codex App Server documentation](https://learn.chatgpt.com/docs/app-server)
and the TypeScript schema generated by installed `codex-cli 0.153.2` with
`codex app-server generate-ts --experimental`. App Server and dynamic tools are
experimental; protocol changes require rechecking this integration.

The backend exposes a small HTTP action allowlist, not an arbitrary RPC proxy.
It uses a random per-process bearer token, constant-time credential comparison,
Host and Origin checks, no cross-origin access, bounded request bodies, and a
restrictive content security policy. Source/model text renders through text nodes;
it is never executable HTML. Streaming state reconnects through an authenticated
HTTP event stream.

Threads use the read-only sandbox and `approvalPolicy: never`. Shell tools,
apps/plugins, hooks, multi-agent tools, browser/computer use, and image generation
are disabled; inherited MCP server entries are explicitly disabled for the thread.
An empty MCP table alone does not remove inherited definitions. Web search is
disabled. Code Mode host stays enabled because this installed version requires it
to dispatch dynamic tools. Only `house_history` requests for the console's own
thread are handled; unsupported server requests receive errors, never approval.

These are operator integration settings, not new House law. The local Codex process
and trusted local user remain part of the trust boundary. This first slice does
not offer shell approvals, project editing, or unrestricted host-tool parity.

## Verification

```sh
pnpm check
pnpm test:console-browser
```

The browser check uses native Node WebSocket/CDP and an installed Chromium. Set
`REGENT_TEST_CHROME` if its default cached executable is unavailable. It installs
nothing and uses an explicitly named protocol fixture for chat. It checks original
text and downloads, navigation, search, text size, shared selection, streaming,
interruption, browser reload, markup safety, and desktop/mobile overflow.

Unit/integration checks cover manifest corruption and symlink escape, absence of
model calls on navigation, exact submission capture, capability and thread bounds,
concurrent-turn rejection, restart reconciliation, uncertain sends, writer locking,
HTTP authentication, Origin/Host checks, unknown actions, and request limits.
Live account/thread and model checks are separate from this offline suite; passing
fixture tests alone does not establish a working live model connection.

On 6 September 2026, a separate bounded live check succeeded with the installed
CLI and existing ChatGPT login: Codex selected the requested original through
`house_history`, returned its ID/hash, and retained that response when a fresh
backend resumed the same console-owned thread. The active host conversation was
not resumed or transferred.
