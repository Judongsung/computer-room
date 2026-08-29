import { FileService } from "@/application/filesystem/file-service";
import { FilesystemService } from "@/application/filesystem/filesystem-service";
import { RecycleBinService } from "@/application/filesystem/recycle-bin-service";
import { NOOP_FILE_UPLOAD_COMPENSATION_OBSERVER } from "@test/support/filesystem/file-upload-compensation-observer";
import {
  MemoryDirectorySortRepository,
  MemoryFileRepository,
} from "@test/support/filesystem/memory-filesystem-repository";
import { MemoryObjectStorage } from "@test/support/filesystem/memory-object-storage";
import {
  SequenceIdGenerator,
  StaticClock,
} from "@test/support/platform/runtime-fakes";

const DEFAULT_ENTRY_IDS = Array.from(
  { length: 32 },
  (_, index) => `entry-${index + 1}`,
);

interface FilesystemApplicationFixtureOptions {
  readonly ids?: readonly string[];
  readonly timestamp?: number;
}

export function createFilesystemApplicationFixture(
  options: FilesystemApplicationFixtureOptions = {},
) {
  const repository = new MemoryFileRepository();
  const storage = new MemoryObjectStorage();
  const ids = new SequenceIdGenerator(options.ids ?? DEFAULT_ENTRY_IDS);
  const clock = new StaticClock(options.timestamp ?? 1_700_000_000_000);
  const directorySorts = new MemoryDirectorySortRepository();
  return {
    repository,
    storage,
    clock,
    directorySorts,
    filesystem: new FilesystemService(
      repository,
      directorySorts,
      ids,
      clock,
    ),
    files: new FileService(
      repository,
      storage,
      ids,
      clock,
      NOOP_FILE_UPLOAD_COMPENSATION_OBSERVER,
    ),
    recycleBin: new RecycleBinService(repository, storage, clock),
  };
}
