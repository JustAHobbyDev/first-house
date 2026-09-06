import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { digest } from "../domain/json.js";
import { hashRef } from "../domain/validation.js";

export class ArtifactStore {
  constructor(readonly root: string) {
    mkdirSync(root, { recursive: true });
  }
  path(ref: string): string {
    return join(this.root, hashRef(ref).slice(7));
  }
  put(body: string | Uint8Array): string {
    const bytes =
      typeof body === "string" ? Buffer.from(body, "utf8") : Buffer.from(body);
    const ref = digest(bytes);
    if (this.has(ref)) {
      if (!this.get(ref).equals(bytes))
        throw new Error("Existing artifact does not match bytes");
      return ref;
    }
    const temporary = join(this.root, `.pending-${randomUUID()}`);
    const fd = openSync(temporary, "wx", 0o444);
    try {
      try {
        writeFileSync(fd, bytes);
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      try {
        linkSync(temporary, this.path(ref));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        if (!this.get(ref).equals(bytes))
          throw new Error("Existing artifact does not match bytes");
      }
    } finally {
      unlinkSync(temporary);
    }
    const dir = openSync(this.root, "r");
    try {
      fsyncSync(dir);
    } finally {
      closeSync(dir);
    }
    return ref;
  }
  get(ref: string): Buffer {
    const bytes = readFileSync(this.path(ref));
    if (digest(bytes) !== ref)
      throw new Error(`Artifact integrity failure: ${ref}`);
    return bytes;
  }
  text(ref: string): string {
    return this.get(ref).toString("utf8");
  }
  has(ref: string): boolean {
    return existsSync(this.path(ref));
  }
  verify(ref: string): boolean {
    try {
      this.get(ref);
      return true;
    } catch {
      return false;
    }
  }
}
