import { IMAGE_UPLOAD_PROFILE_COPY } from "@client/content/ko/integrations/image-upload-profile";
import { useState } from "react";

import {
  IMAGE_UPLOAD_PROFILE_CLASS_NAME,
} from "@client/constants/integrations/image-upload-profile";
import { DESKTOP_ASSET_PATHS } from "@client/constants/desktop/desktop";
import { useImageUploadProfiles } from "@client/hooks/integrations/use-image-upload-profiles";
import { useImageUploadLogs } from "@client/hooks/integrations/use-image-upload-logs";
import { useImageUploadLogSettings } from "@client/hooks/integrations/use-image-upload-log-settings";
import {
  IMAGE_UPLOAD_PROFILES_TAB,
  type ImageUploadProfilesTab,
} from "@client/constants/integrations/image-upload-log";
import { IMAGE_UPLOAD_LOG_COPY } from "@client/content/ko/integrations/image-upload-log";
import type { WidgetWindowControls } from "@client/types/desktop/window";
import type { ImageUploadProfileGateway } from "@client/types/integrations/image-upload-profile";
import type { ImageUploadLogGateway } from "@client/types/integrations/image-upload-log";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";

import { ConfirmDialog } from "@client/components/filesystem/filesystem-dialogs";
import { ImageUploadProfileEditor } from "@client/components/widgets/image-upload-profile-editor";
import { WidgetCard } from "@client/components/widgets/widget-card";
import { XpTabs } from "@client/components/shared/xp-tabs";
import { ImageUploadLogList } from "@client/components/widgets/image-upload-log-list";

export interface ImageUploadProfilesWidgetProps {
  readonly windowControls: WidgetWindowControls;
  readonly imageUploadProfileGateway: ImageUploadProfileGateway;
  readonly imageUploadLogGateway: ImageUploadLogGateway;
  readonly onOpenFilesystemEntry: (entry: FilesystemEntry) => void;
}

export function ImageUploadProfilesWidget({
  windowControls,
  imageUploadProfileGateway,
  imageUploadLogGateway,
  onOpenFilesystemEntry,
}: ImageUploadProfilesWidgetProps) {
  const profiles = useImageUploadProfiles(imageUploadProfileGateway);
  const [activeTab, setActiveTab] = useState<ImageUploadProfilesTab>(
    IMAGE_UPLOAD_PROFILES_TAB.PROFILES,
  );
  const logs = useImageUploadLogs(
    imageUploadLogGateway,
    activeTab === IMAGE_UPLOAD_PROFILES_TAB.LOGS,
  );
  const logSettings = useImageUploadLogSettings(
    imageUploadLogGateway,
    activeTab === IMAGE_UPLOAD_PROFILES_TAB.LOGS,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const remove = async (): Promise<void> => {
    if (await profiles.remove()) setConfirmDelete(false);
  };
  const saveLogSettings = async (): Promise<void> => {
    if (await logSettings.save()) logs.refresh();
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
          retentionDays={logSettings.retentionDays}
          retentionDraft={logSettings.draft}
          settingsLoading={logSettings.loading}
          settingsSaving={logSettings.saving}
          settingsError={logSettings.error}
          settingsLoadFailed={logSettings.loadFailed}
          hasMore={logs.nextCursor !== null}
          onProfileChange={logs.setProfileId}
          onOutcomeChange={logs.setOutcome}
          onRetry={logs.refresh}
          onRetentionDraftChange={logSettings.setDraft}
          onSaveSettings={() => void saveLogSettings()}
          onRetrySettings={() => void logSettings.load()}
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
