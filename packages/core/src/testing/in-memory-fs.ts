import type {
  DirEntry,
  FileStat,
  FileSystemAdapter,
} from "../adapters/file-system.js";
import { EdenwrightError } from "../errors.js";
import { basename, dirname, normalizePath } from "../paths.js";

interface MemoryNode {
  kind: "file" | "directory";
  contents?: string;
  binary?: Uint8Array;
  modifiedAtMs: number;
}

/** Minimal encoder capability — every supported runtime has TextEncoder. */
declare const TextEncoder: new () => { encode(text: string): Uint8Array };
/** Minimal decoder capability — every supported runtime has TextDecoder. */
declare const TextDecoder: new () => { decode(data: Uint8Array): string };

/**
 * In-memory FileSystemAdapter for core unit tests — same contract, no disk.
 * Directories exist implicitly once created via mkdir/writeFile parents.
 */
export class InMemoryFileSystemAdapter implements FileSystemAdapter {
  private readonly nodes = new Map<string, MemoryNode>();
  private clock = 1;

  constructor() {
    this.nodes.set("/", { kind: "directory", modifiedAtMs: 0 });
  }

  private tick(): number {
    this.clock += 1;
    return this.clock;
  }

  async readFile(path: string): Promise<string> {
    const node = this.nodes.get(normalizePath(path));
    if (!node || node.kind !== "file") {
      throw new EdenwrightError("NOT_FOUND", `No such file: ${path}`);
    }
    // Binary-written files (e.g. migration copies) decode back to text.
    return (
      node.contents ?? new TextDecoder().decode(node.binary ?? new Uint8Array())
    );
  }

  async writeFile(path: string, contents: string): Promise<void> {
    const normalized = normalizePath(path);
    await this.mkdir(dirname(normalized));
    this.nodes.set(normalized, {
      kind: "file",
      contents,
      modifiedAtMs: this.tick(),
    });
  }

  async readFileBinary(path: string): Promise<Uint8Array> {
    const node = this.nodes.get(normalizePath(path));
    if (!node || node.kind !== "file") {
      throw new EdenwrightError("NOT_FOUND", `No such file: ${path}`);
    }
    return node.binary ?? new TextEncoder().encode(node.contents ?? "");
  }

  async writeFileBinary(path: string, data: Uint8Array): Promise<void> {
    const normalized = normalizePath(path);
    await this.mkdir(dirname(normalized));
    this.nodes.set(normalized, {
      kind: "file",
      binary: data,
      modifiedAtMs: this.tick(),
    });
  }

  async exists(path: string): Promise<boolean> {
    return this.nodes.has(normalizePath(path));
  }

  async stat(path: string): Promise<FileStat | null> {
    const node = this.nodes.get(normalizePath(path));
    if (!node) return null;
    return {
      kind: node.kind,
      size: node.contents?.length ?? 0,
      modifiedAtMs: node.modifiedAtMs,
    };
  }

  async list(dirPath: string): Promise<DirEntry[]> {
    const normalized = normalizePath(dirPath);
    const node = this.nodes.get(normalized);
    if (!node || node.kind !== "directory") {
      throw new EdenwrightError("NOT_FOUND", `No such directory: ${dirPath}`);
    }
    const prefix = normalized === "/" ? "/" : `${normalized}/`;
    const children = new Map<string, DirEntry["kind"]>();
    for (const [path, child] of this.nodes) {
      if (!path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length);
      if (rest.length === 0 || rest.includes("/")) continue;
      children.set(rest, child.kind);
    }
    return [...children.entries()].map(([name, kind]) => ({ name, kind }));
  }

  async mkdir(path: string): Promise<void> {
    const normalized = normalizePath(path);
    const parts = normalized.split("/").filter(Boolean);
    const absolute = normalized.startsWith("/");
    let current = "";
    if (normalized === "/") return;
    for (const part of parts) {
      current =
        current === "" ? (absolute ? `/${part}` : part) : `${current}/${part}`;
      if (!this.nodes.has(current)) {
        this.nodes.set(current, {
          kind: "directory",
          modifiedAtMs: this.tick(),
        });
      }
    }
  }

  async remove(path: string): Promise<void> {
    const normalized = normalizePath(path);
    const prefix = `${normalized}/`;
    for (const key of [...this.nodes.keys()]) {
      if (key === normalized || key.startsWith(prefix)) {
        this.nodes.delete(key);
      }
    }
  }

  async move(fromPath: string, toPath: string): Promise<void> {
    const from = normalizePath(fromPath);
    const to = normalizePath(toPath);
    const node = this.nodes.get(from);
    if (!node) {
      throw new EdenwrightError("NOT_FOUND", `No such path: ${fromPath}`);
    }
    await this.mkdir(dirname(to));
    const prefix = `${from}/`;
    for (const [key, value] of [...this.nodes.entries()]) {
      if (key === from || key.startsWith(prefix)) {
        this.nodes.set(to + key.slice(from.length), value);
        this.nodes.delete(key);
      }
    }
  }

  /** Test convenience: base name helper for assertions. */
  fileName(path: string): string {
    return basename(path);
  }
}
