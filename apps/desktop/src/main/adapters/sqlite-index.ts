import Database from "better-sqlite3";

import type { IndexStorageAdapter } from "@edenwright/core";

/**
 * Index storage over better-sqlite3 (SPEC §5.1) — a dumb executor. Core owns
 * the schema and all SQL; this class only runs it. The database is a cache:
 * corrupt or missing files are deleted and rebuilt by the eden service.
 */
export class SqliteIndexStorageAdapter implements IndexStorageAdapter {
  private db: Database.Database | null = null;

  async open(path: string): Promise<void> {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
  }

  async close(): Promise<void> {
    this.db?.close();
    this.db = null;
  }

  private requireDb(): Database.Database {
    if (!this.db) {
      throw new Error("Index storage used before open()");
    }
    return this.db;
  }

  exec(script: string): void {
    this.requireDb().exec(script);
  }

  run(statement: string, params: readonly unknown[] = []): void {
    this.requireDb()
      .prepare(statement)
      .run(...params);
  }

  query<Row>(statement: string, params: readonly unknown[] = []): Row[] {
    return this.requireDb()
      .prepare(statement)
      .all(...params) as Row[];
  }

  transaction<T>(fn: () => T): T {
    return this.requireDb().transaction(fn)();
  }
}
