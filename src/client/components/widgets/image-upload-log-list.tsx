import { IMAGE_UPLOAD_LOG_OUTCOME } from "@/constants/integrations/image-upload-log";
import { IMAGE_UPLOAD_LOG_RETENTION } from "@/constants/integrations/image-upload-log";
import type {
  ImageUploadLog,
  ImageUploadLogOutcome,
} from "@/types/integrations/image-upload-log";
import type { ImageUploadProfile } from "@/types/integrations/image-upload-profile";
import {
  IMAGE_UPLOAD_LOG_CLASS_NAME,
  IMAGE_UPLOAD_LOG_FILTER_VALUE,
} from "@client/constants/integrations/image-upload-log";
import {
  IMAGE_UPLOAD_LOG_COPY,
  IMAGE_UPLOAD_LOG_DATE_FORMAT,
} from "@client/content/ko/integrations/image-upload-log";
import { formatFileSize } from "@client/utils/format-file-size";

interface ImageUploadLogListProps {
  readonly items: readonly ImageUploadLog[];
  readonly profiles: readonly ImageUploadProfile[];
  readonly profileId: string | null;
  readonly outcome: ImageUploadLogOutcome | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly retentionDays: number;
  readonly retentionDraft: string;
  readonly settingsLoading: boolean;
  readonly settingsSaving: boolean;
  readonly settingsError: string | null;
  readonly settingsLoadFailed: boolean;
  readonly settingsCanSave: boolean;
  readonly hasMore: boolean;
  readonly onProfileChange: (profileId: string | null) => void;
  readonly onOutcomeChange: (outcome: ImageUploadLogOutcome | null) => void;
  readonly onRetry: () => void;
  readonly onRetentionDraftChange: (value: string) => void;
  readonly onSaveSettings: () => void;
  readonly onRetrySettings: () => void;
  readonly onLoadMore: () => void;
  readonly onOpenFile: (file: NonNullable<ImageUploadLog["file"]>) => void;
}

export function ImageUploadLogList({
  items,
  profiles,
  profileId,
  outcome,
  loading,
  error,
  retentionDays,
  retentionDraft,
  settingsLoading,
  settingsSaving,
  settingsError,
  settingsLoadFailed,
  settingsCanSave,
  hasMore,
  onProfileChange,
  onOutcomeChange,
  onRetry,
  onRetentionDraftChange,
  onSaveSettings,
  onRetrySettings,
  onLoadMore,
  onOpenFile,
}: ImageUploadLogListProps) {
  const profileNames = new Map(
    profiles.map((profile) => [profile.id, profile.displayName] as const),
  );
  return (
    <div className={IMAGE_UPLOAD_LOG_CLASS_NAME.ROOT} aria-busy={loading}>
      <form
        className={IMAGE_UPLOAD_LOG_CLASS_NAME.SETTINGS}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSaveSettings();
        }}
      >
        <fieldset disabled={settingsLoading || settingsSaving}>
          <legend>{IMAGE_UPLOAD_LOG_COPY.SETTINGS_GROUP}</legend>
          <div className={IMAGE_UPLOAD_LOG_CLASS_NAME.SETTINGS_ROW}>
            <label>
              <span>{IMAGE_UPLOAD_LOG_COPY.RETENTION_DAYS}</span>
              <input
                type="number"
                min={IMAGE_UPLOAD_LOG_RETENTION.MIN_DAYS}
                max={IMAGE_UPLOAD_LOG_RETENTION.MAX_DAYS}
                step={1}
                value={retentionDraft}
                onChange={(event) =>
                  onRetentionDraftChange(event.target.value)
                }
              />
            </label>
            <button type="submit" disabled={!settingsCanSave}>
              {IMAGE_UPLOAD_LOG_COPY.SAVE_SETTINGS}
            </button>
            <small>{IMAGE_UPLOAD_LOG_COPY.RETENTION_RANGE}</small>
          </div>
          <p className={IMAGE_UPLOAD_LOG_CLASS_NAME.NOTICE}>
            {settingsLoading
              ? IMAGE_UPLOAD_LOG_COPY.SETTINGS_LOADING
              : IMAGE_UPLOAD_LOG_COPY.RETENTION_NOTICE(retentionDays)}
          </p>
          {settingsError ? (
            <div
              className={IMAGE_UPLOAD_LOG_CLASS_NAME.SETTINGS_ERROR}
              role="alert"
            >
              <span>{settingsError}</span>
              {settingsLoadFailed ? (
                <button type="button" onClick={onRetrySettings}>
                  {IMAGE_UPLOAD_LOG_COPY.RETRY}
                </button>
              ) : null}
            </div>
          ) : null}
        </fieldset>
      </form>
      <div className={IMAGE_UPLOAD_LOG_CLASS_NAME.FILTERS}>
        <label>
          <span>{IMAGE_UPLOAD_LOG_COPY.FILTER_PROFILE}</span>
          <select
            value={profileId ?? IMAGE_UPLOAD_LOG_FILTER_VALUE.ALL}
            onChange={(event) =>
              onProfileChange(event.target.value || null)
            }
          >
            <option value={IMAGE_UPLOAD_LOG_FILTER_VALUE.ALL}>
              {IMAGE_UPLOAD_LOG_COPY.ALL_PROFILES}
            </option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{IMAGE_UPLOAD_LOG_COPY.FILTER_RESULT}</span>
          <select
            value={outcome ?? IMAGE_UPLOAD_LOG_FILTER_VALUE.ALL}
            onChange={(event) =>
              onOutcomeChange(readOutcome(event.target.value))
            }
          >
            <option value={IMAGE_UPLOAD_LOG_FILTER_VALUE.ALL}>
              {IMAGE_UPLOAD_LOG_COPY.ALL_RESULTS}
            </option>
            <option value={IMAGE_UPLOAD_LOG_FILTER_VALUE.SUCCESS}>
              {IMAGE_UPLOAD_LOG_COPY.SUCCESS}
            </option>
            <option value={IMAGE_UPLOAD_LOG_FILTER_VALUE.FAILURE}>
              {IMAGE_UPLOAD_LOG_COPY.FAILURE}
            </option>
          </select>
        </label>
      </div>
      <div className={IMAGE_UPLOAD_LOG_CLASS_NAME.TABLE_WRAPPER}>
        <table className={IMAGE_UPLOAD_LOG_CLASS_NAME.TABLE}>
          <thead>
            <tr>
              <th>{IMAGE_UPLOAD_LOG_COPY.RECEIVED_AT}</th>
              <th>{IMAGE_UPLOAD_LOG_COPY.FILTER_PROFILE}</th>
              <th>{IMAGE_UPLOAD_LOG_COPY.SOURCE_IP}</th>
              <th>{IMAGE_UPLOAD_LOG_COPY.FILTER_RESULT}</th>
              <th>{IMAGE_UPLOAD_LOG_COPY.FILE_OR_ERROR}</th>
              <th>{IMAGE_UPLOAD_LOG_COPY.CONTENT_TYPE}</th>
              <th>{IMAGE_UPLOAD_LOG_COPY.SIZE}</th>
              <th>{IMAGE_UPLOAD_LOG_COPY.DURATION}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <ImageUploadLogRow
                key={item.id}
                item={item}
                profileName={
                  item.profileId
                    ? (profileNames.get(item.profileId) ?? item.profileId)
                    : IMAGE_UPLOAD_LOG_COPY.UNKNOWN_PROFILE
                }
                onOpenFile={onOpenFile}
              />
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 && !error ? (
          <p>{IMAGE_UPLOAD_LOG_COPY.EMPTY}</p>
        ) : null}
        {loading ? <p>{IMAGE_UPLOAD_LOG_COPY.LOADING}</p> : null}
        {error ? (
          <div className={IMAGE_UPLOAD_LOG_CLASS_NAME.ERROR} role="alert">
            <p>{error}</p>
            <button type="button" onClick={onRetry}>
              {IMAGE_UPLOAD_LOG_COPY.RETRY}
            </button>
          </div>
        ) : null}
      </div>
      {hasMore ? (
        <div className={IMAGE_UPLOAD_LOG_CLASS_NAME.FOOTER}>
          <button type="button" disabled={loading} onClick={onLoadMore}>
            {IMAGE_UPLOAD_LOG_COPY.LOAD_MORE}
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface ImageUploadLogRowProps {
  readonly item: ImageUploadLog;
  readonly profileName: string;
  readonly onOpenFile: (file: NonNullable<ImageUploadLog["file"]>) => void;
}

function ImageUploadLogRow({
  item,
  profileName,
  onOpenFile,
}: ImageUploadLogRowProps) {
  const succeeded = item.outcome === IMAGE_UPLOAD_LOG_OUTCOME.SUCCESS;
  const availableFile = item.file;
  return (
    <tr>
      <td>{IMAGE_UPLOAD_LOG_DATE_FORMAT.format(new Date(item.receivedAt))}</td>
      <td>{profileName}</td>
      <td>{item.sourceIp ?? IMAGE_UPLOAD_LOG_COPY.EMPTY_VALUE}</td>
      <td>
        <span
          className={[
            IMAGE_UPLOAD_LOG_CLASS_NAME.OUTCOME,
            succeeded
              ? IMAGE_UPLOAD_LOG_CLASS_NAME.OUTCOME_SUCCESS
              : IMAGE_UPLOAD_LOG_CLASS_NAME.OUTCOME_FAILURE,
          ].join(" ")}
        >
          {succeeded
            ? IMAGE_UPLOAD_LOG_COPY.SUCCESS
            : IMAGE_UPLOAD_LOG_COPY.FAILURE}
        </span>
      </td>
      <td className={IMAGE_UPLOAD_LOG_CLASS_NAME.DETAIL}>
        {succeeded ? (
          availableFile ? (
            <button type="button" onClick={() => onOpenFile(availableFile)}>
              {availableFile.name}
            </button>
          ) : (
            <>
              <span>{item.fileName}</span>
              <small>{IMAGE_UPLOAD_LOG_COPY.UNAVAILABLE_FILE}</small>
            </>
          )
        ) : (
          <>
            <span>{item.error?.message}</span>
            <small>
              {item.error?.code} · {IMAGE_UPLOAD_LOG_COPY.HTTP_STATUS(item.httpStatus)}
            </small>
          </>
        )}
      </td>
      <td>{item.contentType ?? IMAGE_UPLOAD_LOG_COPY.EMPTY_VALUE}</td>
      <td>
        {item.declaredSize === null
          ? IMAGE_UPLOAD_LOG_COPY.EMPTY_VALUE
          : formatFileSize(item.declaredSize)}
      </td>
      <td>{IMAGE_UPLOAD_LOG_COPY.MILLISECONDS(item.durationMs)}</td>
    </tr>
  );
}

function readOutcome(value: string): ImageUploadLogOutcome | null {
  if (value === IMAGE_UPLOAD_LOG_OUTCOME.SUCCESS) {
    return IMAGE_UPLOAD_LOG_OUTCOME.SUCCESS;
  }
  if (value === IMAGE_UPLOAD_LOG_OUTCOME.FAILURE) {
    return IMAGE_UPLOAD_LOG_OUTCOME.FAILURE;
  }
  return null;
}
