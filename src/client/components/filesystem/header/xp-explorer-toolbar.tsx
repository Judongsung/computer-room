import { XP_EXPLORER_HEADER_COPY } from "@client/content/ko/filesystem/explorer-header";
import { XP_EXPLORER_HEADER_CLASS_NAME } from "@client/constants/filesystem/explorer-header";
import { XpExplorerToolbarIcon } from "@client/components/filesystem/header/xp-explorer-toolbar-icon";
import type { XpExplorerToolbarItem } from "@client/types/filesystem/explorer-header";

export function XpExplorerToolbar({
  items,
}: {
  readonly items: readonly XpExplorerToolbarItem[];
}) {
  return (
    <div
      className={XP_EXPLORER_HEADER_CLASS_NAME.COMMAND_BAR}
      role="toolbar"
      aria-label={XP_EXPLORER_HEADER_COPY.COMMAND_BAR}
    >
      {items.map((item) =>
        "separator" in item ? (
          <span
            key={item.id}
            className={XP_EXPLORER_HEADER_CLASS_NAME.COMMAND_SEPARATOR}
            role="separator"
          />
        ) : (
          <button
            key={item.action}
            type="button"
            className={XP_EXPLORER_HEADER_CLASS_NAME.COMMAND}
            disabled={item.disabled}
            onClick={() => void item.onSelect()}
          >
            <XpExplorerToolbarIcon action={item.action} />
            <span>{item.label}</span>
          </button>
        ),
      )}
    </div>
  );
}
