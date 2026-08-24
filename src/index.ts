import { ChecklistService } from "@/application/widgets/checklist-service";
import { FileService } from "@/application/filesystem/file-service";
import { FilesystemPathService } from "@/application/filesystem/filesystem-path-service";
import { FilesystemService } from "@/application/filesystem/filesystem-service";
import { FilesystemDownloadManifestService } from "@/application/filesystem/filesystem-download-manifest-service";
import { NovelAiImageService } from "@/application/integrations/novelai-image-service";
import { RecycleBinService } from "@/application/filesystem/recycle-bin-service";
import { MemoService } from "@/application/widgets/memo-service";
import { ThumbnailService } from "@/application/filesystem/thumbnail-service";
import { ThumbnailPreparingFileService } from "@/application/filesystem/thumbnail-preparing-file-service";
import { WidgetLayoutService } from "@/application/widgets/widget-layout-service";
import { StorageStatusService } from "@/application/storage/storage-status-service";
import {
  ENABLED_ENV_VALUE,
  LOCAL_AUTH_DEFAULT_EMAIL,
  RUNTIME_ENVIRONMENT,
} from "@/constants/platform/auth";
import { ApiRouter } from "@/http/shared/api-router";
import { FileApiHandler } from "@/http/filesystem/file-api-handler";
import { NovelAiImageApiHandler } from "@/http/integrations/novelai-image-api-handler";
import { WidgetApiHandler } from "@/http/widgets/widget-api-handler";
import { StorageStatusApiHandler } from "@/http/storage/storage-status-api-handler";
import {
  CloudflareAccessIdentityVerifier,
  CloudflareAccessApplicationVerifier,
  LocalIdentityVerifier,
  LocalRequestVerifier,
} from "@/infrastructure/auth/access-identity-verifier";
import { D1FilesystemRepository } from "@/infrastructure/filesystem/d1-filesystem-repository";
import { D1DirectorySortRepository } from "@/infrastructure/filesystem/d1-directory-sort-repository";
import { D1ChecklistRepository } from "@/infrastructure/widgets/d1-checklist-repository";
import { D1MemoRepository } from "@/infrastructure/widgets/d1-memo-repository";
import { D1WidgetLayoutRepository } from "@/infrastructure/widgets/d1-widget-layout-repository";
import { D1StorageUsageReader } from "@/infrastructure/storage/d1-storage-usage-reader";
import { R2FileObjectStorage } from "@/infrastructure/filesystem/r2-file-object-storage";
import { R2ObjectStorageUsageReader } from "@/infrastructure/storage/r2-object-storage-usage-reader";
import { CloudflareImageThumbnailGenerator } from "@/infrastructure/filesystem/cloudflare-image-thumbnail-generator";
import { CloudflareBackgroundTaskScheduler } from "@/infrastructure/platform/cloudflare-background-task-scheduler";
import { CryptoIdGenerator, SystemClock } from "@/infrastructure/platform/runtime";
import type { IdentityVerifier, RequestVerifier } from "@/types/platform/auth";

export default {
  async fetch(
    request: Request,
    env: Env,
    context: ExecutionContext,
  ): Promise<Response> {
    const fileRepository = new D1FilesystemRepository(env.DB);
    const storage = new R2FileObjectStorage(env.FILES);
    const ids = new CryptoIdGenerator();
    const clock = new SystemClock();
    const thumbnailService = new ThumbnailService(
      fileRepository,
      storage,
      new CloudflareImageThumbnailGenerator(env.IMAGES),
    );
    const storedFileService = new FileService(
      fileRepository,
      storage,
      ids,
      clock,
    );
    const fileService = new ThumbnailPreparingFileService(
      storedFileService,
      thumbnailService,
      new CloudflareBackgroundTaskScheduler(context),
    );
    const filesystemService = new FilesystemService(
      fileRepository,
      new D1DirectorySortRepository(env.DB),
      ids,
      clock,
    );
    const filesystemPathService = new FilesystemPathService(
      fileRepository,
      ids,
      clock,
    );
    const novelAiImageService = new NovelAiImageService(
      filesystemPathService,
      fileService,
      ids,
      clock,
    );
    const recycleBinService = new RecycleBinService(
      fileRepository,
      storage,
      clock,
    );
    const downloadManifestService = new FilesystemDownloadManifestService(
      fileRepository,
    );
    const fileApiHandler = new FileApiHandler(
      fileService,
      thumbnailService,
      filesystemService,
      recycleBinService,
      downloadManifestService,
    );
    const novelAiImageApiHandler = new NovelAiImageApiHandler(
      novelAiImageService,
    );
    const layoutRepository = new D1WidgetLayoutRepository(env.DB);
    const memoRepository = new D1MemoRepository(env.DB);
    const checklistRepository = new D1ChecklistRepository(env.DB);
    const widgetService = new WidgetLayoutService(
      layoutRepository,
      memoRepository,
      checklistRepository,
      fileRepository,
      ids,
      clock,
    );
    const memoService = new MemoService(layoutRepository, memoRepository, clock);
    const checklistService = new ChecklistService(
      layoutRepository,
      checklistRepository,
      ids,
      clock,
    );
    const widgetApiHandler = new WidgetApiHandler(
      widgetService,
      memoService,
      checklistService,
    );
    const storageStatusApiHandler = new StorageStatusApiHandler(
      new StorageStatusService(
        new R2ObjectStorageUsageReader(env.FILES),
        new D1StorageUsageReader(env.DB),
        clock,
      ),
    );
    const router = new ApiRouter(
      fileApiHandler,
      widgetApiHandler,
      storageStatusApiHandler,
      novelAiImageApiHandler,
      createIdentityVerifier(env),
      createServiceRequestVerifier(env),
    );

    return router.handle(request);
  },
} satisfies ExportedHandler<Env>;

function createIdentityVerifier(env: Env): IdentityVerifier {
  if (isLocalAuthBypass(env)) {
    return new LocalIdentityVerifier(env.OWNER_EMAIL ?? LOCAL_AUTH_DEFAULT_EMAIL);
  }

  return new CloudflareAccessIdentityVerifier({
    teamDomain: env.TEAM_DOMAIN,
    audience: env.POLICY_AUD,
    ownerEmail: env.OWNER_EMAIL,
  });
}

function createServiceRequestVerifier(env: Env): RequestVerifier {
  if (isLocalAuthBypass(env)) {
    return new LocalRequestVerifier();
  }
  return new CloudflareAccessApplicationVerifier({
    teamDomain: env.TEAM_DOMAIN,
    audience: env.NOVELAI_UPLOAD_POLICY_AUD,
  });
}

function isLocalAuthBypass(env: Env): boolean {
  return (
    (env.ENVIRONMENT === RUNTIME_ENVIRONMENT.DEVELOPMENT ||
      env.ENVIRONMENT === RUNTIME_ENVIRONMENT.TEST) &&
    env.DEV_AUTH_BYPASS === ENABLED_ENV_VALUE
  );
}
