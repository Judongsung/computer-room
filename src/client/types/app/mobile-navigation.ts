import type { MOBILE_ACTIVITY_KIND } from "@client/constants/shared/mobile";
import type { FilesystemFileEntry } from "@/types/filesystem/filesystem";

export type MobileActivityKind =
  (typeof MOBILE_ACTIVITY_KIND)[keyof typeof MOBILE_ACTIVITY_KIND];

export type MobileActivity =
  | { readonly kind: typeof MOBILE_ACTIVITY_KIND.HOME }
  | {
      readonly kind: typeof MOBILE_ACTIVITY_KIND.DIRECTORY;
      readonly directoryId: string;
      readonly title: string;
    }
  | { readonly kind: typeof MOBILE_ACTIVITY_KIND.COMPUTER }
  | { readonly kind: typeof MOBILE_ACTIVITY_KIND.TRASH }
  | {
      readonly kind: typeof MOBILE_ACTIVITY_KIND.MEDIA;
      readonly file: FilesystemFileEntry;
      readonly directoryId: string;
    }
  | {
      readonly kind: typeof MOBILE_ACTIVITY_KIND.WIDGET_FILE;
      readonly entryId: string;
      readonly title: string;
    }
  | { readonly kind: typeof MOBILE_ACTIVITY_KIND.WIDGET_DRAFT }
  | { readonly kind: typeof MOBILE_ACTIVITY_KIND.STORAGE_STATUS };

export interface MobileNavigationController {
  readonly current: MobileActivity;
  readonly canGoBack: boolean;
  push(activity: MobileActivity): void;
  back(): void;
  home(): void;
  replace(activity: MobileActivity): void;
}
