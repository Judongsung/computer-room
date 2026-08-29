import { FILESYSTEM_ARCHIVE } from "@/constants/filesystem/download";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import { AppError } from "@/domain/shared/errors";
import { assertNever } from "@/domain/shared/assert-never";
import type {
  FilesystemEntryRecord,
  RootedFilesystemEntryRecord,
} from "@/types/filesystem/filesystem";
import type {
  FilesystemArchiveSource,
  FilesystemArchiveSourceManifest,
} from "@/types/filesystem/download";
import type { FilesystemDownloadManifestUseCases } from "@/types/filesystem/services/download-manifest-service";
import type { FilesystemQueryRepository } from "@/types/filesystem/repository";
import { toPublicEntry } from "@/application/filesystem/filesystem-entry-mapper";
import { uniqueFilesystemIds } from "@/application/filesystem/filesystem-batch";

export class FilesystemDownloadManifestService
  implements FilesystemDownloadManifestUseCases
{
  constructor(private readonly repository: FilesystemQueryRepository) {}

  async createManifest(
    ids: readonly string[],
  ): Promise<FilesystemArchiveSourceManifest> {
    const rootIds = uniqueFilesystemIds(ids);
    const rootedEntries = await this.repository.listActiveSubtrees(rootIds);
    const grouped = groupByRoot(rootedEntries);
    const entries: FilesystemArchiveSource[] = [];
    const skippedWidgetIds: string[] = [];

    for (const rootId of rootIds) {
      const subtree = grouped.get(rootId);
      if (!subtree) {
        throw new AppError(FILESYSTEM_ERRORS.ENTRY_NOT_ACTIVE);
      }
      const root = subtree.get(rootId);
      if (!root) {
        throw new AppError(FILESYSTEM_ERRORS.ENTRY_NOT_ACTIVE);
      }
      const paths = new Map<string, string>();
      const sorted = [...subtree.values()].sort((left, right) =>
        resolveArchivePath(left, root, subtree, paths).localeCompare(
          resolveArchivePath(right, root, subtree, paths),
          "ko-KR",
        ),
      );

      for (const record of sorted) {
        const entry = toPublicEntry(record);
        const path = resolveArchivePath(record, root, subtree, paths);
        switch (entry.kind) {
          case FILESYSTEM_ENTRY_KIND.WIDGET:
            skippedWidgetIds.push(entry.id);
            break;
          case FILESYSTEM_ENTRY_KIND.DIRECTORY:
            entries.push({
              kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
              path: `${path}${FILESYSTEM_ARCHIVE.DIRECTORY_PATH_SUFFIX}`,
              updatedAt: entry.updatedAt,
            });
            break;
          case FILESYSTEM_ENTRY_KIND.FILE:
            entries.push({
              kind: FILESYSTEM_ENTRY_KIND.FILE,
              id: entry.id,
              path,
              size: entry.size,
              updatedAt: entry.updatedAt,
            });
            break;
          default:
            assertNever(entry);
        }
      }
    }

    const files = entries.filter(
      (entry) => entry.kind === FILESYSTEM_ENTRY_KIND.FILE,
    );
    const onlyRootId = rootIds.length === 1 ? rootIds[0] : undefined;
    const onlyRoot = onlyRootId
      ? grouped.get(onlyRootId)?.get(onlyRootId)
      : undefined;
    return {
      archiveName:
        onlyRoot?.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY
          ? `${onlyRoot.name}${FILESYSTEM_ARCHIVE.EXTENSION}`
          : FILESYSTEM_ARCHIVE.DEFAULT_NAME,
      entries,
      totalFileCount: files.length,
      totalBytes: files.reduce((total, file) => total + file.size, 0),
      skippedWidgetIds,
    };
  }
}

function groupByRoot(
  records: readonly RootedFilesystemEntryRecord[],
): Map<string, Map<string, FilesystemEntryRecord>> {
  const grouped = new Map<string, Map<string, FilesystemEntryRecord>>();
  for (const record of records) {
    const subtree = grouped.get(record.rootId) ?? new Map();
    subtree.set(record.entry.id, record.entry);
    grouped.set(record.rootId, subtree);
  }
  return grouped;
}

function resolveArchivePath(
  entry: FilesystemEntryRecord,
  root: FilesystemEntryRecord,
  subtree: ReadonlyMap<string, FilesystemEntryRecord>,
  cache: Map<string, string>,
): string {
  const cached = cache.get(entry.id);
  if (cached) return cached;
  if (entry.id === root.id) {
    cache.set(entry.id, entry.name);
    return entry.name;
  }
  const parent = entry.parentId ? subtree.get(entry.parentId) : null;
  if (!parent) {
    throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
  }
  const path = `${resolveArchivePath(parent, root, subtree, cache)}/${entry.name}`;
  cache.set(entry.id, path);
  return path;
}
