import type { FileTransferUseCases } from "@/types/filesystem/file-transfer-service";
import type {
  FilesystemDownloadManifestUseCases,
  FilesystemUseCases,
  RecycleBinUseCases,
} from "@/types/filesystem/filesystem-service";
import type { ThumbnailUseCases } from "@/types/filesystem/thumbnail";
import type { FeatureApiHandler } from "@/types/platform/http";
import { FileTransferApiRoutes } from "@/http/filesystem/routes/file-transfer-api-routes";
import { FilesystemDownloadApiRoutes } from "@/http/filesystem/routes/filesystem-download-api-routes";
import { FilesystemEntryApiRoutes } from "@/http/filesystem/routes/filesystem-entry-api-routes";
import { RecycleBinApiRoutes } from "@/http/filesystem/routes/recycle-bin-api-routes";

export class FileApiHandler implements FeatureApiHandler {
  private readonly routes: readonly FeatureApiHandler[];

  constructor(
    files: FileTransferUseCases,
    thumbnails: ThumbnailUseCases,
    filesystem: FilesystemUseCases,
    recycleBin: RecycleBinUseCases,
    downloadManifests: FilesystemDownloadManifestUseCases,
  ) {
    this.routes = [
      new FileTransferApiRoutes(files, thumbnails),
      new FilesystemEntryApiRoutes(filesystem),
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
