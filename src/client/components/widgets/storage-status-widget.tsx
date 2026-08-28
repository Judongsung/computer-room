import { useCallback, useEffect, useState, type CSSProperties } from "react";
import {
  STORAGE_FREE_REFERENCE_BYTES,
  STORAGE_MIME_CATEGORY_VALUES,
  STORAGE_OBJECT_PURPOSE_VALUES,
  STORAGE_USAGE_LIMIT_PERCENT,
} from "@/constants/storage/storage-status";
import { KOREA_LOCALE } from "@/constants/platform/date";
import type {
  StorageStatusSnapshot,
  StorageUsageValue,
} from "@/types/storage/storage-status";
import { WIDGET_TYPE as DASHBOARD_WIDGET_TYPE } from "@/constants/widgets/widget";
import {
  STORAGE_MIME_CATEGORY_COLOR,
  STORAGE_MIME_CATEGORY_LABEL,
  STORAGE_OBJECT_PURPOSE_LABEL,
  STORAGE_STATUS_CLASS_NAME,
  STORAGE_STATUS_COPY,
  STORAGE_STATUS_DATE_TIME_FORMAT_OPTIONS,
  STORAGE_STATUS_STYLE_PROPERTY,
  STORAGE_USAGE_LEVEL,
} from "@client/constants/storage/storage-status";
import { DESKTOP_ASSET_PATHS } from "@client/constants/desktop/desktop";
import { XP_WIDGET_TOOLBAR_ACTION } from "@client/constants/shared/xp";
import {
  storageGraphPercent,
  storageUsageLevel,
  storageUsagePercent,
} from "@client/domain/storage/storage-status";
import { messageFromError } from "@client/errors/error-message";
import type { WidgetComponentProps } from "@client/types/desktop/desktop";
import { formatFileSize } from "@client/utils/format-file-size";
import { XpWidgetToolbarButton } from "@client/components/shared/xp-widget-toolbar-button";
import { WidgetCard } from "@client/components/widgets/widget-card";

export function StorageStatusWidget({
  widget,
  windowControls,
  storageStatusGateway,
}: WidgetComponentProps) {
  const [status, setStatus] = useState<StorageStatusSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      setStatus(await storageStatusGateway.getStatus());
    } catch (caught) {
      setError(messageFromError(caught, STORAGE_STATUS_COPY.LOAD_FAILED));
    } finally {
      setLoading(false);
    }
  }, [storageStatusGateway]);

  useEffect(() => {
    void load();
  }, [load]);

  if (widget.type !== DASHBOARD_WIDGET_TYPE.STORAGE_STATUS) return null;

  return (
    <WidgetCard
      title={STORAGE_STATUS_COPY.TITLE}
      iconPath={DESKTOP_ASSET_PATHS.STORAGE_STATUS_ICON}
      windowControls={windowControls}
      toolbarActions={
        <XpWidgetToolbarButton
          action={XP_WIDGET_TOOLBAR_ACTION.REFRESH}
          label={STORAGE_STATUS_COPY.REFRESH}
          disabled={loading}
          onClick={() => void load()}
        />
      }
    >
      <div className={STORAGE_STATUS_CLASS_NAME.ROOT} aria-busy={loading}>
        {loading && !status ? <p>{STORAGE_STATUS_COPY.LOADING}</p> : null}
        {error ? (
          <div className="widget-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => void load()}>
              {STORAGE_STATUS_COPY.RETRY}
            </button>
          </div>
        ) : null}
        {status ? <StorageStatusContent status={status} /> : null}
      </div>
    </WidgetCard>
  );
}

function StorageStatusContent({ status }: { readonly status: StorageStatusSnapshot }) {
  const r2Percent = storageUsagePercent(
    status.r2.standard.bytes,
    STORAGE_FREE_REFERENCE_BYTES.R2_STANDARD,
  );
  const d1Percent = storageUsagePercent(
    status.d1.databaseBytes,
    STORAGE_FREE_REFERENCE_BYTES.D1_DATABASE,
  );
  return (
    <>
      <div className={STORAGE_STATUS_CLASS_NAME.SUMMARY}>
        <section className={STORAGE_STATUS_CLASS_NAME.PANEL}>
          <h3>{STORAGE_STATUS_COPY.R2_TITLE}</h3>
          <dl className={STORAGE_STATUS_CLASS_NAME.COUNTS}>
            <div>
              <dt>{STORAGE_STATUS_COPY.TOTAL_USAGE}</dt>
              <dd>
                {formatFileSize(status.r2.total.bytes)} · {status.r2.total.objectCount.toLocaleString()}
                {STORAGE_STATUS_COPY.COUNT_SUFFIX}
              </dd>
            </div>
            <div>
              <dt>{STORAGE_STATUS_COPY.STANDARD_USAGE}</dt>
              <dd>{formatFileSize(status.r2.standard.bytes)}</dd>
            </div>
          </dl>
          <UsageMeter
            label={STORAGE_STATUS_COPY.R2_FREE_REFERENCE}
            percent={r2Percent}
          />
          <small className={STORAGE_STATUS_CLASS_NAME.NOTE}>
            {STORAGE_STATUS_COPY.R2_FREE_REFERENCE_NOTE}
          </small>
        </section>
        <section className={STORAGE_STATUS_CLASS_NAME.PANEL}>
          <h3>{STORAGE_STATUS_COPY.D1_TITLE}</h3>
          <dl className={STORAGE_STATUS_CLASS_NAME.COUNTS}>
            <div>
              <dt>{STORAGE_STATUS_COPY.DATABASE_USAGE}</dt>
              <dd>{formatFileSize(status.d1.databaseBytes)}</dd>
            </div>
          </dl>
          <UsageMeter
            label={STORAGE_STATUS_COPY.D1_FREE_REFERENCE}
            percent={d1Percent}
          />
        </section>
      </div>
      <MimeGraph status={status} />
      <section className={STORAGE_STATUS_CLASS_NAME.PANEL}>
        <h3>{STORAGE_STATUS_COPY.PURPOSE_BREAKDOWN}</h3>
        <dl className={STORAGE_STATUS_CLASS_NAME.COUNTS}>
          {STORAGE_OBJECT_PURPOSE_VALUES.map((purpose) => (
            <UsageRow
              key={purpose}
              label={STORAGE_OBJECT_PURPOSE_LABEL[purpose]}
              usage={status.r2.byPurpose[purpose]}
            />
          ))}
        </dl>
      </section>
      <section className={STORAGE_STATUS_CLASS_NAME.PANEL}>
        <h3>{STORAGE_STATUS_COPY.FILESYSTEM_COUNTS}</h3>
        <dl className={STORAGE_STATUS_CLASS_NAME.COUNTS}>
          <CountRow label={STORAGE_STATUS_COPY.REGISTERED_FILES} value={status.d1.registeredFileCount} />
          <CountRow label={STORAGE_STATUS_COPY.DIRECTORIES} value={status.d1.directoryCount} />
          <CountRow label={STORAGE_STATUS_COPY.WIDGETS} value={status.d1.widgetCount} />
          <CountRow label={STORAGE_STATUS_COPY.TRASH_ITEMS} value={status.d1.trashItemCount} />
        </dl>
      </section>
      <time
        className={STORAGE_STATUS_CLASS_NAME.TIMESTAMP}
        dateTime={status.measuredAt}
      >
        {STORAGE_STATUS_COPY.MEASURED_AT}: {new Intl.DateTimeFormat(
          KOREA_LOCALE,
          STORAGE_STATUS_DATE_TIME_FORMAT_OPTIONS,
        ).format(new Date(status.measuredAt))}
      </time>
    </>
  );
}

function UsageMeter({ label, percent }: { readonly label: string; readonly percent: number }) {
  const level = storageUsageLevel(percent);
  const width = Math.min(percent, STORAGE_USAGE_LIMIT_PERCENT);
  const rounded = Number(percent.toFixed(1));
  const warning =
    level === STORAGE_USAGE_LEVEL.EXCEEDED
      ? STORAGE_STATUS_COPY.EXCEEDED
      : level === STORAGE_USAGE_LEVEL.WARNING
        ? STORAGE_STATUS_COPY.WARNING
        : null;
  return (
    <div className={`${STORAGE_STATUS_CLASS_NAME.METER} ${STORAGE_STATUS_CLASS_NAME.METER}--${level}`}>
      <div className={STORAGE_STATUS_CLASS_NAME.METER_LABEL}>
        <span>{label}</span>
        <strong>{rounded}{STORAGE_STATUS_COPY.PERCENT_SUFFIX}</strong>
      </div>
      <div
        className={STORAGE_STATUS_CLASS_NAME.METER_TRACK}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={STORAGE_USAGE_LIMIT_PERCENT}
        aria-valuenow={Math.min(rounded, STORAGE_USAGE_LIMIT_PERCENT)}
        aria-valuetext={`${rounded}${STORAGE_STATUS_COPY.PERCENT_SUFFIX}`}
      >
        <span
          className={STORAGE_STATUS_CLASS_NAME.METER_FILL}
          style={{ width: `${width}%` }}
        />
      </div>
      {warning ? <small>{warning}</small> : null}
    </div>
  );
}

function MimeGraph({ status }: { readonly status: StorageStatusSnapshot }) {
  const values = STORAGE_MIME_CATEGORY_VALUES.map((category) => ({
    category,
    usage: status.r2.byMimeCategory[category],
    percent: storageGraphPercent(
      status.r2.byMimeCategory[category].bytes,
      status.r2.total.bytes,
    ),
  }));
  return (
    <section className={STORAGE_STATUS_CLASS_NAME.PANEL}>
      <h3>{STORAGE_STATUS_COPY.MIME_BREAKDOWN}</h3>
      {status.r2.total.bytes === 0 ? (
        <p>{STORAGE_STATUS_COPY.EMPTY}</p>
      ) : (
        <>
          <div
            className={STORAGE_STATUS_CLASS_NAME.GRAPH}
            role="img"
            aria-label={STORAGE_STATUS_COPY.MIME_BREAKDOWN}
          >
            {values.filter(({ usage }) => usage.bytes > 0).map(({ category, percent }) => (
              <span
                key={category}
                className={STORAGE_STATUS_CLASS_NAME.GRAPH_SEGMENT}
                style={{
                  [STORAGE_STATUS_STYLE_PROPERTY.SEGMENT_COLOR]:
                    STORAGE_MIME_CATEGORY_COLOR[category],
                  width: `${percent}%`,
                } as CSSProperties}
              />
            ))}
          </div>
          <ul className={STORAGE_STATUS_CLASS_NAME.LEGEND}>
            {values.map(({ category, usage, percent }) => (
              <li key={category}>
                <i style={{ background: STORAGE_MIME_CATEGORY_COLOR[category] }} />
                <span>{STORAGE_MIME_CATEGORY_LABEL[category]}</span>
                <strong>{formatFileSize(usage.bytes)}</strong>
                <small>{percent.toFixed(1)}{STORAGE_STATUS_COPY.PERCENT_SUFFIX}</small>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function UsageRow({ label, usage }: { readonly label: string; readonly usage: StorageUsageValue }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{formatFileSize(usage.bytes)} · {usage.objectCount.toLocaleString()}{STORAGE_STATUS_COPY.COUNT_SUFFIX}</dd>
    </div>
  );
}

function CountRow({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value.toLocaleString()}{STORAGE_STATUS_COPY.COUNT_SUFFIX}</dd>
    </div>
  );
}
