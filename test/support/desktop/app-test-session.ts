import { ACCESS_LOGOUT_PATH } from "@/constants/platform/auth";
import { MAX_FILE_SIZE_BYTES } from "@/constants/filesystem/file";
import type { SessionInfo } from "@/types/platform/auth";

export const SESSION: SessionInfo = {
  email: "owner@example.com",
  logoutUrl: ACCESS_LOGOUT_PATH,
  filePolicy: { maxUploadSizeBytes: MAX_FILE_SIZE_BYTES },
};
