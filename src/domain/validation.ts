export function object(
  value: unknown,
  name = "value",
): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}
export function text(value: unknown, name = "value"): string {
  if (typeof value !== "string" || value.trim().length === 0)
    throw new Error(`${name} must be nonempty text`);
  return value;
}
export function devId(value: unknown): string {
  const id = text(value, "identity");
  if (!/^dev:[a-z][a-z0-9-]*:[a-zA-Z0-9][a-zA-Z0-9:._-]*$/.test(id))
    throw new Error("Identity must use a dev: namespace");
  return id;
}
export function hashRef(value: unknown): string {
  const ref = text(value, "artifact reference");
  if (!/^sha256:[a-f0-9]{64}$/.test(ref))
    throw new Error("Invalid SHA-256 reference");
  return ref;
}
export function integer(value: unknown, minimum = 0): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum
  )
    throw new Error(`Expected integer >= ${minimum}`);
  return value;
}
export function choice<const T extends readonly string[]>(
  value: unknown,
  choices: T,
): T[number] {
  if (typeof value !== "string" || !choices.includes(value))
    throw new Error(`Expected one of: ${choices.join(", ")}`);
  return value as T[number];
}
export function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("Expected boolean");
  return value;
}
export function array<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Error("Expected array");
  return value.map(parse);
}
export function timestamp(value: unknown): string {
  const s = text(value, "timestamp");
  if (
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s) ||
    !Number.isFinite(Date.parse(s)) ||
    new Date(s).toISOString() !== s
  )
    throw new Error("Expected UTC ISO timestamp");
  return s;
}
export function nullable<T>(
  value: unknown,
  parse: (v: unknown) => T,
): T | null {
  return value === null ? null : parse(value);
}
export function exact(
  o: Record<string, unknown>,
  keys: readonly string[],
): void {
  if (
    Object.keys(o).some((key) => !keys.includes(key)) ||
    keys.some((key) => !(key in o))
  )
    throw new Error(`Expected exactly: ${keys.join(", ")}`);
}
