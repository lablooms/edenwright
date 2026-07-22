/** Error codes stable enough for the shell and plugins to branch on. */
export type EdenwrightErrorCode =
  "MANIFEST_INVALID" | "FILE_CONFLICT" | "NOT_FOUND" | "IO";

export class EdenwrightError extends Error {
  readonly code: EdenwrightErrorCode;

  constructor(code: EdenwrightErrorCode, message: string) {
    super(message);
    this.name = "EdenwrightError";
    this.code = code;
  }
}
