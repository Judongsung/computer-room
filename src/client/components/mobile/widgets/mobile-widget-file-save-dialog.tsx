import { useEffect, useState } from "react";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type {
  FilesystemBreadcrumb,
  FilesystemDirectoryEntry,
} from "@/types/filesystem/filesystem";
import type { WidgetFileDocument } from "@/types/widgets/widget-file";
import { MobileDialog } from "@client/components/mobile/shared/mobile-dialog";
import {
  LOCAL_WIDGET_DRAFT_DEFAULT_NAME,
} from "@client/constants/widgets/local-widget-draft";
import { MOBILE_CLASS_NAME, MOBILE_COPY } from "@client/constants/shared/mobile";
import { messageFromError } from "@client/errors/error-message";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import type { LocalWidgetDraft } from "@client/types/widgets/local-widget-draft";
import type { WidgetFileGateway } from "@client/types/widgets/widget-file";

interface MobileWidgetFileSaveDialogProps {
  readonly draft: LocalWidgetDraft;
  readonly filesystem: FilesystemGateway;
  readonly widgetFiles: WidgetFileGateway;
  readonly onCancel: () => void;
  readonly onSaved: (document: WidgetFileDocument) => void;
}

interface SaveDirectoryState {
  readonly directory: FilesystemDirectoryEntry;
  readonly breadcrumbs: readonly FilesystemBreadcrumb[];
  readonly children: readonly FilesystemDirectoryEntry[];
}

export function MobileWidgetFileSaveDialog({
  draft,
  filesystem,
  widgetFiles,
  onCancel,
  onSaved,
}: MobileWidgetFileSaveDialogProps) {
  const [directoryId, setDirectoryId] = useState<string>(FILESYSTEM_ROOT_ID.DESKTOP);
  const [directory, setDirectory] = useState<SaveDirectoryState | null>(null);
  const [name, setName] = useState<string>(
    draft.type === WIDGET_TYPE.MEMO
      ? LOCAL_WIDGET_DRAFT_DEFAULT_NAME.MEMO
      : LOCAL_WIDGET_DRAFT_DEFAULT_NAME.DAILY_CHECKLIST,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void listSaveDirectory(filesystem, directoryId).then(
      (next) => {
        if (!active) return;
        setDirectory(next);
        setError(null);
        setLoading(false);
      },
      (caught: unknown) => {
        if (!active) return;
        setError(messageFromError(caught, MOBILE_COPY.LOAD_FAILED));
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [directoryId, filesystem]);

  const save = async (): Promise<void> => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const input =
        draft.type === WIDGET_TYPE.MEMO
          ? {
              type: WIDGET_TYPE.MEMO,
              parentId: directoryId,
              name,
              data: { markdown: draft.markdown },
            }
          : {
              type: WIDGET_TYPE.DAILY_CHECKLIST,
              parentId: directoryId,
              name,
              data: {
                items: draft.items.map(({ label, checked }) => ({ label, checked })),
              },
            };
      onSaved(await widgetFiles.createWidgetFile(input));
    } catch (caught) {
      setError(messageFromError(caught, MOBILE_COPY.SAVE_FAILED));
      setSaving(false);
    }
  };

  return (
    <MobileDialog
      title={MOBILE_COPY.FILE_SAVE_TITLE}
      actions={
        <>
          <button type="button" disabled={saving || loading} onClick={() => void save()}>
            {saving ? MOBILE_COPY.SAVING : MOBILE_COPY.SAVE_HERE}
          </button>
          <button type="button" disabled={saving} onClick={onCancel}>{MOBILE_COPY.CANCEL}</button>
        </>
      }
    >
      <div className={MOBILE_CLASS_NAME.FORM}>
        <label className={MOBILE_CLASS_NAME.FIELD}>
          {MOBILE_COPY.FILE_NAME}
          <input value={name} disabled={saving} onChange={(event) => setName(event.currentTarget.value)} />
        </label>
        <div className={MOBILE_CLASS_NAME.FIELD}>
          <span>{MOBILE_COPY.SAVE_LOCATION}</span>
          <div className={MOBILE_CLASS_NAME.BUTTON_ROW}>
            <button type="button" onClick={() => setDirectoryId(FILESYSTEM_ROOT_ID.DESKTOP)}>
              {MOBILE_COPY.HOME_SCREEN}
            </button>
            <button type="button" onClick={() => setDirectoryId(FILESYSTEM_ROOT_ID.DOCUMENTS)}>
              {MOBILE_COPY.MY_DOCUMENTS}
            </button>
          </div>
        </div>
        {directory ? (
          <>
            <nav className={MOBILE_CLASS_NAME.BREADCRUMBS} aria-label={MOBILE_COPY.SAVE_LOCATION}>
              {directory.breadcrumbs.map((breadcrumb) => (
                <button key={breadcrumb.id} type="button" onClick={() => setDirectoryId(breadcrumb.id)}>
                  {breadcrumb.name}
                </button>
              ))}
            </nav>
            {directory.children.length ? (
              <ul className={MOBILE_CLASS_NAME.LIST}>
                {directory.children.map((child) => (
                  <li key={child.id}>
                    <button className={MOBILE_CLASS_NAME.LIST_ITEM} type="button" onClick={() => setDirectoryId(child.id)}>
                      <strong>{child.name}</strong>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>{MOBILE_COPY.NO_SUBDIRECTORIES}</p>
            )}
          </>
        ) : null}
        {loading ? <p>{MOBILE_COPY.LOADING}</p> : null}
        {error ? <p className={MOBILE_CLASS_NAME.ERROR} role="alert">{error}</p> : null}
      </div>
    </MobileDialog>
  );
}

async function listSaveDirectory(
  gateway: FilesystemGateway,
  directoryId: string,
): Promise<SaveDirectoryState> {
  const children: FilesystemDirectoryEntry[] = [];
  let offset = 0;
  let firstPage: Awaited<ReturnType<FilesystemGateway["listDirectory"]>> | null = null;
  while (true) {
    const page = await gateway.listDirectory(directoryId, offset);
    firstPage ??= page;
    children.push(
      ...page.items.filter(
        (entry): entry is FilesystemDirectoryEntry =>
          entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY,
      ),
    );
    if (page.nextOffset === null) break;
    offset = page.nextOffset;
  }
  if (!firstPage) throw new Error(MOBILE_COPY.LOAD_FAILED);
  return {
    directory: firstPage.directory,
    breadcrumbs: firstPage.breadcrumbs,
    children,
  };
}
