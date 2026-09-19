import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import type { SessionInfo } from "@/types/platform/auth";
import { MobileMenu } from "@client/components/mobile/shared/mobile-menu";
import { MOBILE_ACTIVITY_KIND } from "@client/constants/mobile/activity";
import type { MobileShellController } from "@client/types/app/mobile-shell";
import { AccessLogoutLink } from "@client/components/shared/access-logout-link";
import { ACCESS_COPY } from "@client/content/ko/platform/access";

interface MobileShellMenuProps {
  readonly session: SessionInfo;
  readonly controller: MobileShellController;
}

export function MobileShellMenu({
  session,
  controller,
}: MobileShellMenuProps) {
  const activity = controller.currentActivity;
  return (
    <MobileMenu
      open={
        controller.menuOpen && activity.kind !== MOBILE_ACTIVITY_KIND.DIRECTORY
      }
      onClose={controller.closeMenu}
    >
      {activity.kind === MOBILE_ACTIVITY_KIND.HOME ? (
        <>
          <button type="button" onClick={controller.refresh}>
            {MOBILE_COPY.REFRESH}
          </button>
          <button type="button" onClick={controller.openWallpaper}>
            {MOBILE_COPY.WALLPAPER}
          </button>
          <AccessLogoutLink
            logoutUrl={session.logoutUrl}
            pendingChildren={ACCESS_COPY.LOGGING_OUT}
          >
            {MOBILE_COPY.LOGOUT}
          </AccessLogoutLink>
        </>
      ) : null}
      {activity.kind === MOBILE_ACTIVITY_KIND.TRASH ? (
        <button type="button" onClick={controller.refresh}>
          {MOBILE_COPY.REFRESH}
        </button>
      ) : null}
      {activity.kind === MOBILE_ACTIVITY_KIND.MEDIA ? (
        <button type="button" onClick={controller.downloadCurrentMedia}>
          {MOBILE_COPY.DOWNLOAD}
        </button>
      ) : null}
      {activity.kind === MOBILE_ACTIVITY_KIND.WIDGET_DRAFT ? (
        <button type="button" onClick={controller.discardCurrentDraft}>
          {MOBILE_COPY.DELETE_DRAFT}
        </button>
      ) : null}
    </MobileMenu>
  );
}
