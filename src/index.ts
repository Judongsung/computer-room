import { ChecklistRetentionApiHandler } from "@/http/widgets/checklist-retention-api-handler";
import { ChecklistRetentionService } from "@/application/widgets/checklist-retention-service";
import { ChecklistRetentionJob } from "@/application/widgets/checklist-retention-job";
import { D1ChecklistRetentionRepository } from "@/infrastructure/widgets/d1-checklist-retention-repository";
import { ChecklistService } from "@/application/widgets/checklist-service";
import { FileService } from "@/application/filesystem/file-service";
import { FilesystemDirectoryService } from "@/application/filesystem/directory/filesystem-directory-service";
import { FilesystemEntryService } from "@/application/filesystem/entries/filesystem-entry-service";
import { FilesystemPathService } from "@/application/filesystem/filesystem-path-service";
import { FilesystemDownloadManifestService } from "@/application/filesystem/filesystem-download-manifest-service";
import { DirectoryDetailsService } from "@/application/filesystem/directory-details-service";
import { ImageUploadProfileService } from "@/application/integrations/image-upload-profile-service";
import { ImageUploadLogService } from "@/application/integrations/image-upload-log-service";
import { ImageUploadLogPurgeJob } from "@/application/integrations/image-upload-log-purge-job";
import { ImageUploadLogSettingsService } from "@/application/integrations/image-upload-log-settings-service";
import { ImageUploadService } from "@/application/integrations/image-upload-service";
import { ScheduledJobDispatcher } from "@/application/platform/scheduled-job-dispatcher";
import { RecycleBinService } from "@/application/filesystem/recycle/recycle-bin-service";
import { MemoService } from "@/application/widgets/memo-service";
import { ThumbnailService } from "@/application/filesystem/thumbnail-service";
import { ThumbnailPreparingFileService } from "@/application/filesystem/thumbnail-preparing-file-service";
import { WidgetLayoutService } from "@/application/widgets/widget-layout-service";
import { WidgetFileService } from "@/application/widgets/widget-file-service";
import { StorageStatusService } from "@/application/storage/storage-status-service";
import { MobilePreferencesService } from "@/application/platform/mobile-preferences-service";
import { GuestAccessService } from "@/application/admin/guest-access-service";
import { GuestService } from "@/application/guest/guest-service";
import { ActiveFilesystemEntryResolver } from "@/application/filesystem/policies/active-filesystem-entry-resolver";
import { FilesystemNameAllocator } from "@/application/filesystem/policies/filesystem-name-allocator";
import {
  ENABLED_ENV_VALUE,
  LOCAL_AUTH_DEFAULT_EMAIL,
  RUNTIME_ENVIRONMENT,
} from "@/constants/platform/auth";
import { ApiRouter } from "@/http/shared/api-router";
import { FileApiHandler } from "@/http/filesystem/file-api-handler";
import { DirectoryDetailsApiHandler } from "@/http/filesystem/directory-details-api-handler";
import { ImageUploadProfileApiHandler } from "@/http/integrations/image-upload-profile-api-handler";
import { ImageUploadApiHandler } from "@/http/integrations/image-upload-api-handler";
import { ImageUploadLogApiHandler } from "@/http/integrations/image-upload-log-api-handler";
import { ImageUploadLogSettingsApiHandler } from "@/http/integrations/image-upload-log-settings-api-handler";
import { WidgetApiHandler } from "@/http/widgets/widget-api-handler";
import { WidgetFileApiHandler } from "@/http/widgets/widget-file-api-handler";
import { StorageStatusApiHandler } from "@/http/storage/storage-status-api-handler";
import { MobilePreferencesApiHandler } from "@/http/platform/mobile-preferences-api-handler";
import { GuestAccessApiHandler } from "@/http/admin/guest-access-api-handler";
import { GuestApiHandler } from "@/http/guest/guest-api-handler";
import { OwnerLoginApiHandler } from "@/http/platform/owner-login-api-handler";
import {
  CloudflareAccessIdentityVerifier,
  CloudflareAccessApplicationVerifier,
  LocalIdentityVerifier,
  LocalRequestVerifier,
} from "@/infrastructure/auth/access-identity-verifier";
import { D1FilesystemRepository } from "@/infrastructure/filesystem/d1-filesystem-repository";
import { D1DirectorySortRepository } from "@/infrastructure/filesystem/d1-directory-sort-repository";
import { D1DirectoryDetailsRepository } from "@/infrastructure/filesystem/d1-directory-details-repository";
import { D1ChecklistRepository } from "@/infrastructure/widgets/d1-checklist-repository";
import { D1MemoRepository } from "@/infrastructure/widgets/d1-memo-repository";
import { D1WidgetLayoutRepository } from "@/infrastructure/widgets/d1-widget-layout-repository";
import { D1WidgetFileDraftRepository } from "@/infrastructure/widgets/d1-widget-file-draft-repository";
import { D1StorageUsageReader } from "@/infrastructure/storage/d1-storage-usage-reader";
import { R2FileObjectStorage } from "@/infrastructure/filesystem/r2-file-object-storage";
import { R2ObjectStorageUsageReader } from "@/infrastructure/storage/r2-object-storage-usage-reader";
import { CloudflareImageThumbnailGenerator } from "@/infrastructure/filesystem/cloudflare-image-thumbnail-generator";
import { ConsoleFileUploadCompensationObserver } from "@/infrastructure/filesystem/console-file-upload-compensation-observer";
import { CloudflareBackgroundTaskScheduler } from "@/infrastructure/platform/cloudflare-background-task-scheduler";
import { D1MobilePreferencesRepository } from "@/infrastructure/platform/d1-mobile-preferences-repository";
import { D1ImageUploadProfileRepository } from "@/infrastructure/integrations/d1-image-upload-profile-repository";
import { D1ImageUploadLogRepository } from "@/infrastructure/integrations/d1-image-upload-log-repository";
import { D1ImageUploadLogSettingsRepository } from "@/infrastructure/integrations/d1-image-upload-log-settings-repository";
import { D1GuestAccessRepository } from "@/infrastructure/admin/d1-guest-access-repository";
import { D1GuestPublicationRepository } from "@/infrastructure/guest/d1-guest-publication-repository";
import { CloudflareGuestRequestRateLimiter } from "@/infrastructure/guest/cloudflare-guest-request-rate-limiter";
import { CryptoIdGenerator, SystemClock } from "@/infrastructure/platform/runtime";
import type { IdentityVerifier, RequestVerifier } from "@/types/platform/auth";
import type { ScheduledJob } from "@/types/platform/scheduled-job";

export default {
  async fetch(
    request: Request,
    env: Env,
    context: ExecutionContext,
  ): Promise<Response> {
    const fileRepository = new D1FilesystemRepository(env.DB);
    const activeFilesystemEntries = new ActiveFilesystemEntryResolver(
      fileRepository,
    );
    const filesystemNames = new FilesystemNameAllocator(fileRepository);
    const storage = new R2FileObjectStorage(env.FILES);
    const ids = new CryptoIdGenerator();
    const clock = new SystemClock();
    const backgroundTasks = new CloudflareBackgroundTaskScheduler(context);
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
      new ConsoleFileUploadCompensationObserver(),
      activeFilesystemEntries,
      filesystemNames,
    );
    const fileService = new ThumbnailPreparingFileService(
      storedFileService,
      thumbnailService,
      backgroundTasks,
    );
    const directoryService = new FilesystemDirectoryService(
      fileRepository,
      new D1DirectorySortRepository(env.DB),
      ids,
      clock,
      activeFilesystemEntries,
      filesystemNames,
    );
    const entryService = new FilesystemEntryService(
      fileRepository,
      clock,
      activeFilesystemEntries,
      filesystemNames,
    );
    const filesystemPathService = new FilesystemPathService(
      fileRepository,
      ids,
      clock,
      activeFilesystemEntries,
    );
    const imageUploadProfileService = new ImageUploadProfileService(
      new D1ImageUploadProfileRepository(env.DB),
      clock,
    );
    const imageUploadService = new ImageUploadService(
      imageUploadProfileService,
      filesystemPathService,
      fileService,
      ids,
      clock,
    );
    const imageUploadLogRepository = new D1ImageUploadLogRepository(env.DB);
    const imageUploadLogSettingsRepository =
      new D1ImageUploadLogSettingsRepository(env.DB);
    const imageUploadLogService = new ImageUploadLogService(
      imageUploadLogRepository,
      imageUploadLogSettingsRepository,
      activeFilesystemEntries,
      ids,
      clock,
    );
    const imageUploadLogSettingsService = new ImageUploadLogSettingsService(
      imageUploadLogSettingsRepository,
    );
    const recycleBinService = new RecycleBinService(
      fileRepository,
      storage,
      clock,
      activeFilesystemEntries,
      filesystemNames,
    );
    const downloadManifestService = new FilesystemDownloadManifestService(
      fileRepository,
    );
    const fileApiHandler = new FileApiHandler(
      fileService,
      thumbnailService,
      directoryService,
      entryService,
      recycleBinService,
      recycleBinService,
      downloadManifestService,
    );
    const directoryDetailsApiHandler = new DirectoryDetailsApiHandler(
      new DirectoryDetailsService(
        fileRepository,
        new D1DirectoryDetailsRepository(env.DB),
      ),
    );
    const imageUploadApiHandler = new ImageUploadApiHandler(
      imageUploadService,
      imageUploadLogService,
      clock,
      backgroundTasks,
    );
    const imageUploadLogApiHandler = new ImageUploadLogApiHandler(
      imageUploadLogService,
    );
    const imageUploadLogSettingsApiHandler =
      new ImageUploadLogSettingsApiHandler(imageUploadLogSettingsService);
    const imageUploadProfileApiHandler = new ImageUploadProfileApiHandler(
      imageUploadProfileService,
    );
    const layoutRepository = new D1WidgetLayoutRepository(env.DB);
    const memoRepository = new D1MemoRepository(env.DB);
    const checklistRepository = new D1ChecklistRepository(env.DB);
    const widgetService = new WidgetLayoutService(
      layoutRepository,
      memoRepository,
      checklistRepository,
      ids,
      clock,
    );
    const widgetFileService = new WidgetFileService(
      widgetService,
      fileRepository,
      new D1WidgetFileDraftRepository(env.DB),
      ids,
      clock,
      activeFilesystemEntries,
      filesystemNames,
    );
    const widgetFileApiHandler = new WidgetFileApiHandler(
      widgetFileService,
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
      widgetFileService,
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
    const mobilePreferencesApiHandler = new MobilePreferencesApiHandler(
      new MobilePreferencesService(
        new D1MobilePreferencesRepository(env.DB),
        fileRepository,
      ),
    );
    const guestAccessApiHandler = new GuestAccessApiHandler(
      new GuestAccessService(
        new D1GuestAccessRepository(env.DB),
        directoryService,
        activeFilesystemEntries,
        clock,
      ),
    );
    const guestApiHandler = new GuestApiHandler(
      new GuestService(
        new D1GuestPublicationRepository(env.DB),
        new D1DirectorySortRepository(env.DB),
        fileService,
        thumbnailService,
        clock,
      ),
      new CloudflareGuestRequestRateLimiter(
        env.GUEST_METADATA_RATE_LIMITER,
        env.GUEST_BINARY_RATE_LIMITER,
      ),
    );
    const router = new ApiRouter(
      [
        new OwnerLoginApiHandler(),
        fileApiHandler,
        directoryDetailsApiHandler,
        widgetFileApiHandler,
        widgetApiHandler,
        storageStatusApiHandler,
        mobilePreferencesApiHandler,
        new ChecklistRetentionApiHandler(new ChecklistRetentionService(
          new D1ChecklistRetentionRepository(env.DB),
        )),
        imageUploadProfileApiHandler,
        imageUploadLogApiHandler,
        imageUploadLogSettingsApiHandler,
        guestAccessApiHandler,
      ],
      [imageUploadApiHandler],
      [guestApiHandler],
      createIdentityVerifier(env),
      createServiceRequestVerifier(env),
    );

    return router.handle(request);
  },
  scheduled(
    controller: ScheduledController,
    env: Env,
    context: ExecutionContext,
  ): void {
    new ScheduledJobDispatcher(
      new CloudflareBackgroundTaskScheduler(context),
      createScheduledJobs(env),
    ).dispatch(controller.scheduledTime);
  },
} satisfies ExportedHandler<Env>;

function createScheduledJobs(env: Env): readonly ScheduledJob[] {
  return [
    new ChecklistRetentionJob(new D1ChecklistRetentionRepository(env.DB)),
    new ImageUploadLogPurgeJob(
      new D1ImageUploadLogRepository(env.DB),
      new D1ImageUploadLogSettingsRepository(env.DB),
    ),
  ];
}

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
    audience: [
      env.INTEGRATION_UPLOAD_POLICY_AUD,
      env.NOVELAI_UPLOAD_POLICY_AUD,
    ].filter((audience): audience is string => Boolean(audience)),
  });
}

function isLocalAuthBypass(env: Env): boolean {
  return (
    (env.ENVIRONMENT === RUNTIME_ENVIRONMENT.DEVELOPMENT ||
      env.ENVIRONMENT === RUNTIME_ENVIRONMENT.TEST) &&
    env.DEV_AUTH_BYPASS === ENABLED_ENV_VALUE
  );
}
