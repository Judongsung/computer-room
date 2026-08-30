import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { useState } from "react";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { WidgetType } from "@/types/widgets/widget";
import { WIDGET_TITLE_BY_TYPE } from "@client/content/ko/widgets/content";
import { WIDGET_ICON_PATH_BY_TYPE } from "@client/constants/desktop/desktop";
import {
  SYSTEM_APP_CONFIG,
  SYSTEM_APP_ID,
} from "@client/constants/desktop/system-app";
import { XP_EXPLORER_HEADER_CLASS_NAME } from "@client/constants/filesystem/explorer-header";
import { SYSTEM_APP_TITLE_BY_ID } from "@client/content/ko/desktop/system-app";
import type { SystemWindowChromeProps } from "@client/types/desktop/system-app";
import { SystemAppWindow } from "@client/components/desktop/system-app-window";
import { XpExplorerHeader } from "@client/components/filesystem/header/xp-explorer-header";
import { useXpContextMenu } from "@client/state/context-menu/context-menu-context";
import { contextMenuCommand } from "@client/domain/context-menu/context-menu";
import { XP_CONTEXT_MENU_COMMAND_ID } from "@client/constants/context-menu/context-menu";
import { buildMyComputerExplorerHeaderModel } from "@client/domain/filesystem/explorer-header-menu";

const WIDGET_CATALOG = [
  WIDGET_TYPE.MEMO,
  WIDGET_TYPE.DAILY_CHECKLIST,
  WIDGET_TYPE.STORAGE_STATUS,
  WIDGET_TYPE.IMAGE_UPLOAD_PROFILES,
] as const;

interface MyComputerWindowProps extends SystemWindowChromeProps {
  readonly onAddWidget: (type: WidgetType) => void;
}

export function MyComputerWindow({
  onAddWidget,
  ...chrome
}: MyComputerWindowProps) {
  const contextMenu = useXpContextMenu();
  const [selectedType, setSelectedType] = useState<WidgetType | null>(null);
  const runSelectedWidget = (): void => {
    if (selectedType) onAddWidget(selectedType);
  };
  const model = buildMyComputerExplorerHeaderModel(Boolean(selectedType), {
    runWidget: runSelectedWidget,
    close: chrome.onClose,
  });
  return (
    <SystemAppWindow
      {...chrome}
      appId={SYSTEM_APP_ID.MY_COMPUTER}
      bodyClassName="my-computer__body"
      toolbarClassName={XP_EXPLORER_HEADER_CLASS_NAME.FRAME_TOOLBAR}
      toolbar={
        <XpExplorerHeader
          menus={model.menus}
          toolbarItems={model.toolbarItems}
          locationIconPath={SYSTEM_APP_CONFIG[SYSTEM_APP_ID.MY_COMPUTER].iconPath}
          address={SYSTEM_APP_TITLE_BY_ID[SYSTEM_APP_ID.MY_COMPUTER]}
        />
      }
    >
      <p>{FILESYSTEM_COPY.MY_COMPUTER_DESCRIPTION}</p>
      <div className="widget-catalog">
        {WIDGET_CATALOG.map((type) => (
          <button
            key={type}
            type="button"
            className={type === selectedType ? "widget-catalog__item widget-catalog__item--selected" : "widget-catalog__item"}
            onClick={() => setSelectedType(type)}
            onDoubleClick={() => onAddWidget(type)}
            onContextMenu={(event) =>
              contextMenu.openFromEvent(event, [
                contextMenuCommand(
                  XP_CONTEXT_MENU_COMMAND_ID.OPEN,
                  FILESYSTEM_COPY.RUN_WIDGET,
                  () => onAddWidget(type),
                ),
              ])
            }
          >
            <img src={WIDGET_ICON_PATH_BY_TYPE[type]} alt="" />
            <span>{WIDGET_TITLE_BY_TYPE[type]}</span>
          </button>
        ))}
      </div>
    </SystemAppWindow>
  );
}
