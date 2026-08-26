import type { FilesystemDirectoryDetails } from "@/types/filesystem/directory-details";
import type { FOLDER_PROPERTIES_STATUS } from "@client/constants/filesystem/details";

export interface FolderPropertiesTarget {
  readonly id: string;
  readonly name: string;
}

export type FolderPropertiesState =
  | { readonly status: typeof FOLDER_PROPERTIES_STATUS.CLOSED }
  | {
      readonly status: typeof FOLDER_PROPERTIES_STATUS.LOADING;
      readonly target: FolderPropertiesTarget;
    }
  | {
      readonly status: typeof FOLDER_PROPERTIES_STATUS.READY;
      readonly target: FolderPropertiesTarget;
      readonly details: FilesystemDirectoryDetails;
    }
  | {
      readonly status: typeof FOLDER_PROPERTIES_STATUS.ERROR;
      readonly target: FolderPropertiesTarget;
      readonly message: string;
    };

export interface FolderPropertiesController {
  readonly state: FolderPropertiesState;
  open(target: FolderPropertiesTarget): void;
  refresh(): void;
  close(): void;
}
