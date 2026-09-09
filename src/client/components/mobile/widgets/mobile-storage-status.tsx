import { STORAGE_STATUS_COPY } from "@client/content/ko/storage/storage-status";
import { UI_LOCALE } from "@client/content/ko/shared/format";
import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { MobileActivity } from "@client/components/mobile/shared/mobile-activity";
import { MOBILE_CLASS_NAME } from "@client/constants/mobile/class-names";
import { useStorageStatus } from "@client/hooks/storage/use-storage-status";
import type { StorageStatusGateway } from "@client/types/storage/storage-status";
import { formatFileSize } from "@client/utils/format-file-size";

interface MobileStorageStatusProps {
  readonly gateway: StorageStatusGateway;
}

export function MobileStorageStatus({ gateway }: MobileStorageStatusProps) {
  const { status, loading, error, refresh } = useStorageStatus(gateway);

  return (
    <MobileActivity
      title={STORAGE_STATUS_COPY.TITLE}
      actions={
        <button type="button" disabled={loading} onClick={() => void refresh()}>
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
                <div><dt>{STORAGE_STATUS_COPY.REGISTERED_FILES}</dt><dd>{status.r2.total.objectCount.toLocaleString(UI_LOCALE)}{STORAGE_STATUS_COPY.COUNT_SUFFIX}</dd></div>
              </dl>
            </section>
            <section className={MOBILE_CLASS_NAME.WIDGET_PANEL}>
              <h2>{STORAGE_STATUS_COPY.D1_TITLE}</h2>
              <dl>
                <div><dt>{STORAGE_STATUS_COPY.DATABASE_USAGE}</dt><dd>{formatFileSize(status.d1.databaseBytes)}</dd></div>
                <div><dt>{STORAGE_STATUS_COPY.DIRECTORIES}</dt><dd>{status.d1.directoryCount.toLocaleString(UI_LOCALE)}{STORAGE_STATUS_COPY.COUNT_SUFFIX}</dd></div>
                <div><dt>{STORAGE_STATUS_COPY.WIDGETS}</dt><dd>{status.d1.widgetCount.toLocaleString(UI_LOCALE)}{STORAGE_STATUS_COPY.COUNT_SUFFIX}</dd></div>
                <div><dt>{STORAGE_STATUS_COPY.TRASH_ITEMS}</dt><dd>{status.d1.trashItemCount.toLocaleString(UI_LOCALE)}{STORAGE_STATUS_COPY.COUNT_SUFFIX}</dd></div>
              </dl>
            </section>
            <small>{STORAGE_STATUS_COPY.MEASURED_AT}: {new Date(status.measuredAt).toLocaleString(UI_LOCALE)}</small>
          </>
        ) : null}
      </div>
    </MobileActivity>
  );
}
