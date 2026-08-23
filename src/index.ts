import { ChecklistService } from "./application/checklist-service";
import { FileService } from "./application/file-service";
import { FilesystemPathService } from "./application/filesystem-path-service";
import { FilesystemService } from "./application/filesystem-service";
import { NovelAiImageService } from "./application/novelai-image-service";
import { RecycleBinService } from "./application/recycle-bin-service";
import { MemoService } from "./application/memo-service";
import { ThumbnailService } from "./application/thumbnail-service";
import { ThumbnailPreparingFileService } from "./application/thumbnail-preparing-file-service";
import { WidgetLayoutService } from "./application/widget-layout-service";
import {
  ENABLED_ENV_VALUE,
  LOCAL_AUTH_DEFAULT_EMAIL,
  RUNTIME_ENVIRONMENT,
} from "./constants/auth";
import { ApiRouter } from "./http/api-router";
import { FileApiHandler } from "./http/file-api-handler";
import { NovelAiImageApiHandler } from "./http/novelai-image-api-handler";
import { WidgetApiHandler } from "./http/widget-api-handler";
import {
  CloudflareAccessIdentityVerifier,
  CloudflareAccessApplicationVerifier,
  LocalIdentityVerifier,
  LocalRequestVerifier,
} from "./infrastructure/access-identity-verifier";
import { D1FilesystemRepository } from "./infrastructure/d1-filesystem-repository";
import { D1ChecklistRepository } from "./infrastructure/d1-checklist-repository";
import { D1MemoRepository } from "./infrastructure/d1-memo-repository";
import { D1WidgetLayoutRepository } from "./infrastructure/d1-widget-layout-repository";
import { R2FileObjectStorage } from "./infrastructure/r2-file-object-storage";
import { CloudflareImageThumbnailGenerator } from "./infrastructure/cloudflare-image-thumbnail-generator";
import { CloudflareBackgroundTaskScheduler } from "./infrastructure/cloudflare-background-task-scheduler";
import { CryptoIdGenerator, SystemClock } from "./infrastructure/runtime";
import type { IdentityVerifier, RequestVerifier } from "./types/auth";

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
    const filesystemService = new FilesystemService(fileRepository, ids, clock);
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
    const fileApiHandler = new FileApiHandler(
      fileService,
      thumbnailService,
      filesystemService,
      recycleBinService,
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
    const router = new ApiRouter(
      fileApiHandler,
      widgetApiHandler,
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
