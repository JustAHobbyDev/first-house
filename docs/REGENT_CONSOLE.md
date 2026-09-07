# Regent web console

The console is a local development surface for the human Regent to read preserved
history, converse privately with a Codex assistant, and participate as Regent in
the separately authorized interactive House test. No canonical House has been
born. The House runtime still uses its fake adapter. The private Codex conversation
remains separate from the Claude member conversations described below.

## Interactive House test

Select **House test** in the conversation panel. **Start members** launches one
headless Claude process each for Steward, Witness, and Dreamer. The Regent opens
the new situation in the message box. **Responders** selects all three or one
member; each send runs one turn for the selected members, with no automatic next
round. Ctrl/Command+Enter sends. **Stop** ends the member processes.

All test statements are shared correspondence. A member receives the statements
it has not yet been shown when its next turn starts. Members selected together
receive the same round boundary; their replies become available to one another
on a subsequent turn. Choosing a responder is not a private-message function.
No model runs merely from reading, selecting records, or opening a panel.

Each member begins with the exact preserved creation myth, visibly DRAFT /
UNRATIFIED. The custom system prompt supplies its development identity, the
human's Regent role, the JSON transport, and the boundary that it speaks only
for itself and has no tools or real-world effects. It contains no interpretation
of the myth or situation. Prior test outcomes, purpose essays, facilitator
summaries, archive selections, and private Codex chat are not inserted. The
original source and hash can be downloaded under **Context and participants**.

Claude runs with `-p --input-format stream-json --output-format stream-json
--verbose --safe-mode --tools '' --disable-slash-commands` and the explicit custom
system prompt. Each process has its own directory and session. Safe mode disables
project instructions, hooks, plugins, memories, and inherited MCP configurations.
These are separate conversations, not OS-isolated identities or an independent
Witness authority. The console displays final response text, not hidden reasoning.

The separate `var/dev-regent-console/house-test/experiment.sqlite` records source
bytes, system prompts, exact submitted JSON strings, provider results, public
statements, and starts/stops. Inputs are committed before any member call. Stored
events have update/delete guards; this is a local development record without
independent custody or the runtime's hash-chain guarantees. It is not a Chronicle.
Claude also needs write access to its own session storage under `~/.claude`.

Completed conversations can resume using their own saved Claude session IDs.
An interrupted, failed, or otherwise uncertain turn blocks automatic continuation
and is never resent. The transcript and pending input remain available for
inspection; outcome recovery is not yet automated. Reloading the browser retains
the transcript and selected conversation tab without invoking members.

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

The interface follows the Regent console template in the user-supplied
`RegnetConsoleRedesign.zip`: a light reading surface, collapsible side panels,
floating controls, and a compact status bar. Details remain in the provenance
disclosure. Its Source Sans 3 and IBM Plex Mono fonts are served locally.
The design's example prose, simulated statuses, copied databases, and access files
are not imported into the application.

Keyboard controls outside text fields: **F** toggles records, **C** toggles Codex,
**← / →** select the previous/next record, **T** cycles text size, and **.** hides
or reveals the reading dock. The dock hides while scrolling down and returns when
scrolling up; pin it to keep it visible. On small screens, records and chat open
as drawers; Escape closes them. **?** opens a floating shortcut reference; press
**?** again or Escape to close it. Ctrl/Command+Enter sends from the composer.

Markdown originals use a limited display renderer for headings, paragraphs,
emphasis, code, lists, quotes, tables, and links. Source HTML is rendered as text,
and images are not fetched. The provenance disclosure offers **Show source text**;
downloads and chat attachments continue to use the exact original bytes/text.

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
Both imported rehearsals are complete. The separate live House-test status reports
the new Claude experiment; it does not change the archived history. There is no
runtime replay/branching or token-level debugger in this slice.

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
and reconciles assistant messages within their original submission and turn,
including a final response missed
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
