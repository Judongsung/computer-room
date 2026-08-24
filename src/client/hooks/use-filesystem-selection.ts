import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  changeFilesystemSelection,
  orderedSelectedIds,
} from "../domain/filesystem-selection";

interface SelectionEventModifiers {
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
}

export function useFilesystemSelection(orderedIds: readonly string[]) {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const anchorId = useRef<string | null>(null);

  useEffect(() => {
    const available = new Set(orderedIds);
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => available.has(id)));
      return sameSet(current, next) ? current : next;
    });
    if (anchorId.current && !available.has(anchorId.current)) {
      anchorId.current = null;
    }
  }, [orderedIds]);

  const select = useCallback(
    (id: string, event: SelectionEventModifiers): void => {
      setSelectedIds((current) => {
        const change = changeFilesystemSelection(
          current,
          orderedIds,
          id,
          anchorId.current,
          {
            toggle: event.ctrlKey || event.metaKey,
            range: event.shiftKey,
          },
        );
        anchorId.current = change.anchorId;
        return change.selectedIds;
      });
    },
    [orderedIds],
  );

  const replace = useCallback(
    (ids: readonly string[]): void => {
      const available = new Set(orderedIds);
      const next = ids.filter((id) => available.has(id));
      setSelectedIds(new Set(next));
      anchorId.current = next.at(-1) ?? null;
    },
    [orderedIds],
  );
  const clear = useCallback((): void => {
    setSelectedIds(new Set());
    anchorId.current = null;
  }, []);
  const selectAll = useCallback((): void => {
    setSelectedIds(new Set(orderedIds));
    anchorId.current = orderedIds.at(-1) ?? null;
  }, [orderedIds]);
  const selectedInOrder = useMemo(
    () => orderedSelectedIds(selectedIds, orderedIds),
    [orderedIds, selectedIds],
  );
  const dragIds = useCallback(
    (id: string): readonly string[] =>
      selectedIds.has(id) ? selectedInOrder : [id],
    [selectedIds, selectedInOrder],
  );

  return {
    selectedIds,
    selectedInOrder,
    select,
    replace,
    clear,
    selectAll,
    dragIds,
  };
}

function sameSet(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): boolean {
  return left.size === right.size && [...left].every((id) => right.has(id));
}
