import { ChecklistService } from "./application/checklist-service";
import { FileService } from "./application/file-service";
import { FilesystemService } from "./application/filesystem-service";
import { RecycleBinService } from "./application/recycle-bin-service";
import { MemoService } from "./application/memo-service";
import { WidgetLayoutService } from "./application/widget-layout-service";
import {
  ENABLED_ENV_VALUE,
  LOCAL_AUTH_DEFAULT_EMAIL,
  RUNTIME_ENVIRONMENT,
} from "./constants/auth";
import { ApiRouter } from "./http/api-router";
import { FileApiHandler } from "./http/file-api-handler";
import { WidgetApiHandler } from "./http/widget-api-handler";
import {
  CloudflareAccessIdentityVerifier,
  LocalIdentityVerifier,
} from "./infrastructure/access-identity-verifier";
import { D1FilesystemRepository } from "./infrastructure/d1-filesystem-repository";
import { D1ChecklistRepository } from "./infrastructure/d1-checklist-repository";
import { D1MemoRepository } from "./infrastructure/d1-memo-repository";
import { D1WidgetLayoutRepository } from "./infrastructure/d1-widget-layout-repository";
import { R2FileObjectStorage } from "./infrastructure/r2-file-object-storage";
import { CryptoIdGenerator, SystemClock } from "./infrastructure/runtime";
import type { IdentityVerifier } from "./types/auth";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const fileRepository = new D1FilesystemRepository(env.DB);
    const storage = new R2FileObjectStorage(env.FILES);
    const ids = new CryptoIdGenerator();
    const clock = new SystemClock();
    const fileService = new FileService(
      fileRepository,
      storage,
      ids,
      clock,
    );
    const filesystemService = new FilesystemService(fileRepository, ids, clock);
    const recycleBinService = new RecycleBinService(
      fileRepository,
      storage,
      clock,
    );
    const fileApiHandler = new FileApiHandler(
      fileService,
      filesystemService,
      recycleBinService,
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
      createIdentityVerifier(env),
    );

    return router.handle(request);
  },
} satisfies ExportedHandler<Env>;

function createIdentityVerifier(env: Env): IdentityVerifier {
  const isLocalBypass =
    (env.ENVIRONMENT === RUNTIME_ENVIRONMENT.DEVELOPMENT ||
      env.ENVIRONMENT === RUNTIME_ENVIRONMENT.TEST) &&
    env.DEV_AUTH_BYPASS === ENABLED_ENV_VALUE;

  if (isLocalBypass) {
    return new LocalIdentityVerifier(env.OWNER_EMAIL ?? LOCAL_AUTH_DEFAULT_EMAIL);
  }

  return new CloudflareAccessIdentityVerifier({
    teamDomain: env.TEAM_DOMAIN,
    audience: env.POLICY_AUD,
    ownerEmail: env.OWNER_EMAIL,
  });
}
