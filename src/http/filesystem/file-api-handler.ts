import type { FileTransferUseCases } from "@/types/filesystem/file-transfer-service";
import type { FilesystemDirectoryUseCases } from "@/types/filesystem/services/directory-service";
import type { FilesystemDownloadManifestUseCases } from "@/types/filesystem/services/download-manifest-service";
import type { FilesystemEntryUseCases } from "@/types/filesystem/services/entry-service";
import type { RecycleBinUseCases } from "@/types/filesystem/services/recycle-bin-service";
import type { FilesystemTrashUseCases } from "@/types/filesystem/services/trash-service";
import type { ThumbnailUseCases } from "@/types/filesystem/thumbnail";
import type { FeatureApiHandler } from "@/types/platform/http";
import { FileTransferApiRoutes } from "@/http/filesystem/routes/file-transfer-api-routes";
import { FilesystemDirectoryApiRoutes } from "@/http/filesystem/routes/filesystem-directory-api-routes";
import { FilesystemDownloadApiRoutes } from "@/http/filesystem/routes/filesystem-download-api-routes";
import { FilesystemEntryApiRoutes } from "@/http/filesystem/routes/filesystem-entry-api-routes";
import { RecycleBinApiRoutes } from "@/http/filesystem/routes/recycle-bin-api-routes";

import type { FilesystemSearchUseCases } from "@/types/filesystem/search/search";
import { FilesystemSearchApiRoutes } from "@/http/filesystem/routes/filesystem-search-api-routes";

export class FileApiHandler implements FeatureApiHandler {
  private readonly routes: readonly FeatureApiHandler[];

  constructor(
    files: FileTransferUseCases,
    thumbnails: ThumbnailUseCases,
    directories: FilesystemDirectoryUseCases,
    entries: FilesystemEntryUseCases,
    trash: FilesystemTrashUseCases,
    recycleBin: RecycleBinUseCases,
    downloadManifests: FilesystemDownloadManifestUseCases,
    search: FilesystemSearchUseCases,
  ) {
    this.routes = [
      new FilesystemSearchApiRoutes(search),
      new FileTransferApiRoutes(files, thumbnails),
      new FilesystemDirectoryApiRoutes(directories),
      new FilesystemEntryApiRoutes(entries, trash),
      new RecycleBinApiRoutes(recycleBin),
      new FilesystemDownloadApiRoutes(downloadManifests),
    ];
  }

  async handle(request: Request, url: URL): Promise<Response | null> {
    for (const route of this.routes) {
      const response = await route.handle(request, url);
      if (response !== null) return response;
    }
    return null;
  }
}
