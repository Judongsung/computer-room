import { useEffect, useState } from "react";
import type { FilesystemTrashPage } from "@/types/filesystem/filesystem";
import { MobileEntryIcon } from "@client/components/mobile/filesystem/mobile-entry-icon";
import { MobileActivity } from "@client/components/mobile/shared/mobile-activity";
import { MOBILE_CLASS_NAME, MOBILE_COPY } from "@client/constants/shared/mobile";
import { messageFromError } from "@client/errors/error-message";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";

interface MobileRecycleBinProps {
  readonly gateway: FilesystemGateway;
  readonly revision: number;
}

export function MobileRecycleBin({ gateway, revision }: MobileRecycleBinProps) {
  const [page, setPage] = useState<FilesystemTrashPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let active = true;
    void gateway.listTrash().then(
      (next) => {
        if (!active) return;
        setPage(next);
        setError(null);
      },
      (caught: unknown) => {
        if (active) setError(messageFromError(caught, MOBILE_COPY.LOAD_FAILED));
      },
    );
    return () => {
      active = false;
    };
  }, [gateway, revision]);

  const loadMore = async (): Promise<void> => {
    if (!page?.nextOffset || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await gateway.listTrash(page.nextOffset);
      setPage({ ...next, items: [...page.items, ...next.items] });
    } catch (caught) {
      setError(messageFromError(caught, MOBILE_COPY.LOAD_FAILED));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <MobileActivity title={MOBILE_COPY.RECYCLE_BIN}>
      {!page && !error ? <p className={MOBILE_CLASS_NAME.MESSAGE}>{MOBILE_COPY.LOADING}</p> : null}
      {error ? <p className={MOBILE_CLASS_NAME.ERROR} role="alert">{error}</p> : null}
      {page?.items.length === 0 ? (
        <p className={MOBILE_CLASS_NAME.MESSAGE}>{MOBILE_COPY.EMPTY_TRASH}</p>
      ) : null}
      {page?.items.length ? (
        <ul className={MOBILE_CLASS_NAME.LIST}>
          {page.items.map(({ entry, deletedAt, originalLocation }) => (
            <li key={entry.id} className={MOBILE_CLASS_NAME.LIST_ITEM}>
              <span className={MOBILE_CLASS_NAME.LIST_ICON}>
                <MobileEntryIcon entry={entry} gateway={gateway} />
              </span>
              <span className={MOBILE_CLASS_NAME.LIST_TEXT}>
                <strong>{entry.name}</strong>
                <small className={MOBILE_CLASS_NAME.LIST_META}>
                  {MOBILE_COPY.ORIGINAL_LOCATION}: {originalLocation}
                </small>
                <small className={MOBILE_CLASS_NAME.LIST_META}>
                  {MOBILE_COPY.DELETED_AT}: {new Date(deletedAt).toLocaleString("ko-KR")}
                </small>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {page?.nextOffset !== null && page?.nextOffset !== undefined ? (
        <button type="button" disabled={loadingMore} onClick={() => void loadMore()}>
          {loadingMore ? MOBILE_COPY.LOADING : MOBILE_COPY.LOAD_MORE}
        </button>
      ) : null}
    </MobileActivity>
  );
}
