import type { FilesystemBreadcrumb } from "@/types/filesystem/filesystem";
import { XP_EXPLORER_HEADER_CLASS_NAME } from "@client/constants/filesystem/explorer-header";

import type { FilesystemDirectoryDropCapability } from "@client/types/filesystem/drag";

interface ExplorerBreadcrumbsProps {
  readonly items: readonly FilesystemBreadcrumb[];
  readonly onNavigate: (item: FilesystemBreadcrumb) => void;
  readonly drop?: FilesystemDirectoryDropCapability;
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
        {...drop?.targets.getProps<HTMLButtonElement>(
          item.id,
          (event) => drop.onDrop(event, item.id),
          { disabled: drop.disabled },
        )}
      >
        {item.name}
      </button>
    </span>
  ));
}
