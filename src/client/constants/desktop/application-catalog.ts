import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { XP_CONTEXT_MENU_COMMAND_ID } from "@client/constants/context-menu/context-menu";
import { WIDGET_ICON_PATH_BY_TYPE } from "@client/constants/desktop/desktop";
import { APPLICATION_LAUNCH_LOCATION } from "@client/constants/desktop/application";
import type { DesktopApplicationDefinition } from "@client/types/desktop/application";

const EVERY_DESKTOP_LOCATION = Object.values(APPLICATION_LAUNCH_LOCATION);

export const DESKTOP_APPLICATION_CATALOG = defineApplicationCatalog([
  application(WIDGET_TYPE.MEMO, XP_CONTEXT_MENU_COMMAND_ID.ADD_MEMO),
  application(
    WIDGET_TYPE.DAILY_CHECKLIST,
    XP_CONTEXT_MENU_COMMAND_ID.ADD_CHECKLIST,
  ),
  application(
    WIDGET_TYPE.STORAGE_STATUS,
    XP_CONTEXT_MENU_COMMAND_ID.ADD_STORAGE_STATUS,
  ),
  application(
    WIDGET_TYPE.IMAGE_UPLOAD_PROFILES,
    XP_CONTEXT_MENU_COMMAND_ID.ADD_IMAGE_UPLOAD_PROFILES,
  ),
  application(WIDGET_TYPE.ADMIN, XP_CONTEXT_MENU_COMMAND_ID.ADD_ADMIN),
] as const);

function application(
  type: DesktopApplicationDefinition["type"],
  contextCommandId: string,
): DesktopApplicationDefinition {
  return {
    type,
    iconPath: WIDGET_ICON_PATH_BY_TYPE[type],
    contextCommandId,
    launchLocations: EVERY_DESKTOP_LOCATION,
  };
}

function defineApplicationCatalog<
  const T extends readonly DesktopApplicationDefinition[],
>(
  catalog: T &
    (Exclude<DesktopApplicationDefinition["type"], T[number]["type"]> extends never
      ? unknown
      : never),
): T {
  return catalog;
}
