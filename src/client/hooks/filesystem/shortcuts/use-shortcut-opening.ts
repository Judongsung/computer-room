import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import type { FilesystemEntry, FilesystemShortcutTarget } from "@/types/filesystem/filesystem";
import type { FilesystemShortcutUseCases } from "@/types/filesystem/services/shortcut-service";
import { SHORTCUT_COPY } from "@client/content/ko/filesystem/shortcut";
import { messageFromError } from "@client/errors/error-message";

export function useShortcutOpening(
  gateway: Pick<FilesystemShortcutUseCases, "resolveShortcut">,
  location: unknown,
  onOpen: (entry: FilesystemShortcutTarget) => void,
) {
  const session = useMemo(
    () => ({ gateway, location, active: false, pending: null as object | null }),
    [gateway, location],
  );
  const latest = useRef(onOpen);
  const [failure, setFailure] = useState<{ session: typeof session; message: string } | null>(null);
  useLayoutEffect(() => { latest.current = onOpen; });
  useLayoutEffect(() => {
    session.active = true;
    return () => {
      session.active = false;
      session.pending = null;
    };
  }, [session]);
  const open = useCallback((entry: FilesystemEntry): void => {
    if (!session.active) return;
    if (entry.kind !== FILESYSTEM_ENTRY_KIND.SHORTCUT) {
      session.pending = null;
      setFailure(null);
      latest.current(entry);
      return;
    }
    if (session.pending) return;
    const token = {};
    session.pending = token;
    setFailure(null);
    const current = () => session.active && session.pending === token;
    void gateway.resolveShortcut(entry.id).then((target) => {
      if (current()) latest.current(target);
    }).catch((reason: unknown) => {
      if (current()) {
        setFailure({ session, message: messageFromError(reason, SHORTCUT_COPY.OPEN_FAILED) });
      }
    }).finally(() => {
      if (current()) session.pending = null;
    });
  }, [gateway, session]);
  return {
    open,
    error: failure?.session === session ? failure.message : null,
    clearError: () => setFailure(null),
  };
}
