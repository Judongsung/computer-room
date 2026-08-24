import type { FilesystemEntry } from "./filesystem";

export interface FilesystemBatchFailure {
  readonly id: string;
  readonly code: string;
  readonly message: string;
}

export interface FilesystemBatchResult {
  readonly succeededIds: readonly string[];
  readonly entries: readonly FilesystemEntry[];
  readonly failures: readonly FilesystemBatchFailure[];
  readonly closedWidgetIds: readonly string[];
}
