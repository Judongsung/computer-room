import { lazy, Suspense, useState } from "react";
import { ACCESS_BOOTSTRAP_STATUS, CLIENT_ACCESS_MODE } from "@client/constants/platform/access";
import { CLIENT_INTERFACE_MODE } from "@client/constants/shared/interface-mode";
import { APP_COPY } from "@client/content/ko/shared/app";
import { ACCESS_COPY } from "@client/content/ko/platform/access";
import { DashboardApiClient } from "@client/api/widgets/dashboard-api-client";
import { GuestApiClient } from "@client/api/guest/guest-api-client";
import { useAccessBootstrap } from "@client/hooks/platform/use-access-bootstrap";
import { useInterfaceMode } from "@client/hooks/shared/use-interface-mode";
import type { AppProps } from "@client/types/app/app";

const DesktopApplication = lazy(() =>
  import("@client/components/desktop/application/desktop-application").then((module) => ({
    default: module.DesktopApplication,
  })),
);
const MobileApplication = lazy(() =>
  import("@client/components/mobile/mobile-application").then((module) => ({
    default: module.MobileApplication,
  })),
);
const GuestDesktopApplication = lazy(() =>
  import("@client/components/desktop/guest/guest-desktop-application").then(
    (module) => ({ default: module.GuestDesktopApplication }),
  ),
);
const GuestMobileApplication = lazy(() =>
  import("@client/components/mobile/guest/guest-mobile-application").then(
    (module) => ({ default: module.GuestMobileApplication }),
  ),
);

export function App(props: AppProps) {
  const mode = useInterfaceMode(props.interfaceMode);
  const [ownerGateway] = useState(() => props.api ?? new DashboardApiClient());
  const [guestGateway] = useState(() => props.guestApi ?? new GuestApiClient());
  const forcedMode =
    props.accessMode ??
    (props.api ? CLIENT_ACCESS_MODE.OWNER : undefined);
  const bootstrap = useAccessBootstrap({
    owner: ownerGateway,
    guest: guestGateway,
    ...(forcedMode ? { forcedMode } : {}),
    injectedOwnerSession: props.initialSession ?? null,
  });

  let application;
  if (bootstrap.state.status === ACCESS_BOOTSTRAP_STATUS.LOADING) {
    application = accessState(mode, ACCESS_COPY.CONNECTING);
  } else if (bootstrap.state.status === ACCESS_BOOTSTRAP_STATUS.ERROR) {
    application = (
      <main className={`interface-loading interface-loading--${mode}`}>
        <p role="alert">{bootstrap.state.message}</p>
        <button type="button" onClick={bootstrap.retry}>
          {ACCESS_COPY.RETRY}
        </button>
      </main>
    );
  } else if (bootstrap.state.status === ACCESS_BOOTSTRAP_STATUS.GUEST) {
    application = mode === CLIENT_INTERFACE_MODE.MOBILE ? (
      <GuestMobileApplication
        session={bootstrap.state.session}
        gateway={guestGateway}
      />
    ) : (
      <GuestDesktopApplication
        session={bootstrap.state.session}
        gateway={guestGateway}
      />
    );
  } else {
    const ownerProps = {
      ...props,
      api: ownerGateway,
      ...(bootstrap.state.session
        ? { initialSession: bootstrap.state.session }
        : {}),
    };
    application = mode === CLIENT_INTERFACE_MODE.MOBILE ? (
      <MobileApplication {...ownerProps} />
    ) : (
      <DesktopApplication {...ownerProps} />
    );
  }
  return (
    <Suspense
      fallback={
        <main className={`interface-loading interface-loading--${mode}`} role="status">
          {APP_COPY.CONNECTING}
        </main>
      }
    >
      {application}
    </Suspense>
  );
}

function accessState(mode: string, message: string) {
  return (
    <main
      className={`interface-loading interface-loading--${mode}`}
      role="status"
    >
      {message}
    </main>
  );
}
