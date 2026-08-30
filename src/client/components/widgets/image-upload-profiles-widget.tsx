import { IMAGE_UPLOAD_PROFILE_COPY } from "@client/content/ko/integrations/image-upload-profile";
import { useState } from "react";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import {
  IMAGE_UPLOAD_PROFILE_CLASS_NAME,
} from "@client/constants/integrations/image-upload-profile";
import { DESKTOP_ASSET_PATHS } from "@client/constants/desktop/desktop";
import { useImageUploadProfiles } from "@client/hooks/integrations/use-image-upload-profiles";
import { useImageUploadLogs } from "@client/hooks/integrations/use-image-upload-logs";
import {
  IMAGE_UPLOAD_PROFILES_TAB,
  type ImageUploadProfilesTab,
} from "@client/constants/integrations/image-upload-log";
import { IMAGE_UPLOAD_LOG_COPY } from "@client/content/ko/integrations/image-upload-log";
import type { WidgetComponentProps } from "@client/types/desktop/desktop";
import { ConfirmDialog } from "@client/components/filesystem/filesystem-dialogs";
import { ImageUploadProfileEditor } from "@client/components/widgets/image-upload-profile-editor";
import { WidgetCard } from "@client/components/widgets/widget-card";
import { XpTabs } from "@client/components/shared/xp-tabs";
import { ImageUploadLogList } from "@client/components/widgets/image-upload-log-list";

export function ImageUploadProfilesWidget({
  widget,
  windowControls,
  imageUploadProfileGateway,
  imageUploadLogGateway,
  onOpenFilesystemEntry,
}: WidgetComponentProps) {
  const profiles = useImageUploadProfiles(imageUploadProfileGateway);
  const [activeTab, setActiveTab] = useState<ImageUploadProfilesTab>(
    IMAGE_UPLOAD_PROFILES_TAB.PROFILES,
  );
  const logs = useImageUploadLogs(
    imageUploadLogGateway,
    activeTab === IMAGE_UPLOAD_PROFILES_TAB.LOGS,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (widget.type !== WIDGET_TYPE.IMAGE_UPLOAD_PROFILES) return null;

  const remove = async (): Promise<void> => {
    if (await profiles.remove()) setConfirmDelete(false);
  };

  const profilePanel = (
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
  );
  const tabs = [
    {
      id: IMAGE_UPLOAD_PROFILES_TAB.PROFILES,
      label: IMAGE_UPLOAD_LOG_COPY.PROFILES_TAB,
      panel: profilePanel,
    },
    {
      id: IMAGE_UPLOAD_PROFILES_TAB.LOGS,
      label: IMAGE_UPLOAD_LOG_COPY.LOGS_TAB,
      panel: (
        <ImageUploadLogList
          items={logs.items}
          profiles={profiles.profiles}
          profileId={logs.profileId}
          outcome={logs.outcome}
          loading={logs.loading}
          error={logs.error}
          hasMore={logs.nextCursor !== null}
          onProfileChange={logs.setProfileId}
          onOutcomeChange={logs.setOutcome}
          onRetry={logs.refresh}
          onLoadMore={logs.loadMore}
          onOpenFile={onOpenFilesystemEntry}
        />
      ),
    },
  ] as const;

  return (
    <WidgetCard
      title={IMAGE_UPLOAD_PROFILE_COPY.TITLE}
      iconPath={DESKTOP_ASSET_PATHS.IMAGE_UPLOAD_PROFILES_ICON}
      windowControls={windowControls}
    >
      <XpTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        ariaLabel={IMAGE_UPLOAD_LOG_COPY.TABS_LABEL}
        className={IMAGE_UPLOAD_PROFILE_CLASS_NAME.TABS}
      />
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
