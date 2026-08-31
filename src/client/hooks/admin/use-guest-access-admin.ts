import { useCallback, useEffect, useRef, useState } from "react";
import { GUEST_PUBLICATION_STATE } from "@/constants/admin/guest-access";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import type {
  GuestAccessDirectoryPage,
  GuestAccessEntry,
  GuestAccessSettings,
} from "@/types/admin/guest-access";
import { GUEST_ACCESS_COPY } from "@client/content/ko/admin/guest-access";
import { messageFromError } from "@client/errors/error-message";
import type { GuestAccessGateway } from "@client/types/admin/guest-access";

interface PendingDirectoryChange {
  readonly item: GuestAccessEntry;
  readonly published: boolean;
}

export function useGuestAccessAdmin(gateway: GuestAccessGateway) {
  const [settings, setSettings] = useState<GuestAccessSettings | null>(null);
  const [directoryId, setDirectoryId] = useState<string>(
    FILESYSTEM_ROOT_ID.DESKTOP,
  );
  const [page, setPage] = useState<GuestAccessDirectoryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [entryBusyId, setEntryBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDirectoryChange, setPendingDirectoryChange] =
    useState<PendingDirectoryChange | null>(null);
  const requestSequence = useRef(0);
  const directoryIdRef = useRef(directoryId);

  const loadDirectory = useCallback(
    async (id: string): Promise<void> => {
      const sequence = ++requestSequence.current;
      setLoading(true);
      setError(null);
      try {
        const next = await gateway.listDirectory(id);
        if (sequence === requestSequence.current) setPage(next);
      } catch (caught) {
        if (sequence === requestSequence.current) {
          setError(messageFromError(caught, GUEST_ACCESS_COPY.LOAD_FAILED));
        }
      } finally {
        if (sequence === requestSequence.current) setLoading(false);
      }
    },
    [gateway],
  );

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [nextSettings] = await Promise.all([
        gateway.getSettings(),
        loadDirectory(directoryId),
      ]);
      setSettings(nextSettings);
    } catch (caught) {
      setError(messageFromError(caught, GUEST_ACCESS_COPY.LOAD_FAILED));
    } finally {
      setLoading(false);
    }
  }, [directoryId, gateway, loadDirectory]);

  useEffect(() => {
    void load();
  }, [load]);

  const navigate = useCallback((id: string): void => {
    directoryIdRef.current = id;
    setDirectoryId(id);
  }, []);

  const updateEnabled = useCallback(
    async (enabled: boolean): Promise<void> => {
      if (!settings || settingsBusy) return;
      const previous = settings;
      setSettings({ enabled });
      setSettingsBusy(true);
      setError(null);
      try {
        setSettings(await gateway.updateSettings(enabled));
      } catch (caught) {
        setSettings(previous);
        setError(messageFromError(caught, GUEST_ACCESS_COPY.SAVE_FAILED));
      } finally {
        setSettingsBusy(false);
      }
    },
    [gateway, settings, settingsBusy],
  );

  const applyPublication = useCallback(
    async (item: GuestAccessEntry, published: boolean): Promise<void> => {
      if (entryBusyId) return;
      const previousPage = page;
      const mutationDirectoryId = page?.directory.id ?? directoryId;
      setEntryBusyId(item.entry.id);
      setError(null);
      setPage((current) =>
        current
          ? {
              ...current,
              items: current.items.map((candidate) =>
                candidate.entry.id === item.entry.id
                  ? {
                      ...candidate,
                      publicationState: published
                        ? GUEST_PUBLICATION_STATE.PUBLIC
                        : GUEST_PUBLICATION_STATE.PRIVATE,
                    }
                  : candidate,
              ),
            }
          : current,
      );
      try {
        await gateway.setEntryPublished(item.entry.id, published);
        if (directoryIdRef.current === mutationDirectoryId) {
          await loadDirectory(mutationDirectoryId);
        }
      } catch (caught) {
        setPage((current) =>
          current?.directory.id === mutationDirectoryId ? previousPage : current,
        );
        setError(messageFromError(caught, GUEST_ACCESS_COPY.SAVE_FAILED));
      } finally {
        setEntryBusyId(null);
      }
    },
    [directoryId, entryBusyId, gateway, loadDirectory, page],
  );

  const requestPublicationChange = useCallback(
    (item: GuestAccessEntry): void => {
      const published =
        item.publicationState !== GUEST_PUBLICATION_STATE.PUBLIC;
      if (item.entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) {
        setPendingDirectoryChange({ item, published });
        return;
      }
      void applyPublication(item, published);
    },
    [applyPublication],
  );

  const confirmDirectoryChange = useCallback(async (): Promise<void> => {
    const pending = pendingDirectoryChange;
    if (!pending) return;
    setPendingDirectoryChange(null);
    await applyPublication(pending.item, pending.published);
  }, [applyPublication, pendingDirectoryChange]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (!page || page.nextOffset === null || loadingMore) return;
    const currentDirectoryId = page.directory.id;
    setLoadingMore(true);
    setError(null);
    try {
      const next = await gateway.listDirectory(
        currentDirectoryId,
        page.nextOffset,
      );
      setPage((current) =>
        current?.directory.id === next.directory.id
          ? { ...next, items: [...current.items, ...next.items] }
          : current,
      );
    } catch (caught) {
      setError(messageFromError(caught, GUEST_ACCESS_COPY.LOAD_FAILED));
    } finally {
      setLoadingMore(false);
    }
  }, [gateway, loadingMore, page]);

  return {
    settings,
    page,
    loading,
    loadingMore,
    settingsBusy,
    entryBusyId,
    error,
    pendingDirectoryChange,
    navigate,
    updateEnabled,
    requestPublicationChange,
    confirmDirectoryChange,
    cancelDirectoryChange: () => setPendingDirectoryChange(null),
    loadMore,
    retry: load,
  } as const;
}
