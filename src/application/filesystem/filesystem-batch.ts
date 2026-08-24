import { AppError } from "@/domain/shared/errors";
import type { FilesystemBatchFailure } from "@/types/filesystem/batch";

export interface SettledFilesystemOperation<T> {
  readonly succeeded: readonly { readonly id: string; readonly value: T }[];
  readonly failures: readonly FilesystemBatchFailure[];
}

export async function settleFilesystemOperations<T>(
  ids: readonly string[],
  operation: (id: string) => Promise<T>,
): Promise<SettledFilesystemOperation<T>> {
  const succeeded: Array<{ id: string; value: T }> = [];
  const failures: FilesystemBatchFailure[] = [];

  for (const id of uniqueFilesystemIds(ids)) {
    try {
      succeeded.push({ id, value: await operation(id) });
    } catch (error) {
      if (!(error instanceof AppError)) {
        throw error;
      }
      failures.push({ id, code: error.code, message: error.message });
    }
  }

  return { succeeded, failures };
}

export function uniqueFilesystemIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}
