import { canonicalJson, digest } from "../domain/json.js";
import * as v from "../domain/validation.js";
import type { DomainService } from "../domain/service.js";
import type { CompiledContext } from "../context/compiler.js";

export interface ModelResult {
  text: string;
  intention: { capability: "artifact.write"; body: string };
}
export interface ModelAdapter {
  invoke(context: CompiledContext): Promise<ModelResult>;
}
export class FakeAdapter implements ModelAdapter {
  calls = 0;
  async invoke(context: CompiledContext): Promise<ModelResult> {
    this.calls++;
    const body = `Disposable development response for ${context.manifest.actorId}. Evidence has been received; no service was promised. No canonical House has been born.`;
    return { text: body, intention: { capability: "artifact.write", body } };
  }
}
export function recordManifest(
  service: DomainService,
  context: CompiledContext,
): void {
  if (
    digest(context.rendered) !== context.manifest.renderedRef ||
    digest(canonicalJson(context.manifest)) !== context.manifestRef
  )
    throw new Error("Compiled context integrity failure");
  const artifacts = service.store.artifacts;
  const cursorEvent = service.store.read(
    context.manifest.cursor,
    context.manifest.cursor,
  )[0];
  if (
    !cursorEvent ||
    cursorEvent.id !== context.manifest.cursorEventId ||
    cursorEvent.occurredAt !== context.manifest.asOf
  )
    throw new Error("Manifest cursor provenance mismatch");
  // Preserve omitted candidates too: the manifest must remain independently inspectable.
  for (const candidate of context.manifest.candidates)
    artifacts.get(candidate.pack.bodyRef);
  artifacts.put(context.rendered);
  artifacts.put(canonicalJson(context.manifest));
  service.record(
    {
      type: "ContextManifestCompiled",
      data: {
        actorId: context.manifest.actorId,
        manifestRef: context.manifestRef,
        renderedRef: context.manifest.renderedRef,
        cursor: context.manifest.cursor,
      },
    },
    { recordedBy: "runtime", actorId: context.manifest.actorId },
  );
}
export async function invokeRecorded(
  service: DomainService,
  context: CompiledContext,
  adapter: ModelAdapter,
): Promise<ModelResult> {
  const state = service.state();
  const manifest = state.manifests[context.manifestRef];
  if (
    !manifest ||
    manifest.actorId !== context.manifest.actorId ||
    manifest.cursor !== context.manifest.cursor ||
    manifest.renderedRef !== digest(context.rendered) ||
    digest(canonicalJson(context.manifest)) !== context.manifestRef
  )
    throw new Error("Exact manifest must be recorded before invocation");
  if (
    service.store.artifacts.text(context.manifestRef) !==
      canonicalJson(context.manifest) ||
    service.store.artifacts.text(manifest.renderedRef) !== context.rendered
  )
    throw new Error("Recorded context bytes mismatch");
  if (state.actors[manifest.actorId]?.lifecycle !== "active")
    throw new Error("Only active development actors may invoke");
  const manifestEvent = service.store
    .read()
    .find(
      (e) =>
        e.type === "ContextManifestCompiled" &&
        e.data.manifestRef === context.manifestRef,
    )!;
  // Pass a detached copy so adapters cannot alter the caller's evidence objects.
  const resultInput: unknown = await adapter.invoke(structuredClone(context));
  const result = v.object(resultInput);
  v.exact(result, ["text", "intention"]);
  const intention = v.object(result.intention);
  v.exact(intention, ["capability", "body"]);
  const parsed: ModelResult = {
    text: v.text(result.text),
    intention: {
      capability: v.choice(intention.capability, ["artifact.write"]),
      body: v.text(intention.body),
    },
  };
  const bodyRef = service.store.artifacts.put(canonicalJson(parsed));
  service.record(
    {
      type: "ModelResultRecorded",
      data: {
        actorId: manifest.actorId,
        manifestRef: context.manifestRef,
        bodyRef,
        adapter: "fake",
      },
    },
    {
      actorId: manifest.actorId,
      recordedBy: "runtime",
      causedBy: manifestEvent.id,
    },
  );
  return parsed;
}
