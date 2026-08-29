import { IMAGE_UPLOAD_PROFILE_COPY } from "@client/content/ko/integrations/image-upload-profile";
import { useState } from "react";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import {
  IMAGE_UPLOAD_PROFILE_CLASS_NAME,
} from "@client/constants/integrations/image-upload-profile";
import { DESKTOP_ASSET_PATHS } from "@client/constants/desktop/desktop";
import { XP_WIDGET_TOOLBAR_ACTION } from "@client/constants/shared/xp";
import { useImageUploadProfiles } from "@client/hooks/integrations/use-image-upload-profiles";
import type { WidgetComponentProps } from "@client/types/desktop/desktop";
import { ConfirmDialog } from "@client/components/filesystem/filesystem-dialogs";
import { XpWidgetToolbarButton } from "@client/components/shared/xp-widget-toolbar-button";
import { ImageUploadProfileEditor } from "@client/components/widgets/image-upload-profile-editor";
import { WidgetCard } from "@client/components/widgets/widget-card";

export function ImageUploadProfilesWidget({
  widget,
  windowControls,
  imageUploadProfileGateway,
}: WidgetComponentProps) {
  const profiles = useImageUploadProfiles(imageUploadProfileGateway);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (widget.type !== WIDGET_TYPE.IMAGE_UPLOAD_PROFILES) return null;

  const remove = async (): Promise<void> => {
    if (await profiles.remove()) setConfirmDelete(false);
  };

  return (
    <WidgetCard
      title={IMAGE_UPLOAD_PROFILE_COPY.TITLE}
      iconPath={DESKTOP_ASSET_PATHS.IMAGE_UPLOAD_PROFILES_ICON}
      windowControls={windowControls}
      toolbarActions={
        <XpWidgetToolbarButton
          action={XP_WIDGET_TOOLBAR_ACTION.REFRESH}
          label={IMAGE_UPLOAD_PROFILE_COPY.REFRESH}
          disabled={profiles.loading || profiles.busy}
          onClick={() => void profiles.load()}
        />
      }
    >
      <div
        className={IMAGE_UPLOAD_PROFILE_CLASS_NAME.ROOT}
        aria-busy={profiles.loading || profiles.busy}
      >
        <aside className={IMAGE_UPLOAD_PROFILE_CLASS_NAME.SIDEBAR}>
          <strong>{IMAGE_UPLOAD_PROFILE_COPY.PROFILE_LIST}</strong>
          <button
            type="button"
            disabled={profiles.busy}
            onClick={profiles.beginCreate}
          >
            {IMAGE_UPLOAD_PROFILE_COPY.NEW_PROFILE}
          </button>
          <div className={IMAGE_UPLOAD_PROFILE_CLASS_NAME.LIST}>
            {profiles.profiles.map((profile) => {
              const selected = profiles.selectedProfile?.id === profile.id;
              const classes = [
                IMAGE_UPLOAD_PROFILE_CLASS_NAME.LIST_ITEM,
                selected
                  ? IMAGE_UPLOAD_PROFILE_CLASS_NAME.LIST_ITEM_SELECTED
                  : null,
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  key={profile.id}
                  type="button"
                  className={classes}
                  disabled={profiles.busy}
                  onClick={() => profiles.select(profile)}
                >
                  <span>{profile.displayName}</span>
                  <small>
                    {profile.enabled
                      ? IMAGE_UPLOAD_PROFILE_COPY.ACTIVE
                      : IMAGE_UPLOAD_PROFILE_COPY.INACTIVE}
                  </small>
                </button>
              );
            })}
          </div>
          {!profiles.loading && profiles.profiles.length === 0 ? (
            <p>{IMAGE_UPLOAD_PROFILE_COPY.EMPTY}</p>
          ) : null}
        </aside>
        <main className={IMAGE_UPLOAD_PROFILE_CLASS_NAME.EDITOR}>
          {profiles.loading && !profiles.draft ? (
            <p>{IMAGE_UPLOAD_PROFILE_COPY.LOADING}</p>
          ) : profiles.draft ? (
            <ImageUploadProfileEditor
              draft={profiles.draft}
              creating={profiles.creating}
              busy={profiles.busy}
              onChange={profiles.changeDraft}
              onSave={() => void profiles.save()}
              onDelete={() => setConfirmDelete(true)}
            />
          ) : (
            <p>{IMAGE_UPLOAD_PROFILE_COPY.SELECT_PROFILE}</p>
          )}
          {profiles.error ? (
            <div className="widget-error" role="alert">
              <p>{profiles.error}</p>
              {!profiles.draft ? (
                <button type="button" onClick={() => void profiles.load()}>
                  {IMAGE_UPLOAD_PROFILE_COPY.RETRY}
                </button>
              ) : null}
            </div>
          ) : null}
        </main>
      </div>
      {confirmDelete && profiles.selectedProfile ? (
        <ConfirmDialog
          title={IMAGE_UPLOAD_PROFILE_COPY.DELETE_TITLE}
          message={IMAGE_UPLOAD_PROFILE_COPY.DELETE_MESSAGE(
            profiles.selectedProfile.displayName,
          )}
          confirmLabel={IMAGE_UPLOAD_PROFILE_COPY.DELETE_CONFIRM}
          busy={profiles.busy}
          onConfirm={() => void remove()}
          onCancel={() => setConfirmDelete(false)}
        />
      ) : null}
    </WidgetCard>
  );
}
