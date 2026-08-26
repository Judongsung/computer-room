import { useCallback, useEffect, useState } from "react";
import type { StorageStatusSnapshot } from "@/types/storage/storage-status";
import { MobileActivity } from "@client/components/mobile/shared/mobile-activity";
import { MOBILE_CLASS_NAME, MOBILE_COPY } from "@client/constants/shared/mobile";
import { STORAGE_STATUS_COPY } from "@client/constants/storage/storage-status";
import type { StorageStatusGateway } from "@client/types/storage/storage-status";
import { formatFileSize } from "@client/utils/format-file-size";

interface MobileStorageStatusProps {
  readonly gateway: StorageStatusGateway;
}

export function MobileStorageStatus({ gateway }: MobileStorageStatusProps) {
  const [status, setStatus] = useState<StorageStatusSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      setStatus(await gateway.getStatus());
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : STORAGE_STATUS_COPY.LOAD_FAILED,
      );
    } finally {
      setLoading(false);
    }
  }, [gateway]);
  useEffect(() => void load(), [load]);

  return (
    <MobileActivity
      title={STORAGE_STATUS_COPY.TITLE}
      actions={
        <button type="button" disabled={loading} onClick={() => void load()}>
          {MOBILE_COPY.REFRESH}
        </button>
      }
    >
      <div className={MOBILE_CLASS_NAME.WIDGET} aria-busy={loading}>
        {loading && !status ? <p>{STORAGE_STATUS_COPY.LOADING}</p> : null}
        {error ? <p className={MOBILE_CLASS_NAME.ERROR} role="alert">{error}</p> : null}
        {status ? (
          <>
            <section className={MOBILE_CLASS_NAME.WIDGET_PANEL}>
              <h2>{STORAGE_STATUS_COPY.R2_TITLE}</h2>
              <dl>
                <div><dt>{STORAGE_STATUS_COPY.TOTAL_USAGE}</dt><dd>{formatFileSize(status.r2.total.bytes)}</dd></div>
                <div><dt>{STORAGE_STATUS_COPY.REGISTERED_FILES}</dt><dd>{status.r2.total.objectCount.toLocaleString()}개</dd></div>
              </dl>
            </section>
            <section className={MOBILE_CLASS_NAME.WIDGET_PANEL}>
              <h2>{STORAGE_STATUS_COPY.D1_TITLE}</h2>
              <dl>
                <div><dt>{STORAGE_STATUS_COPY.DATABASE_USAGE}</dt><dd>{formatFileSize(status.d1.databaseBytes)}</dd></div>
                <div><dt>{STORAGE_STATUS_COPY.DIRECTORIES}</dt><dd>{status.d1.directoryCount.toLocaleString()}개</dd></div>
                <div><dt>{STORAGE_STATUS_COPY.WIDGETS}</dt><dd>{status.d1.widgetCount.toLocaleString()}개</dd></div>
                <div><dt>{STORAGE_STATUS_COPY.TRASH_ITEMS}</dt><dd>{status.d1.trashItemCount.toLocaleString()}개</dd></div>
              </dl>
            </section>
            <small>{STORAGE_STATUS_COPY.MEASURED_AT}: {new Date(status.measuredAt).toLocaleString("ko-KR")}</small>
          </>
        ) : null}
      </div>
    </MobileActivity>
  );
}
