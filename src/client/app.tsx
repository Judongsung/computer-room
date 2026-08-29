import { lazy, Suspense } from "react";
import { CLIENT_INTERFACE_MODE } from "@client/constants/shared/interface-mode";
import { APP_COPY } from "@client/content/ko/shared/app";
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

export function App(props: AppProps) {
  const mode = useInterfaceMode(props.interfaceMode);
  const application =
    mode === CLIENT_INTERFACE_MODE.MOBILE ? (
      <MobileApplication {...props} />
    ) : (
      <DesktopApplication {...props} />
    );
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
