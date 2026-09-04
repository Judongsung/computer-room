import { useState } from "react";
import type { FilesystemFileEntry } from "@/types/filesystem/filesystem";
import type { FileDownloadSource } from "@client/types/filesystem/text/files";
import { downloadFile } from "@client/utils/download-file";

export function useDownloadConfirmation(gateway: FileDownloadSource) {
  const [file, request] = useState<FilesystemFileEntry | null>(null);
  return {
    file, request,
    cancel: () => request(null),
    confirm: () => {
      if (!file) return;
      downloadFile(gateway.downloadUrl(file.id));
      request(null);
    },
  };
}
