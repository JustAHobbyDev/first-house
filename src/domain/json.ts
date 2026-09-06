import { createHash } from "node:crypto";

export type Json =
  null | boolean | number | string | Json[] | { [key: string]: Json };

/** Sorted object keys; array order preserved; rejects lossy/non-JSON values. */
export function canonicalJson(value: unknown): string {
  const seen = new Set<object>();
  function encode(v: unknown): string {
    if (v === null || typeof v === "boolean" || typeof v === "string")
      return JSON.stringify(v);
    if (typeof v === "number" && Number.isFinite(v)) return JSON.stringify(v);
    if (typeof v !== "object" || v === null) throw new Error("Non-JSON value");
    if (seen.has(v)) throw new Error("Cyclic JSON");
    seen.add(v);
    let result: string;
    if (Array.isArray(v)) {
      result = "[" + Array.from(v, encode).join(",") + "]";
    } else {
      if (
        Object.getPrototypeOf(v) !== Object.prototype &&
        Object.getPrototypeOf(v) !== null
      )
        throw new Error("Non-plain JSON object");
      result =
        "{" +
        Object.keys(v)
          .sort()
          .map(
            (key) =>
              JSON.stringify(key) +
              ":" +
              encode((v as Record<string, unknown>)[key]),
          )
          .join(",") +
        "}";
    }
    seen.delete(v);
    return result;
  }
  return encode(value);
}

export function digest(bytes: string | Uint8Array): string {
  return "sha256:" + createHash("sha256").update(bytes).digest("hex");
}

export function clone<T>(value: T): T {
  return JSON.parse(canonicalJson(value)) as T;
}
