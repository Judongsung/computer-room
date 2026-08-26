import { useCallback, useEffect, useRef, useState } from "react";
import {
  FOLDER_PROPERTIES_COPY,
  FOLDER_PROPERTIES_STATUS,
} from "@client/constants/filesystem/details";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import type {
  FolderPropertiesController,
  FolderPropertiesState,
  FolderPropertiesTarget,
} from "@client/types/filesystem/folder-properties";

const CLOSED_STATE: FolderPropertiesState = {
  status: FOLDER_PROPERTIES_STATUS.CLOSED,
};

export function useFolderProperties(
  gateway: FilesystemGateway,
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
            message: errorMessage(reason),
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

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : FOLDER_PROPERTIES_COPY.LOAD_FAILED;
}
