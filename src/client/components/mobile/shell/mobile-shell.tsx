import type { ChecklistRetentionUseCases } from "@/types/widgets/checklist/retention";
import type { SessionInfo } from "@/types/platform/auth";
import { MobileLazyFeatureBoundary } from "@client/components/mobile/shared/mobile-lazy-feature-boundary";
import { MobileNavigationBar } from "@client/components/mobile/shared/mobile-navigation-bar";
import { MobileActivityLayer } from "@client/components/mobile/shell/mobile-activity-layer";
import {
  mobileActivityKey,
  mobileActivityTitle,
} from "@client/components/mobile/shell/mobile-activity-presentation";
import { MobileShellDialogLayer } from "@client/components/mobile/shell/mobile-shell-dialog-layer";
import { MobileShellMenu } from "@client/components/mobile/shell/mobile-shell-menu";
import { MOBILE_CLASS_NAME } from "@client/constants/mobile/class-names";
import { MOBILE_LAYOUT_CSS_VARIABLES } from "@client/constants/mobile/layout";
import { useMobileShellController } from "@client/hooks/mobile/shell/use-mobile-shell-controller";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import type { MobilePreferencesGateway } from "@client/types/platform/mobile-preferences";
import type { StorageStatusGateway } from "@client/types/storage/storage-status";
import type { DashboardGateway } from "@client/types/widgets/api";
import type { WidgetFileGateway } from "@client/types/widgets/widget-file";

interface MobileShellProps {
  readonly session: SessionInfo;
  readonly dashboard: DashboardGateway;
  readonly filesystem: FilesystemGateway;
  readonly storageStatus: StorageStatusGateway;
  readonly checklistRetentionGateway: ChecklistRetentionUseCases;
  readonly widgetFiles: WidgetFileGateway;
  readonly mobilePreferences: MobilePreferencesGateway;
}

export function MobileShell({
  session,
  dashboard,
  filesystem,
  storageStatus,
  checklistRetentionGateway,
  widgetFiles,
  mobilePreferences,
}: MobileShellProps) {
  const controller = useMobileShellController({
    filesystem,
    mobilePreferences,
  });
  const activity = controller.currentActivity;

  return (
    <div className={MOBILE_CLASS_NAME.ROOT} style={MOBILE_LAYOUT_CSS_VARIABLES}>
      <div className={MOBILE_CLASS_NAME.SCREEN}>
        <MobileLazyFeatureBoundary
          key={mobileActivityKey(activity)}
          title={mobileActivityTitle(activity)}
        >
          <MobileActivityLayer
            checklistRetentionGateway={checklistRetentionGateway}
            controller={controller}
            dashboard={dashboard}
            filesystem={filesystem}
            storageStatus={storageStatus}
            widgetFiles={widgetFiles}
          />
        </MobileLazyFeatureBoundary>
      </div>
      <MobileNavigationBar
        canGoBack={controller.canGoBack}
        menuEnabled={controller.menuEnabled}
        menuOpen={controller.menuOpen}
        onBack={controller.goBack}
        onHome={controller.goHome}
        onMenu={controller.toggleMenu}
      />
      <MobileShellMenu session={session} controller={controller} />
      <MobileShellDialogLayer controller={controller} />
    </div>
  );
}
