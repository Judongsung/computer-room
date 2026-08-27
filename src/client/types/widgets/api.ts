import type { ChecklistGateway } from "@client/types/widgets/ports/checklist";
import type { WidgetLayoutGateway } from "@client/types/widgets/ports/layout";
import type { WidgetLifecycleGateway } from "@client/types/widgets/ports/lifecycle";
import type { MemoGateway } from "@client/types/widgets/ports/memo";
import type { SessionGateway } from "@client/types/widgets/ports/session";

export interface DashboardGateway
  extends SessionGateway,
    WidgetLayoutGateway,
    WidgetLifecycleGateway,
    MemoGateway,
    ChecklistGateway {}
