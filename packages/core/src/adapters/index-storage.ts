/**
 * Index storage capability (SPEC §5.4). The SQLite index at `.eden/index.db`
 * is a disposable cache of derivations from plain files — never the truth.
 * Implemented with better-sqlite3 in the shell (arrives in M1); core owns the
 * schema and the SQL, so the adapter stays a dumb executor.
 */

export interface IndexStorageAdapter {
  /** Open (creating when absent) the index database at the given path. */
  open(path: string): Promise<void>;

  close(): Promise<void>;

  /** Execute a multi-statement SQL script (schema DDL). No parameters. */
  exec(script: string): void;

  /** Run a single statement without a result set (INSERT, UPDATE, DELETE). */
  run(statement: string, params?: readonly unknown[]): void;

  /** Run a query and return all rows. */
  query<Row>(statement: string, params?: readonly unknown[]): Row[];

  /** Run `fn` inside a transaction; rolls back when it throws. */
  transaction<T>(fn: () => T): T;
}
