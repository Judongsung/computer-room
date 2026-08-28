import { lazy } from "react";

export const MobileDirectory = lazy(() =>
  import("@client/components/mobile/filesystem/mobile-directory").then(
    (module) => ({ default: module.MobileDirectory }),
  ),
);

export const MobileRecycleBin = lazy(() =>
  import("@client/components/mobile/filesystem/mobile-recycle-bin").then(
    (module) => ({ default: module.MobileRecycleBin }),
  ),
);

export const MobileWallpaperPicker = lazy(() =>
  import("@client/components/mobile/launcher/mobile-wallpaper-picker").then(
    (module) => ({ default: module.MobileWallpaperPicker }),
  ),
);

export const MobileMediaViewer = lazy(() =>
  import("@client/components/mobile/media/mobile-media-viewer").then(
    (module) => ({ default: module.MobileMediaViewer }),
  ),
);

export const MobileStorageStatus = lazy(() =>
  import("@client/components/mobile/widgets/mobile-storage-status").then(
    (module) => ({ default: module.MobileStorageStatus }),
  ),
);

export const MobileWidgetCatalog = lazy(() =>
  import("@client/components/mobile/widgets/mobile-widget-catalog").then(
    (module) => ({ default: module.MobileWidgetCatalog }),
  ),
);

export const MobileWidgetDraftScreen = lazy(() =>
  import("@client/components/mobile/widgets/mobile-widget-draft-screen").then(
    (module) => ({ default: module.MobileWidgetDraftScreen }),
  ),
);

export const MobileWidgetFileScreen = lazy(() =>
  import("@client/components/mobile/widgets/mobile-widget-file-screen").then(
    (module) => ({ default: module.MobileWidgetFileScreen }),
  ),
);
