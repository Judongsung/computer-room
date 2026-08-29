import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import {
  API_PATH_SEGMENTS,
  FILESYSTEM_API_PATHS,
} from "@/constants/platform/api";
import { HTTP_METHOD } from "@/constants/platform/http";
import type { FilesystemDownloadManifestUseCases } from "@/types/filesystem/services/download-manifest-service";
import type { FeatureApiHandler } from "@/types/platform/http";
import {
  assertMethod,
  readIdArray,
  readRequiredJsonObject,
} from "@/http/filesystem/filesystem-request";
import { jsonResponse } from "@/http/shared/responses";

export class FilesystemDownloadApiRoutes implements FeatureApiHandler {
  constructor(
    private readonly downloadManifests: FilesystemDownloadManifestUseCases,
  ) {}

  async handle(request: Request, url: URL): Promise<Response | null> {
    if (url.pathname !== FILESYSTEM_API_PATHS.DOWNLOAD_MANIFEST) {
      return null;
    }

    assertMethod(request, HTTP_METHOD.POST);
    const body = await readRequiredJsonObject(request);
    const manifest = await this.downloadManifests.createManifest(
      readIdArray(body.entryIds),
    );
    return jsonResponse({
      ...manifest,
      entries: manifest.entries.map((entry) =>
        entry.kind === FILESYSTEM_ENTRY_KIND.FILE
          ? {
              ...entry,
              downloadUrl: `${FILESYSTEM_API_PATHS.FILES}/${encodeURIComponent(entry.id)}/${API_PATH_SEGMENTS.DOWNLOAD}`,
            }
          : entry,
      ),
    });
  }
}
