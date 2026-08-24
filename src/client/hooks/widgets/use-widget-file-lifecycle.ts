import { useCallback, useState } from "react";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { WIDGET_BEHAVIOR } from "@/constants/widgets/widget";
import type { DashboardWidget } from "@/types/widgets/widget";
import type { DesktopPlacement } from "@/types/filesystem/filesystem";

interface WidgetFileLifecycleOptions {
  readonly widgets: readonly DashboardWidget[];
  readonly desktopPlacement: () => DesktopPlacement;
  readonly onSaveFile: (widgetId: string, input: { readonly parentId: string; readonly name: string; readonly desktopPlacement?: DesktopPlacement }) => Promise<void>;
  readonly onClose: (widgetId: string) => Promise<void>;
  readonly onDiscard: (widgetId: string) => Promise<void>;
  readonly onFilesystemChanged: () => void;
  readonly onWindowClosed: (widgetId: string) => void;
  readonly onError: (error: unknown) => void;
}

export function useWidgetFileLifecycle({
  widgets,
  desktopPlacement,
  onSaveFile,
  onClose,
  onDiscard,
  onFilesystemChanged,
  onWindowClosed,
  onError,
}: WidgetFileLifecycleOptions) {
  const [saveWidgetId, setSaveWidgetId] = useState<string | null>(null);
  const [closePromptWidgetId, setClosePromptWidgetId] = useState<string | null>(null);
  const [closeAfterSaveWidgetId, setCloseAfterSaveWidgetId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const requestClose = useCallback((widgetId: string): void => {
    const widget = widgets.find((candidate) => candidate.id === widgetId);
    if (!widget) return;
    if (!widget.file && !WIDGET_BEHAVIOR[widget.type].persistsWithoutFile) {
      setClosePromptWidgetId(widgetId);
      return;
    }
    void onClose(widgetId)
      .then(() => onWindowClosed(widgetId))
      .catch(onError);
  }, [onClose, onError, onWindowClosed, widgets]);

  const save = useCallback(async (parentId: string, name: string): Promise<void> => {
    if (!saveWidgetId) return;
    setBusy(true);
    try {
      await onSaveFile(saveWidgetId, {
        parentId,
        name,
        ...(parentId === FILESYSTEM_ROOT_ID.DESKTOP
          ? { desktopPlacement: desktopPlacement() }
          : {}),
      });
      onFilesystemChanged();
      const shouldClose = closeAfterSaveWidgetId === saveWidgetId;
      setSaveWidgetId(null);
      setCloseAfterSaveWidgetId(null);
      if (shouldClose) {
        await onClose(saveWidgetId);
        onWindowClosed(saveWidgetId);
      }
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }, [closeAfterSaveWidgetId, desktopPlacement, onClose, onError, onFilesystemChanged, onSaveFile, onWindowClosed, saveWidgetId]);

  const chooseSave = useCallback((): void => {
    if (!closePromptWidgetId) return;
    setCloseAfterSaveWidgetId(closePromptWidgetId);
    setSaveWidgetId(closePromptWidgetId);
    setClosePromptWidgetId(null);
  }, [closePromptWidgetId]);

  const discard = useCallback((): void => {
    if (!closePromptWidgetId) return;
    const widgetId = closePromptWidgetId;
    setBusy(true);
    void onDiscard(widgetId)
      .then(() => {
        onWindowClosed(widgetId);
        setClosePromptWidgetId(null);
      })
      .catch(onError)
      .finally(() => setBusy(false));
  }, [closePromptWidgetId, onDiscard, onError, onWindowClosed]);

  const cancelSave = useCallback((): void => {
    if (busy) return;
    setSaveWidgetId(null);
    setCloseAfterSaveWidgetId(null);
  }, [busy]);

  return {
    saveWidgetId,
    closePromptWidgetId,
    busy,
    requestClose,
    beginSave: setSaveWidgetId,
    save,
    chooseSave,
    discard,
    cancelSave,
    cancelClose: () => setClosePromptWidgetId(null),
  } as const;
}
