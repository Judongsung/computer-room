import {
  IMAGE_UPLOAD_CONTENT_TYPE_LABEL,
  IMAGE_UPLOAD_PROFILE_COPY,
  IMAGE_UPLOAD_ROOT_LABEL,
} from "@client/content/ko/integrations/image-upload-profile";
import { useMemo, useState, type FormEvent } from "react";
import {
  IMAGE_UPLOAD_CONTENT_TYPE_VALUES,
  IMAGE_UPLOAD_PROFILE_ROOT_IDS,
} from "@/constants/integrations/image-upload-profile";
import { isImageUploadProfileRootId } from "@/domain/integrations/image-upload-profile";
import type { ImageUploadContentType } from "@/types/integrations/image-upload-profile";
import {
  IMAGE_UPLOAD_PROFILE_CLASS_NAME,
  IMAGE_UPLOAD_PROFILE_FIELD_ID,
} from "@client/constants/integrations/image-upload-profile";
import { XP_TABS_CLASS_NAME } from "@client/constants/shared/xp-tabs";
import {
  imageUploadProfilePreview,
  imageUploadProfileUrl,
} from "@client/domain/integrations/image-upload-profile";
import type { ImageUploadProfileDraft } from "@client/types/integrations/image-upload-profile";

interface ImageUploadProfileEditorProps {
  readonly draft: ImageUploadProfileDraft;
  readonly creating: boolean;
  readonly busy: boolean;
  readonly onChange: (change: Partial<ImageUploadProfileDraft>) => void;
  readonly onSave: () => void;
  readonly onDelete: () => void;
}

export function ImageUploadProfileEditor({
  draft,
  creating,
  busy,
  onChange,
  onSave,
  onDelete,
}: ImageUploadProfileEditorProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const preview = useMemo(() => {
    try {
      return imageUploadProfilePreview(draft);
    } catch {
      return null;
    }
  }, [draft]);
  const uploadUrl = draft.id
    ? imageUploadProfileUrl(window.location.origin, draft.id)
    : "";

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    onSave();
  };

  const copyUrl = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(uploadUrl);
      setNotice(IMAGE_UPLOAD_PROFILE_COPY.COPY_COMPLETE);
    } catch {
      setNotice(IMAGE_UPLOAD_PROFILE_COPY.COPY_FAILED);
    }
  };

  return (
    <form
      className={IMAGE_UPLOAD_PROFILE_CLASS_NAME.FORM}
      onSubmit={submit}
    >
      <div className={IMAGE_UPLOAD_PROFILE_CLASS_NAME.FORM_FIELDS}>
        <label
          className={IMAGE_UPLOAD_PROFILE_CLASS_NAME.FIELD}
          htmlFor={IMAGE_UPLOAD_PROFILE_FIELD_ID.ID}
        >
          <span>{IMAGE_UPLOAD_PROFILE_COPY.ID}</span>
          <input
            id={IMAGE_UPLOAD_PROFILE_FIELD_ID.ID}
            value={draft.id}
            readOnly={!creating}
            required
            onChange={(event) => onChange({ id: event.target.value })}
          />
          <small className={IMAGE_UPLOAD_PROFILE_CLASS_NAME.HELP}>
            {IMAGE_UPLOAD_PROFILE_COPY.ID_HELP}
          </small>
        </label>
        <label
          className={IMAGE_UPLOAD_PROFILE_CLASS_NAME.FIELD}
          htmlFor={IMAGE_UPLOAD_PROFILE_FIELD_ID.DISPLAY_NAME}
        >
          <span>{IMAGE_UPLOAD_PROFILE_COPY.DISPLAY_NAME}</span>
          <input
            id={IMAGE_UPLOAD_PROFILE_FIELD_ID.DISPLAY_NAME}
            value={draft.displayName}
            required
            onChange={(event) => onChange({ displayName: event.target.value })}
          />
        </label>
        <label
          className={IMAGE_UPLOAD_PROFILE_CLASS_NAME.FIELD}
          htmlFor={IMAGE_UPLOAD_PROFILE_FIELD_ID.ROOT}
        >
          <span>{IMAGE_UPLOAD_PROFILE_COPY.ROOT}</span>
          <select
            id={IMAGE_UPLOAD_PROFILE_FIELD_ID.ROOT}
            value={draft.rootId}
            onChange={(event) => {
              if (isImageUploadProfileRootId(event.target.value)) {
                onChange({ rootId: event.target.value });
              }
            }}
          >
            {IMAGE_UPLOAD_PROFILE_ROOT_IDS.map((rootId) => (
              <option key={rootId} value={rootId}>
                {IMAGE_UPLOAD_ROOT_LABEL[rootId]}
              </option>
            ))}
          </select>
        </label>
        <label
          className={IMAGE_UPLOAD_PROFILE_CLASS_NAME.FIELD}
          htmlFor={IMAGE_UPLOAD_PROFILE_FIELD_ID.PATH_TEMPLATE}
        >
          <span>{IMAGE_UPLOAD_PROFILE_COPY.PATH_TEMPLATE}</span>
          <input
            id={IMAGE_UPLOAD_PROFILE_FIELD_ID.PATH_TEMPLATE}
            value={draft.pathTemplate}
            onChange={(event) => onChange({ pathTemplate: event.target.value })}
          />
          <small className={IMAGE_UPLOAD_PROFILE_CLASS_NAME.HELP}>
            {IMAGE_UPLOAD_PROFILE_COPY.PATH_TEMPLATE_HELP}
          </small>
        </label>
        <label
          className={IMAGE_UPLOAD_PROFILE_CLASS_NAME.FIELD}
          htmlFor={IMAGE_UPLOAD_PROFILE_FIELD_ID.FILE_NAME_TEMPLATE}
        >
          <span>{IMAGE_UPLOAD_PROFILE_COPY.FILE_NAME_TEMPLATE}</span>
          <input
            id={IMAGE_UPLOAD_PROFILE_FIELD_ID.FILE_NAME_TEMPLATE}
            value={draft.fileNameTemplate}
            required
            onChange={(event) =>
              onChange({ fileNameTemplate: event.target.value })
            }
          />
        </label>
        <fieldset className={IMAGE_UPLOAD_PROFILE_CLASS_NAME.GROUP}>
          <legend>{IMAGE_UPLOAD_PROFILE_COPY.CONTENT_TYPES}</legend>
          <div className={IMAGE_UPLOAD_PROFILE_CLASS_NAME.MIME_LIST}>
            {IMAGE_UPLOAD_CONTENT_TYPE_VALUES.map((contentType) => (
              <label key={contentType}>
                <input
                  type="checkbox"
                  checked={draft.contentTypes.includes(contentType)}
                  onChange={() =>
                    onChange({
                      contentTypes: toggleContentType(
                        draft.contentTypes,
                        contentType,
                      ),
                    })
                  }
                />
                {IMAGE_UPLOAD_CONTENT_TYPE_LABEL[contentType]}
              </label>
            ))}
          </div>
        </fieldset>
        <label
          className={IMAGE_UPLOAD_PROFILE_CLASS_NAME.ENABLED}
          htmlFor={IMAGE_UPLOAD_PROFILE_FIELD_ID.ENABLED}
        >
          <input
            id={IMAGE_UPLOAD_PROFILE_FIELD_ID.ENABLED}
            type="checkbox"
            checked={draft.enabled}
            onChange={(event) => onChange({ enabled: event.target.checked })}
          />
          {IMAGE_UPLOAD_PROFILE_COPY.ENABLED}
        </label>
        <fieldset
          className={`${IMAGE_UPLOAD_PROFILE_CLASS_NAME.GROUP} ${IMAGE_UPLOAD_PROFILE_CLASS_NAME.PREVIEW}`}
        >
          <legend>{IMAGE_UPLOAD_PROFILE_COPY.PREVIEW}</legend>
          <div className={IMAGE_UPLOAD_PROFILE_CLASS_NAME.GROUP_CONTENT}>
            <output>
              {preview ?? IMAGE_UPLOAD_PROFILE_COPY.PREVIEW_INVALID}
            </output>
          </div>
        </fieldset>
        <fieldset
          className={`${IMAGE_UPLOAD_PROFILE_CLASS_NAME.GROUP} ${IMAGE_UPLOAD_PROFILE_CLASS_NAME.URL}`}
        >
          <legend>{IMAGE_UPLOAD_PROFILE_COPY.UPLOAD_URL}</legend>
          <div className={IMAGE_UPLOAD_PROFILE_CLASS_NAME.GROUP_CONTENT}>
            <output>{uploadUrl}</output>
            <button
              type="button"
              disabled={!uploadUrl}
              onClick={() => void copyUrl()}
            >
              {IMAGE_UPLOAD_PROFILE_COPY.COPY_URL}
            </button>
          </div>
        </fieldset>
        {notice ? (
          <p className={IMAGE_UPLOAD_PROFILE_CLASS_NAME.NOTICE} role="status">
            {notice}
          </p>
        ) : null}
      </div>
      <div className={XP_TABS_CLASS_NAME.PANEL_ACTIONS}>
        {!creating ? (
          <button type="button" disabled={busy} onClick={onDelete}>
            {IMAGE_UPLOAD_PROFILE_COPY.DELETE}
          </button>
        ) : null}
        <button type="submit" disabled={busy}>
          {busy
            ? IMAGE_UPLOAD_PROFILE_COPY.SAVING
            : IMAGE_UPLOAD_PROFILE_COPY.SAVE}
        </button>
      </div>
    </form>
  );
}

function toggleContentType(
  selected: readonly string[],
  contentType: ImageUploadContentType,
): readonly string[] {
  return selected.includes(contentType)
    ? selected.filter((candidate) => candidate !== contentType)
    : [...selected, contentType];
}
