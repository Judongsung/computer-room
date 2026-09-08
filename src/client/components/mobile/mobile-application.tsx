
import { checklistRetentionApi as defaultChecklistRetentionApi } from "@client/api/widgets/checklist-retention-api-client";
import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { useCallback, useEffect, useState } from "react";
import "@client/styles/mobile.css";
import type { SessionInfo } from "@/types/platform/auth";
import { DashboardApiClient } from "@client/api/widgets/dashboard-api-client";
import { FilesystemApiClient } from "@client/api/filesystem/filesystem-api-client";
import { StorageStatusApiClient } from "@client/api/storage/storage-status-api-client";
import { WidgetFileApiClient } from "@client/api/widgets/widget-file-api-client";
import { MobilePreferencesApiClient } from "@client/api/platform/mobile-preferences-api-client";
import { MobileShell } from "@client/components/mobile/shell/mobile-shell";
import { MOBILE_CLASS_NAME } from "@client/constants/mobile/class-names";
import { MOBILE_LAYOUT_CSS_VARIABLES } from "@client/constants/mobile/layout";
import { messageFromError } from "@client/errors/error-message";
import { ThumbnailLoadProvider } from "@client/state/filesystem/thumbnail-load-context";
import type { AppProps } from "@client/types/app/app";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import type { StorageStatusGateway } from "@client/types/storage/storage-status";
import type { MobilePreferencesGateway } from "@client/types/platform/mobile-preferences";
import type { DashboardGateway } from "@client/types/widgets/api";
import type { WidgetFileGateway } from "@client/types/widgets/widget-file";

export function MobileApplication({
  checklistRetentionApi,
  api,
  filesystemApi,
  storageStatusApi,
  widgetFileApi,
  mobilePreferencesApi,
  initialSession,
}: AppProps) {
  const checklistRetentionGateway = checklistRetentionApi ?? defaultChecklistRetentionApi;
  const [dashboard] = useState<DashboardGateway>(() => api ?? new DashboardApiClient());
  const [filesystem] = useState<FilesystemGateway>(() => filesystemApi ?? new FilesystemApiClient());
  const [storageStatus] = useState<StorageStatusGateway>(() => storageStatusApi ?? new StorageStatusApiClient());
  const [widgetFiles] = useState<WidgetFileGateway>(() => widgetFileApi ?? new WidgetFileApiClient());
  const [mobilePreferences] = useState<MobilePreferencesGateway>(
    () => mobilePreferencesApi ?? new MobilePreferencesApiClient(),
  );
  const [session, setSession] = useState<SessionInfo | null>(
    initialSession ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const load = useCallback(async (): Promise<void> => {
    if (initialSession) {
      setSession(initialSession);
      setError(null);
      return;
    }
    try {
      setSession(await dashboard.getSession());
      setError(null);
    } catch (caught) {
      setError(messageFromError(caught, MOBILE_COPY.LOAD_FAILED));
    }
  }, [dashboard, initialSession]);
  useEffect(() => void load(), [load, revision]);

  if (!session) {
    return (
      <div className={MOBILE_CLASS_NAME.ROOT} style={MOBILE_LAYOUT_CSS_VARIABLES}>
        <main className={MOBILE_CLASS_NAME.SCREEN}>
          <p className={error ? MOBILE_CLASS_NAME.ERROR : MOBILE_CLASS_NAME.MESSAGE} role={error ? "alert" : "status"}>
            {error ?? MOBILE_COPY.LOADING}
          </p>
          {error ? <button type="button" onClick={() => setRevision((current) => current + 1)}>{MOBILE_COPY.RETRY}</button> : null}
        </main>
      </div>
    );
  }

  return (
    <ThumbnailLoadProvider>
      <MobileShell
        session={session}
        dashboard={dashboard}
        filesystem={filesystem}
        checklistRetentionGateway={checklistRetentionGateway}
        storageStatus={storageStatus}
        widgetFiles={widgetFiles}
        mobilePreferences={mobilePreferences}
      />
    </ThumbnailLoadProvider>
  );
}
