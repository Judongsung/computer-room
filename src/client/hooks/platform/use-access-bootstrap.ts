import { useCallback, useEffect, useState } from "react";
import type { SessionInfo } from "@/types/platform/auth";
import {
  ACCESS_BOOTSTRAP_STATUS,
  CLIENT_ACCESS_MODE,
} from "@client/constants/platform/access";
import { ACCESS_COPY } from "@client/content/ko/platform/access";
import {
  clearOwnerAccessHint,
  consumeOwnerAccessQuery,
  hasOwnerAccessHint,
} from "@client/domain/platform/access-mode";
import { messageFromError } from "@client/errors/error-message";
import type {
  AccessBootstrapState,
  ClientAccessMode,
  GuestSessionGateway,
} from "@client/types/platform/access";
import type { SessionGateway } from "@client/types/widgets/ports/session";

interface AccessBootstrapOptions {
  readonly owner: SessionGateway;
  readonly guest: GuestSessionGateway;
  readonly forcedMode?: ClientAccessMode;
  readonly injectedOwnerSession?: SessionInfo | null;
}

export function useAccessBootstrap({
  owner,
  guest,
  forcedMode,
  injectedOwnerSession = null,
}: AccessBootstrapOptions) {
  const initialState = forcedMode === CLIENT_ACCESS_MODE.OWNER
    ? {
        status: ACCESS_BOOTSTRAP_STATUS.OWNER,
        session: injectedOwnerSession,
      } satisfies AccessBootstrapState
    : { status: ACCESS_BOOTSTRAP_STATUS.LOADING } satisfies AccessBootstrapState;
  const [state, setState] = useState<AccessBootstrapState>(initialState);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (forcedMode === CLIENT_ACCESS_MODE.OWNER) return undefined;
    let active = true;

    const loadGuest = async (): Promise<void> => {
      const session = await guest.getSession();
      if (active) {
        setState({ status: ACCESS_BOOTSTRAP_STATUS.GUEST, session });
      }
    };
    const load = async (): Promise<void> => {
      setState({ status: ACCESS_BOOTSTRAP_STATUS.LOADING });
      const requestedOwner =
        forcedMode === undefined &&
        typeof window !== "undefined" &&
        consumeOwnerAccessQuery(window.location, window.history);
      const shouldProbeOwner =
        forcedMode !== CLIENT_ACCESS_MODE.GUEST &&
        (requestedOwner || hasOwnerAccessHint());

      if (shouldProbeOwner) {
        try {
          const session = await owner.getSession();
          if (active) {
            setState({ status: ACCESS_BOOTSTRAP_STATUS.OWNER, session });
          }
          return;
        } catch {
          clearOwnerAccessHint();
        }
      }

      try {
        await loadGuest();
      } catch (error) {
        if (active) {
          setState({
            status: ACCESS_BOOTSTRAP_STATUS.ERROR,
            message: messageFromError(error, ACCESS_COPY.LOAD_FAILED),
          });
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [attempt, forcedMode, guest, owner]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);
  return { state, retry } as const;
}
