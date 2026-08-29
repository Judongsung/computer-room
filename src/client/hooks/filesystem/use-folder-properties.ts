import { FOLDER_PROPERTIES_COPY } from "@client/content/ko/filesystem/details";
import { useCallback, useEffect, useRef, useState } from "react";
import { FOLDER_PROPERTIES_STATUS } from "@client/constants/filesystem/details";
import type { FilesystemDirectoryGateway } from "@client/types/filesystem/ports/directory";
import { messageFromError } from "@client/errors/error-message";
import type {
  FolderPropertiesController,
  FolderPropertiesState,
  FolderPropertiesTarget,
} from "@client/types/filesystem/folder-properties";

const CLOSED_STATE: FolderPropertiesState = {
  status: FOLDER_PROPERTIES_STATUS.CLOSED,
};

export function useFolderProperties(
  gateway: Pick<FilesystemDirectoryGateway, "getDirectoryDetails">,
): FolderPropertiesController {
  const requestSequence = useRef(0);
  const [state, setState] = useState<FolderPropertiesState>(CLOSED_STATE);

  const load = useCallback(
    (target: FolderPropertiesTarget): void => {
      const requestId = ++requestSequence.current;
      setState({ status: FOLDER_PROPERTIES_STATUS.LOADING, target });
      void gateway
        .getDirectoryDetails(target.id)
        .then((details) => {
          if (requestSequence.current !== requestId) return;
          setState({
            status: FOLDER_PROPERTIES_STATUS.READY,
            target,
            details,
          });
        })
        .catch((reason: unknown) => {
          if (requestSequence.current !== requestId) return;
          setState({
            status: FOLDER_PROPERTIES_STATUS.ERROR,
            target,
            message: messageFromError(reason, FOLDER_PROPERTIES_COPY.LOAD_FAILED),
          });
        });
    },
    [gateway],
  );

  const refresh = useCallback((): void => {
    if (state.status !== FOLDER_PROPERTIES_STATUS.CLOSED) {
      load(state.target);
    }
  }, [load, state]);

  const close = useCallback((): void => {
    requestSequence.current += 1;
    setState(CLOSED_STATE);
  }, []);

  useEffect(
    () => () => {
      requestSequence.current += 1;
    },
    [],
  );

  return { state, open: load, refresh, close };
}
