import { GUEST_PUBLICATION_STATE } from "@/constants/admin/guest-access";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { GuestAccessEntry } from "@/types/admin/guest-access";
import {
  ADMIN_APPLICATION_COPY,
  GUEST_ACCESS_COPY,
} from "@client/content/ko/admin/guest-access";
import {
  ADMIN_APPLICATION_TAB,
  GUEST_ACCESS_CLASS_NAME,
} from "@client/constants/admin/guest-access";
import {
  DESKTOP_ASSET_PATHS,
  WIDGET_ICON_PATH_BY_TYPE,
} from "@client/constants/desktop/desktop";
import { useGuestAccessAdmin } from "@client/hooks/admin/use-guest-access-admin";
import type { WidgetComponentProps } from "@client/types/desktop/desktop";
import { ConfirmDialog } from "@client/components/filesystem/filesystem-dialogs";
import { XpTabs } from "@client/components/shared/xp-tabs";
import { XpCheckbox } from "@client/components/shared/xp-checkbox";
import { XpExplorerAddressBar } from "@client/components/filesystem/header/xp-explorer-address-bar";
import { XP_EXPLORER_HEADER_CLASS_NAME } from "@client/constants/filesystem/explorer-header";
import { WidgetCard } from "@client/components/widgets/widget-card";

export function AdminApplication({
  widget,
  windowControls,
  guestAccessGateway,
}: WidgetComponentProps) {
  const controller = useGuestAccessAdmin(guestAccessGateway);
  if (widget.type !== WIDGET_TYPE.ADMIN) return null;

  const panel = (
    <div className={GUEST_ACCESS_CLASS_NAME.ROOT} aria-busy={controller.loading}>
      <section className={GUEST_ACCESS_CLASS_NAME.SETTINGS}>
        <XpCheckbox
          checked={controller.settings?.enabled ?? false}
          disabled={!controller.settings || controller.settingsBusy}
          label={<strong>{GUEST_ACCESS_COPY.ENABLE}</strong>}
          onCheckedChange={(checked) => void controller.updateEnabled(checked)}
        />
        <p>
          {controller.settings?.enabled
            ? GUEST_ACCESS_COPY.ENABLED
            : GUEST_ACCESS_COPY.DISABLED}
        </p>
        <small>{GUEST_ACCESS_COPY.NOT_ACTIVE_YET}</small>
      </section>
      <nav className={GUEST_ACCESS_CLASS_NAME.ROOTS}>
        <button
          type="button"
          onClick={() => controller.navigate(FILESYSTEM_ROOT_ID.DESKTOP)}
        >
          {GUEST_ACCESS_COPY.DESKTOP_ROOT}
        </button>
        <button
          type="button"
          onClick={() => controller.navigate(FILESYSTEM_ROOT_ID.DOCUMENTS)}
        >
          {GUEST_ACCESS_COPY.DOCUMENTS_ROOT}
        </button>
      </nav>
      {controller.page ? (
        <>
          <XpExplorerAddressBar
            locationIconPath={DESKTOP_ASSET_PATHS.FOLDER_ICON}
            address={controller.page.breadcrumbs.map((item, index) => (
              <span key={item.id}>
                {index > 0 ? (
                  <span
                    className={
                      XP_EXPLORER_HEADER_CLASS_NAME.BREADCRUMB_SEPARATOR
                    }
                    aria-hidden="true"
                  >
                    {"\\"}
                  </span>
                ) : null}
                <button
                  type="button"
                  className={XP_EXPLORER_HEADER_CLASS_NAME.BREADCRUMB}
                  onClick={() => controller.navigate(item.id)}
                >
                  {item.name}
                </button>
              </span>
            ))}
          />
          <div className={GUEST_ACCESS_CLASS_NAME.LIST} role="list">
            {controller.page.items.map((item) => (
              <GuestAccessRow
                key={item.entry.id}
                item={item}
                busy={controller.entryBusyId === item.entry.id}
                onOpen={() => controller.navigate(item.entry.id)}
                onToggle={() => controller.requestPublicationChange(item)}
              />
            ))}
            {!controller.loading && controller.page.items.length === 0 ? (
              <p className={GUEST_ACCESS_CLASS_NAME.EMPTY}>
                {GUEST_ACCESS_COPY.EMPTY}
              </p>
            ) : null}
          </div>
          {controller.page.nextOffset !== null ? (
            <button
              type="button"
              className={GUEST_ACCESS_CLASS_NAME.LOAD_MORE}
              disabled={controller.loadingMore}
              onClick={() => void controller.loadMore()}
            >
              {controller.loadingMore
                ? GUEST_ACCESS_COPY.LOADING_MORE
                : GUEST_ACCESS_COPY.LOAD_MORE}
            </button>
          ) : null}
        </>
      ) : controller.loading ? (
        <p>{GUEST_ACCESS_COPY.LOADING}</p>
      ) : null}
      {controller.error ? (
        <div className="widget-error" role="alert">
          <p>{controller.error}</p>
          <button type="button" onClick={() => void controller.retry()}>
            {GUEST_ACCESS_COPY.RETRY}
          </button>
        </div>
      ) : null}
    </div>
  );
  const pending = controller.pendingDirectoryChange;

  return (
    <WidgetCard
      title={ADMIN_APPLICATION_COPY.TITLE}
      iconPath={DESKTOP_ASSET_PATHS.ADMIN_ICON}
      windowControls={windowControls}
    >
      <XpTabs
        tabs={[
          {
            id: ADMIN_APPLICATION_TAB.GUEST_ACCESS,
            label: ADMIN_APPLICATION_COPY.GUEST_ACCESS_TAB,
            panel,
          },
        ]}
        activeTab={ADMIN_APPLICATION_TAB.GUEST_ACCESS}
        onChange={() => undefined}
        ariaLabel={ADMIN_APPLICATION_COPY.TABS_LABEL}
        className={GUEST_ACCESS_CLASS_NAME.TABS}
      />
      {pending ? (
        <ConfirmDialog
          title={
            pending.published
              ? GUEST_ACCESS_COPY.PUBLISH_DIRECTORY_TITLE
              : GUEST_ACCESS_COPY.UNPUBLISH_DIRECTORY_TITLE
          }
          message={
            pending.published
              ? GUEST_ACCESS_COPY.PUBLISH_DIRECTORY_MESSAGE
              : GUEST_ACCESS_COPY.UNPUBLISH_DIRECTORY_MESSAGE
          }
          confirmLabel={
            pending.published
              ? GUEST_ACCESS_COPY.PUBLISH
              : GUEST_ACCESS_COPY.UNPUBLISH
          }
          cancelLabel={GUEST_ACCESS_COPY.CANCEL}
          busy={false}
          onConfirm={() => void controller.confirmDirectoryChange()}
          onCancel={controller.cancelDirectoryChange}
        />
      ) : null}
    </WidgetCard>
  );
}

function GuestAccessRow({
  item,
  busy,
  onOpen,
  onToggle,
}: {
  readonly item: GuestAccessEntry;
  readonly busy: boolean;
  readonly onOpen: () => void;
  readonly onToggle: () => void;
}) {
  const entry = item.entry;
  const iconPath =
    entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY
      ? DESKTOP_ASSET_PATHS.FOLDER_ICON
      : entry.kind === FILESYSTEM_ENTRY_KIND.WIDGET
        ? WIDGET_ICON_PATH_BY_TYPE[entry.widgetType]
        : DESKTOP_ASSET_PATHS.FILE_ICON;
  const nameContent = (
    <>
      <img src={iconPath} alt="" />
      <span>{entry.name}</span>
    </>
  );
  return (
    <div className={GUEST_ACCESS_CLASS_NAME.ROW} role="listitem">
      <PublicationCheckbox item={item} busy={busy} onToggle={onToggle} />
      {entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY ? (
        <button
          type="button"
          className={GUEST_ACCESS_CLASS_NAME.ROW_NAME}
          onDoubleClick={onOpen}
        >
          {nameContent}
        </button>
      ) : (
        <span className={GUEST_ACCESS_CLASS_NAME.ROW_NAME}>{nameContent}</span>
      )}
      <small className={GUEST_ACCESS_CLASS_NAME.ROW_META}>
        {GUEST_ACCESS_COPY.ENTRY_KIND[entry.kind]}
      </small>
      <small className={GUEST_ACCESS_CLASS_NAME.STATUS}>
        {GUEST_ACCESS_COPY.STATE[item.publicationState]}
      </small>
    </div>
  );
}

function PublicationCheckbox({
  item,
  busy,
  onToggle,
}: {
  readonly item: GuestAccessEntry;
  readonly busy: boolean;
  readonly onToggle: () => void;
}) {
  const partial =
    item.publicationState === GUEST_PUBLICATION_STATE.PARTIAL;
  return (
    <XpCheckbox
      checked={item.publicationState === GUEST_PUBLICATION_STATE.PUBLIC}
      disabled={busy}
      indeterminate={partial}
      label={`${item.entry.name} ${GUEST_ACCESS_COPY.STATE[item.publicationState]}`}
      labelVisuallyHidden
      onCheckedChange={onToggle}
    />
  );
}
