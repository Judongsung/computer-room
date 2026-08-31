import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { useState } from "react";
import type { WidgetType } from "@/types/widgets/widget";
import { APPLICATION_NAME_BY_TYPE } from "@client/content/ko/desktop/application";
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
import {
  DESKTOP_APPLICATION_CATALOG,
} from "@client/constants/desktop/application-catalog";
import { APPLICATION_LAUNCH_LOCATION } from "@client/constants/desktop/application";

interface MyComputerWindowProps extends SystemWindowChromeProps {
  readonly onLaunchApplication: (type: WidgetType) => void;
}

export function MyComputerWindow({
  onLaunchApplication,
  ...chrome
}: MyComputerWindowProps) {
  const contextMenu = useXpContextMenu();
  const [selectedType, setSelectedType] = useState<WidgetType | null>(null);
  const runSelectedApplication = (): void => {
    if (selectedType) onLaunchApplication(selectedType);
  };
  const model = buildMyComputerExplorerHeaderModel(Boolean(selectedType), {
    runApplication: runSelectedApplication,
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
      <div className="application-catalog">
        {DESKTOP_APPLICATION_CATALOG.filter(({ launchLocations }) =>
          launchLocations.includes(APPLICATION_LAUNCH_LOCATION.MY_COMPUTER),
        ).map(({ type, iconPath }) => (
          <button
            key={type}
            type="button"
            className={type === selectedType ? "application-catalog__item application-catalog__item--selected" : "application-catalog__item"}
            onClick={() => setSelectedType(type)}
            onDoubleClick={() => onLaunchApplication(type)}
            onContextMenu={(event) =>
              contextMenu.openFromEvent(event, [
                contextMenuCommand(
                  XP_CONTEXT_MENU_COMMAND_ID.OPEN,
                  FILESYSTEM_COPY.RUN_APPLICATION,
                  () => onLaunchApplication(type),
                ),
              ])
            }
          >
            <img src={iconPath} alt="" />
            <span>{APPLICATION_NAME_BY_TYPE[type]}</span>
          </button>
        ))}
      </div>
    </SystemAppWindow>
  );
}
