import type { WidgetType } from "@/types/widgets/widget";
import type { APPLICATION_LAUNCH_LOCATION } from "@client/constants/desktop/application";

export type ApplicationLaunchLocation =
  (typeof APPLICATION_LAUNCH_LOCATION)[keyof typeof APPLICATION_LAUNCH_LOCATION];

export interface DesktopApplicationDefinition {
  readonly type: WidgetType;
  readonly iconPath: string;
  readonly contextCommandId: string;
  readonly launchLocations: readonly ApplicationLaunchLocation[];
}
