import type { DragEvent } from "react";
import type { FilesystemBreadcrumb } from "@/types/filesystem/filesystem";
import { XP_EXPLORER_HEADER_CLASS_NAME } from "@client/constants/filesystem/explorer-header";

interface ExplorerBreadcrumbDropCapability {
  readonly targetId: string | null;
  readonly onTargetChange: (id: string | null) => void;
  readonly onDrop: (event: DragEvent, parentId: string) => void;
}

interface ExplorerBreadcrumbsProps {
  readonly items: readonly FilesystemBreadcrumb[];
  readonly onNavigate: (item: FilesystemBreadcrumb) => void;
  readonly drop?: ExplorerBreadcrumbDropCapability;
}

export function ExplorerBreadcrumbs({
  items,
  onNavigate,
  drop,
}: ExplorerBreadcrumbsProps) {
  return items.map((item, index) => (
    <span key={item.id}>
      {index > 0 ? (
        <span
          className={XP_EXPLORER_HEADER_CLASS_NAME.BREADCRUMB_SEPARATOR}
          aria-hidden="true"
        >
          {"\\"}
        </span>
      ) : null}
      <button
        type="button"
        className={XP_EXPLORER_HEADER_CLASS_NAME.BREADCRUMB}
        onClick={() => onNavigate(item)}
        data-drop-target={drop?.targetId === item.id || undefined}
        onDragEnter={
          drop
            ? (event) => {
                event.stopPropagation();
                drop.onTargetChange(item.id);
              }
            : undefined
        }
        onDragLeave={drop ? () => drop.onTargetChange(null) : undefined}
        onDragOver={drop ? (event) => event.preventDefault() : undefined}
        onDrop={drop ? (event) => drop.onDrop(event, item.id) : undefined}
      >
        {item.name}
      </button>
    </span>
  ));
}
