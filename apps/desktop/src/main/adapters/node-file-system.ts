import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import { basename, dirname, join } from "node:path";

import type { DirEntry, FileStat, FileSystemAdapter } from "@edenwright/core";
import { EdenwrightError } from "@edenwright/core";

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

/**
 * File system adapter over Node fs. Writes are atomic (temp sibling + rename)
 * — golden rule 1: never a half-written user file.
 */
export class NodeFileSystemAdapter implements FileSystemAdapter {
  async readFile(path: string): Promise<string> {
    try {
      return await fs.readFile(path, "utf8");
    } catch (error) {
      if (isNotFound(error)) {
        throw new EdenwrightError("NOT_FOUND", `No such file: ${path}`);
      }
      throw error;
    }
  }

  async writeFile(path: string, contents: string): Promise<void> {
    await fs.mkdir(dirname(path), { recursive: true });
    const tempPath = join(
      dirname(path),
      `.${basename(path)}.${randomBytes(6).toString("hex")}.tmp`,
    );
    try {
      await fs.writeFile(tempPath, contents, "utf8");
      await fs.rename(tempPath, path);
    } catch (error) {
      // Never leave temp litter in the user's eden.
      await fs.rm(tempPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  async readFileBinary(path: string): Promise<Uint8Array> {
    try {
      const buffer = await fs.readFile(path);
      return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.length);
    } catch (error) {
      if (isNotFound(error)) {
        throw new EdenwrightError("NOT_FOUND", `No such file: ${path}`);
      }
      throw error;
    }
  }

  async writeFileBinary(path: string, data: Uint8Array): Promise<void> {
    await fs.mkdir(dirname(path), { recursive: true });
    const tempPath = join(
      dirname(path),
      `.${basename(path)}.${randomBytes(6).toString("hex")}.tmp`,
    );
    try {
      await fs.writeFile(tempPath, data);
      await fs.rename(tempPath, path);
    } catch (error) {
      await fs.rm(tempPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async stat(path: string): Promise<FileStat | null> {
    try {
      const stats = await fs.stat(path);
      return {
        kind: stats.isDirectory() ? "directory" : "file",
        size: stats.isDirectory() ? 0 : stats.size,
        modifiedAtMs: stats.mtimeMs,
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async list(dirPath: string): Promise<DirEntry[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries.map((entry) => ({
        name: entry.name,
        kind: entry.isDirectory()
          ? ("directory" as const)
          : entry.isFile()
            ? ("file" as const)
            : ("other" as const),
      }));
    } catch (error) {
      if (isNotFound(error)) {
        throw new EdenwrightError("NOT_FOUND", `No such directory: ${dirPath}`);
      }
      throw error;
    }
  }

  async mkdir(path: string): Promise<void> {
    await fs.mkdir(path, { recursive: true });
  }

  async remove(path: string): Promise<void> {
    await fs.rm(path, { recursive: true, force: true });
  }

  async move(fromPath: string, toPath: string): Promise<void> {
    await fs.mkdir(dirname(toPath), { recursive: true });
    await fs.rename(fromPath, toPath);
  }
}
