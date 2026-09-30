import { useCallback, useLayoutEffect, useMemo, useState } from "react";
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
import { mergeFilesystemItems } from "@client/hooks/filesystem/use-filesystem-pages";
import type { GuestAccessGateway } from "@client/types/admin/guest-access";

interface PendingDirectoryChange {
  readonly item: GuestAccessEntry;
  readonly published: boolean;
}

interface ReadRequest {
  promise: Promise<void>;
}

interface PageRequest extends ReadRequest {
  readonly operation: "reload" | "more";
}

const INITIAL_STATE = {
  settings: null as GuestAccessSettings | null,
  page: null as GuestAccessDirectoryPage | null,
  loading: true,
  loadingMore: false,
  settingsBusy: false,
  entryBusyId: null as string | null,
  settingsReadError: null as string | null,
  settingsSaveError: null as string | null,
  directoryError: null as string | null,
  publicationError: null as string | null,
  pendingDirectoryChange: null as PendingDirectoryChange | null,
};

export function useGuestAccessAdmin(gateway: GuestAccessGateway) {
  const session = useMemo(() => ({
    gateway,
    active: false,
    directoryId: FILESYSTEM_ROOT_ID.DESKTOP as string,
    epoch: 0,
    settingsRead: null as ReadRequest | null,
    settingsSave: null as object | null,
    pageRead: null as PageRequest | null,
    publication: null as object | null,
    settingsRefreshPending: false,
    directoryRefreshPending: false,
    state: { ...INITIAL_STATE },
  }), [gateway]);
  const [state, setState] = useState({ session, ...INITIAL_STATE });
  const publish = useCallback((patch: Partial<typeof INITIAL_STATE> = {}): void => {
    if (!session.active) return;
    session.state = {
      ...session.state,
      ...patch,
      loading: Boolean(session.settingsRead || session.pageRead?.operation === "reload"),
      loadingMore: session.pageRead?.operation === "more",
      settingsBusy: Boolean(session.settingsSave),
    };
    setState({ session, ...session.state });
  }, [session]);

  const readSettings = useCallback((): Promise<void> => {
    if (!session.active) return Promise.resolve();
    if (session.settingsSave) {
      session.settingsRefreshPending = true;
      return Promise.resolve();
    }
    if (session.settingsRead) return session.settingsRead.promise;
    const request: ReadRequest = { promise: Promise.resolve() };
    session.settingsRead = request;
    publish();
    const current = () => session.active && session.settingsRead === request;
    request.promise = (async () => {
      try {
        const settings = await session.gateway.getSettings();
        if (current()) publish({ settings, settingsReadError: null });
      } catch (caught) {
        if (current()) publish({ settingsReadError: messageFromError(caught, GUEST_ACCESS_COPY.LOAD_FAILED) });
      } finally {
        if (current()) {
          session.settingsRead = null;
          publish();
        }
      }
    })();
    return request.promise;
  }, [publish, session]);

  const readDirectory = useCallback((operation: PageRequest["operation"] = "reload", force = false): Promise<void> => {
    if (!session.active) return Promise.resolve();
    if (session.publication && !force) {
      if (operation === "reload") session.directoryRefreshPending = true;
      return Promise.resolve();
    }
    if (!force && session.pageRead?.operation === "reload") return session.pageRead.promise;
    if (!force && session.pageRead?.operation === operation) return session.pageRead.promise;
    const previous = session.state.page;
    const offset = operation === "more" ? previous?.nextOffset : undefined;
    if (operation === "more" && (offset === undefined || offset === null)) return Promise.resolve();
    if (operation === "reload") session.epoch += 1;
    const epoch = session.epoch;
    const id = session.directoryId;
    const request: PageRequest = { operation, promise: Promise.resolve() };
    session.pageRead = request;
    publish();
    const current = () => session.active && session.epoch === epoch && session.pageRead === request;
    request.promise = (async () => {
      try {
        const next = operation === "more"
          ? await session.gateway.listDirectory(id, offset ?? 0)
          : await session.gateway.listDirectory(id);
        if (current()) publish({
          page: operation === "more" && previous
            ? { ...next, items: mergeFilesystemItems(previous.items, next.items, (item) => item.entry.id) }
            : next,
          directoryError: null,
        });
      } catch (caught) {
        if (current()) publish({ directoryError: messageFromError(caught, GUEST_ACCESS_COPY.LOAD_FAILED) });
      } finally {
        if (current()) {
          session.pageRead = null;
          publish();
        }
      }
    })();
    return request.promise;
  }, [publish, session]);

  useLayoutEffect(() => {
    session.active = true;
    session.state = { ...INITIAL_STATE };
    session.directoryId = FILESYSTEM_ROOT_ID.DESKTOP;
    void readSettings();
    void readDirectory("reload", true);
    return () => {
      session.active = false;
      session.epoch += 1;
      session.settingsRead = null;
      session.settingsSave = null;
      session.pageRead = null;
      session.publication = null;
      session.settingsRefreshPending = false;
      session.directoryRefreshPending = false;
    };
  }, [readDirectory, readSettings, session]);

  const navigate = useCallback((id: string): void => {
    if (!session.active || session.directoryId === id) return;
    session.directoryId = id;
    session.epoch += 1;
    session.pageRead = null;
    session.directoryRefreshPending = false;
    publish({ page: null, directoryError: null, publicationError: null, pendingDirectoryChange: null });
    void readDirectory("reload", true);
  }, [publish, readDirectory, session]);

  const updateEnabled = useCallback(async (enabled: boolean): Promise<void> => {
    const previous = session.state.settings;
    if (!session.active || !previous || session.settingsSave) return;
    const token = {};
    session.settingsSave = token;
    session.settingsRead = null;
    publish({ settings: { enabled }, settingsSaveError: null });
    const current = () => session.active && session.settingsSave === token;
    try {
      const settings = await session.gateway.updateSettings(enabled);
      if (current()) publish({ settings });
    } catch (caught) {
      if (current()) publish({ settings: previous, settingsSaveError: messageFromError(caught, GUEST_ACCESS_COPY.SAVE_FAILED) });
    } finally {
      if (current()) {
        session.settingsSave = null;
        publish();
        if (session.settingsRefreshPending) {
          session.settingsRefreshPending = false;
          void readSettings();
        }
      }
    }
  }, [publish, readSettings, session]);

  const applyPublication = useCallback(async (item: GuestAccessEntry, published: boolean): Promise<void> => {
    const page = session.state.page;
    const previous = page?.items.find((candidate) => candidate.entry.id === item.entry.id);
    if (!session.active || session.publication || !page || !previous) return;
    const token = {};
    session.publication = token;
    session.epoch += 1;
    session.pageRead = null;
    const epoch = session.epoch;
    publish({
      entryBusyId: item.entry.id,
      publicationError: null,
      page: replacePublication(page, {
        ...previous,
        publicationState: published ? GUEST_PUBLICATION_STATE.PUBLIC : GUEST_PUBLICATION_STATE.PRIVATE,
      }),
    });
    const current = () => session.active && session.publication === token;
    let saved = false;
    try {
      await session.gateway.setEntryPublished(item.entry.id, published);
      saved = current();
    } catch (caught) {
      if (current() && session.epoch === epoch && session.state.page) publish({
        page: replacePublication(session.state.page, previous),
        publicationError: messageFromError(caught, GUEST_ACCESS_COPY.SAVE_FAILED),
      });
    } finally {
      if (current()) {
        session.publication = null;
        publish({ entryBusyId: null });
        const refresh = saved || session.directoryRefreshPending;
        session.directoryRefreshPending = false;
        if (refresh) await readDirectory("reload", true);
      }
    }
  }, [publish, readDirectory, session]);

  const requestPublicationChange = useCallback((item: GuestAccessEntry): void => {
    if (!session.active || session.publication || !session.state.page?.items.some((candidate) => candidate.entry.id === item.entry.id)) return;
    const published = item.publicationState !== GUEST_PUBLICATION_STATE.PUBLIC;
    if (item.entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) publish({ pendingDirectoryChange: { item, published } });
    else void applyPublication(item, published);
  }, [applyPublication, publish, session]);
  const confirmDirectoryChange = useCallback(async (): Promise<void> => {
    const pending = session.state.pendingDirectoryChange;
    if (!session.active || !pending) return;
    publish({ pendingDirectoryChange: null });
    await applyPublication(pending.item, pending.published);
  }, [applyPublication, publish, session]);
  const cancelDirectoryChange = useCallback(() => publish({ pendingDirectoryChange: null }), [publish]);
  const loadMore = useCallback(() => readDirectory("more"), [readDirectory]);
  const retry = useCallback(async (): Promise<void> => {
    await Promise.all([readSettings(), readDirectory()]);
  }, [readDirectory, readSettings]);

  const visible = state.session === session ? state : INITIAL_STATE;
  return {
    settings: visible.settings,
    page: visible.page,
    loading: visible.loading,
    loadingMore: visible.loadingMore,
    settingsBusy: visible.settingsBusy,
    entryBusyId: visible.entryBusyId,
    error: visible.settingsSaveError ?? visible.publicationError ?? visible.settingsReadError ?? visible.directoryError,
    pendingDirectoryChange: visible.pendingDirectoryChange,
    navigate,
    updateEnabled,
    requestPublicationChange,
    confirmDirectoryChange,
    cancelDirectoryChange,
    loadMore,
    retry,
  } as const;
}

function replacePublication(page: GuestAccessDirectoryPage, item: GuestAccessEntry): GuestAccessDirectoryPage {
  return {
    ...page,
    items: page.items.map((candidate) => candidate.entry.id === item.entry.id ? item : candidate),
  };
}
