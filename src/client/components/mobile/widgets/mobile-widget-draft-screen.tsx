import { useState } from "react";
import { MAX_ACTIVE_CHECKLIST_ITEMS } from "@/constants/widgets/checklist";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { normalizeChecklistLabel } from "@/domain/widgets/checklist";
import type { ChecklistItem } from "@/types/widgets/widget";
import type { WidgetFileDocument } from "@/types/widgets/widget-file";
import { MobileActivity } from "@client/components/mobile/shared/mobile-activity";
import { MobileChecklist } from "@client/components/mobile/widgets/mobile-checklist";
import { MobileMemo } from "@client/components/mobile/widgets/mobile-memo";
import { MobileWidgetFileSaveDialog } from "@client/components/mobile/widgets/mobile-widget-file-save-dialog";
import { MOBILE_CLASS_NAME, MOBILE_COPY } from "@client/constants/shared/mobile";
import { LOCAL_WIDGET_DRAFT_DEFAULT_NAME } from "@client/constants/widgets/local-widget-draft";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import type { LocalWidgetDraft } from "@client/types/widgets/local-widget-draft";
import type { WidgetFileGateway } from "@client/types/widgets/widget-file";

interface MobileWidgetDraftScreenProps {
  readonly draft: LocalWidgetDraft;
  readonly filesystem: FilesystemGateway;
  readonly widgetFiles: WidgetFileGateway;
  readonly onSaveDraft: (draft: LocalWidgetDraft) => boolean;
  readonly onSavedFile: (document: WidgetFileDocument) => void;
  readonly onDirtyChange: (dirty: boolean) => void;
}

export function MobileWidgetDraftScreen({
  draft,
  filesystem,
  widgetFiles,
  onSaveDraft,
  onSavedFile,
  onDirtyChange,
}: MobileWidgetDraftScreenProps) {
  const [fileDraft, setFileDraft] = useState<LocalWidgetDraft | null>(null);
  const title =
    draft.type === WIDGET_TYPE.MEMO
      ? LOCAL_WIDGET_DRAFT_DEFAULT_NAME.MEMO
      : LOCAL_WIDGET_DRAFT_DEFAULT_NAME.DAILY_CHECKLIST;

  const persist = (next: LocalWidgetDraft): void => {
    if (!onSaveDraft(next)) throw new Error(MOBILE_COPY.DRAFT_STORAGE_FAILED);
  };

  const replaceItem = (replacement: ChecklistItem): void => {
    if (draft.type !== WIDGET_TYPE.DAILY_CHECKLIST) return;
    persist({
      ...draft,
      items: draft.items.map((item) => item.id === replacement.id ? replacement : item),
    });
  };

  return (
    <MobileActivity title={title}>
      {draft.type === WIDGET_TYPE.MEMO ? (
        <MobileMemo
          markdown={draft.markdown}
          startEditing
          onDirtyChange={onDirtyChange}
          onSave={async (markdown) => persist({ ...draft, markdown })}
          onRequestFileSave={(markdown) => {
            const next = { ...draft, markdown };
            if (onSaveDraft(next)) setFileDraft(next);
          }}
        />
      ) : (
        <MobileChecklist
          items={draft.items}
          onAdd={async (label) => {
            if (draft.items.length >= MAX_ACTIVE_CHECKLIST_ITEMS) return;
            persist({
              ...draft,
              items: [
                ...draft.items,
                { id: crypto.randomUUID(), label: normalizeChecklistLabel(label), checked: false },
              ],
            });
          }}
          onRename={async (item, label) =>
            replaceItem({ ...item, label: normalizeChecklistLabel(label) })
          }
          onDelete={async (item) =>
            persist({ ...draft, items: draft.items.filter((candidate) => candidate.id !== item.id) })
          }
          onToggle={async (item, checked) => replaceItem({ ...item, checked })}
          onRequestFileSave={() => setFileDraft(draft)}
        />
      )}
      <p className={MOBILE_CLASS_NAME.MESSAGE}>{MOBILE_COPY.STATUS_DRAFT_RETAINED}</p>
      {fileDraft ? (
        <MobileWidgetFileSaveDialog
          draft={fileDraft}
          filesystem={filesystem}
          widgetFiles={widgetFiles}
          onCancel={() => setFileDraft(null)}
          onSaved={onSavedFile}
        />
      ) : null}
    </MobileActivity>
  );
}
